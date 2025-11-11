import { ManualGiftEntry } from '../ManualGiftEntry';

interface ManualGiftEntryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ManualGiftEntryDrawer({
  open,
  onClose,
}: ManualGiftEntryDrawerProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer drawer--wide">
        <header className="drawer-header">
          <div>
            <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
              Manual intake
            </p>
            <h3 className="f-text-xl f-font-semibold f-text-ink f-m-0">Log manual gift</h3>
            <p className="small-text f-mt-2 f-mb-0">
              Capture cheques, phone donations, or event-day gifts without leaving the queue.
            </p>
          </div>
          <button type="button" className="f-btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="f-overflow-y-auto f-pr-1">
          <ManualGiftEntry />
        </div>
      </div>
    </div>
  );
}
