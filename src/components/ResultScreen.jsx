import { SUCCESS_THRESHOLD, TOTAL_MOLES } from '../constants/gameConfig';

export default function ResultScreen({ result, onPlayAgain, onNewPhoto }) {
  const { hitCount, missCount } = result;
  const success = hitCount > SUCCESS_THRESHOLD;

  return (
    <div className={`screen result-screen ${success ? 'result-success' : 'result-fail'}`}>
      <h1>{success ? 'You win!' : 'Better luck next time'}</h1>
      <p className="result-score">
        You hit {hitCount} of {TOTAL_MOLES} moles ({missCount} missed).
      </p>
      <p className="result-detail">
        {success
          ? `Needed more than ${SUCCESS_THRESHOLD} — you cleared it.`
          : `Needed more than ${SUCCESS_THRESHOLD} to win.`}
      </p>

      <div className="button-row">
        <button type="button" onClick={onNewPhoto} className="secondary">
          Upload new photo
        </button>
        <button type="button" onClick={onPlayAgain} className="primary">
          Play again
        </button>
      </div>
    </div>
  );
}
