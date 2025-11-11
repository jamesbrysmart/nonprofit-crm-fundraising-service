import { useMemo } from 'react';

interface SummaryProps {
  statusSummary: {
    total: number;
    needsReview: number;
    ready: number;
    commitFailed: number;
    committed: number;
  };
  intakeSummary: Array<{ label: string; count: number }>;
  batchSummary: Array<{ label: string; count: number }>;
  activeIntakeSources: string[];
  activeBatchId: string | null;
  hasActiveFilters: boolean;
  actionError: string | null;
  loading: boolean;
  isRefreshing: boolean;
  refresh(): Promise<void>;
  onClearFilters(): void;
  onToggleIntakeSource(label: string): void;
  onSelectBatch(label: string): void;
}

const chipBaseClasses =
  'f-chip f-text-sm f-font-medium f-bg-white f-border f-border-slate-200 f-text-slate-600 hover:f-border-slate-400';
const chipActiveClasses = 'f-border-primary f-bg-primary/10 f-text-primary';
const pillClasses =
  'f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1';
const countBadgeClasses =
  'f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-200 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5';

export function StagingQueueSummary({
  statusSummary,
  intakeSummary,
  batchSummary,
  activeIntakeSources,
  activeBatchId,
  hasActiveFilters,
  actionError,
  loading,
  isRefreshing,
  refresh,
  onClearFilters,
  onToggleIntakeSource,
  onSelectBatch,
}: SummaryProps): JSX.Element {
  const statusPills = useMemo(
    () => [
      { label: 'Total', value: statusSummary.total },
      { label: 'Needs review', value: statusSummary.needsReview },
      { label: 'Ready', value: statusSummary.ready },
      { label: 'Commit failed', value: statusSummary.commitFailed },
      { label: 'Committed', value: statusSummary.committed },
    ],
    [statusSummary],
  );

  return (
    <div className="f-card f-p-5 f-space-y-4">
      <div className="f-flex f-flex-col lg:f-flex-row f-items-start f-justify-between f-gap-4">
        <div>
          <h3 className="f-text-lg f-font-semibold f-text-ink f-m-0">Staging queue</h3>
          <p className="f-text-sm f-text-slate-500 f-mt-1 f-mb-0">
            Latest staged gifts sorted by most recently updated. Use refresh after new submissions.
          </p>
        </div>
        <div className="f-flex f-flex-wrap f-gap-3 f-items-center">
          {hasActiveFilters ? (
            <button
              type="button"
              className="f-btn--secondary"
              onClick={onClearFilters}
              disabled={loading}
            >
              Clear filters
            </button>
          ) : null}
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

      <div className="f-grid f-gap-4 lg:f-grid-cols-3">
        <div className="f-space-y-3">
          <h3 className="f-text-base f-font-semibold f-text-ink f-m-0">Status overview</h3>
          <div className="f-flex f-flex-wrap f-gap-2">
            {statusPills.map((pill) => (
              <span key={pill.label} className={pillClasses}>
                {pill.label}: <strong>{pill.value}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="f-space-y-3">
          <h3 className="f-text-base f-font-semibold f-text-ink f-m-0">Intake sources</h3>
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
          <div className="f-space-y-3">
            <h3 className="f-text-base f-font-semibold f-text-ink f-m-0">Gift batches</h3>
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
      </div>
    </div>
  );
}
