import { useState } from 'react';
import { ManualGiftEntry } from './components/ManualGiftEntry';
import { StagingQueue } from './components/StagingQueue';

type ViewMode = 'manual' | 'queue';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewMode>('manual');

  return (
    <div>
      <main>
        <header style={{ marginBottom: '2.5rem' }}>
          <h1>Fundraising Admin</h1>
          <p className="small-text" style={{ marginTop: '0.75rem' }}>
            Managed extension console for donation intake. Start with manual gift entry, then review
            staged records as we expand the workflow.
          </p>
        </header>

        <nav className="app-nav" aria-label="Fundraising admin views">
          <button
            type="button"
            onClick={() => setView('manual')}
            disabled={view === 'manual'}
          >
            Manual gift entry
          </button>
          <button
            type="button"
            onClick={() => setView('queue')}
            disabled={view === 'queue'}
          >
            Staging queue
          </button>
        </nav>

        {view === 'manual' ? <ManualGiftEntry /> : <StagingQueue />}
      </main>
    </div>
  );
}
