import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRecurringAgreements, RecurringAgreementListItem } from '../api';
import { statusToneClass } from './gift-staging/queueStatusTone';

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
    <section className="section-unstyled f-space-y-6">
      <div className="f-card f-p-6 f-space-y-6">
        <div className="f-flex f-flex-col lg:f-flex-row f-gap-4 f-justify-between">
          <div className="f-space-y-1">
            <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
              Recurring agreements
            </p>
            <h2 className="f-text-2xl f-font-semibold f-text-ink f-m-0">Agreement monitor</h2>
            <p className="small-text">
              Snapshot of active agreements pulled from Twenty metadata. Use this list to confirm
              Stripe or GoCardless webhooks are attaching to the right plan.
            </p>
          </div>
          <div className="f-flex f-flex-wrap f-gap-3 f-items-start">
            <a
              href="/objects/recurringAgreements"
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
                void load('refresh');
              }}
              disabled={isRefreshing || loading}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="f-grid f-gap-4 lg:f-grid-cols-2">
          <div className="f-space-y-3">
            <h3 className="f-text-base f-font-semibold f-text-ink f-m-0">Agreements overview</h3>
            <div className="f-flex f-flex-wrap f-gap-2">
              <span className="f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1">
                Total: <strong>{summary.total}</strong>
              </span>
              <span className="f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1">
                Active: <strong>{summary.active}</strong>
              </span>
              <span className="f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1">
                Overdue: <strong>{summary.overdue}</strong>
              </span>
              <span className="f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1">
                Paused/Canceled: <strong>{summary.paused}</strong>
              </span>
              <span className="f-inline-flex f-items-center f-gap-1.5 f-rounded-full f-bg-slate-100 f-text-slate-700 f-text-sm f-font-medium f-px-3 f-py-1">
                Delinquent: <strong>{summary.delinquent}</strong>
              </span>
            </div>
          </div>
          <div className="f-space-y-3">
            <h3 className="f-text-base f-font-semibold f-text-ink f-m-0">Filter focus</h3>
            <div className="f-flex f-flex-wrap f-gap-2">
              <button
                type="button"
                className={`f-chip ${activeFilter === 'overdue' ? 'f-border-primary f-bg-primary/10 f-text-primary' : ''}`}
                onClick={() => handleSelectFilter('overdue')}
              >
                Overdue{' '}
                <span className="f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-200 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5">
                  {summary.overdue}
                </span>
              </button>
              <button
                type="button"
                className={`f-chip ${activeFilter === 'paused' ? 'f-border-primary f-bg-primary/10 f-text-primary' : ''}`}
                onClick={() => handleSelectFilter('paused')}
              >
                Paused/Canceled{' '}
                <span className="f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-200 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5">
                  {summary.paused}
                </span>
              </button>
              <button
                type="button"
                className={`f-chip ${activeFilter === 'delinquent' ? 'f-border-primary f-bg-primary/10 f-text-primary' : ''}`}
                onClick={() => handleSelectFilter('delinquent')}
              >
                Delinquent{' '}
                <span className="f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-200 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5">
                  {summary.delinquent}
                </span>
              </button>
              {activeFilter !== 'all' ? (
                <button
                  type="button"
                  className="f-btn--ghost f-text-sm"
                  onClick={() => setActiveFilter('all')}
                >
                  Show all
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="f-state-block">Loading recurring agreements…</div>
        ) : error ? (
          <div className="f-alert f-alert--error" role="alert">
            {error}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="f-state-block">No recurring agreements found.</div>
        ) : (
          <div className="f-overflow-x-auto f-rounded-xl f-border f-border-slate-200 f-bg-white">
            <table className="f-min-w-full f-text-sm f-text-slate-800">
              <thead>
                <tr>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Agreement ID
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Donor ID
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Amount
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Cadence
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Next expected
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Status
                  </th>
                  <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                    Provider
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((agreement) => (
                  <tr key={agreement.id} className="f-border-b f-border-slate-100">
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      <code className="f-inline-flex f-font-mono f-text-xs f-bg-slate-100 f-text-slate-700 f-rounded f-px-2 f-py-0.5">
                        {agreement.id}
                      </code>
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      {agreement.contactId ?? '—'}
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      {formatAmount(agreement)}
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      {agreement.cadence ?? '—'}
                      {agreement.intervalCount && agreement.intervalCount > 1
                        ? ` · every ${agreement.intervalCount}`
                        : ''}
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      {formatDate(agreement.nextExpectedAt)}
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      <span className={statusToneClass(agreementStatusTone(agreement))}>
                        {agreement.status ?? '—'}
                      </span>
                    </td>
                    <td className="f-border-b f-border-slate-100 f-px-3 f-py-4">
                      {agreement.provider ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
