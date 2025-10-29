import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecurringAgreements, RecurringAgreementListItem } from '../api';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatAmount(item: RecurringAgreementListItem): string {
  if (typeof item.amountMinor !== 'number') {
    return '—';
  }

  const currency = item.currency ?? 'GBP';
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }

  return formatter.format(item.amountMinor / 100);
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

export function RecurringAgreementList(): JSX.Element {
  const [agreements, setAgreements] = useState<RecurringAgreementListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const records = await fetchRecurringAgreements({ limit: 50 });
        setAgreements(records);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load agreements.';
        setError(message);
        setAgreements([]);
      } finally {
        if (mode === 'refresh') {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const rows = useMemo(() => agreements, [agreements]);

  return (
    <section>
      <div className="queue-header">
        <div>
          <h2>Recurring agreements</h2>
          <p className="small-text">
            Snapshot of active agreements pulled from Twenty metadata. Use this list to confirm
            Stripe or GoCardless webhooks are attaching to the right plan.
          </p>
        </div>
        <div className="queue-actions-bar">
          <a
            href="/objects/recurringAgreements"
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
              void load('refresh');
            }}
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="queue-state">Loading recurring agreements…</div>
      ) : error ? (
        <div className="queue-state queue-state-error" role="alert">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="queue-state">No recurring agreements found.</div>
      ) : (
        <div className="queue-table-wrapper">
          <table className="queue-table">
            <thead>
              <tr>
                <th scope="col">Agreement ID</th>
                <th scope="col">Donor ID</th>
                <th scope="col">Amount</th>
                <th scope="col">Cadence</th>
                <th scope="col">Next expected</th>
                <th scope="col">Status</th>
                <th scope="col">Provider</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((agreement) => (
                <tr key={agreement.id}>
                  <td className="queue-cell-id">
                    <code>{agreement.id}</code>
                  </td>
                  <td>{agreement.contactId ?? '—'}</td>
                  <td>{formatAmount(agreement)}</td>
                  <td>
                    {agreement.cadence ?? '—'}
                    {agreement.intervalCount && agreement.intervalCount > 1
                      ? ` · every ${agreement.intervalCount}`
                      : ''}
                  </td>
                  <td>{formatDate(agreement.nextExpectedAt)}</td>
                  <td>{agreement.status ?? '—'}</td>
                  <td>{agreement.provider ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
