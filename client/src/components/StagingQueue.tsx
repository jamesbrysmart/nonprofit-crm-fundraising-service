import { useState, useMemo, useCallback } from 'react';
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
  const [recurringHealth, setRecurringHealth] = useState({
    pendingReview: 0,
    autoPromoted: 0,
    unlinked: 0,
    lastWebhookAt: null as string | null,
  });

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

  const derivedRows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        formattedDate: formatDate(item.updatedAt ?? item.createdAt),
        formattedAmount: formatAmount(item),
        donorSummary: resolveDonor(item),
        dedupeStatusMeta: formatDedupeStatus(item.dedupeStatus),
        expectedAtDisplay: item.expectedAt ? formatDate(item.expectedAt) : '—',
        hasGiftDuplicate:
          typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate'),
      })),
    [items],
  );

  const filteredRows = useMemo(() => {
    if (!showDuplicatesOnly) {
      return derivedRows;
    }
    return derivedRows.filter(
      (row) =>
        row.dedupeStatusMeta.label !== 'Auto-matched' ||
        row.hasGiftDuplicate,
    );
  }, [derivedRows, showDuplicatesOnly]);

  useEffect(() => {
    const recurringRows = derivedRows.filter((row) => Boolean(row.recurringAgreementId));
    const pendingReview = recurringRows.filter(
      (row) => row.processingStatus !== 'committed' && row.dedupeStatus !== 'matched_existing',
    ).length;
    const autoPromoted = recurringRows.filter(
      (row) => row.processingStatus === 'committed' && row.autoPromote,
    ).length;
    const unlinked = derivedRows.filter((row) => row.hasRecurringMetadata && !row.recurringAgreementId).length;
    const lastAuto = recurringRows
      .filter((row) => row.processingStatus === 'committed')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]?.updatedAt;

    setRecurringHealth({
      pendingReview,
      autoPromoted,
      unlinked,
      lastWebhookAt: lastAuto ? formatDate(lastAuto) : null,
    });
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
        <div className="queue-actions-bar">
          {actionError ? (
            <div className="queue-state queue-state-error" role="alert" style={{ marginRight: '1rem' }}>
              {actionError}
            </div>
          ) : null}
          <div className="recurring-health">
            <h3>Recurring health</h3>
            <dl>
              <div>
                <dt>Pending review</dt>
                <dd>{recurringHealth.pendingReview}</dd>
              </div>
              <div>
                <dt>Auto-promoted</dt>
                <dd>{recurringHealth.autoPromoted}</dd>
              </div>
              <div>
                <dt>Unlinked</dt>
                <dd>{recurringHealth.unlinked}</dd>
              </div>
              <div>
                <dt>Last webhook</dt>
                <dd>{recurringHealth.lastWebhookAt ?? 'n/a'}</dd>
              </div>
            </dl>
          </div>
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

      <div className="queue-filters" style={{ marginBottom: '1.5rem' }}>
        <div className="filter-chip-group">
          <button
            type="button"
            className={`chip ${activeFilters.statuses?.includes('commit_failed') ? 'chip--active' : ''}`}
            onClick={() => {
              if (activeFilters.statuses?.includes('commit_failed')) {
                clearFilterKey('statuses');
              } else {
                applyFilter({ statuses: ['commit_failed'] });
              }
            }}
          >
            Commit failed
          </button>
          <button
            type="button"
            className={`chip ${showDuplicatesOnly ? 'chip--active' : ''}`}
            onClick={() => setShowDuplicatesOnly((prev) => !prev)}
          >
            Duplicates
          </button>
          <button
            type="button"
            className={`chip ${
              activeFilters.intakeSources?.includes('manual_ui') ? 'chip--active' : ''
            }`}
            onClick={() => {
              if (activeFilters.intakeSources?.includes('manual_ui')) {
                clearFilterKey('intakeSources');
              } else {
                applyFilter({ intakeSources: ['manual_ui'] });
              }
            }}
          >
            Manual UI
          </button>
        </div>
        <div className="filter-inline-group">
          <label htmlFor="recurring-filter" className="small-text" style={{ marginRight: '0.75rem' }}>
            Recurring agreement ID
          </label>
          <input
            id="recurring-filter"
            type="text"
            value={recurringFilterInput}
            onChange={(event) => setRecurringFilterInput(event.target.value)}
            placeholder="ra_..."
            style={{ marginRight: '0.75rem' }}
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
              style={{ marginLeft: '0.5rem' }}
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
                <th scope="col">Created</th>
                <th scope="col">Amount</th>
                <th scope="col">Processing</th>
                <th scope="col">Validation</th>
                <th scope="col">Dedupe</th>
                <th scope="col">Intake Source</th>
                <th scope="col">Batch</th>
                <th scope="col">Recurring</th>
                <th scope="col">Expected</th>
                <th scope="col">Provider</th>
                <th scope="col">Donor</th>
                <th scope="col" className="queue-col-actions">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="queue-cell-id">
                    <code>{row.id}</code>
                  </td>
                  <td>{row.formattedDate}</td>
                  <td>{row.formattedAmount}</td>
                  <td>{row.processingStatus ?? '—'}</td>
                  <td>{row.validationStatus ?? '—'}</td>
                  <td>
                    <span
                      className={`status-pill status-pill--${row.dedupeStatusMeta.tone}`}
                    >
                      {row.dedupeStatusMeta.label}
                    </span>
                    {row.hasGiftDuplicate ? (
                      <span className="status-pill status-pill--warning" style={{ marginLeft: '0.35rem' }}>
                        Possible duplicate gift
                      </span>
                    ) : null}
                  </td>
                  <td>{row.intakeSource ?? '—'}</td>
                  <td>{row.giftBatchId ? <code>{row.giftBatchId}</code> : '—'}</td>
                  <td>
                    {row.recurringAgreementId ? <code>{row.recurringAgreementId}</code> : '—'}
                  </td>
                  <td>{row.expectedAtDisplay}</td>
                  <td>{row.provider ?? '—'}</td>
                  <td>{row.donorSummary}</td>
                  <td className="queue-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openDrawer(row.id, 'duplicates')}
                    >
                      Resolve duplicates
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => markReady(row.id)}
                      disabled={processingIds[row.id] === 'mark-ready'}
                    >
                      {processingIds[row.id] === 'mark-ready' ? 'Marking…' : 'Mark ready'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => processNow(row.id)}
                      disabled={processingIds[row.id] === 'process'}
                    >
                      {processingIds[row.id] === 'process' ? 'Processing…' : 'Process now'}
                    </button>
                    {row.processingStatus === 'commit_failed' ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => retryProcessing(row.id)}
                        disabled={processingIds[row.id] !== undefined}
                      >
                        Retry
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openDrawer(row.id)}
                    >
                      View details
                    </button>
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
