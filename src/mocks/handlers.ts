import { delay, http, HttpResponse } from 'msw';
import {
  compareRanking,
  sameConfig,
  type ApiErrorBody,
  type HistoryPage,
  type MatchRecord,
  type RankingPage,
  type RecordMatchResponse,
} from '@/api/contracts';
import { createRng } from '@/game/math';
import { mockDb } from './db';
import { getFixtures } from './fixtures';
import { getScenario, runtime, type Behavior, type Latency } from './scenarios';

type Endpoint = 'ranking' | 'history' | 'record';

const err = (status: number, code: string, message: string) =>
  HttpResponse.json<ApiErrorBody>({ code, message }, { status });

let latencyRng = createRng(42);
export const resetMockRandomness = (seed = 42) => {
  latencyRng = createRng(seed);
};

async function applyLatency(latency: Latency, endpoint: Endpoint): Promise<void> {
  switch (latency.kind) {
    case 'none':
      return;
    case 'fixed':
      await delay(latency.ms);
      return;
    case 'variable':
      await delay(Math.round(latency.minMs + latencyRng() * (latency.maxMs - latency.minMs)));
      return;
    case 'outOfOrder': {
      const n = (runtime.counters[`order:${endpoint}`] = (runtime.counters[`order:${endpoint}`] ?? 0) + 1);
      await delay(n % 2 === 1 ? latency.slowMs : latency.fastMs);
      return;
    }
  }
}

/** Returns a failure response for the configured behavior, or `null` to continue normally. */
async function failure(behavior: Behavior): Promise<Response | null> {
  switch (behavior) {
    case 'timeout':
      await delay('infinite');
      return null;
    case 'network':
      return HttpResponse.error();
    case 'http500':
      return err(500, 'INTERNAL_ERROR', 'The server hit an unexpected error.');
    case 'http503':
      return err(503, 'UNAVAILABLE', 'The service is temporarily unavailable.');
    case 'http404':
      return err(404, 'NOT_FOUND', 'The requested resource was not found.');
    default:
      return null;
  }
}

function paging(url: URL) {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? 1)) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('pageSize') ?? 8)) || 8));
  return { page, pageSize };
}

function validRecord(b: unknown): b is MatchRecord {
  const r = b as Partial<MatchRecord> | null;
  return (
    !!r &&
    typeof r.matchId === 'string' && r.matchId.length > 0 &&
    typeof r.playerId === 'string' &&
    typeof r.playerName === 'string' &&
    typeof r.playedAt === 'string' && !Number.isNaN(Date.parse(r.playedAt)) &&
    Number.isInteger(r.score) && (r.score as number) >= 0 &&
    Number.isInteger(r.durationMs) && (r.durationMs as number) >= 0 &&
    (r.endReason === 'time' || r.endReason === 'death') &&
    !!r.config && typeof r.config.sessionTimeSec === 'number' && typeof r.config.enemySpawnTimeSec === 'number'
  );
}

export const handlers = [
  http.get('*/api/ranking', async ({ request }) => {
    const sc = getScenario();
    await applyLatency(sc.latency, 'ranking');
    const fail = await failure(sc.ranking);
    if (fail) return fail;

    const url = new URL(request.url);
    const { page, pageSize } = paging(url);
    const config = {
      sessionTimeSec: Number(url.searchParams.get('sessionTimeSec')),
      enemySpawnTimeSec: Number(url.searchParams.get('enemySpawnTimeSec')),
    };
    const all =
      sc.ranking === 'empty'
        ? []
        : [...getFixtures(sc.dataset), ...mockDb.all()].filter((m) => sameConfig(m.config, config)).sort(compareRanking);
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const body: RankingPage = {
      items: all.slice(start, start + pageSize).map((m, i) => ({
        rank: start + i + 1,
        matchId: m.matchId,
        playerId: m.playerId,
        playerName: m.playerName,
        score: m.score,
        durationMs: m.durationMs,
        playedAt: m.playedAt,
        endReason: m.endReason,
      })),
      page,
      pageSize,
      total,
      totalPages,
    };
    return HttpResponse.json(body);
  }),

  http.get('*/api/players/:playerId/matches', async ({ request, params }) => {
    const sc = getScenario();
    await applyLatency(sc.latency, 'history');
    const fail = await failure(sc.history);
    if (fail) return fail;

    const { page, pageSize } = paging(new URL(request.url));
    const mine =
      sc.history === 'empty'
        ? []
        : mockDb
            .all()
            .filter((m) => m.playerId === params.playerId)
            .sort((a, b) => (a.playedAt === b.playedAt ? (a.matchId < b.matchId ? -1 : 1) : a.playedAt < b.playedAt ? 1 : -1));
    const total = mine.length;
    const body: HistoryPage = {
      items: mine.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
    return HttpResponse.json(body);
  }),

  http.post('*/api/matches', async ({ request }) => {
    const sc = getScenario();
    await applyLatency(sc.latency, 'record');
    const body = await request.json().catch(() => null);
    if (!validRecord(body)) return err(400, 'INVALID_MATCH', 'The match record is invalid.');

    // Idempotency: a known matchId returns the stored record instead of creating another.
    const existing = mockDb.find(body.matchId);

    if (sc.record === 'flaky503') {
      const key = `flaky:${body.matchId}`;
      const attempts = (runtime.counters[key] = (runtime.counters[key] ?? 0) + 1);
      if (attempts <= 2 && !existing) return err(503, 'UNAVAILABLE', 'The service is temporarily unavailable.');
    } else if (sc.record !== 'ok' && sc.record !== 'timeoutAfterSave') {
      const fail = await failure(sc.record);
      if (fail) return fail;
    }

    if (existing) {
      if (sc.record === 'timeoutAfterSave' && !runtime.counters[`tas:${body.matchId}`]) {
        runtime.counters[`tas:${body.matchId}`] = 1;
        await delay('infinite');
      }
      return HttpResponse.json<RecordMatchResponse>({ record: existing, created: false }, { status: 200 });
    }

    mockDb.insert(body);
    if (sc.record === 'timeoutAfterSave') {
      runtime.counters[`tas:${body.matchId}`] = 1; // only the first response is lost
      await delay('infinite');
    }
    return HttpResponse.json<RecordMatchResponse>({ record: body, created: true }, { status: 201 });
  }),
];
