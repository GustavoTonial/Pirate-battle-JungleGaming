import { useEffect, useRef, useState } from 'react';
import { useRecorder } from '@/api/MatchRecorder';
import type { MatchRecord } from '@/api/contracts';
import { buildGameConfig } from '@/config/gameConfig';
import { GameSession } from '@/engine/GameSession';
import type { HudSnapshot, MatchResult } from '@/game/types';
import { loadGameTextures } from '@/render/assets';
import { useAppStore } from '@/state/appStore';
import { getPlayer } from '@/state/player';
import { newId } from '@/state/storage';
import { installTestApi } from '@/testing/testApi';
import { readTestMode } from '@/testing/testMode';
import { Hud } from './Hud';
import { PauseDialog } from './PauseDialog';
import { TouchControls, useTouchControlsVisible } from './TouchControls';

const RESULT_DELAY_MS = 900;

export function MatchScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [perfText, setPerfText] = useState('');
  const matchKey = useAppStore((s) => s.matchKey);
  const status = useAppStore((s) => s.hud?.status);
  const goto = useAppStore((s) => s.goto);
  const showTouch = useTouchControlsVisible();
  const recorder = useRecorder();
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  // One session per match. Everything created here is released in the cleanup, which also makes
  // React Strict Mode's mount -> unmount -> mount cycle safe.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let created: GameSession | null = null;
    let removeTestApi: () => void = () => {};
    let resultTimer: number | undefined;
    const testMode = readTestMode();
    const store = useAppStore.getState();
    const config = buildGameConfig(store.activeOptions);
    const matchId = newId();

    const onHud = (h: HudSnapshot) => useAppStore.getState().setHud(h);
    const onEnded = (result: MatchResult) => {
      const player = getPlayer();
      const record: MatchRecord = {
        matchId: result.matchId,
        playerId: player.id,
        playerName: player.name,
        playedAt: result.endedAt,
        score: result.score,
        durationMs: result.durationMs,
        endReason: result.endReason,
        config: result.config,
      };
      useAppStore.getState().finishMatch(result);
      void recorderRef.current.submit(record); // persisted as pending first, then sent
      setBanner(result.endReason === 'time' ? "Time's up!" : 'Your ship was sunk!');
      // Manual-clock test runs get a longer window to inspect the final state before the screen changes.
      resultTimer = window.setTimeout(
        () => useAppStore.getState().goto('result'),
        testMode.manualClock ? 2500 : RESULT_DELAY_MS,
      );
    };

    loadGameTextures()
      .then((textures) =>
        cancelled
          ? null
          : GameSession.create(
              {
                host,
                textures,
                config,
                seed: testMode.seed ?? Math.floor(Math.random() * 0x7fffffff),
                matchId,
                testMode,
                onHud,
                onEnded,
              },
              () => cancelled,
            ),
      )
      .then((s) => {
        if (!s) return;
        if (cancelled) {
          s.destroy();
          return;
        }
        created = s;
        if (testMode.enabled) removeTestApi = installTestApi(s);
        setSession(s);
        s.start();
        setAnnouncement('Match started.');
      })
      .catch((e: unknown) => {
        console.error('Could not start the match', e);
        if (!cancelled) goto('menu');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(resultTimer);
      removeTestApi();
      created?.destroy();
      setSession(null);
      useAppStore.getState().setHud(null);
    };
  }, [matchKey, goto]);

  // Screen-reader announcements only for state changes and a few milestones (never per frame).
  const hud = useAppStore((s) => s.hud);
  const lowHealth = !!hud && hud.health > 0 && hud.health <= Math.ceil(hud.maxHealth * 0.3);
  useEffect(() => {
    if (status === 'paused') setAnnouncement('Game paused.');
    else if (status === 'running') setAnnouncement('Game resumed.');
  }, [status]);
  useEffect(() => {
    if (lowHealth) setAnnouncement('Warning: hull is badly damaged.');
  }, [lowHealth]);
  const timeLeft = hud?.timeLeftSec;
  useEffect(() => {
    if (status === 'running' && (timeLeft === 30 || timeLeft === 10)) setAnnouncement(`${timeLeft} seconds left.`);
  }, [timeLeft, status]);

  // Optional performance overlay (?perf=1).
  useEffect(() => {
    if (!session || !readTestMode().perf) return;
    const id = window.setInterval(() => {
      const r = session.perf.report();
      setPerfText(`${r.avgFps} fps | p95 ${r.p95FrameMs} ms | entities ${r.maxEntities}`);
    }, 1000);
    return () => window.clearInterval(id);
  }, [session]);

  return (
    <main className="match" aria-label="Match">
      <div className="match-canvas" ref={hostRef} data-testid="arena" />
      {session && (
        <>
          <Hud onPause={() => session.pause()} />
          {showTouch && <TouchControls input={session.input} />}
        </>
      )}
      {banner && <div className="banner" role="presentation">{banner}</div>}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      {perfText && <div className="perf">{perfText}</div>}
      <PauseDialog
        open={status === 'paused'}
        onResume={() => session?.resume()}
        onQuit={() => goto('menu')} // abandoning a match records nothing
      />
    </main>
  );
}
