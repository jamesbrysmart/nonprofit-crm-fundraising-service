import { GiftDrawerFocus } from './types';

interface DrawerHeaderProps {
  stagingId: string | null;
  title?: string;
  onClose(): void;
}

export function DrawerHeader({
  stagingId,
  title = 'Staging record',
  onClose,
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
        <button type="button" className="f-btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
