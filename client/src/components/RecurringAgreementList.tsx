import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecurringAgreements, RecurringAgreementListItem } from '../api';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

type AgreementStatusTone = 'info' | 'success' | 'warning' | 'danger';

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

function isPausedAgreement(agreement: RecurringAgreementListItem): boolean {
  const status = (agreement.status ?? '').toLowerCase();
  return status === 'paused' || status === 'canceled';
}

function isDelinquentAgreement(agreement: RecurringAgreementListItem): boolean {
  return (agreement.status ?? '').toLowerCase() === 'delinquent';
}

function isOverdueAgreement(agreement: RecurringAgreementListItem): boolean {
  if (!agreement.nextExpectedAt) {
    return false;
  }
  const status = (agreement.status ?? '').toLowerCase();
  if (status !== 'active') {
    return false;
  }
  const nextDate = new Date(agreement.nextExpectedAt);
  if (Number.isNaN(nextDate.getTime())) {
    return false;
  }
  const today = new Date();
  return nextDate.getTime() < today.setHours(0, 0, 0, 0);
}

function agreementStatusTone(agreement: RecurringAgreementListItem): AgreementStatusTone {
  if (isDelinquentAgreement(agreement)) {
    return 'danger';
  }
  if (isPausedAgreement(agreement)) {
    return 'warning';
  }
  if (isOverdueAgreement(agreement)) {
    return 'warning';
  }
  return 'info';
}

export function RecurringAgreementList(): JSX.Element {
  const [agreements, setAgreements] = useState<RecurringAgreementListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'paused' | 'delinquent'>('all');

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

  const summary = useMemo(() => {
    let overdue = 0;
    let paused = 0;
    let delinquent = 0;
    agreements.forEach((agreement) => {
      if (isOverdueAgreement(agreement)) {
        overdue += 1;
      }
      if (isPausedAgreement(agreement)) {
        paused += 1;
      }
      if (isDelinquentAgreement(agreement)) {
        delinquent += 1;
      }
    });
    return {
      total: agreements.length,
      overdue,
      paused,
      delinquent,
      active: agreements.length - paused - delinquent,
    };
  }, [agreements]);

  const rows = useMemo(() => agreements, [agreements]);

  const filteredRows = useMemo(() => {
    switch (activeFilter) {
      case 'overdue':
        return rows.filter((agreement) => isOverdueAgreement(agreement));
      case 'paused':
        return rows.filter((agreement) => isPausedAgreement(agreement));
      case 'delinquent':
        return rows.filter((agreement) => isDelinquentAgreement(agreement));
      default:
        return rows;
    }
  }, [rows, activeFilter]);

  const handleSelectFilter = (filter: 'overdue' | 'paused' | 'delinquent') => {
    setActiveFilter((current) => (current === filter ? 'all' : filter));
  };

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
        <div className="queue-header-actions">
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

      <div className="queue-summary">
        <div className="queue-summary-section">
          <h3>Agreements overview</h3>
          <div className="summary-pill-group">
            <span className="summary-pill">
              Total: <strong>{summary.total}</strong>
            </span>
            <span className="summary-pill">
              Active: <strong>{summary.active}</strong>
            </span>
            <span className="summary-pill">
              Overdue: <strong>{summary.overdue}</strong>
            </span>
            <span className="summary-pill">
              Paused/Canceled: <strong>{summary.paused}</strong>
            </span>
            <span className="summary-pill">
              Delinquent: <strong>{summary.delinquent}</strong>
            </span>
          </div>
        </div>
        <div className="queue-summary-section">
          <h3>Filter focus</h3>
          <div className="summary-chip-group">
            <button
              type="button"
              className={`summary-chip ${activeFilter === 'overdue' ? 'summary-chip--active' : ''}`}
              onClick={() => handleSelectFilter('overdue')}
            >
              Overdue <span className="summary-chip-count">{summary.overdue}</span>
            </button>
            <button
              type="button"
              className={`summary-chip ${activeFilter === 'paused' ? 'summary-chip--active' : ''}`}
              onClick={() => handleSelectFilter('paused')}
            >
              Paused/Canceled <span className="summary-chip-count">{summary.paused}</span>
            </button>
            <button
              type="button"
              className={`summary-chip ${activeFilter === 'delinquent' ? 'summary-chip--active' : ''}`}
              onClick={() => handleSelectFilter('delinquent')}
            >
              Delinquent <span className="summary-chip-count">{summary.delinquent}</span>
            </button>
            {activeFilter !== 'all' ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveFilter('all')}
              >
                Show all
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="queue-state">Loading recurring agreements…</div>
      ) : error ? (
        <div className="queue-state queue-state-error" role="alert">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
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
              {filteredRows.map((agreement) => (
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
                  <td>
                    <span className={`status-pill status-pill--${agreementStatusTone(agreement)}`}>
                      {agreement.status ?? '—'}
                    </span>
                  </td>
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
