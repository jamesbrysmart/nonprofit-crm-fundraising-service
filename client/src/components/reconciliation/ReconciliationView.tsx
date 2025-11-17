import { FormEvent, useMemo, useState } from 'react';
import { GiftPayoutRecord } from '../../api';
import { useGiftPayouts, GiftPayoutFilters } from '../../hooks/useGiftPayouts';
import { AddPayoutDrawer } from './AddPayoutDrawer';
import { PayoutDrawer } from './PayoutDrawer';
import { PayoutTable } from './PayoutTable';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'partially_reconciled', label: 'Partially reconciled' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'variance', label: 'Variance' },
];

export function ReconciliationView(): JSX.Element {
  const [filters, setFilters] = useState<GiftPayoutFilters>({});
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
  const [selectedPayout, setSelectedPayout] = useState<GiftPayoutRecord | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { payouts, loading, error, refreshing, refresh } = useGiftPayouts(filters);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    payouts.forEach((payout) => {
      const status = payout.status ?? 'pending';
      counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
  }, [payouts]);

  const unresolvedCount = useMemo(
    () => payouts.filter((payout) => payout.status !== 'reconciled').length,
    [payouts],
  );

  const pendingStagingTotal = useMemo(
    () => payouts.reduce((sum, payout) => sum + (payout.pendingStagingCount ?? 0), 0),
    [payouts],
  );

  const sourceSummary = useMemo(() => {
    const summary = new Map<string, number>();
    payouts.forEach((payout) => {
      const label = payout.sourceSystem?.trim() || 'Unknown';
      summary.set(label, (summary.get(label) ?? 0) + 1);
    });
    return Array.from(summary.entries()).map(([label, count]) => ({ label, count }));
  }, [payouts]);

  const toggleStatus = (value: string) => {
    setFilters((prev) => {
      const current = prev.statuses ?? [];
      const next = current.includes(value)
        ? current.filter((status) => status !== value)
        : [...current, value];
      return {
        ...prev,
        statuses: next,
      };
    });
  };

  const toggleSource = (value: string) => {
    setFilters((prev) => {
      const current = prev.sourceSystems ?? [];
      const next = current.includes(value)
        ? current.filter((source) => source !== value)
        : [...current, value];
      return {
        ...prev,
        sourceSystems: next,
      };
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      search: searchDraft.trim() || undefined,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchDraft('');
  };

  return (
    <section className="f-space-y-6">
      <div className="f-flex f-flex-col lg:f-flex-row f-justify-between f-items-start f-gap-4">
        <div className="f-flex f-flex-wrap f-gap-4 f-w-full">
          <div className="f-card f-flex-1 f-min-w-[180px] f-p-4">
            <p className="small-text f-m-0 f-text-slate-500">Total payouts</p>
            <p className="f-text-2xl f-font-semibold f-m-0">{payouts.length}</p>
          </div>
          <div className="f-card f-flex-1 f-min-w-[180px] f-p-4">
            <p className="small-text f-m-0 f-text-slate-500">Unreconciled</p>
            <p className="f-text-2xl f-font-semibold f-m-0">{unresolvedCount}</p>
          </div>
          <div className="f-card f-flex-1 f-min-w-[180px] f-p-4">
            <p className="small-text f-m-0 f-text-slate-500">Pending staging</p>
            <p className="f-text-2xl f-font-semibold f-m-0">{pendingStagingTotal}</p>
          </div>
        </div>
        <div className="f-flex f-gap-2">
          <button
            type="button"
            className="f-btn--ghost"
            onClick={() => {
              void refresh();
            }}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="f-btn--primary" onClick={() => setIsAddOpen(true)}>
            Add payout
          </button>
        </div>
      </div>

      <div className="f-card f-space-y-4">
        <div className="f-flex f-flex-wrap f-gap-3">
          {STATUS_FILTERS.map((filter) => {
            const isActive = filters.statuses?.includes(filter.value) ?? false;
            const baseClasses =
              'f-inline-flex f-items-center f-gap-2 f-rounded-full f-border f-border-slate-200 f-bg-white f-text-sm f-font-medium f-text-slate-600 f-px-3 f-py-1.5';
            return (
              <button
                key={filter.value}
                type="button"
                className={`${baseClasses} ${isActive ? 'f-border-primary f-bg-primary/10 f-text-primary' : ''}`}
                onClick={() => toggleStatus(filter.value)}
              >
                {filter.label}
                <span className="f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-100 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5">
                  {statusCounts[filter.value] ?? 0}
                </span>
              </button>
            );
          })}
          {filters.statuses?.length ? (
            <button type="button" className="f-btn--ghost f-ml-auto" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="f-flex f-flex-wrap f-gap-3 f-items-center">
          <form className="f-flex f-gap-2" onSubmit={handleSearch}>
            <input
              type="search"
              className="f-input"
              placeholder="Search reference or ID"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <button type="submit" className="f-btn--secondary">
              Search
            </button>
          </form>
          {sourceSummary.length > 0 ? (
            <div className="f-flex f-flex-wrap f-gap-2">
              {sourceSummary.map(({ label, count }) => {
                const isActive = filters.sourceSystems?.includes(label) ?? false;
                const baseClasses =
                  'f-inline-flex f-items-center f-gap-2 f-rounded-full f-border f-border-slate-200 f-bg-white f-text-sm f-font-medium f-text-slate-600 f-px-3 f-py-1.5';
                return (
                  <button
                    key={label}
                    type="button"
                    className={`${baseClasses} ${isActive ? 'f-border-primary f-bg-primary/10 f-text-primary' : ''}`}
                    onClick={() => toggleSource(label)}
                  >
                    {label}
                    <span className="f-inline-flex f-items-center f-justify-center f-rounded-full f-bg-slate-100 f-text-ink f-text-xs f-font-semibold f-px-2 f-py-0.5">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <PayoutTable
        payouts={payouts}
        loading={loading}
        error={error}
        onSelect={(payout) => setSelectedPayout(payout)}
      />

      <PayoutDrawer
        payout={selectedPayout}
        open={Boolean(selectedPayout)}
        onClose={() => setSelectedPayout(null)}
        onUpdated={async () => {
          await refresh();
          setSelectedPayout(null);
        }}
      />

      <AddPayoutDrawer
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={async () => {
          await refresh();
        }}
      />
    </section>
  );
}
