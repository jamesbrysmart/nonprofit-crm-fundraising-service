interface StagingQueueFiltersProps {
  showDuplicatesOnly: boolean;
  highValueOnly: boolean;
  onToggleDuplicates(): void;
  onToggleHighValue(): void;
  recurringFilterInput: string;
  onRecurringInputChange(value: string): void;
  onApplyRecurring(): void;
  canClearRecurring: boolean;
  onClearRecurring(): void;
  applyDisabled: boolean;
}

const toggleChipBase =
  'f-inline-flex f-items-center f-rounded-full f-border f-border-slate-200 f-bg-white f-px-3 f-py-1.5 f-text-sm f-font-medium f-text-slate-600 hover:f-border-slate-400';
const toggleChipActive = 'f-border-primary f-bg-primary/10 f-text-primary';

export function StagingQueueFilters({
  showDuplicatesOnly,
  highValueOnly,
  onToggleDuplicates,
  onToggleHighValue,
  recurringFilterInput,
  onRecurringInputChange,
  onApplyRecurring,
  canClearRecurring,
  onClearRecurring,
  applyDisabled,
}: StagingQueueFiltersProps): JSX.Element {
  return (
    <div className="f-flex f-flex-col lg:f-flex-row f-gap-6 f-justify-between f-items-start">
      <div className="f-flex f-flex-wrap f-gap-2">
        <button
          type="button"
          className={`${toggleChipBase} ${showDuplicatesOnly ? toggleChipActive : ''}`}
          onClick={onToggleDuplicates}
        >
          Duplicates
        </button>
        <button
          type="button"
          className={`${toggleChipBase} ${highValueOnly ? toggleChipActive : ''}`}
          onClick={onToggleHighValue}
        >
          High value (≥ £1k)
        </button>
      </div>
      <div className="f-flex-1 f-w-full">
        <label htmlFor="recurring-filter" className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-block f-mb-2">
          Recurring agreement ID
        </label>
        <div className="f-flex f-flex-col sm:f-flex-row f-gap-3">
          <input
            id="recurring-filter"
            type="text"
            value={recurringFilterInput}
            onChange={(event) => onRecurringInputChange(event.target.value)}
            placeholder="ra_..."
            className="f-flex-1 f-rounded-lg f-border f-border-slate-300 f-bg-white f-px-3 f-py-2 f-text-sm f-text-ink focus:f-border-primary focus:f-ring-2 focus:f-ring-primary/20"
          />
          <div className="f-inline-flex f-gap-2">
            <button
              type="button"
              className="secondary-button"
              onClick={onApplyRecurring}
              disabled={applyDisabled}
            >
              Apply
            </button>
            {canClearRecurring ? (
              <button type="button" className="secondary-button" onClick={onClearRecurring}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
