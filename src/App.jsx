import { useCallback, useState } from 'react';
import PhotoUploadScreen from './components/PhotoUploadScreen';
import DifficultySelectScreen from './components/DifficultySelectScreen';
import GameBoard from './components/GameBoard';
import ResultScreen from './components/ResultScreen';
import { DIFFICULTIES } from './constants/gameConfig';

// Simple top-level state machine — four screens, no router needed for an
// app this small and fully client-side.
const SCREENS = {
  UPLOAD: 'upload',
  DIFFICULTY: 'difficulty',
  GAME: 'game',
  RESULT: 'result',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.UPLOAD);
  const [photoVariants, setPhotoVariants] = useState(null);
  const [difficultyKey, setDifficultyKey] = useState('medium');
  const [result, setResult] = useState(null);

  const handlePhotoReady = useCallback((variants) => {
    setPhotoVariants(variants);
    setScreen(SCREENS.DIFFICULTY);
  }, []);

  const handleDifficultySelect = useCallback((key) => {
    setDifficultyKey(key);
    setScreen(SCREENS.GAME);
  }, []);

  const handleGameEnd = useCallback((finalResult) => {
    setResult(finalResult);
    // Brief pause so the player sees the last mole's pop animation finish
    // before the screen swaps out from under them.
    setTimeout(() => setScreen(SCREENS.RESULT), 500);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setResult(null);
    setScreen(SCREENS.DIFFICULTY);
  }, []);

  const handleNewPhoto = useCallback(() => {
    setResult(null);
    setPhotoVariants(null);
    setScreen(SCREENS.UPLOAD);
  }, []);

  return (
    <div className="app">
      {screen === SCREENS.UPLOAD && <PhotoUploadScreen onPhotoReady={handlePhotoReady} />}

      {screen === SCREENS.DIFFICULTY && (
        <DifficultySelectScreen onSelect={handleDifficultySelect} onBack={handleNewPhoto} />
      )}

      {screen === SCREENS.GAME && (
        <GameBoard
          key={difficultyKey /* fresh engine instance each round */}
          difficultyConfig={DIFFICULTIES[difficultyKey]}
          photoVariants={photoVariants}
          onGameEnd={handleGameEnd}
        />
      )}

      {screen === SCREENS.RESULT && result && (
        <ResultScreen result={result} onPlayAgain={handlePlayAgain} onNewPhoto={handleNewPhoto} />
      )}
    </div>
  );
}
