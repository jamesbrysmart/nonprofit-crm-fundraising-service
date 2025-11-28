import { PersonDuplicate } from '../../api';
import {
  describeDuplicate,
  duplicateTierBadgeClass,
  duplicateTierLabel,
  formatMatchDate,
  classifyDuplicateFromContext,
} from './duplicateHelpers';
import { personDuplicateToDisplay } from '../../utils/donorAdapters';

interface DonorSearchModalProps {
  isOpen: boolean;
  onClose(): void;
  searchTerm: string;
  onSearchTermChange(value: string): void;
  onSearchSubmit(event: React.FormEvent<HTMLFormElement>): void;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: PersonDuplicate[];
  onSelectDonor(id: string): void;
  formState: {
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
  };
}

export function DonorSearchModal({
  isOpen,
  onClose,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  searchLoading,
  searchError,
  searchResults,
  onSelectDonor,
  formState,
}: DonorSearchModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="f-modal" role="dialog" aria-modal="true">
      <div className="f-modal-panel">
        <div className="f-flex f-justify-between f-items-center f-gap-4">
          <div>
            <h3 className="f-text-xl f-font-semibold f-text-ink f-m-0">Search donors</h3>
            <p className="f-help-text">Match by name or email before creating a new record.</p>
          </div>
          <button type="button" className="f-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="f-flex f-flex-col sm:f-flex-row f-gap-3" onSubmit={onSearchSubmit}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Name or email"
            className="f-input"
          />
          <button type="submit" className="f-btn--secondary" disabled={searchLoading}>
            {searchLoading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError ? (
          <div className="f-alert f-alert--error" role="alert">
            {searchError}
          </div>
        ) : null}
        {searchLoading ? (
          <div className="f-state-block">Searching donors…</div>
        ) : searchResults.length > 0 ? (
          <table className="f-table">
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Supporter</th>
                <th scope="col">Email</th>
                <th scope="col">Updated</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {searchResults.map((match) => {
                if (!match?.id) {
                  return null;
                }
                const display = personDuplicateToDisplay(match);
                const tier = classifyDuplicateFromContext(display, formState);
                return (
                  <tr key={match.id}>
                    <td>
                      <span className={duplicateTierBadgeClass(tier)}>{duplicateTierLabel(tier)}</span>
                    </td>
                    <td>{describeDuplicate(display)}</td>
                    <td>{display.email ?? '—'}</td>
                    <td>{formatMatchDate(display.updatedAt ?? display.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="f-btn--ghost"
                        onClick={() => onSelectDonor(match.id)}
                      >
                        Use donor
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !searchError && <p className="f-help-text">Enter a name or email to search.</p>
        )}
      </div>
    </div>
  );
}
