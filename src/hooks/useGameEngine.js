import { useCallback, useEffect, useRef, useState } from 'react';
import { HOLE_COUNT, TOTAL_MOLES } from '../constants/gameConfig';
import { EXPRESSION_LIST } from '../utils/faceCompositor';

const EMPTY_HOLE = { active: false, expression: null, moleId: null };

function makeEmptyHoles() {
  return Array.from({ length: HOLE_COUNT }, () => ({ ...EMPTY_HOLE }));
}

/**
 * Drives the whole round: spawning moles into random empty holes on a
 * timer, auto-expiring them if not hit in time, tracking score, and
 * flagging when the round is over (20 moles spawned AND resolved).
 *
 * Intentionally framework-agnostic about rendering — it only hands back
 * plain state. The board/holes are plain DOM+CSS, not canvas, per the
 * agreed stack.
 */
export function useGameEngine(difficultyConfig, { onGameEnd } = {}) {
  const [holes, setHoles] = useState(makeEmptyHoles);
  const [spawnedCount, setSpawnedCount] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [flashes, setFlashes] = useState([]); // transient "+1" / miss indicators
  const [status, setStatus] = useState('playing'); // 'playing' | 'finished'

  const moleTimersRef = useRef(new Map()); // moleId -> timeout handle
  const nextMoleIdRef = useRef(0);
  const nextFlashIdRef = useRef(0);
  const spawnedCountRef = useRef(0);
  const activeCountRef = useRef(0);
  const holesRef = useRef(holes);
  const statusRef = useRef('playing');
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;
  holesRef.current = holes;

  const pushFlash = useCallback((holeIndex, type) => {
    const id = nextFlashIdRef.current++;
    setFlashes((prev) => [...prev, { id, holeIndex, type }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((f) => f.id !== id));
    }, 650);
  }, []);

  const resolveMole = useCallback(
    (holeIndex, wasHit) => {
      const holeState = holesRef.current[holeIndex];
      if (!holeState || !holeState.active) return; // already resolved, ignore

      const timer = moleTimersRef.current.get(holeState.moleId);
      if (timer) {
        clearTimeout(timer);
        moleTimersRef.current.delete(holeState.moleId);
      }

      setHoles((prev) => {
        const next = [...prev];
        next[holeIndex] = { ...EMPTY_HOLE };
        return next;
      });
      activeCountRef.current -= 1;
      pushFlash(holeIndex, wasHit ? 'hit' : 'miss');

      if (wasHit) {
        setHitCount((c) => c + 1);
      } else {
        setMissCount((c) => c + 1);
      }
    },
    [pushFlash]
  );

  const hitMole = useCallback(
    (holeIndex) => {
      if (statusRef.current !== 'playing') return;
      const holeState = holesRef.current[holeIndex];
      if (!holeState || !holeState.active) return; // whiffed — nothing there
      resolveMole(holeIndex, true);
    },
    [resolveMole]
  );

  const trySpawn = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    if (spawnedCountRef.current >= TOTAL_MOLES) return;
    if (activeCountRef.current >= difficultyConfig.maxConcurrentMoles) return;

    const emptyIndices = holesRef.current
      .map((h, i) => (h.active ? -1 : i))
      .filter((i) => i !== -1);
    if (emptyIndices.length === 0) return;

    const holeIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const expression = EXPRESSION_LIST[Math.floor(Math.random() * EXPRESSION_LIST.length)];
    const moleId = nextMoleIdRef.current++;

    spawnedCountRef.current += 1;
    activeCountRef.current += 1;
    setSpawnedCount(spawnedCountRef.current);

    setHoles((prev) => {
      const next = [...prev];
      next[holeIndex] = { active: true, expression, moleId };
      return next;
    });

    const timer = setTimeout(() => {
      resolveMole(holeIndex, false);
    }, difficultyConfig.moleUpDurationMs);
    moleTimersRef.current.set(moleId, timer);
  }, [difficultyConfig, resolveMole]);

  // Spawn loop. Fires once almost-immediately so the player isn't staring
  // at an empty board for a full interval, then on a steady cadence.
  // The "kickoff" is a cancelable timeout (not a bare synchronous call) so
  // React 18 StrictMode's dev-only mount→cleanup→mount cycle can't leak an
  // extra spawn — cleanup cancels whichever timer hasn't fired yet.
  useEffect(() => {
    const kickoff = setTimeout(trySpawn, 0);
    const interval = setInterval(trySpawn, difficultyConfig.spawnIntervalMs);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyConfig]);

  // End-of-round detection: every mole that will ever spawn has spawned,
  // and none are still up (hit or auto-expired).
  useEffect(() => {
    if (
      statusRef.current === 'playing' &&
      spawnedCount >= TOTAL_MOLES &&
      activeCountRef.current === 0
    ) {
      statusRef.current = 'finished';
      setStatus('finished');
      onGameEndRef.current?.({ hitCount, missCount, totalMoles: TOTAL_MOLES });
    }
    // hitCount/missCount included so the check re-runs on the resolving
    // event itself (spawnedCount alone wouldn't change on the last miss).
  }, [spawnedCount, hitCount, missCount]);

  // Clean up any pending expiry timers on unmount (e.g. leaving mid-game).
  useEffect(
    () => () => {
      moleTimersRef.current.forEach(clearTimeout);
      moleTimersRef.current.clear();
    },
    []
  );

  return { holes, flashes, hitMole, spawnedCount, hitCount, missCount, status };
}
