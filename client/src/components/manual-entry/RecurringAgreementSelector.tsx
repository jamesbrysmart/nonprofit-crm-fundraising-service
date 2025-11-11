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
      <div className="f-field">
        <label className="f-inline-flex f-items-center f-gap-2 f-text-sm f-font-medium f-text-slate-700">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(event) => onToggleRecurring(event.target.checked)}
          />
          Part of a recurring agreement
        </label>
      </div>

      {isRecurring ? (
        <div className="f-field">
          <label htmlFor="recurringSearch" className="f-field-label">
            Find recurring agreement
          </label>
          <input
            id="recurringSearch"
            type="text"
            value={recurringSearch}
            onChange={(event) => onRecurringSearchChange(event.target.value)}
            placeholder="Search by agreement ID or donor"
            className="f-input"
          />
          <div className="f-flex f-flex-col f-gap-2">
            {!hasAnyAgreements ? (
              <p className="f-help-text">No agreements available yet.</p>
            ) : filteredRecurringOptions.length === 0 ? (
              <p className="f-help-text">No agreement matches your search.</p>
            ) : (
              filteredRecurringOptions.slice(0, 8).map((agreement) => (
                <button
                  key={agreement.id}
                  type="button"
                  className={
                    selectedRecurringId === agreement.id ? 'f-btn--secondary' : 'f-btn--ghost'
                  }
                  onClick={() => onSelectRecurring(agreement.id)}
                >
                  {agreement.id}
                  {agreement.contactId ? ` · ${agreement.contactId}` : ''}
                  {agreement.status ? ` (${agreement.status})` : ''}
                </button>
              ))
            )}
            {selectedRecurringId ? (
              <p className="f-help-text">
                Selected agreement:&nbsp;
                <code>{selectedRecurringId}</code>
              </p>
            ) : (
              <p className="f-help-text">Select an agreement before continuing.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
