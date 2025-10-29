import { useMemo, useState } from 'react';
import { GiftStagingListItem } from '../api';
import { useGiftStagingList } from '../hooks/useGiftStagingList';
import { GiftStagingDrawer } from './GiftStagingDrawer';

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
  const [appliedRecurringFilter, setAppliedRecurringFilter] = useState<string | undefined>(
    undefined,
  );
  const { items, loading, isRefreshing, error, refresh } = useGiftStagingList({
    recurringAgreementId: appliedRecurringFilter,
  });
  const [selectedStagingId, setSelectedStagingId] = useState<string | null>(null);

  const handleApplyFilter = () => {
    const trimmed = recurringFilterInput.trim();
    setAppliedRecurringFilter(trimmed.length > 0 ? trimmed : undefined);
  };

  const handleClearFilter = () => {
    setRecurringFilterInput('');
    setAppliedRecurringFilter(undefined);
  };

  const derivedRows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        formattedDate: formatDate(item.createdAt ?? item.updatedAt),
        formattedAmount: formatAmount(item),
        donorSummary: resolveDonor(item),
        dedupeStatusMeta: formatDedupeStatus(item.dedupeStatus),
        expectedAtDisplay: item.expectedAt ? formatDate(item.expectedAt) : '—',
      })),
    [items],
  );

  return (
    <section>
      <div className="queue-header">
        <div>
          <h2>Staging queue</h2>
          <p className="small-text">
            Latest staged gifts sorted by most recently updated. Use refresh after new submissions.
          </p>
        </div>
        <div className="queue-actions-bar">
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
          onClick={handleApplyFilter}
          disabled={loading && !appliedRecurringFilter}
        >
          Apply
        </button>
        {appliedRecurringFilter && (
          <button
            type="button"
            className="secondary-button"
            style={{ marginLeft: '0.5rem' }}
            onClick={handleClearFilter}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="queue-state">Loading staging records…</div>
      ) : error ? (
        <div className="queue-state queue-state-error" role="alert">
          {error}
        </div>
      ) : derivedRows.length === 0 ? (
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
              {derivedRows.map((row) => (
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
                  </td>
                  <td>{row.intakeSource ?? '—'}</td>
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
                      onClick={() => setSelectedStagingId(row.id)}
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
        onClose={() => setSelectedStagingId(null)}
        onRefreshList={() => {
          void refresh();
        }}
      />
    </section>
  );
}
