import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CurrencyAmount,
  GiftPayoutRecord,
  GiftRecord,
  fetchGifts,
  linkGiftsToPayout,
  unlinkGiftsFromPayout,
  updateGiftPayout,
} from '../../api';

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

const formatGiftAmount = (gift: GiftRecord): string => {
  if (!gift.amount || typeof gift.amount.value !== 'number') {
    return '—';
  }
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: gift.amount.currencyCode ?? 'GBP',
    minimumFractionDigits: 2,
  });
  return formatter.format(gift.amount.value);
};

const formatGiftDate = (value?: string): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleDateString();
};

const receiptTone = (status?: string): { label: string; className: string } => {
  const normalized = (status ?? '').toLowerCase();
  switch (normalized) {
    case 'sent':
      return { label: 'Receipt sent', className: 'f-badge f-bg-green-100 f-text-green-800' };
    case 'failed':
      return { label: 'Receipt failed', className: 'f-badge f-bg-danger/10 f-text-danger' };
    case 'suppressed':
      return { label: 'Receipt suppressed', className: 'f-badge f-bg-amber-100 f-text-amber-800' };
    case 'pending':
      return { label: 'Receipt pending', className: 'f-badge f-bg-slate-200 f-text-ink' };
    default:
      return { label: 'Receipt unknown', className: 'f-badge f-bg-slate-200 f-text-ink' };
  }
};

