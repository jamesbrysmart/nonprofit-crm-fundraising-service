import { statusToneClass } from './queueStatusTone';
import type { QueueRow } from './stagingQueueUtils';

interface QueueTableProps {
  rows: QueueRow[];
  loading: boolean;
  error: string | null;
  onReview(id: string): void;
  onMarkReady(id: string): void;
  onProcess(id: string): void;
  onRetry(id: string): void;
  processingIds: Record<string, 'mark-ready' | 'process'>;
}

export function StagingQueueTable({
  rows,
  loading,
  error,
  onReview,
  onMarkReady,
  onProcess,
  onRetry,
  processingIds,
}: QueueTableProps): JSX.Element {
  if (loading) {
    return (
      <div className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-text-sm f-text-slate-600 f-p-4">
        Loading staging records…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-text-sm f-p-4"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-text-sm f-text-slate-600 f-p-4">
        No staging records found.
      </div>
    );
  }

  const headerCell =
    'f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3';
  const dataCell = 'f-border-b f-border-slate-100 f-px-3 f-py-4 f-align-top f-text-sm f-text-slate-800';

  return (
    <div className="f-overflow-x-auto f-rounded-xl f-border f-border-slate-200 f-bg-white">
      <table className="f-min-w-full f-text-sm f-text-slate-800">
        <thead>
          <tr>
            <th scope="col" className={headerCell}>
              Staging ID
            </th>
            <th scope="col" className={headerCell}>
              Donor
            </th>
            <th scope="col" className={headerCell}>
              Amount
            </th>
            <th scope="col" className={headerCell}>
              Updated
            </th>
            <th scope="col" className={headerCell}>
              Status
            </th>
            <th scope="col" className={headerCell}>
              Source
            </th>
            <th scope="col" className={headerCell}>
              Alerts
            </th>
            <th scope="col" className={`${headerCell} f-text-right`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`f-transition-colors ${row.isHighValue ? 'f-bg-amber-50/60' : 'f-bg-white'} hover:f-bg-slate-50`}
            >
              <td className={dataCell}>
                <code className="f-inline-flex f-font-mono f-text-xs f-bg-slate-100 f-text-slate-700 f-rounded f-px-2 f-py-0.5">
                  {row.id}
                </code>
              </td>
              <td className={dataCell}>{row.donorSummary}</td>
              <td className={dataCell}>
                <div className="f-flex f-items-center f-gap-2 f-flex-wrap">
                  <span className="f-font-semibold">{row.formattedAmount}</span>
                  {row.intentLabel ? (
                    <span className="f-badge f-bg-slate-100 f-text-slate-600 f-text-xs f-font-semibold">
                      {row.intentLabel}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={dataCell}>{row.formattedDate}</td>
              <td className={dataCell}>
                <div className="f-flex f-flex-col f-gap-1">
                  <span className={statusToneClass(row.statusMeta.tone)}>
                    {row.statusMeta.label}
                  </span>
                  {row.receiptMeta ? (
                    <span
                      className={statusToneClass(
                        row.receiptMeta.tone === 'danger'
                          ? 'danger'
                          : row.receiptMeta.tone === 'warning'
                            ? 'warning'
                            : row.receiptMeta.tone === 'success'
                              ? 'success'
                              : 'info',
                      )}
                    >
                      {row.receiptMeta.label}
                      {row.receiptMeta.policy ? ` (${row.receiptMeta.policy})` : ''}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={dataCell}>
                <div className="f-flex f-items-center f-gap-2 f-flex-wrap">
                  <span>{row.intakeSource ?? '—'}</span>
                  {row.giftBatchId ? (
                    <span className="f-badge f-bg-slate-200 f-text-ink">{row.giftBatchId}</span>
                  ) : null}
                </div>
              </td>
              <td className={dataCell}>
                {row.alertFlags.length === 0 ? (
                  '—'
                ) : (
                  <div className="f-flex f-flex-wrap f-gap-1.5">
                    {row.alertFlags.map((alert) => (
                      <span
                        key={alert}
                        className="f-inline-flex f-items-center f-rounded-full f-bg-amber-100 f-text-amber-800 f-text-xs f-font-medium f-px-2.5 f-py-0.5"
                      >
                        {alert}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className={`${dataCell} f-text-right`}>
                <div className="f-flex f-flex-wrap f-justify-end f-gap-2">
                  <button
                    type="button"
                    className="f-btn--ghost"
                    onClick={() => onReview(row.id)}
                  >
                  Review
                  </button>
                  <button
                    type="button"
                    className="f-btn--ghost"
                    onClick={() => onMarkReady(row.id)}
                    disabled={processingIds[row.id] === 'mark-ready'}
                  >
                    {processingIds[row.id] === 'mark-ready' ? 'Marking…' : 'Mark ready'}
                  </button>
                  {row.statusMeta.label === 'Ready to process' ? (
                    <button
                      type="button"
                      className="f-btn--ghost"
                      onClick={() => onProcess(row.id)}
                      disabled={processingIds[row.id] === 'process'}
                    >
                      {processingIds[row.id] === 'process' ? 'Processing…' : 'Process now'}
                    </button>
                  ) : null}
                  {row.statusMeta.label === 'Commit failed' ? (
                    <button
                      type="button"
                      className="f-btn--ghost"
                      onClick={() => onRetry(row.id)}
                      disabled={processingIds[row.id] !== undefined}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
