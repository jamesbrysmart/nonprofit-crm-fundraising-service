import { useMemo } from 'react';

interface SummaryProps {
  statusSummary: {
    total: number;
    needsAttention: number;
    eligibleNow: number;
    processFailed: number;
    processed: number;
  };
  searchValue: string;
  onSearchChange(value: string): void;
  sortValue: string;
  sortOptions: Array<{ value: string; label: string }>;
  onSortChange(value: string): void;
  columnOptions: Array<{ key: string; label: string; required?: boolean }>;
  visibleColumns: string[];
  onToggleColumn(key: string): void;
  intakeSummary: Array<{ label: string; count: number }>;
  batchSummary: Array<{ label: string; count: number }>;
  batchDiagnosticsSummary: {
    blockers: Array<{ label: string; count: number }>;
    warnings: Array<{ label: string; count: number }>;
    lowIdentityCount: number;
    total: number;
  } | null;
  activeIntakeSources: string[];
  activeBatchId: string | null;
  hasActiveFilters: boolean;
  actionError: string | null;
  loading: boolean;
  isRefreshing: boolean;
  showDuplicatesOnly: boolean;
  highValueOnly: boolean;
  refresh(): Promise<void>;
  onClearFilters(): void;
  onToggleIntakeSource(label: string): void;
  onSelectBatch(label: string): void;
  onToggleDuplicates(): void;
  onToggleHighValue(): void;
}

const chipBaseClasses =
  'f-chip f-text-xs f-font-semibold f-bg-white f-border f-border-slate-200 f-text-slate-600 hover:f-border-slate-400';
const chipActiveClasses = 'f-border-primary f-bg-primary/10 f-text-primary';
const pillClasses =
  'f-inline-flex f-items-center f-gap-1 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-xs f-font-semibold f-px-3 f-py-1';
const countBadgeClasses =
  'f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-200 f-text-ink f-text-[11px] f-font-semibold f-px-2 f-py-0.5';
const toggleChipBase =
  'f-inline-flex f-items-center f-rounded-full f-border f-border-slate-200 f-bg-white f-px-3 f-py-1.5 f-text-sm f-font-medium f-text-slate-600 hover:f-border-slate-400';
const toggleChipActive = 'f-border-primary f-bg-primary/10 f-text-primary';
const filterChipBase =
  'f-inline-flex f-items-center f-gap-2 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-xs f-font-semibold f-px-3 f-py-1';
const filterChipClear =
  'f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-white f-text-slate-500 f-text-[11px] f-font-bold f-w-4 f-h-4 hover:f-text-slate-700';

