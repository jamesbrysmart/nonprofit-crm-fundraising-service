import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  GiftStagingListItem,
  processGiftStaging,
  updateGiftStagingStatus,
} from '../api';
import { GiftStagingListFetchOptions, useGiftStagingList } from '../hooks/useGiftStagingList';
import { GiftStagingDrawer } from './GiftStagingDrawer';
import { GiftDrawerFocus } from './GiftStagingDrawer';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const HIGH_VALUE_THRESHOLD = 100000;
const intentLabels: Record<string, string> = {
  grant: 'Grant',
  legacy: 'Legacy',
  corporateInKind: 'Corporate',
  standard: 'Standard',
};

type StagingStatusTone = 'info' | 'success' | 'warning' | 'danger';

function getProcessingStatusMeta(
  item: GiftStagingListItem,
): { label: string; tone: StagingStatusTone } {
  const promotionStatus = item.processingStatus ?? item.promotionStatus ?? 'pending';
  const validationStatus = item.validationStatus ?? 'pending';
  const dedupeStatus = item.dedupeStatus ?? 'pending';

  if (promotionStatus === 'commit_failed') {
    return { label: 'Commit failed', tone: 'danger' };
  }

  if (promotionStatus === 'committed') {
    return { label: 'Committed', tone: 'success' };
  }

  if (promotionStatus === 'ready_for_commit') {
    return { label: 'Ready to process', tone: 'info' };
  }

  const needsValidation = validationStatus !== 'passed';
  const needsDedupeReview = dedupeStatus === 'needs_review';

  if (needsValidation || needsDedupeReview) {
    return { label: 'Needs review', tone: 'warning' };
  }

  return { label: 'Pending', tone: 'info' };
}

function getAlertFlags(item: GiftStagingListItem): string[] {
  const alerts = new Set<string>();
  if ((item.dedupeStatus ?? '') === 'needs_review') {
    alerts.add('Possible duplicate');
  }
  if (!item.donorId) {
    alerts.add('Donor unresolved');
  }
  if (typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate')) {
    alerts.add('Duplicate warning');
  }
  if (item.recurringAgreementId) {
    alerts.add('Recurring');
  }
  if (typeof item.amountMinor === 'number' && item.amountMinor >= HIGH_VALUE_THRESHOLD) {
    alerts.add('High value');
  }
  return Array.from(alerts);
}

function getIntentLabel(intent?: string): string | undefined {
  if (!intent) {
    return undefined;
  }
  return intentLabels[intent] ?? intent;
}

function statusToneClass(tone: StagingStatusTone): string {
  switch (tone) {
    case 'success':
      return 'status-pill--success';
    case 'warning':
      return 'status-pill--warning';
    case 'danger':
      return 'status-pill--danger';
    default:
      return 'status-pill--info';
  }
}

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

function formatAmount(item: GiftStagingListItem): string {
  if (typeof item.amountMinor !== 'number') {
    return '—';
  }
  const currency = item.currency ?? 'GBP';
  const formatter =
    currencyFormatters.get(currency) ??
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(currency, formatter);
  }

  const pounds = item.amountMinor / 100;
  return formatter.format(pounds);
}

function resolveDonor(item: GiftStagingListItem): string {
  const fullName = [item.donorFirstName, item.donorLastName]
    .filter((part) => part && part.trim().length > 0)
    .join(' ')
    .trim();
  const email = item.donorEmail?.trim();

  const segments: string[] = [];

  if (fullName.length > 0) {
    segments.push(fullName);
  }

  if (email && email.length > 0) {
    segments.push(`<${email}>`);
  }

  if (item.donorId) {
    if (segments.length > 0) {
      segments.push(`ID ${item.donorId}`);
    } else {
      segments.push(`Linked donor (${item.donorId})`);
    }
  }

  if (segments.length === 0) {
    return 'Pending donor resolution';
  }

  return segments.join(' · ');
}

function formatDedupeStatus(status?: string): { label: string; tone: 'info' | 'success' | 'warning' } {
  switch (status) {
    case 'matched_existing':
      return { label: 'Auto-matched', tone: 'success' };
    case 'needs_review':
      return { label: 'Needs review', tone: 'warning' };
    default:
      return { label: status ?? '—', tone: 'info' };
  }
}

