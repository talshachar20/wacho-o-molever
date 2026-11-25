export default function Hole({ position, holeState, flash, onHit }) {
  const { active, expression, moleId } = holeState;

  function handlePointerDown(event) {
    event.preventDefault();
    onHit();
  }

  return (
    <div
      className="hole"
      style={{ top: `${position.top}%`, left: `${position.left}%` }}
    >
      <div className="hole-dirt" />
      <div className={`mole-shaft ${active ? 'mole-up' : 'mole-down'}`}>
        {expression && (
          // Keyed by moleId so each new pop-up is a fresh element — avoids
          // any stale transition state carrying over between spawns.
          <img
            key={moleId}
            src={expression.src}
            alt="Mole face"
            className={`mole-face mood-${expression.mood}`}
            onPointerDown={handlePointerDown}
            draggable={false}
          />
        )}
      </div>
      {flash && <div className={`flash flash-${flash.type}`}>{flash.type === 'hit' ? '+1' : 'MISS'}</div>}
    </div>
  );
}
