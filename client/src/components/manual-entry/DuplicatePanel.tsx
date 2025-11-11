import { PersonDuplicate } from '../../api';
import {
  describeDuplicate,
  duplicateTierBadgeClass,
  duplicateTierLabel,
  formatMatchDate,
  DuplicateTier,
} from './duplicateHelpers';

interface DuplicatePanelProps {
  classifiedDuplicates: Array<{ match: PersonDuplicate; tier: DuplicateTier }>;
  selectedDuplicateId: string | null;
  onSelectDuplicate(id: string): void;
  onCreateWithNewContact(): void;
  onUseExistingContact(): void;
  onOpenSearch(): void;
  disableActions: boolean;
}

export function DuplicatePanel({
  classifiedDuplicates,
  selectedDuplicateId,
  onSelectDuplicate,
  onCreateWithNewContact,
  onUseExistingContact,
  onOpenSearch,
  disableActions,
}: DuplicatePanelProps): JSX.Element {
  return (
    <div
      className="f-rounded-2xl f-border f-border-slate-200 f-bg-white f-shadow-card f-p-5 f-space-y-4"
      role="status"
      aria-live="polite"
    >
      <div className="f-flex f-flex-col f-gap-1">
        <h2 className="f-text-xl f-font-semibold f-text-ink f-m-0">Possible existing donors</h2>
        <p className="f-help-text">
          We found donors that match the details you entered. Select one to reuse their record or continue to create a new contact.
        </p>
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
                  <span className={duplicateTierBadgeClass(tier)}>{duplicateTierLabel(tier)}</span>
                </td>
                <td>{describeDuplicate(match)}</td>
                <td>{match.emails?.primaryEmail ?? '—'}</td>
                <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
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
      <div className="f-flex f-flex-wrap f-gap-3 f-justify-end">
        <button
          type="button"
          className="f-btn--ghost"
          onClick={onCreateWithNewContact}
          disabled={disableActions}
        >
          Create new contact
        </button>
        <button
          type="button"
          className="f-btn--primary"
          onClick={onUseExistingContact}
          disabled={!selectedDuplicateId || disableActions}
        >
          Use selected donor
        </button>
      </div>
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
    </div>
  );
}
