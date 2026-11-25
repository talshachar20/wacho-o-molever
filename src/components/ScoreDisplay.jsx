import { TOTAL_MOLES } from '../constants/gameConfig';

export default function ScoreDisplay({ hitCount, spawnedCount }) {
  return (
    <div className="score-display" aria-live="polite">
      <div className="score-main">Score: {hitCount}</div>
      <div className="score-sub">
        Mole {Math.min(spawnedCount, TOTAL_MOLES)} / {TOTAL_MOLES}
      </div>
    </div>
  );
}
