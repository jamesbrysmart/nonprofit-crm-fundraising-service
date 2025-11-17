import { FormEvent, useState } from 'react';
import { createGiftPayout } from '../../api';

interface AddPayoutDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

interface FormState {
  sourceSystem: string;
  payoutReference: string;
  depositDate: string;
  currency: string;
  depositGross: string;
  depositFees: string;
  depositNet: string;
  expectedItemCount: string;
  note: string;
}

const initialState: FormState = {
  sourceSystem: '',
  payoutReference: '',
  depositDate: '',
  currency: 'GBP',
  depositGross: '',
  depositFees: '',
  depositNet: '',
  expectedItemCount: '',
  note: '',
};

export function AddPayoutDrawer({ open, onClose, onCreated }: AddPayoutDrawerProps): JSX.Element | null {
  const [formState, setFormState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleChange = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetAndClose = () => {
    setFormState(initialState);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const toCurrency = (raw: string) => {
        const parsed = Number.parseFloat(raw);
        if (Number.isNaN(parsed)) {
          return undefined;
        }
        return {
          value: parsed,
          currencyCode: formState.currency || 'GBP',
        };
      };

      const expectedItemCount = formState.expectedItemCount.trim().length
        ? Number.parseInt(formState.expectedItemCount, 10)
        : undefined;

      const payload: Record<string, unknown> = {
        sourceSystem: formState.sourceSystem.trim() || undefined,
        payoutReference: formState.payoutReference.trim() || undefined,
        depositDate: formState.depositDate || undefined,
        depositGrossAmount: toCurrency(formState.depositGross),
        depositFeeAmount: toCurrency(formState.depositFees),
        depositNetAmount: toCurrency(formState.depositNet),
        expectedItemCount: Number.isFinite(expectedItemCount) ? expectedItemCount : undefined,
        note: formState.note.trim() || undefined,
      };

      await createGiftPayout(payload);
      await onCreated();
      resetAndClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payout.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer drawer--wide">
        <header className="drawer-header">
          <div>
            <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
              Reconciliation
            </p>
            <h3 className="f-text-xl f-font-semibold f-text-ink f-m-0">Add payout</h3>
            <p className="small-text f-mt-2 f-mb-0">
              Track a new processor payout or bank deposit for reconciliation.
            </p>
          </div>
          <button type="button" className="f-btn--ghost" onClick={resetAndClose} disabled={submitting}>
            Close
          </button>
        </header>

        <form className="f-space-y-4 f-pb-12" onSubmit={handleSubmit}>
          {error ? (
            <div className="f-rounded-lg f-border f-border-danger/20 f-bg-danger/5 f-text-danger f-p-3" role="alert">
              {error}
            </div>
          ) : null}

          <div className="f-grid lg:f-grid-cols-2 f-gap-4">
            <div className="f-field">
              <label htmlFor="payoutSourceSystem" className="f-field-label">
                Source system
              </label>
              <input
                id="payoutSourceSystem"
                type="text"
                className="f-input"
                value={formState.sourceSystem}
                onChange={(event) => handleChange('sourceSystem', event.target.value)}
                placeholder="Stripe, GoCardless, manual_bank"
              />
            </div>

            <div className="f-field">
              <label htmlFor="payoutReference" className="f-field-label">
                Payout reference
              </label>
              <input
                id="payoutReference"
                type="text"
                className="f-input"
                value={formState.payoutReference}
                onChange={(event) => handleChange('payoutReference', event.target.value)}
                placeholder="POUT-123"
              />
            </div>
          </div>

          <div className="f-grid lg:f-grid-cols-2 f-gap-4">
            <div className="f-field">
              <label htmlFor="payoutDate" className="f-field-label">
                Deposit date
              </label>
              <input
                id="payoutDate"
                type="date"
                className="f-input"
                value={formState.depositDate}
                onChange={(event) => handleChange('depositDate', event.target.value)}
              />
            </div>

            <div className="f-field">
              <label htmlFor="payoutCurrency" className="f-field-label">
                Currency
              </label>
              <select
                id="payoutCurrency"
                className="f-input"
                value={formState.currency}
                onChange={(event) => handleChange('currency', event.target.value)}
              >
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="f-grid lg:f-grid-cols-3 f-gap-4">
            <div className="f-field">
              <label htmlFor="payoutGross" className="f-field-label">
                Gross amount
              </label>
              <input
                id="payoutGross"
                type="number"
                step="0.01"
                className="f-input"
                value={formState.depositGross}
                onChange={(event) => handleChange('depositGross', event.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="f-field">
              <label htmlFor="payoutFees" className="f-field-label">
                Fees amount
              </label>
              <input
                id="payoutFees"
                type="number"
                step="0.01"
                className="f-input"
                value={formState.depositFees}
                onChange={(event) => handleChange('depositFees', event.target.value)}
                placeholder="120"
              />
            </div>
            <div className="f-field">
              <label htmlFor="payoutNet" className="f-field-label">
                Net amount
              </label>
              <input
                id="payoutNet"
                type="number"
                step="0.01"
                className="f-input"
                value={formState.depositNet}
                onChange={(event) => handleChange('depositNet', event.target.value)}
                placeholder="4880"
              />
            </div>
          </div>

          <div className="f-grid lg:f-grid-cols-2 f-gap-4">
            <div className="f-field">
              <label htmlFor="payoutExpectedCount" className="f-field-label">
                Expected transactions
              </label>
              <input
                id="payoutExpectedCount"
                type="number"
                min="0"
                className="f-input"
                value={formState.expectedItemCount}
                onChange={(event) => handleChange('expectedItemCount', event.target.value)}
                placeholder="10"
              />
            </div>
            <div className="f-field">
              <label htmlFor="payoutNote" className="f-field-label">
                Note
              </label>
              <input
                id="payoutNote"
                type="text"
                className="f-input"
                value={formState.note}
                onChange={(event) => handleChange('note', event.target.value)}
                placeholder="September Stripe payout"
              />
            </div>
          </div>

          <div className="f-flex f-justify-end f-gap-3 f-pt-2">
            <button type="button" className="f-btn--ghost" onClick={resetAndClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="f-btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create payout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
