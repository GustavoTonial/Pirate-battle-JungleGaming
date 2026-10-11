import { Assets, Rectangle, Texture } from 'pixi.js';

const base = import.meta.env.BASE_URL;
const url = (p: string) => `${base}assets/${p}`;

export interface GameTextures {
  ships: Record<string, Texture>;
  water: Texture;
  islands: Record<'grass' | 'sand' | 'rock-a' | 'rock-b' | 'rock-c', Texture>;
}

let cached: GameTextures | null = null;

/** Tiles sheet is the 2x (retina) PNG: all frames below are in 2x pixels. */
const TILE_FRAMES: Record<keyof GameTextures['islands'], [number, number, number, number]> = {
  grass: [640, 0, 512, 512],
  sand: [0, 0, 384, 384],
  'rock-a': [0, 384, 128, 128],
  'rock-b': [128, 512, 128, 128],
  'rock-c': [256, 384, 128, 128],
};

function sub(source: Texture, [x, y, w, h]: [number, number, number, number]): Texture {
  return new Texture({ source: source.source, frame: new Rectangle(x, y, w, h) });
}

/**
 * Loads (once) and returns every texture needed by a match. Rejects on any failure so the
 * caller can show an error and offer a retry; nothing is cached on failure.
 */
export async function loadGameTextures(onProgress?: (ratio: number) => void): Promise<GameTextures> {
  if (cached) {
    onProgress?.(1);
    return cached;
  }
  const atlasRes = await fetch(url('ships.json'));
  if (!atlasRes.ok) throw new Error(`Could not load ship atlas (HTTP ${atlasRes.status}).`);
  const atlas = (await atlasRes.json()) as Record<string, [number, number, number, number]>;

  const loaded = (await Assets.load<Texture>(
    [url('ships.png'), url('tiles.png'), url('water.png')],
    (p: number) => onProgress?.(p),
  )) as Record<string, Texture>;
  const shipsTex = loaded[url('ships.png')];
  const tilesTex = loaded[url('tiles.png')];
  const waterTex = loaded[url('water.png')];
  if (!shipsTex || !tilesTex || !waterTex) throw new Error('A game texture is missing after loading.');

  const ships: Record<string, Texture> = {};
  for (const [name, rect] of Object.entries(atlas)) ships[name] = sub(shipsTex, rect);

  const islands = {} as GameTextures['islands'];
  for (const key of Object.keys(TILE_FRAMES) as (keyof GameTextures['islands'])[]) {
    islands[key] = sub(tilesTex, TILE_FRAMES[key]);
  }
  cached = { ships, water: waterTex, islands };
  onProgress?.(1);
  return cached;
}
