import { useEffect, useState } from 'react';
import { useRoute } from './lib/router';
import { isLoaded, loadState, useStore } from './lib/store';
import { startAutoBackup } from './lib/sync';
import { DialoguePlayer, Dialogues } from './screens/Dialogues';
import { AddWord, Dictionary, Tips, WordDetail } from './screens/Dictionary';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';

export function App() {
  const [ready, setReady] = useState(isLoaded());
  const onboarded = useStore((s) => s.settings.onboarded);
  const route = useRoute();

  useEffect(() => {
    if (ready) return;
    loadState().then(() => {
      setReady(true);
      startAutoBackup();
    });
  }, [ready]);

  if (!ready) return <div className="screen splash" />;
  if (!onboarded) return <Onboarding />;

  switch (route[0]) {
    case 'session':
      return <Session />;
    case 'dialogues':
      return <Dialogues />;
    case 'dialogue':
      return <DialoguePlayer key={route[1]} id={route[1] ?? ''} />;
    case 'dict':
      return <Dictionary />;
    case 'word':
      return <WordDetail key={route[1]} id={route[1] ?? ''} />;
    case 'add':
      return <AddWord />;
    case 'tips':
      return <Tips />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}
