import { GiftDrawerFocus } from './types';

interface DrawerHeaderProps {
  stagingId: string | null;
  loading: boolean;
  actionBusy: 'mark-ready' | 'process' | null;
  actionError?: string | null;
  title?: string;
  onClose(): void;
  onMarkReady(): void;
  onProcess(): void;
}

export function DrawerHeader({
  stagingId,
  loading,
  actionBusy,
  actionError,
  title = 'Staging record',
  onClose,
  onMarkReady,
  onProcess,
}: DrawerHeaderProps): JSX.Element {
  return (
    <div className="drawer-header">
      <div>
        <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">Review</p>
        <h3 className="f-text-xl f-font-semibold f-text-ink f-m-0">{title}</h3>
        <p className="small-text">
          ID <code>{stagingId}</code>
        </p>
      </div>
      <div className="drawer-header-actions">
        {actionError ? (
          <span className="f-badge f-bg-danger/10 f-text-danger f-mr-2" title={actionError}>
            Error
          </span>
        ) : null}
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
          className="f-btn--secondary"
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
