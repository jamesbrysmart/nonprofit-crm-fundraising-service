import { GiftPayoutRecord } from '../../api';

interface PayoutTableProps {
  payouts: GiftPayoutRecord[];
  loading: boolean;
  error: string | null;
  onSelect: (payout: GiftPayoutRecord) => void;
}

const formatCurrency = (value?: number, currencyCode?: string): string => {
  if (typeof value !== 'number') {
    return '—';
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode ?? 'GBP',
    minimumFractionDigits: 2,
  });
  return formatter.format(value);
};

const toNet = (payout: GiftPayoutRecord): number | undefined => {
  const gross = payout.depositNetAmount?.value
    ? payout.depositNetAmount.value
    : payout.depositGrossAmount?.value;
  const fee = payout.depositFeeAmount?.value ?? 0;
  if (typeof gross !== 'number') {
    return undefined;
  }
  return gross - fee;
};

const toMatchedNet = (payout: GiftPayoutRecord): number | undefined => {
  const gross = payout.matchedGrossAmount?.value;
  const fee = payout.matchedFeeAmount?.value ?? 0;
  if (typeof gross !== 'number') {
    return undefined;
  }
  return gross - fee;
};

export function PayoutTable({ payouts, loading, error, onSelect }: PayoutTableProps): JSX.Element {
  if (loading) {
    return (
      <div className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-text-sm f-text-slate-600 f-p-4">
        Loading payouts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-text-sm f-p-4" role="alert">
        {error}
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-text-sm f-text-slate-600 f-p-4">
        No payouts found.
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
            <th className={headerCell}>Reference</th>
            <th className={headerCell}>Source</th>
            <th className={headerCell}>Deposit date</th>
            <th className={headerCell}>Deposit net</th>
            <th className={headerCell}>Matched net</th>
            <th className={headerCell}>Variance</th>
            <th className={headerCell}>Status</th>
            <th className={headerCell}>Pending items</th>
            <th className={headerCell}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => {
            const depositNet = toNet(payout);
            const matchedNet = toMatchedNet(payout);
            const variance =
              typeof depositNet === 'number' && typeof matchedNet === 'number'
                ? depositNet - matchedNet
                : undefined;
            const currencyCode =
              payout.depositNetAmount?.currencyCode || payout.depositGrossAmount?.currencyCode || 'GBP';

            const statusTone =
              payout.status === 'reconciled'
                ? 'f-bg-green-50 f-text-green-700'
                : payout.status === 'variance'
                  ? 'f-bg-danger/10 f-text-danger'
                  : payout.status === 'partially_reconciled'
                    ? 'f-bg-amber-50 f-text-amber-700'
                    : 'f-bg-slate-100 f-text-slate-700';

            return (
              <tr key={payout.id} className="hover:f-bg-slate-50">
                <td className={dataCell}>
                  <div className="f-flex f-flex-col">
                    <strong>{payout.payoutReference || payout.id}</strong>
                    <span className="small-text f-text-slate-500">{payout.id}</span>
                  </div>
                </td>
                <td className={dataCell}>{payout.sourceSystem || '—'}</td>
                <td className={dataCell}>{payout.depositDate || '—'}</td>
                <td className={dataCell}>{formatCurrency(depositNet, currencyCode)}</td>
                <td className={dataCell}>{formatCurrency(matchedNet, currencyCode)}</td>
                <td className={dataCell}>
                  {variance === undefined
                    ? '—'
                    : formatCurrency(variance, currencyCode)}
                </td>
                <td className={dataCell}>
                  <span className={`f-inline-flex f-rounded-full f-px-3 f-py-1 f-text-xs f-font-semibold ${statusTone}`}>
                    {payout.status ? payout.status.replace(/_/g, ' ') : 'Pending'}
                  </span>
                </td>
                <td className={dataCell}>{payout.pendingStagingCount ?? 0}</td>
                <td className={dataCell}>
                  <button
                    type="button"
                    className="f-btn--ghost"
                    onClick={() => onSelect(payout)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
