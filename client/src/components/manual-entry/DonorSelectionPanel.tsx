import { PersonDuplicate } from '../../api';
import {
  DuplicateTier,
  describeDuplicate,
  duplicateTierLabel,
  formatMatchDate,
} from './duplicateHelpers';

interface ClassifiedDuplicate {
  match: PersonDuplicate;
  tier: DuplicateTier;
}

interface DonorSelectionPanelProps {
  selectedDonor?: PersonDuplicate;
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
        <div className="supporter-summary" role="status" aria-live="polite">
          <div className="supporter-summary-header">
            <h4>Selected donor</h4>
            <button type="button" className="secondary-button" onClick={onChangeDonor} disabled={disableActions}>
              Change donor
            </button>
          </div>
          <dl className="supporter-summary-meta">
            <div>
              <dt>Name</dt>
              <dd>{describeDuplicate(selectedDonor)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{selectedDonor.emails?.primaryEmail ?? '—'}</dd>
            </div>
            <div>
              <dt>Donor ID</dt>
              <dd>{selectedDonor.id}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatMatchDate(selectedDonor.updatedAt ?? selectedDonor.createdAt)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="secondary-button"
            onClick={onClearSelectedDonor}
            disabled={disableActions}
          >
            Clear selection
          </button>
        </div>
      ) : (
        <div className="supporter-summary supporter-summary--empty">
          <div className="supporter-summary-header">
            <h4>Donor selection</h4>
            <button type="button" className="secondary-button" onClick={onOpenSearch} disabled={disableActions}>
              Search donors…
            </button>
          </div>
          <p className="small-text">
            No donor selected. A new donor record will be created when you submit this gift.
          </p>
        </div>
      )}

      {duplicateLookupError ? (
        <div className="form-alert form-alert-error" role="alert">
          {duplicateLookupError}
        </div>
      ) : null}

      {!showDuplicates && classifiedDuplicates.length > 0 ? (
        <div className="duplicate-hint">
          <div className="duplicate-hint-header">
            <p className="small-text">Possible existing donors:</p>
            <button type="button" className="secondary-button" onClick={onOpenSearch}>
              Search donors…
            </button>
          </div>
          <table className="duplicate-table">
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
                return (
                  <tr
                    key={match.id}
                    className={isSelected ? 'duplicate-row--selected' : undefined}
                  >
                    <td>
                      <span className={`duplicate-tier-badge duplicate-tier-badge--${tier}`}>
                        {duplicateTierLabel(tier)}
                      </span>
                    </td>
                    <td>{describeDuplicate(match)}</td>
                    <td>{match.emails?.primaryEmail ?? '—'}</td>
                    <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onSelectDuplicate(match.id)}
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
            <p className="small-text">
              Selected donor:&nbsp;
              <code>{selectedDuplicateId}</code>
            </p>
          ) : (
            <p className="small-text">Select a donor or search the directory.</p>
          )}
        </div>
      ) : (
        <div className="duplicate-hint-actions">
          <button type="button" className="secondary-button" onClick={onOpenSearch} disabled={disableActions}>
            Search donors…
          </button>
        </div>
      )}

      {potentialDuplicateMessage ? (
        <div className="form-alert form-alert-warning" role="alert">
          {potentialDuplicateMessage}
        </div>
      ) : null}
    </>
  );
}
