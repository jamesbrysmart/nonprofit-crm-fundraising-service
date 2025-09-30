import { useEffect, useMemo, useState } from 'react';
import {
  createGift,
  findPersonDuplicates,
  PersonDuplicate,
} from './api';

interface GiftFormState {
  amountValue: string;
  currencyCode: string;
  giftDate: string;
  giftName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
}

const defaultFormState = (): GiftFormState => ({
  amountValue: '',
  currencyCode: 'GBP',
  giftDate: new Date().toISOString().slice(0, 10),
  giftName: '',
  contactFirstName: '',
  contactLastName: '',
  contactEmail: '',
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
  const [duplicateMatches, setDuplicateMatches] = useState<PersonDuplicate[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    if (!showDuplicates) {
      return;
    }

    setShowDuplicates(false);
    setDuplicateMatches([]);
    setSelectedDuplicateId(null);
  }, [formState.contactFirstName, formState.contactLastName, formState.contactEmail]);

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

  const buildDuplicateLookupPayload = () => {
    const firstName = formState.contactFirstName.trim();
    const lastName = formState.contactLastName.trim();
    const email = formState.contactEmail.trim();

    return {
      firstName,
      lastName,
      email: email.length > 0 ? email : undefined,
      depth: 1,
    };
  };

  const resetAfterSuccess = (response: Awaited<ReturnType<typeof createGift>>) => {
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
    setShowDuplicates(false);
    setDuplicateMatches([]);
    setSelectedDuplicateId(null);
  };

  const submitGift = async (contactId?: string) => {
    const payload = buildGiftPayload(formState, contactId ?? undefined);
    const response = await createGift(payload);
    resetAfterSuccess(response);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    if (showDuplicates) {
      setStatus({
        state: 'error',
        message: 'Select an existing contact below or create a new one to continue.',
      });
      return;
    }

    setStatus({ state: 'submitting' });

    try {
      const matches = await findPersonDuplicates(buildDuplicateLookupPayload());
      const filtered = matches.filter(
        (match): match is PersonDuplicate & { id: string } =>
          typeof match?.id === 'string',
      );

      if (filtered.length > 0) {
        setDuplicateMatches(filtered);
        setShowDuplicates(true);
        setStatus({ state: 'idle' });
        return;
      }

      await submitGift();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const handleUseExistingContact = async () => {
    if (!selectedDuplicateId) {
      return;
    }

    setStatus({ state: 'submitting' });
    try {
      await submitGift(selectedDuplicateId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const handleCreateWithNewContact = async () => {
    setStatus({ state: 'submitting' });
    try {
      await submitGift();
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

              <div className="form-row">
                <label htmlFor="contactEmail">Email (optional)</label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  value={formState.contactEmail}
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
              <button
                type="submit"
                disabled={
                  isSubmitDisabled ||
                  status.state === 'submitting' ||
                  showDuplicates
                }
              >
                {status.state === 'submitting' ? 'Saving…' : 'Create gift'}
              </button>
            </div>
          </form>

          {showDuplicates && duplicateMatches.length > 0 ? (
            <div className="duplicate-panel" role="status" aria-live="polite">
              <h2>Possible existing supporters</h2>
              <p className="small-text">
                We found supporters that match the details you entered. Select one to reuse their
                record or continue to create a new contact.
              </p>
              <ul className="duplicate-list">
                {duplicateMatches.map((match) => {
                  if (!match.id) {
                    return null;
                  }

                  const label = describeDuplicate(match);

                  return (
                    <li key={match.id} className="duplicate-item">
                      <label>
                        <input
                          type="radio"
                          name="existingContact"
                          value={match.id}
                          checked={selectedDuplicateId === match.id}
                          onChange={() => setSelectedDuplicateId(match.id ?? null)}
                          disabled={status.state === 'submitting'}
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="duplicate-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCreateWithNewContact}
                  disabled={status.state === 'submitting'}
                >
                  Create new contact
                </button>
                <button
                  type="button"
                  onClick={handleUseExistingContact}
                  disabled={!selectedDuplicateId || status.state === 'submitting'}
                >
                  Use selected contact
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function buildGiftPayload(state: GiftFormState, existingContactId?: string) {
  const amountValue = Number.parseFloat(state.amountValue);
  if (Number.isNaN(amountValue)) {
    throw new Error('Amount must be numeric');
  }

  const contactFirstName = state.contactFirstName.trim();
  const contactLastName = state.contactLastName.trim();
  const contactEmail = state.contactEmail.trim();

  const payload = {
    amount: {
      currencyCode: state.currencyCode,
      value: amountValue,
    },
    giftDate: state.giftDate,
    name: state.giftName.trim() || undefined,
  } as const;

  if (existingContactId) {
    return {
      ...payload,
      contactId: existingContactId,
    };
  }

  return {
    ...payload,
    contact: {
      firstName: contactFirstName,
      lastName: contactLastName,
      ...(contactEmail.length > 0 ? { email: contactEmail } : {}),
    },
  };
}

function describeDuplicate(match: PersonDuplicate): string {
  const nameFromFull = match.name?.fullName;
  const nameFromParts = [match.name?.firstName, match.name?.lastName]
    .filter((part) => part && part.trim().length > 0)
    .join(' ')
    .trim();

  const formattedName = (nameFromFull ?? nameFromParts).trim();
  const email = match.emails?.primaryEmail?.trim();

  const pieces: string[] = [];
  if (formattedName) {
    pieces.push(formattedName);
  }
  if (email) {
    pieces.push(email);
  }

  const updatedAt = match.updatedAt ?? match.createdAt;
  if (updatedAt) {
    const date = new Date(updatedAt);
    if (!Number.isNaN(date.valueOf())) {
      pieces.push(`Updated ${date.toLocaleDateString()}`);
    }
  }

  return pieces.length > 0 ? pieces.join(' • ') : 'Existing contact';
}
