import { DonorDisplay } from '../../types/donor';
import {
  DuplicateTier,
  describeDuplicate,
  duplicateTierBadgeClass,
  duplicateTierLabel,
  formatMatchDate,
} from './duplicateHelpers';

export interface ClassifiedDuplicate {
  match: DonorDisplay;
  tier: DuplicateTier;
}

interface DonorSelectionPanelProps {
  selectedDonor?: DonorDisplay;
  onChangeDonor(): void;
  onClearSelectedDonor(): void;
  duplicateLookupError: string | null;
  showDuplicates: boolean;
  classifiedDuplicates: ClassifiedDuplicate[];
  selectedDuplicateId: string | null;
  onSelectDuplicate(id: string): void;
  onOpenSearch(): void;
  potentialDuplicateMessage: string | null;
  disableActions: boolean;
}

export function DonorSelectionPanel({
  selectedDonor,
  onChangeDonor,
  onClearSelectedDonor,
  duplicateLookupError,
  showDuplicates,
  classifiedDuplicates,
  selectedDuplicateId,
  onSelectDuplicate,
  onOpenSearch,
  potentialDuplicateMessage,
  disableActions,
}: DonorSelectionPanelProps): JSX.Element {
  return (
    <>
      {selectedDonor ? (
        <div
          className="f-rounded-xl f-border f-border-slate-200 f-bg-slate-50 f-p-4 f-space-y-4"
          role="status"
          aria-live="polite"
        >
          <div className="f-flex f-justify-between f-items-center f-gap-3">
            <h4 className="f-text-base f-font-semibold f-text-ink f-m-0">Selected donor</h4>
            <button
              type="button"
              className="f-btn--ghost"
              onClick={onChangeDonor}
              disabled={disableActions}
            >
              Change donor
            </button>
          </div>
          <dl className="f-grid f-gap-3 sm:f-grid-cols-2">
            <div>
              <dt className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1">
                Name
              </dt>
              <dd className="f-m-0 f-text-sm f-text-ink">{describeDuplicate(selectedDonor)}</dd>
            </div>
            <div>
              <dt className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1">
                Email
              </dt>
              <dd className="f-m-0 f-text-sm f-text-ink">{selectedDonor.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1">
                Donor ID
              </dt>
              <dd className="f-m-0 f-text-sm f-text-ink">{selectedDonor.id}</dd>
            </div>
            <div>
              <dt className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1">
                Updated
              </dt>
              <dd className="f-m-0 f-text-sm f-text-ink">
                {formatMatchDate(selectedDonor.updatedAt ?? null)}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="f-btn--ghost"
            onClick={onClearSelectedDonor}
            disabled={disableActions}
          >
            Clear selection
          </button>
        </div>
      ) : (
        <div className="f-rounded-xl f-border f-border-dashed f-border-slate-300 f-bg-slate-50 f-p-4 f-space-y-3">
          <div className="f-flex f-justify-between f-items-center f-gap-3">
            <h4 className="f-text-base f-font-semibold f-text-ink f-m-0">Donor selection</h4>
            <button
              type="button"
              className="f-btn--secondary"
              onClick={onOpenSearch}
              disabled={disableActions}
            >
              Search donors…
            </button>
          </div>
          <p className="f-help-text">
            No donor selected. A new donor record will be created when you submit this gift.
          </p>
        </div>
      )}

      {duplicateLookupError ? (
        <div className="f-alert f-alert--error" role="alert">
          {duplicateLookupError}
        </div>
      ) : null}

      {!showDuplicates && classifiedDuplicates.length > 0 ? (
        <div className="f-rounded-xl f-border f-border-slate-200 f-bg-slate-50 f-p-4 f-space-y-3">
          <div className="f-flex f-justify-between f-items-center f-gap-3">
            <p className="f-help-text f-m-0 f-text-slate-600">Possible existing donors:</p>
            <button
              type="button"
              className="f-btn--ghost"
              onClick={onOpenSearch}
              disabled={disableActions}
            >
              Search donors…
            </button>
          </div>
          <table className="f-table">
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Donor</th>
                <th scope="col">Email</th>
                <th scope="col">Updated</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {classifiedDuplicates.map(({ match, tier }) => {
                if (!match?.id) {
                  return null;
                }
                const isSelected = selectedDuplicateId === match.id;
                const rowClass = isSelected ? 'f-bg-primary/5' : 'f-bg-white';
                return (
                  <tr key={match.id} className={`${rowClass} f-transition-colors`}>
                    <td>
                      <span className={duplicateTierBadgeClass(tier)}>
                        {duplicateTierLabel(tier)}
                      </span>
                    </td>
                    <td>{describeDuplicate(match)}</td>
                    <td>{match.email ?? '—'}</td>
                    <td>{formatMatchDate(match.updatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={isSelected ? 'f-btn--secondary' : 'f-btn--ghost'}
                        onClick={() => onSelectDuplicate(match.id)}
                        disabled={disableActions}
                      >
                        {isSelected ? 'Selected' : 'Use donor'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selectedDuplicateId ? (
            <p className="f-help-text">
              Selected donor:&nbsp;
              <code>{selectedDuplicateId}</code>
            </p>
          ) : (
            <p className="f-help-text">Select a donor or search the directory.</p>
          )}
        </div>
      ) : (
        <div className="f-flex f-justify-end">
          <button
            type="button"
            className="f-btn--secondary"
            onClick={onOpenSearch}
            disabled={disableActions}
          >
            Search donors…
          </button>
        </div>
      )}

      {potentialDuplicateMessage ? (
        <div className="f-alert f-alert--warning" role="alert">
          {potentialDuplicateMessage}
        </div>
      ) : null}
    </>
  );
}