export function PayoutDrawer({ payout, open, onClose, onUpdated }: PayoutDrawerProps): JSX.Element | null {
  const [status, setStatus] = useState(payout?.status ?? '');
  const [varianceReason, setVarianceReason] = useState(payout?.varianceReason ?? '');
  const [note, setNote] = useState(payout?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedGifts, setLinkedGifts] = useState<GiftRecord[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [candidateGifts, setCandidateGifts] = useState<GiftRecord[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (payout) {
      setStatus(payout.status ?? '');
      setVarianceReason(payout.varianceReason ?? '');
      setNote(payout.note ?? '');
      setError(null);
    }
  }, [payout]);

  const loadLinkedGifts = useCallback(async () => {
    if (!payout?.id) {
      setLinkedGifts([]);
      return;
    }
    setLinkedLoading(true);
    setLinkedError(null);
    try {
      const records = await fetchGifts({
        giftPayoutId: payout.id,
        limit: 200,
        sort: 'giftDate:desc',
      });
      const filtered = records.filter((gift) => gift.giftPayoutId === payout.id);
      setLinkedGifts(filtered);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load linked gifts.';
      setLinkedError(message);
      setLinkedGifts([]);
    } finally {
      setLinkedLoading(false);
    }
  }, [payout?.id]);

  useEffect(() => {
    if (open && payout) {
      void loadLinkedGifts();
      setLinkInput('');
      setLinkFeedback(null);
      setLinkFormError(null);
      setSelectedCandidateIds(new Set());
    } else if (!open) {
      setLinkedGifts([]);
      setCandidateGifts([]);
      setSelectedCandidateIds(new Set());
    }
  }, [open, payout, loadLinkedGifts]);

  const loadCandidateGifts = useCallback(async () => {
    if (!payout) {
      setCandidateGifts([]);
      return;
    }
    setCandidateLoading(true);
    setCandidateError(null);
    try {
      const records = await fetchGifts({ limit: 200, sort: 'giftDate:desc' });
      const available = records.filter((gift) => !gift.giftPayoutId);

      const maxAmount = payout.depositGrossAmount?.value ?? payout.depositNetAmount?.value;
      const depositDate = payout.depositDate ? new Date(payout.depositDate) : undefined;
      const source = payout.sourceSystem?.toLowerCase().trim();

      const filtered = available.filter((gift) => {
        if (maxAmount) {
          if (!gift.amount || typeof gift.amount.value !== 'number') {
            return false;
          }
          if (gift.amount.value > maxAmount) {
            return false;
          }
        }
        if (depositDate) {
          if (!gift.giftDate) {
            return false;
          }
          const giftDate = new Date(gift.giftDate);
          if (Number.isNaN(giftDate.valueOf())) {
            return false;
          }
          const diffDays = Math.abs(giftDate.getTime() - depositDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 5) {
            return false;
          }
        }
        return true;
      });

      let result = filtered;
      if (source) {
        const sourceMatches = filtered.filter((gift) => {
          if (!gift.intakeSource) {
            return false;
          }
          return gift.intakeSource.toLowerCase().includes(source);
        });
        if (sourceMatches.length > 0) {
          result = sourceMatches;
        }
      }

      setCandidateGifts(result.slice(0, 50));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load suggested gifts.';
      setCandidateError(message);
      setCandidateGifts([]);
    } finally {
      setCandidateLoading(false);
    }
  }, [payout]);

  useEffect(() => {
    if (open && payout) {
      void loadCandidateGifts();
    }
  }, [open, payout, loadCandidateGifts]);

  const toggleCandidateSelection = (giftId: string) => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(giftId)) {
        next.delete(giftId);
      } else {
        next.add(giftId);
      }
      return next;
    });
  };

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
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update payout.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualLinkSubmit = async () => {
    if (!payout) {
      return;
    }
    const ids = linkInput
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (ids.length === 0) {
      setLinkFormError('Enter at least one gift ID.');
      return;
    }
    setLinkFormError(null);
    setLinkFeedback(null);
    setLinking(true);
    try {
      await linkGiftsToPayout(payout.id, ids);
      setLinkInput('');
      setLinkFeedback(ids.length === 1 ? `Linked gift ${ids[0]}.` : `Linked ${ids.length} gifts.`);
      await loadLinkedGifts();
      await loadCandidateGifts();
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link gifts.';
      setLinkFormError(message);
    } finally {
      setLinking(false);
    }
  };

  const handleCandidateLink = async () => {
    if (!payout) {
      return;
    }
    if (selectedCandidateIds.size === 0) {
      setLinkFormError('Select at least one suggested gift.');
      return;
    }
    setLinkFormError(null);
    setLinkFeedback(null);
    setLinking(true);
    try {
      await linkGiftsToPayout(payout.id, Array.from(selectedCandidateIds));
      setSelectedCandidateIds(new Set());
      await loadLinkedGifts();
      await loadCandidateGifts();
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link selected gifts.';
      setLinkFormError(message);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (giftId: string) => {
    if (!payout) {
      return;
    }
    setLinkFormError(null);
    setLinkFeedback(null);
    setUnlinkingId(giftId);
    try {
      await unlinkGiftsFromPayout(payout.id, [giftId]);
      await loadLinkedGifts();
      await loadCandidateGifts();
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlink gift.';
      setLinkFormError(message);
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer drawer--wide">
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

          <section className="f-card f-space-y-3">
            <div className="f-flex f-justify-between f-items-center">
              <h4 className="f-text-base f-font-semibold f-text-ink f-m-0">Linked gifts</h4>
              <div className="f-flex f-gap-2">
                <button
                  type="button"
                  className="f-btn--ghost"
                  onClick={() => {
                    void loadLinkedGifts();
                  }}
                  disabled={linkedLoading}
                >
                  {linkedLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
            {linkedError ? (
              <div
                className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-p-3"
                role="alert"
              >
                {linkedError}
              </div>
            ) : null}
            {linkFeedback ? (
              <div
                className="f-rounded-lg f-border f-border-green-200 f-bg-green-50 f-text-green-700 f-p-3"
                role="status"
              >
                {linkFeedback}
              </div>
            ) : null}
            {linkFormError ? (
              <div
                className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-p-3"
                role="alert"
              >
                {linkFormError}
              </div>
            ) : null}
            {linkedLoading ? (
              <div className="f-state-block">Loading linked gifts…</div>
            ) : linkedGifts.length === 0 ? (
              <div className="f-state-block">
                No gifts linked yet. Add a gift ID below to reconcile this payout.
              </div>
            ) : (
              <div className="f-overflow-x-auto f-rounded-xl f-border f-border-slate-200 f-bg-white">
                <table className="f-min-w-full f-text-sm f-text-slate-800">
                  <thead>
                    <tr>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Gift
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Donor
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Amount
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Gift date
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Receipt
                      </th>
                      <th className="f-text-right f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedGifts.map((gift) => (
                      <tr key={gift.id} className="hover:f-bg-slate-50">
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                          <div className="f-flex f-flex-col">
                            <a
                              href={`/objects/gifts/${gift.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="f-text-primary f-font-semibold"
                            >
                              {gift.id}
                            </a>
                            {gift.name ? (
                              <span className="small-text f-text-slate-500">{gift.name}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                          {gift.contactName || gift.contactId || '—'}
                        </td>
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                          {formatGiftAmount(gift)}
                        </td>
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                          {formatGiftDate(gift.giftDate)}
                        </td>
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                          <div className="f-flex f-flex-col f-gap-1">
                            <span className={receiptTone(gift.receiptStatus).className}>
                              {receiptTone(gift.receiptStatus).label}
                            </span>
                            {gift.receiptPolicyApplied ? (
                              <span className="small-text f-text-slate-500">
                                Policy: {gift.receiptPolicyApplied}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="f-border-b f-border-slate-100 f-px-3 f-py-3 f-text-right">
                          <button
                            type="button"
                            className="f-btn--ghost"
                            onClick={() => {
                              void handleUnlink(gift.id);
                            }}
                            disabled={unlinkingId === gift.id}
                          >
                            {unlinkingId === gift.id ? 'Unlinking…' : 'Unlink'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="f-flex f-flex-col lg:f-flex-row f-gap-2">
              <input
                type="text"
                className="f-input"
                placeholder="Gift IDs (comma or space separated)"
                value={linkInput}
                onChange={(event) => setLinkInput(event.target.value)}
              />
              <button
                type="button"
                className="f-btn--primary lg:f-flex-none"
                onClick={() => {
                  void handleManualLinkSubmit();
                }}
                disabled={linking}
              >
                {linking ? 'Linking…' : 'Link gifts'}
              </button>
            </div>
            <p className="small-text f-text-slate-500 f-m-0">
              Provide one or more gift IDs to associate them with this payout. You must reconcile in
              Twenty to see linked gifts reflected elsewhere.
            </p>
          </section>

          <section className="f-card f-space-y-3">
            <div className="f-flex f-justify-between f-items-center">
              <h4 className="f-text-base f-font-semibold f-text-ink f-m-0">Suggested gifts</h4>
              <button
                type="button"
                className="f-btn--ghost"
                onClick={() => {
                  void loadCandidateGifts();
                }}
                disabled={candidateLoading}
              >
                {candidateLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            {candidateError ? (
              <div
                className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-p-3"
                role="alert"
              >
                {candidateError}
              </div>
            ) : null}
            {candidateLoading ? (
              <div className="f-state-block">Loading suggested gifts…</div>
            ) : candidateGifts.length === 0 ? (
              <div className="f-state-block">
                No suggested gifts within the date or amount range. Adjust the payout details or use
                the manual link option above.
              </div>
            ) : (
              <div className="f-overflow-x-auto f-rounded-xl f-border f-border-slate-200 f-bg-white">
                <table className="f-min-w-full f-text-sm f-text-slate-800">
                  <thead>
                    <tr>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Select
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Gift
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Amount
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Gift date
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Intake source
                      </th>
                      <th className="f-text-left f-text-xs f-font-semibold f-uppercase f-tracking-[0.08em] f-text-slate-500 f-border-b f-border-slate-200 f-py-3 f-px-3">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateGifts.map((gift) => {
                      const checked = selectedCandidateIds.has(gift.id);
                      return (
                        <tr key={gift.id} className="hover:f-bg-slate-50">
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                toggleCandidateSelection(gift.id);
                              }}
                            />
                          </td>
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            <div className="f-flex f-flex-col">
                              <span className="f-font-semibold">{gift.id}</span>
                              {gift.contactName ? (
                                <span className="small-text f-text-slate-500">{gift.contactName}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            {formatGiftAmount(gift)}
                          </td>
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            {formatGiftDate(gift.giftDate)}
                          </td>
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            {gift.intakeSource ?? '—'}
                          </td>
                          <td className="f-border-b f-border-slate-100 f-px-3 f-py-3">
                            <div className="f-flex f-flex-col f-gap-1">
                              <span className={receiptTone(gift.receiptStatus).className}>
                                {receiptTone(gift.receiptStatus).label}
                              </span>
                              {gift.receiptPolicyApplied ? (
                                <span className="small-text f-text-slate-500">
                                  Policy: {gift.receiptPolicyApplied}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="f-flex f-gap-2 f-flex-wrap">
              <button
                type="button"
                className="f-btn--primary"
                onClick={() => {
                  void handleCandidateLink();
                }}
                disabled={linking || selectedCandidateIds.size === 0}
              >
                {linking ? 'Linking…' : 'Link selected'}
              </button>
              <button
                type="button"
                className="f-btn--ghost"
                onClick={() => setSelectedCandidateIds(new Set())}
                disabled={selectedCandidateIds.size === 0}
              >
                Clear selection
              </button>
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