export function StagingQueueSummary({
  statusSummary,
  searchValue,
  onSearchChange,
  sortValue,
  sortOptions,
  onSortChange,
  columnOptions,
  visibleColumns,
  onToggleColumn,
  intakeSummary,
  batchSummary,
  batchDiagnosticsSummary,
  activeIntakeSources,
  activeBatchId,
  hasActiveFilters,
  actionError,
  loading,
  isRefreshing,
  showDuplicatesOnly,
  highValueOnly,
  refresh,
  onClearFilters,
  onToggleIntakeSource,
  onSelectBatch,
  onToggleDuplicates,
  onToggleHighValue,
}: SummaryProps): JSX.Element {
  const statusPills = useMemo(
    () => [
      { label: 'Total', value: statusSummary.total },
      { label: 'Needs attention', value: statusSummary.needsAttention },
      { label: 'Eligible now', value: statusSummary.eligibleNow },
      { label: 'Failed', value: statusSummary.processFailed },
      { label: 'Processed', value: statusSummary.processed },
    ],
    [statusSummary],
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const trimmedSearch = searchValue.trim();
    if (trimmedSearch.length > 0) {
      chips.push({
        key: 'search',
        label: `Search: "${trimmedSearch}"`,
        onClear: () => onSearchChange(''),
      });
    }
    if (activeIntakeSources.length > 0) {
      activeIntakeSources.forEach((source) => {
        chips.push({
          key: `source-${source}`,
          label: `Source: ${source}`,
          onClear: () => onToggleIntakeSource(source),
        });
      });
    }
    if (activeBatchId) {
      chips.push({
        key: 'batch',
        label: `Batch: ${activeBatchId}`,
        onClear: () => onSelectBatch(activeBatchId),
      });
    }
    if (showDuplicatesOnly) {
      chips.push({
        key: 'duplicates',
        label: 'Duplicates only',
        onClear: () => onToggleDuplicates(),
      });
    }
    if (highValueOnly) {
      chips.push({
        key: 'high-value',
        label: 'High value (≥ £1k)',
        onClear: () => onToggleHighValue(),
      });
    }
    return chips;
  }, [
    searchValue,
    activeIntakeSources,
    activeBatchId,
    showDuplicatesOnly,
    highValueOnly,
    onSearchChange,
    onToggleIntakeSource,
    onSelectBatch,
    onToggleDuplicates,
    onToggleHighValue,
  ]);

  const filterCount = activeFilterChips.length;

  return (
    <div className="f-card f-p-4 f-space-y-3">
      <div className="f-flex f-flex-col gap-3 lg:f-flex-row lg:f-items-center lg:f-justify-between">
        <div className="f-flex f-flex-wrap f-gap-2">
          {statusPills.map((pill) => (
            <span key={pill.label} className={pillClasses}>
              {pill.label}: <strong>{pill.value}</strong>
            </span>
          ))}
        </div>
        <div className="f-flex f-flex-wrap f-gap-2">
          <a
            href="/objects/giftStagings"
            target="_blank"
            rel="noopener noreferrer"
            className="f-btn--ghost"
          >
            Open in Twenty
          </a>
          <button
            type="button"
            className="f-btn--secondary"
            onClick={() => {
              void refresh();
            }}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-text-sm f-p-3"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      <div className="f-flex f-flex-col gap-3 lg:f-flex-row lg:f-items-center lg:f-justify-between">
        <div className="f-flex f-flex-wrap f-gap-2 f-items-center">
          <details className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-p-3">
            <summary className="f-text-sm f-font-semibold f-text-ink f-cursor-pointer">
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </summary>
            <div className="f-mt-3 f-space-y-4">
              <div className="f-field">
                <label className="f-field-label">Search</label>
                <input
                  type="text"
                  className="f-input"
                  placeholder="Search staging records"
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>

              <div>
                <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1 f-mt-0">
                  Intake sources
                </p>
                {intakeSummary.length === 0 ? (
                  <span className="f-text-sm f-text-slate-500">No intake sources</span>
                ) : (
                  <div className="f-flex f-flex-wrap f-gap-2">
                    {intakeSummary.map(({ label, count }) => {
                      const isActive = activeIntakeSources.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`${chipBaseClasses} ${isActive ? chipActiveClasses : ''}`}
                          onClick={() => onToggleIntakeSource(label)}
                        >
                          <span>{label}</span>
                          <span className={countBadgeClasses}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {batchSummary.length > 0 ? (
                <div>
                  <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-mb-1 f-mt-0">
                    Gift batches
                  </p>
                  <div className="f-flex f-flex-wrap f-gap-2">
                    {batchSummary.map(({ label, count }) => {
                      const isActive = activeBatchId === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`${chipBaseClasses} ${isActive ? chipActiveClasses : ''}`}
                          onClick={() => onSelectBatch(label)}
                        >
                          <span>{label}</span>
                          <span className={countBadgeClasses}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="f-flex f-flex-wrap f-gap-2">
                <button
                  type="button"
                  className={`${toggleChipBase} ${showDuplicatesOnly ? toggleChipActive : ''}`}
                  onClick={onToggleDuplicates}
                >
                  Duplicates only
                </button>
                <button
                  type="button"
                  className={`${toggleChipBase} ${highValueOnly ? toggleChipActive : ''}`}
                  onClick={onToggleHighValue}
                >
                  High value (≥ £1k)
                </button>
              </div>
            </div>
          </details>

          <div className="f-field">
            <label className="f-field-label">Sort</label>
            <select
              className="f-input"
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <details className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-p-3">
          <summary className="f-text-sm f-font-semibold f-text-ink f-cursor-pointer">
            Fields
          </summary>
          <div className="f-mt-3 f-space-y-2">
            {columnOptions.map((column) => {
              const checked = visibleColumns.includes(column.key);
              return (
                <label
                  key={column.key}
                  className="f-flex f-items-center f-gap-2 f-text-sm f-text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={column.required}
                    onChange={() => onToggleColumn(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
        </details>
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="f-flex f-flex-wrap f-items-center f-gap-2">
          {activeFilterChips.map((chip) => (
            <span key={chip.key} className={filterChipBase}>
              {chip.label}
              <button type="button" className={filterChipClear} onClick={chip.onClear}>
                ×
              </button>
            </span>
          ))}
          {hasActiveFilters ? (
            <button type="button" className="f-btn--ghost" onClick={onClearFilters}>
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}

      {batchDiagnosticsSummary ? (
        <div className="f-rounded-lg f-border f-border-slate-200 f-bg-slate-50/60 f-px-3 f-py-2 f-text-xs f-text-slate-600">
          <div className="f-flex f-flex-wrap f-gap-2 f-items-center">
            <span className="f-font-semibold">Batch diagnostics</span>
            <span className="f-text-slate-500">({batchDiagnosticsSummary.total} gifts)</span>
          </div>
          <div className="f-flex f-flex-col gap-1 f-mt-1">
            {batchDiagnosticsSummary.blockers.length > 0 ? (
              <span>
                Blockers:{' '}
                {batchDiagnosticsSummary.blockers
                  .map(({ label, count }) => `${label} (${count})`)
                  .join(', ')}
              </span>
            ) : (
              <span>Blockers: none</span>
            )}
            {batchDiagnosticsSummary.warnings.length > 0 ? (
              <span>
                Warnings:{' '}
                {batchDiagnosticsSummary.warnings
                  .map(({ label, count }) => `${label} (${count})`)
                  .join(', ')}
              </span>
            ) : (
              <span>Warnings: none</span>
            )}
            {batchDiagnosticsSummary.lowIdentityCount > 0 ? (
              <span>
                Low identity confidence: {batchDiagnosticsSummary.lowIdentityCount}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