export function StagingQueue(): JSX.Element {
  const [recurringFilterInput, setRecurringFilterInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<GiftStagingListFetchOptions>({});
  const { items, loading, isRefreshing, error, refresh } = useGiftStagingList(activeFilters);
  const [selectedStagingId, setSelectedStagingId] = useState<string | null>(null);
  const [drawerFocus, setDrawerFocus] = useState<GiftDrawerFocus>('overview');
  const [processingIds, setProcessingIds] = useState<Record<string, 'mark-ready' | 'process'>>(
    {},
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [highValueOnly, setHighValueOnly] = useState(false);

  const openDrawer = useCallback((stagingId: string, focus: GiftDrawerFocus = 'overview') => {
    setSelectedStagingId(stagingId);
    setDrawerFocus(focus);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedStagingId(null);
  }, []);

  const applyFilter = useCallback(
    (updates: GiftStagingListFetchOptions) => {
      setActiveFilters((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [],
  );

  const clearFilterKey = useCallback(
    (key: keyof GiftStagingListFetchOptions) => {
      setActiveFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const handleApplyRecurringFilter = () => {
    const trimmed = recurringFilterInput.trim();
    if (trimmed.length > 0) {
      applyFilter({ recurringAgreementId: trimmed });
    } else {
      clearFilterKey('recurringAgreementId');
    }
  };

  const activeIntakeSources = activeFilters.intakeSources ?? [];
  const hasActiveFilters =
    Boolean(activeBatchId) ||
    activeIntakeSources.length > 0 ||
    showDuplicatesOnly ||
    highValueOnly ||
    Boolean(activeFilters.recurringAgreementId) ||
    Boolean(activeFilters.search);

  const handleSelectIntakeSource = (source: string) => {
    if (activeIntakeSources.includes(source)) {
      clearFilterKey('intakeSources');
    } else {
      applyFilter({ intakeSources: [source] });
    }
  };

  const handleSelectBatch = (batchId: string) => {
    setActiveBatchId((current) => (current === batchId ? null : batchId));
  };

  const handleClearFilters = () => {
    if (activeFilters.intakeSources) {
      clearFilterKey('intakeSources');
    }
    if (activeFilters.recurringAgreementId) {
      clearFilterKey('recurringAgreementId');
    }
    if (activeFilters.search) {
      clearFilterKey('search');
    }
    setActiveBatchId(null);
    setShowDuplicatesOnly(false);
    setHighValueOnly(false);
  };

  const derivedRows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        formattedDate: formatDate(item.updatedAt ?? item.createdAt),
        formattedAmount: formatAmount(item),
        donorSummary: resolveDonor(item),
        dedupeStatusMeta: formatDedupeStatus(item.dedupeStatus),
        statusMeta: getProcessingStatusMeta(item),
        expectedAtDisplay: item.expectedAt ? formatDate(item.expectedAt) : '—',
        hasRecurringMetadata: Boolean(
          item.provider ||
            item.providerPaymentId ||
            item.recurringAgreementId ||
            item.expectedAt,
        ),
        hasGiftDuplicate:
          typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate'),
        alertFlags: getAlertFlags(item),
        isHighValue:
          typeof item.amountMinor === 'number' && item.amountMinor >= HIGH_VALUE_THRESHOLD,
        intentLabel: getIntentLabel(item.giftIntent),
      })),
    [items],
  );

  const filteredRows = useMemo(() => {
    let rows = derivedRows;
    if (activeBatchId) {
      rows = rows.filter((row) => row.giftBatchId === activeBatchId);
    }
    if (showDuplicatesOnly) {
      rows = rows.filter(
        (row) =>
          row.dedupeStatusMeta.label !== 'Auto-matched' ||
          row.hasGiftDuplicate,
      );
    }
    if (highValueOnly) {
      rows = rows.filter((row) => row.isHighValue);
    }
    return rows;
  }, [derivedRows, activeBatchId, showDuplicatesOnly, highValueOnly]);

  useEffect(() => {
    if (activeBatchId && !derivedRows.some((row) => row.giftBatchId === activeBatchId)) {
      setActiveBatchId(null);
    }
  }, [derivedRows, activeBatchId]);

  const statusSummary = useMemo(() => {
    let needsReview = 0;
    let ready = 0;
    let commitFailed = 0;
    let committed = 0;
    derivedRows.forEach((row) => {
      const tone = row.statusMeta.tone;
      const label = row.statusMeta.label;
      if (label === 'Commit failed') {
        commitFailed += 1;
      } else if (label === 'Committed') {
        committed += 1;
      } else if (label === 'Ready to process') {
        ready += 1;
      } else if (tone === 'warning') {
        needsReview += 1;
      }
    });
    return {
      total: derivedRows.length,
      needsReview,
      ready,
      commitFailed,
      committed,
    };
  }, [derivedRows]);

  const intakeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    derivedRows.forEach((row) => {
      const key = row.intakeSource?.trim() && row.intakeSource.length > 0 ? row.intakeSource : 'Unknown source';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [derivedRows]);

  const batchSummary = useMemo(() => {
    const counts = new Map<string, number>();
    derivedRows.forEach((row) => {
      if (row.giftBatchId) {
        counts.set(row.giftBatchId, (counts.get(row.giftBatchId) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [derivedRows]);

  const markReady = useCallback(
    async (stagingId: string) => {
      setProcessingIds((prev) => ({ ...prev, [stagingId]: 'mark-ready' }));
      setActionError(null);
      try {
        await updateGiftStagingStatus(stagingId, {
          promotionStatus: 'ready_for_commit',
          validationStatus: 'passed',
        });
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to mark staging record ready.';
        setActionError(message);
      } finally {
        setProcessingIds((prev) => {
          const next = { ...prev };
          delete next[stagingId];
          return next;
        });
      }
    },
    [refresh],
  );

  const processNow = useCallback(
    async (stagingId: string) => {
      setProcessingIds((prev) => ({ ...prev, [stagingId]: 'process' }));
      setActionError(null);
      try {
        const response = await processGiftStaging(stagingId);
        if (response.status !== 'committed') {
          const summary =
            response.status === 'deferred'
              ? `Processing deferred (${response.reason ?? 'not ready'})`
              : `Processing failed (${response.error ?? 'unknown error'})`;
          setActionError(summary);
        }
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to process staging record.';
        setActionError(message);
      } finally {
        setProcessingIds((prev) => {
          const next = { ...prev };
          delete next[stagingId];
          return next;
        });
      }
    },
    [refresh],
  );

  const retryProcessing = useCallback(
    async (stagingId: string) => {
      await markReady(stagingId);
      await processNow(stagingId);
    },
    [markReady, processNow],
  );

  return (
    <section>
      <div className="queue-header">
        <div className="queue-heading">
          <h2>Staging queue</h2>
          <p className="small-text">
            Latest staged gifts sorted by most recently updated. Use refresh after new submissions.
          </p>
        </div>
        <div className="queue-header-actions">
          {hasActiveFilters ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleClearFilters}
              disabled={loading}
            >
              Clear filters
            </button>
          ) : null}
          <a
            href="/objects/giftStagings"
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-link"
          >
            Open in Twenty
          </a>
          <button
            type="button"
            className="secondary-button"
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
        <div className="queue-state queue-state-error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="queue-summary">
        <div className="queue-summary-section">
          <h3>Status overview</h3>
          <div className="summary-pill-group">
            <span className="summary-pill">
              Total: <strong>{statusSummary.total}</strong>
            </span>
            <span className="summary-pill">
              Needs review: <strong>{statusSummary.needsReview}</strong>
            </span>
            <span className="summary-pill">
              Ready: <strong>{statusSummary.ready}</strong>
            </span>
            <span className="summary-pill">
              Commit failed: <strong>{statusSummary.commitFailed}</strong>
            </span>
            <span className="summary-pill">
              Committed: <strong>{statusSummary.committed}</strong>
            </span>
          </div>
        </div>
        <div className="queue-summary-section">
          <h3>Intake sources</h3>
          <div className="summary-chip-group">
            {intakeSummary.length === 0 ? (
              <span className="summary-empty">No intake sources</span>
            ) : (
              intakeSummary.map(({ label, count }) => (
                <button
                  key={label}
                  type="button"
                  className={`summary-chip ${
                    activeIntakeSources.includes(label) ? 'summary-chip--active' : ''
                  }`}
                  onClick={() => handleSelectIntakeSource(label)}
                >
                  {label} <span className="summary-chip-count">{count}</span>
                </button>
              ))
            )}
          </div>
        </div>
        {batchSummary.length > 0 ? (
          <div className="queue-summary-section">
            <h3>Gift batches</h3>
            <div className="summary-chip-group">
              {batchSummary.map(({ label, count }) => (
                <button
                  key={label}
                  type="button"
                  className={`summary-chip ${activeBatchId === label ? 'summary-chip--active' : ''}`}
                  onClick={() => handleSelectBatch(label)}
                >
                  {label} <span className="summary-chip-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="queue-tools">
        <div className="queue-tools-left">
          <button
            type="button"
            className={`chip ${showDuplicatesOnly ? 'chip--active' : ''}`}
            onClick={() => setShowDuplicatesOnly((prev) => !prev)}
          >
            Duplicates
          </button>
          <button
            type="button"
            className={`chip ${highValueOnly ? 'chip--active' : ''}`}
            onClick={() => setHighValueOnly((prev) => !prev)}
          >
            High value (≥ £1k)
          </button>
        </div>
        <div className="queue-tools-right">
          <div className="queue-tools-recurring">
            <label htmlFor="recurring-filter" className="small-text">
              Recurring agreement ID
            </label>
            <div className="queue-tools-recurring-controls">
              <input
                id="recurring-filter"
                type="text"
                value={recurringFilterInput}
                onChange={(event) => setRecurringFilterInput(event.target.value)}
                placeholder="ra_..."
              />
              <button
                type="button"
                className="secondary-button"
                onClick={handleApplyRecurringFilter}
                disabled={loading && !recurringFilterInput}
              >
                Apply
              </button>
              {activeFilters.recurringAgreementId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    clearFilterKey('recurringAgreementId');
                    setRecurringFilterInput('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="queue-state">Loading staging records…</div>
      ) : error ? (
        <div className="queue-state queue-state-error" role="alert">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="queue-state">No staging records found.</div>
      ) : (
        <div className="queue-table-wrapper">
          <table className="queue-table">
            <thead>
              <tr>
                <th scope="col">Staging ID</th>
                <th scope="col">Donor</th>
                <th scope="col">Amount</th>
                <th scope="col">Updated</th>
                <th scope="col">Status</th>
                <th scope="col">Source</th>
                <th scope="col">Alerts</th>
                <th scope="col" className="queue-col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={row.isHighValue ? 'queue-row queue-row--high-value' : 'queue-row'}
                >
                  <td className="queue-cell-id">
                    <code>{row.id}</code>
                  </td>
                  <td>{row.donorSummary}</td>
                  <td>
                    <div className="queue-amount">
                      <span>{row.formattedAmount}</span>
                      {row.intentLabel ? (
                        <span className="intent-pill">{row.intentLabel}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{row.formattedDate}</td>
                  <td>
                    <span className={`status-pill ${statusToneClass(row.statusMeta.tone)}`}>
                      {row.statusMeta.label}
                    </span>
                  </td>
                  <td>
                    <div className="queue-source">
                      <span>{row.intakeSource ?? '—'}</span>
                      {row.giftBatchId ? (
                        <span className="queue-batch-tag">{row.giftBatchId}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {row.alertFlags.length === 0 ? (
                      '—'
                    ) : (
                      <div className="queue-alerts">
                        {row.alertFlags.map((alert) => (
                          <span key={alert} className="queue-alert">
                            {alert}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="queue-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openDrawer(row.id)}
                    >
                      Review
                    </button>
                    {row.statusMeta.label === 'Ready to process' ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => processNow(row.id)}
                        disabled={processingIds[row.id] === 'process'}
                      >
                        {processingIds[row.id] === 'process' ? 'Processing…' : 'Process now'}
                      </button>
                    ) : null}
                    {row.statusMeta.label === 'Commit failed' ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => retryProcessing(row.id)}
                        disabled={processingIds[row.id] !== undefined}
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GiftStagingDrawer
        stagingId={selectedStagingId}
        focus={drawerFocus}
        onClose={closeDrawer}
        onRefreshList={() => {
          void refresh();
        }}
      />
    </section>
  );
}
