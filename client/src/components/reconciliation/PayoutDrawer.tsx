import { useEffect, useMemo, useState } from 'react';
import { CurrencyAmount, GiftPayoutRecord, updateGiftPayout } from '../../api';

interface PayoutDrawerProps {
  payout: GiftPayoutRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'partially_reconciled', label: 'Partially reconciled' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'variance', label: 'Variance' },
];

const formatCurrency = (amount?: CurrencyAmount): string => {
  if (!amount || typeof amount.value !== 'number') {
    return '—';
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: amount.currencyCode ?? 'GBP',
    minimumFractionDigits: 2,
  });
  return formatter.format(amount.value);
};

const computeNet = (gross?: CurrencyAmount, fees?: CurrencyAmount): number | undefined => {
  if (!gross || typeof gross.value !== 'number') {
    return undefined;
  }
  const feeValue = typeof fees?.value === 'number' ? fees.value : 0;
  return gross.value - feeValue;
};

export function PayoutDrawer({ payout, open, onClose, onUpdated }: PayoutDrawerProps): JSX.Element | null {
  const [status, setStatus] = useState(payout?.status ?? '');
  const [varianceReason, setVarianceReason] = useState(payout?.varianceReason ?? '');
  const [note, setNote] = useState(payout?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payout) {
      setStatus(payout.status ?? '');
      setVarianceReason(payout.varianceReason ?? '');
      setNote(payout.note ?? '');
      setError(null);
    }
  }, [payout]);

  const depositNet = useMemo(() => computeNet(payout?.depositGrossAmount, payout?.depositFeeAmount), [
    payout,
  ]);
  const matchedNet = useMemo(() => computeNet(payout?.matchedGrossAmount, payout?.matchedFeeAmount), [
    payout,
  ]);
  const variance =
    typeof depositNet === 'number' && typeof matchedNet === 'number'
      ? depositNet - matchedNet
      : undefined;

  if (!open || !payout) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};
      if ((payout.status ?? '') !== status) {
        payload.status = status || null;
      }
      if ((payout.varianceReason ?? '') !== varianceReason) {
        payload.varianceReason = varianceReason || null;
      }
      if ((payout.note ?? '') !== note) {
        payload.note = note || null;
      }
      if (status === 'reconciled' && !payout.confirmedAt) {
        payload.confirmedAt = new Date().toISOString();
      }

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }

      await updateGiftPayout(payout.id, payload);
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update payout.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer">
        <header className="drawer-header">
          <div>
            <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
              Payout detail
            </p>
            <h3 className="f-text-xl f-font-semibold f-text-ink f-m-0">
              {payout.payoutReference || payout.id}
            </h3>
            <p className="small-text f-mt-2 f-mb-0">
              {payout.sourceSystem || 'Unspecified source'} ·
              {payout.depositDate ? ` ${payout.depositDate}` : ' No date'}
            </p>
          </div>
          <button type="button" className="f-btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="f-space-y-4 f-pb-10">
          {error ? (
            <div className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-p-3" role="alert">
              {error}
            </div>
          ) : null}

          <section className="f-card f-space-y-3">
            <h4 className="f-text-base f-font-semibold f-text-ink f-m-0">Summary</h4>
            <div className="f-grid lg:f-grid-cols-3 f-gap-3">
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-slate-50 f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Deposit net</p>
                <p className="f-text-lg f-font-semibold f-m-0">
                  {depositNet !== undefined && payout.depositNetAmount?.currencyCode
                    ? new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: payout.depositNetAmount?.currencyCode ?? 'GBP',
                        minimumFractionDigits: 2,
                      }).format(depositNet)
                    : formatCurrency(payout.depositNetAmount)}
                </p>
              </div>
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-slate-50 f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Matched net</p>
                <p className="f-text-lg f-font-semibold f-m-0">
                  {matchedNet !== undefined && payout.matchedGrossAmount?.currencyCode
                    ? new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: payout.matchedGrossAmount?.currencyCode ?? 'GBP',
                        minimumFractionDigits: 2,
                      }).format(matchedNet)
                    : formatCurrency(payout.matchedGrossAmount)}
                </p>
              </div>
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-slate-50 f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Variance</p>
                <p className={`f-text-lg f-font-semibold f-m-0 ${variance && Math.abs(variance) > 0.01 ? 'f-text-danger' : ''}`}>
                  {variance === undefined || payout.depositGrossAmount?.currencyCode === undefined
                    ? '—'
                    : new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: payout.depositGrossAmount?.currencyCode ?? 'GBP',
                        minimumFractionDigits: 2,
                      }).format(variance)}
                </p>
              </div>
            </div>
            <div className="f-grid lg:f-grid-cols-3 f-gap-3">
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-white f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Expected items</p>
                <p className="f-text-base f-font-semibold f-m-0">
                  {payout.expectedItemCount ?? '—'}
                </p>
              </div>
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-white f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Matched gifts</p>
                <p className="f-text-base f-font-semibold f-m-0">
                  {payout.matchedGiftCount ?? 0}
                </p>
              </div>
              <div className="f-rounded-xl f-border f-border-slate-200 f-bg-white f-p-3">
                <p className="small-text f-m-0 f-text-slate-500">Pending staging</p>
                <p className="f-text-base f-font-semibold f-m-0">
                  {payout.pendingStagingCount ?? 0}
                </p>
              </div>
            </div>
          </section>

          <section className="f-card f-space-y-4">
            <div className="f-grid lg:f-grid-cols-2 f-gap-4">
              <div className="f-field">
                <label htmlFor="payoutStatus" className="f-field-label">
                  Status
                </label>
                <select
                  id="payoutStatus"
                  className="f-input"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">Select status</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f-field">
                <label htmlFor="payoutVariance" className="f-field-label">
                  Variance reason
                </label>
                <input
                  id="payoutVariance"
                  type="text"
                  className="f-input"
                  value={varianceReason}
                  onChange={(event) => setVarianceReason(event.target.value)}
                />
              </div>
            </div>

            <div className="f-field">
              <label htmlFor="payoutNoteDetail" className="f-field-label">
                Internal note
              </label>
              <textarea
                id="payoutNoteDetail"
                className="f-input"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="f-flex f-justify-between f-items-center">
              <p className="small-text f-m-0 f-text-slate-500">
                {payout.confirmedAt
                  ? `Confirmed ${new Date(payout.confirmedAt).toLocaleDateString()}`
                  : 'Not confirmed by finance yet.'}
              </p>
              <div className="f-flex f-gap-2">
                <button
                  type="button"
                  className="f-btn--ghost"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="f-btn--primary"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
