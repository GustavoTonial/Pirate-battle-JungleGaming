import { Application, Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js';
import type { GameConfig } from '@/config/gameConfig';
import type { Projectile, Ship, ShipKind, SimEvent } from '@/game/types';
import type { Simulation } from '@/game/Simulation';
import type { GameTextures } from './assets';

const SHIP_SCALE = 0.55;
/** Texture frames per health stage: healthy -> torn -> ghost-grey wreck. */
const STAGES: Record<ShipKind, string[]> = {
  player: ['ship_9', 'ship_15', 'ship_21'],
  chaser: ['ship_8', 'ship_14', 'ship_20'],
  shooter: ['ship_4', 'ship_16', 'ship_22'],
};
const BAR_W = 38;
const BAR_H = 5;

function stageFor(ratio: number): 0 | 1 | 2 {
  return ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
}

class ShipView {
  readonly root = new Container();
  private readonly sprite: Sprite;
  private readonly fire: Sprite;
  private readonly bar = new Graphics();
  private lastHealth = -1;
  private stage = -1;

  constructor(private readonly tex: GameTextures, private readonly kind: ShipKind) {
    this.sprite = new Sprite({ texture: tex.ships[STAGES[kind][0]!], anchor: 0.5, scale: SHIP_SCALE });
    this.fire = new Sprite({ texture: tex.ships['fire_1']!, anchor: { x: 0.5, y: 0.8 }, scale: 0.7, visible: false });
    this.bar.y = -40;
    this.root.addChild(this.sprite, this.fire, this.bar);
  }

  update(s: Ship, time: number): void {
    this.root.position.set(s.x, s.y);
    // The ship textures point their bow down (+y); heading 0 means east.
    this.sprite.rotation = s.heading - Math.PI / 2;
    const ratio = s.health / s.maxHealth;
    const stage = stageFor(ratio);
    if (stage !== this.stage) {
      this.stage = stage;
      this.sprite.texture = this.tex.ships[STAGES[this.kind][stage]!]!;
    }
    // Damage deterioration: burning once the hull is badly hurt.
    this.fire.visible = ratio <= 0.4 && s.alive;
    if (this.fire.visible) {
      this.fire.alpha = 0.75 + 0.25 * Math.sin(time * 18 + s.id);
      this.fire.scale.set(0.6 + 0.12 * Math.sin(time * 11 + s.id));
    }
    this.sprite.tint = s.hitFlash > 0 ? 0xff6a6a : 0xffffff;
    if (s.health !== this.lastHealth) {
      this.lastHealth = s.health;
      this.drawBar(ratio);
    }
    this.root.visible = s.alive;
  }

  private drawBar(ratio: number): void {
    const color = ratio > 0.5 ? 0x4cc34a : ratio > 0.25 ? 0xf2a81d : 0xe0382f;
    this.bar
      .clear()
      .roundRect(-BAR_W / 2 - 1, -1, BAR_W + 2, BAR_H + 2, 3)
      .fill({ color: 0x0b1d2b, alpha: 0.85 })
      .roundRect(-BAR_W / 2, 0, Math.max(0, BAR_W * ratio), BAR_H, 2)
      .fill(color);
  }
}

interface Effect {
  sprite: Sprite;
  age: number;
  life: number;
  from: number;
  to: number;
}

export interface RendererStats {
  ships: number;
  projectiles: number;
  effects: number;
}

/**
 * Draws a `Simulation`. It owns the Pixi application and every display object; the
 * simulation never knows it exists. `sync` reads sim state each frame, `update` advances
 * purely visual effects by simulated time (so effects freeze while paused).
 */
export class GameRenderer {
  private readonly world = new Container();
  private readonly water: TilingSprite;
  private readonly shipLayer = new Container();
  private readonly bulletLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly shipViews = new Map<number, ShipView>();
  private readonly bulletViews = new Map<number, Sprite>();
  private readonly bulletPool: Sprite[] = [];
  private readonly effectPool: Sprite[] = [];
  private effects: Effect[] = [];
  private time = 0;
  private shake = 0;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  private constructor(
    readonly app: Application,
    private readonly tex: GameTextures,
    private readonly config: Readonly<GameConfig>,
  ) {
    const { width, height } = config.arena;
    this.water = new TilingSprite({ texture: tex.water, width, height, tileScale: { x: 0.5, y: 0.5 } });
    const islands = new Container();
    for (const isl of config.arena.islands) {
      const sprite = new Sprite({ texture: tex.islands[isl.sprite], anchor: 0.5, scale: 0.5 });
      sprite.position.set(isl.x, isl.y);
      islands.addChild(sprite);
    }
    this.world.addChild(this.water, islands, this.bulletLayer, this.shipLayer, this.fxLayer);
    app.stage.addChild(this.world);
  }

  /**
   * Creates the renderer. Async because Pixi initializes asynchronously; if `isCancelled`
   * turns true meanwhile (React Strict Mode double-mount, fast unmount) everything is torn
   * down and `null` is returned without ever touching the DOM.
   */
  static async create(
    host: HTMLElement,
    tex: GameTextures,
    config: Readonly<GameConfig>,
    isCancelled: () => boolean,
    opts: { autoStart: boolean },
  ): Promise<GameRenderer | null> {
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      background: '#0d3c5a',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: opts.autoStart,
      preference: 'webgl',
    });
    if (isCancelled()) {
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
      return null;
    }
    const r = new GameRenderer(app, tex, config);
    app.canvas.setAttribute('aria-hidden', 'true'); // semantic state lives in the React HUD
    app.canvas.style.display = 'block';
    host.appendChild(app.canvas);
    r.observe(host);
    r.resize(host.clientWidth, host.clientHeight);
    return r;
  }

  private observe(host: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => this.resize(host.clientWidth, host.clientHeight));
    this.resizeObserver.observe(host);
  }

  /** Fits the fixed-size arena into the canvas (letterboxed), keeping its aspect ratio. */
  resize(w: number, h: number): void {
    if (this.destroyed || w < 1 || h < 1) return;
    const res = Math.min(window.devicePixelRatio || 1, 2);
    if (this.app.renderer.resolution !== res) this.app.renderer.resolution = res;
    this.app.renderer.resize(w, h);
    const { width, height } = this.config.arena;
    const scale = Math.min(w / width, h / height);
    this.world.scale.set(scale);
    this.baseX = (w - width * scale) / 2;
    this.baseY = (h - height * scale) / 2;
    this.world.position.set(this.baseX, this.baseY);
  }
  private baseX = 0;
  private baseY = 0;

  stats(): RendererStats {
    return { ships: this.shipViews.size, projectiles: this.bulletViews.size, effects: this.effects.length };
  }

  /** Mirrors the simulation into display objects. Cheap: no allocations in steady state. */
  sync(sim: Simulation): void {
    const seen = new Set<number>();
    for (const s of sim.ships) {
      seen.add(s.id);
      let v = this.shipViews.get(s.id);
      if (!v) {
        v = new ShipView(this.tex, s.kind);
        this.shipViews.set(s.id, v);
        this.shipLayer.addChild(v.root);
      }
      v.update(s, this.time);
    }
    for (const [id, v] of this.shipViews) {
      if (!seen.has(id)) {
        v.root.destroy({ children: true });
        this.shipViews.delete(id);
      }
    }
    const seenB = new Set<number>();
    for (const b of sim.projectiles) {
      seenB.add(b.id);
      let sp = this.bulletViews.get(b.id);
      if (!sp) {
        sp = this.acquireBullet(b);
        this.bulletViews.set(b.id, sp);
      }
      sp.position.set(b.x, b.y);
    }
    for (const [id, sp] of this.bulletViews) {
      if (!seenB.has(id)) {
        sp.visible = false;
        this.bulletPool.push(sp);
        this.bulletViews.delete(id);
      }
    }
  }

  private acquireBullet(b: Projectile): Sprite {
    let sp = this.bulletPool.pop();
    if (!sp) {
      sp = new Sprite({ texture: this.tex.ships['cannon_ball']!, anchor: 0.5 });
      this.bulletLayer.addChild(sp);
    }
    sp.visible = true;
    sp.scale.set(b.owner === 'player' ? 1.1 : 1.3);
    sp.tint = b.owner === 'player' ? 0xffffff : 0xff9a6a;
    return sp;
  }

  /** Advances visual-only state by simulated seconds. */
  update(dt: number): void {
    this.time += dt;
    this.water.tilePosition.x += dt * 10;
    this.water.tilePosition.y += dt * 4;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]!;
      e.age += dt;
      const t = Math.min(1, e.age / e.life);
      e.sprite.scale.set(e.from + (e.to - e.from) * t);
      e.sprite.alpha = 1 - t * t;
      if (t >= 1) {
        e.sprite.visible = false;
        this.effectPool.push(e.sprite);
        this.effects.splice(i, 1);
      }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = (this.shake / this.config.effects.shakeSec) * this.config.effects.shakePx;
      this.world.position.set(this.baseX + Math.sin(this.time * 90) * k, this.baseY + Math.cos(this.time * 77) * k);
      if (this.shake === 0) this.world.position.set(this.baseX, this.baseY);
    }
  }

  handleEvents(events: SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'shot':
          this.spawnEffect('explosion_3', ev.x, ev.y, 0.2, ev.weapon === 'side' ? 0.8 : 0.55, 0.16, ev.heading);
          break;
        case 'hit':
          this.spawnEffect('explosion_3', ev.x, ev.y, 0.25, ev.target === 'island' ? 0.5 : 0.8, 0.22);
          break;
        case 'explosion':
          this.spawnEffect('explosion_1', ev.x, ev.y, 0.5, ev.kind === 'player' ? 1.5 : 1.1, 0.55);
          this.spawnEffect('explosion_2', ev.x, ev.y, 0.3, 0.9, 0.4);
          break;
        case 'playerDamaged':
          this.shake = this.config.effects.shakeSec;
          break;
        case 'ended':
          break;
      }
    }
  }

  private spawnEffect(frame: string, x: number, y: number, from: number, to: number, life: number, rotation = 0): void {
    let sp = this.effectPool.pop();
    if (!sp) {
      sp = new Sprite({ texture: this.tex.ships[frame] as Texture, anchor: 0.5 });
      this.fxLayer.addChild(sp);
    }
    sp.texture = this.tex.ships[frame]!;
    sp.visible = true;
    sp.position.set(x, y);
    sp.rotation = rotation;
    sp.alpha = 1;
    sp.scale.set(from);
    this.effects.push({ sprite: sp, age: 0, life, from, to });
  }

  render(): void {
    if (!this.destroyed) this.app.render();
  }

  /** Releases the observer, the Pixi application and every display object. Shared textures stay cached. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.app.ticker.stop();
    this.shipViews.clear();
    this.bulletViews.clear();
    this.bulletPool.length = 0;
    this.effectPool.length = 0;
    this.effects = [];
    this.app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
  }
}
