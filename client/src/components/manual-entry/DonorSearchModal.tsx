import { PersonDuplicate } from '../../api';
import {
  classifyDuplicate,
  describeDuplicate,
  duplicateTierLabel,
  formatMatchDate,
} from './duplicateHelpers';

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
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>Search donors</h3>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="modal-search" onSubmit={onSearchSubmit}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Name or email"
          />
          <button type="submit" className="secondary-button" disabled={searchLoading}>
            {searchLoading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError ? (
          <div className="form-alert form-alert-error" role="alert">
            {searchError}
          </div>
        ) : null}
        {searchLoading ? (
          <div className="queue-state">Searching donors…</div>
        ) : searchResults.length > 0 ? (
          <table className="modal-table">
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
                const tier = classifyDuplicate(match, formState);
                return (
                  <tr key={match.id}>
                    <td>
                      <span className={`duplicate-tier-badge duplicate-tier-badge--${tier}`}>
                        {duplicateTierLabel(tier)}
                      </span>
                    </td>
                    <td>{describeDuplicate(match)}</td>
                    <td>{match.emails?.primaryEmail ?? '—'}</td>
                    <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
                    <td>
                      <button type="button" className="secondary-button" onClick={() => onSelectDonor(match.id)}>
                        Use donor
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !searchError && <p className="small-text">Enter a name or email to search.</p>
        )}
      </div>
    </div>
  );
}
