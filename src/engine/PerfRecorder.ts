import type { Simulation } from '@/game/Simulation';

export interface PerfReport {
  frames: number;
  avgFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  maxEntities: number;
  avgEntities: number;
}

/** Cheap rolling recorder of frame times and entity counts (used by the profiling spec and `?perf=1`). */
export class PerfRecorder {
  private frames: number[] = [];
  private entitySum = 0;
  private maxEntities = 0;

  frame(deltaMs: number, sim: Simulation): void {
    if (deltaMs <= 0 || sim.status !== 'running') return;
    this.frames.push(deltaMs);
    const entities = sim.ships.length + sim.projectiles.length;
    this.entitySum += entities;
    if (entities > this.maxEntities) this.maxEntities = entities;
  }

  reset(): void {
    this.frames = [];
    this.entitySum = 0;
    this.maxEntities = 0;
  }

  report(): PerfReport {
    const n = this.frames.length;
    if (n === 0) {
      return { frames: 0, avgFps: 0, p50FrameMs: 0, p95FrameMs: 0, maxFrameMs: 0, maxEntities: 0, avgEntities: 0 };
    }
    const sorted = [...this.frames].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * n))]!;
    const total = this.frames.reduce((a, b) => a + b, 0);
    return {
      frames: n,
      avgFps: Math.round((n / total) * 1000 * 10) / 10,
      p50FrameMs: round2(q(0.5)),
      p95FrameMs: round2(q(0.95)),
      maxFrameMs: round2(sorted[n - 1]!),
      maxEntities: this.maxEntities,
      avgEntities: round2(this.entitySum / n),
    };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
