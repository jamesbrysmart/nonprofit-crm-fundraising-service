import { PersonDuplicate } from '../../api';
import {
  describeDuplicate,
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
    <div className="duplicate-panel" role="status" aria-live="polite">
      <h2>Possible existing donors</h2>
      <p className="small-text">
        We found donors that match the details you entered. Select one to reuse their record or continue to create a new contact.
      </p>
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
              <tr key={match.id} className={isSelected ? 'duplicate-row--selected' : undefined}>
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
      <div className="duplicate-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCreateWithNewContact}
          disabled={disableActions}
        >
          Create new contact
        </button>
        <button
          type="button"
          onClick={onUseExistingContact}
          disabled={!selectedDuplicateId || disableActions}
        >
          Use selected donor
        </button>
      </div>
      <button type="button" className="secondary-button" onClick={onOpenSearch} disabled={disableActions}>
        Search donors…
      </button>
    </div>
  );
}
