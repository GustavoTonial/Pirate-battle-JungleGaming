import { useAppStore } from '@/state/appStore';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { MatchScreen } from '@/ui/MatchScreen';
import { MenuScreen } from '@/ui/MenuScreen';
import { OptionsScreen } from '@/ui/OptionsScreen';
import { ResultScreen } from '@/ui/ResultScreen';

export default function App() {
  const screen = useAppStore((s) => s.screen);
  return (
    <div className="app">
      {screen === 'menu' && <MenuScreen />}
      {screen === 'options' && <OptionsScreen />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'match' && <MatchScreen />}
      {screen === 'result' && <ResultScreen />}
      <div className="rotate-overlay" role="alert">
        Rotate your device to landscape to play Pirate Battle.
      </div>
    </div>
  );
}
