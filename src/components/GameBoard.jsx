import { useCallback, useRef, useState } from 'react';
import Hole from './Hole';
import ScoreDisplay from './ScoreDisplay';
import { useGameEngine } from '../hooks/useGameEngine';
import { HOLE_POSITIONS } from '../constants/gameConfig';

export default function GameBoard({ difficultyConfig, photoVariants, onGameEnd }) {
  const { holes, flashes, hitMole, spawnedCount, hitCount, missCount } = useGameEngine(
    difficultyConfig,
    { onGameEnd }
  );

  // "Hover a hammer" per spec — track pointer position to render a hammer
  // cursor that follows the mouse, with a quick swing animation on tap.
  const boardRef = useRef(null);
  const [hammer, setHammer] = useState({ x: 0, y: 0, visible: false, swinging: false });
  const swingTimeoutRef = useRef(null);

  const handlePointerMove = useCallback((event) => {
    if (event.pointerType !== 'mouse') return; // touch has no persistent cursor
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHammer((prev) => ({
      ...prev,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      visible: true,
    }));
  }, []);

  const swing = useCallback(() => {
    setHammer((prev) => ({ ...prev, swinging: true }));
    clearTimeout(swingTimeoutRef.current);
    swingTimeoutRef.current = setTimeout(() => {
      setHammer((prev) => ({ ...prev, swinging: false }));
    }, 160);
  }, []);

  const handleHoleHit = useCallback(
    (holeIndex) => {
      swing();
      hitMole(holeIndex);
    },
    [hitMole, swing]
  );

  const flashByHole = new Map(flashes.map((f) => [f.holeIndex, f]));

  return (
    <div
      className="screen game-screen"
      ref={boardRef}
      onPointerMove={handlePointerMove}
      onPointerDown={swing}
      onPointerLeave={() => setHammer((prev) => ({ ...prev, visible: false }))}
    >
      <ScoreDisplay hitCount={hitCount} spawnedCount={spawnedCount} />

      <div className="board">
        {holes.map((holeState, index) => {
          const expression = holeState.expression
            ? { src: photoVariants[holeState.expression], mood: holeState.expression }
            : null;
          return (
            <Hole
              key={index}
              position={HOLE_POSITIONS[index]}
              holeState={{ ...holeState, expression }}
              flash={flashByHole.get(index)}
              onHit={() => handleHoleHit(index)}
            />
          );
        })}
      </div>

      {hammer.visible && (
        <div
          className={`hammer-cursor ${hammer.swinging ? 'swinging' : ''}`}
          style={{ left: hammer.x, top: hammer.y }}
          aria-hidden="true"
        >
          🔨
        </div>
      )}

      <p className="misses-note">Missed: {missCount}</p>
    </div>
  );
}
