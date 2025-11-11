import { GiftDrawerFocus } from './types';

interface DrawerHeaderProps {
  stagingId: string | null;
  loading: boolean;
  actionBusy: 'mark-ready' | 'process' | null;
  onClose(): void;
  onMarkReady(): void;
  onProcess(): void;
}

export function DrawerHeader({
  stagingId,
  loading,
  actionBusy,
  onClose,
  onMarkReady,
  onProcess,
}: DrawerHeaderProps): JSX.Element {
  return (
    <div className="drawer-header">
      <div>
        <h3>Staging record</h3>
        <p className="small-text">
          ID <code>{stagingId}</code>
        </p>
      </div>
      <div className="drawer-header-actions">
        <button
          type="button"
          className="f-btn--ghost"
          onClick={onMarkReady}
          disabled={actionBusy === 'mark-ready' || loading}
        >
          {actionBusy === 'mark-ready' ? 'Marking…' : 'Mark ready'}
        </button>
        <button
          type="button"
          className="f-btn--ghost"
          onClick={onProcess}
          disabled={actionBusy === 'process' || loading}
        >
          {actionBusy === 'process' ? 'Processing…' : 'Process now'}
        </button>
        <button type="button" className="f-btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
