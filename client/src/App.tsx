import { useMemo, useState } from 'react';
import { createGift } from './api';

interface GiftFormState {
  amountValue: string;
  currencyCode: string;
  giftDate: string;
  giftName: string;
  contactFirstName: string;
  contactLastName: string;
}

const defaultFormState = (): GiftFormState => ({
  amountValue: '',
  currencyCode: 'GBP',
  giftDate: new Date().toISOString().slice(0, 10),
  giftName: '',
  contactFirstName: '',
  contactLastName: '',
});

type FormStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string }
  | { state: 'success'; giftId: string; giftName?: string };

const initialStatus: FormStatus = { state: 'idle' };

export function App(): JSX.Element {
  const [formState, setFormState] = useState<GiftFormState>(() => defaultFormState());
  const [status, setStatus] = useState<FormStatus>(initialStatus);

  const isSubmitDisabled = useMemo(() => {
    if (!formState.amountValue || Number.isNaN(Number.parseFloat(formState.amountValue))) {
      return true;
    }
    return !formState.contactFirstName.trim() || !formState.contactLastName.trim();
  }, [formState.amountValue, formState.contactFirstName, formState.contactLastName]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    setStatus({ state: 'submitting' });

    try {
      const payload = buildGiftPayload(formState);
      const response = await createGift(payload);
      const giftId = response.data?.createGift?.id;
      if (!giftId) {
        throw new Error('Twenty response missing gift ID');
      }

      setStatus({
        state: 'success',
        giftId,
        giftName: response.data?.createGift?.name,
      });
      setFormState(defaultFormState());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const giftLink = status.state === 'success' ? '/objects/gifts' : undefined;

  return (
    <div>
      <main>
        <header style={{ marginBottom: '2.5rem' }}>
          <h1>Fundraising Admin</h1>
          <p className="small-text" style={{ marginTop: '0.75rem' }}>
            Record gifts directly inside Twenty while we prototype the managed-extension UX.
          </p>
        </header>
        <section>
          <form onSubmit={handleSubmit}>
            <fieldset disabled={status.state === 'submitting'} style={{ border: 0, padding: 0 }}>
              <legend style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                Gift details
              </legend>
              <div className="form-row">
                <label htmlFor="amountValue">Amount</label>
                <div className="form-row-inline">
                  <input
                    id="amountValue"
                    name="amountValue"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    required
                    value={formState.amountValue}
                    onChange={handleChange}
                  />
                  <select
                    id="currencyCode"
                    name="currencyCode"
                    value={formState.currencyCode}
                    onChange={handleChange}
                  >
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="giftDate">Gift date</label>
                <input
                  id="giftDate"
                  name="giftDate"
                  type="date"
                  required
                  value={formState.giftDate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label htmlFor="giftName">Gift name (optional)</label>
                <input
                  id="giftName"
                  name="giftName"
                  type="text"
                  placeholder="Spring Appeal Donation"
                  value={formState.giftName}
                  onChange={handleChange}
                />
              </div>

              <legend style={{ fontSize: '1.125rem', fontWeight: 600, margin: '2rem 0 1rem' }}>
                Contact details
              </legend>

              <div className="form-row">
                <label htmlFor="contactFirstName">First name</label>
                <input
                  id="contactFirstName"
                  name="contactFirstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formState.contactFirstName}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label htmlFor="contactLastName">Last name</label>
                <input
                  id="contactLastName"
                  name="contactLastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formState.contactLastName}
                  onChange={handleChange}
                />
              </div>
            </fieldset>

            {status.state === 'error' && (
              <div className="form-alert form-alert-error" role="alert">
                {status.message}
              </div>
            )}

            {status.state === 'success' && (
              <div className="form-alert form-alert-success" role="status">
                Gift saved in Twenty (id {status.giftId}).
                {giftLink ? (
                  <a href={giftLink} className="form-alert-link">
                    Open gifts list
                  </a>
                ) : null}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" disabled={isSubmitDisabled || status.state === 'submitting'}>
                {status.state === 'submitting' ? 'Saving…' : 'Create gift'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function buildGiftPayload(state: GiftFormState) {
  const amountValue = Number.parseFloat(state.amountValue);
  if (Number.isNaN(amountValue)) {
    throw new Error('Amount must be numeric');
  }

  const payload = {
    amount: {
      currencyCode: state.currencyCode,
      value: amountValue,
    },
    giftDate: state.giftDate,
    name: state.giftName.trim() || undefined,
    contact: {
      firstName: state.contactFirstName.trim(),
      lastName: state.contactLastName.trim(),
    },
  };

  return payload;
}
