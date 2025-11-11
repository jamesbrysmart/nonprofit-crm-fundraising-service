import { RecurringAgreementListItem } from '../../api';

interface RecurringAgreementSelectorProps {
  isRecurring: boolean;
  onToggleRecurring(checked: boolean): void;
  recurringSearch: string;
  onRecurringSearchChange(value: string): void;
  filteredRecurringOptions: RecurringAgreementListItem[];
  hasAnyAgreements: boolean;
  selectedRecurringId: string | null;
  onSelectRecurring(id: string): void;
}

export function RecurringAgreementSelector({
  isRecurring,
  onToggleRecurring,
  recurringSearch,
  onRecurringSearchChange,
  filteredRecurringOptions,
  hasAnyAgreements,
  selectedRecurringId,
  onSelectRecurring,
}: RecurringAgreementSelectorProps): JSX.Element {
  return (
    <>
      <div className="form-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(event) => onToggleRecurring(event.target.checked)}
          />
          Part of a recurring agreement
        </label>
      </div>

      {isRecurring ? (
        <div className="form-row">
          <label htmlFor="recurringSearch">Find recurring agreement</label>
          <input
            id="recurringSearch"
            type="text"
            value={recurringSearch}
            onChange={(event) => onRecurringSearchChange(event.target.value)}
            placeholder="Search by agreement ID or donor"
          />
          <div className="recurring-options">
            {!hasAnyAgreements ? (
              <p className="small-text">No agreements available yet.</p>
            ) : filteredRecurringOptions.length === 0 ? (
              <p className="small-text">No agreement matches your search.</p>
            ) : (
              filteredRecurringOptions.slice(0, 8).map((agreement) => (
                <button
                  key={agreement.id}
                  type="button"
                  className={`secondary-button recurring-option ${
                    selectedRecurringId === agreement.id ? 'secondary-button--active' : ''
                  }`}
                  onClick={() => onSelectRecurring(agreement.id)}
                >
                  {agreement.id}
                  {agreement.contactId ? ` · ${agreement.contactId}` : ''}
                  {agreement.status ? ` (${agreement.status})` : ''}
                </button>
              ))
            )}
            {selectedRecurringId ? (
              <p className="small-text">
                Selected agreement:&nbsp;
                <code>{selectedRecurringId}</code>
              </p>
            ) : (
              <p className="small-text">Select an agreement before continuing.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
