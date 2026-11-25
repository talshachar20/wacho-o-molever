import { DIFFICULTIES, DIFFICULTY_ORDER } from '../constants/gameConfig';

export default function DifficultySelectScreen({ onSelect, onBack }) {
  return (
    <div className="screen difficulty-screen">
      <h1>Choose your difficulty</h1>
      <p className="subtitle">20 moles will pop up total. Hit more than 15 to win.</p>

      <div className="difficulty-grid">
        {DIFFICULTY_ORDER.map((key) => {
          const d = DIFFICULTIES[key];
          return (
            <button
              key={key}
              type="button"
              className={`difficulty-card difficulty-${key}`}
              onClick={() => onSelect(key)}
            >
              <span className="difficulty-label">{d.label}</span>
              <span className="difficulty-description">{d.description}</span>
            </button>
          );
        })}
      </div>

      <div className="button-row">
        <button type="button" onClick={onBack} className="secondary">
          Back to photo
        </button>
      </div>
    </div>
  );
}
