import { useEffect, useMemo, useState } from 'react';
import {
  createGiftStaging,
  findPersonDuplicates,
  PersonDuplicate,
  processGiftStaging,
  updateGiftStagingStatus,
} from '../api';
import type { GiftCreatePayload } from '../api';

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
  | { state: 'success'; giftId: string; stagingId: string };

const initialStatus: FormStatus = { state: 'idle' };

export function ManualGiftEntry(): JSX.Element {
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

  const handleSuccess = (result: { giftId: string; stagingId: string }) => {
    setStatus({
      state: 'success',
      giftId: result.giftId,
      stagingId: result.stagingId,
    });
    setFormState(defaultFormState());
    setShowDuplicates(false);
    setDuplicateMatches([]);
    setSelectedDuplicateId(null);
  };

  const stageAndProcessGift = async (
    contactId?: string,
  ): Promise<{ giftId: string; stagingId: string }> => {
    const payload: GiftCreatePayload = {
      ...buildGiftPayload(formState, contactId ?? undefined),
      autoPromote: false,
    };

    const stagingResponse = await createGiftStaging(payload);
    const stagingId = stagingResponse.data?.giftStaging?.id;

    if (!stagingId) {
      throw new Error('Gift staging response missing id');
    }

    await updateGiftStagingStatus(stagingId, {
      promotionStatus: 'ready_for_commit',
      validationStatus: 'passed',
      dedupeStatus: 'passed',
    });

    const processingResponse = await processGiftStaging(stagingId);

    if (processingResponse.status === 'committed' && processingResponse.giftId) {
      return {
        giftId: processingResponse.giftId,
        stagingId: processingResponse.stagingId,
      };
    }

    if (processingResponse.status === 'deferred') {
      switch (processingResponse.reason) {
        case 'locked':
          throw new Error('Staging record is currently being processed. Please try again shortly.');
        case 'missing_payload':
          throw new Error(
            'Staging record is missing its payload. Review the staging queue before retrying.',
          );
        default:
          throw new Error('Staging record is not ready for processing yet.');
      }
    }

    if (processingResponse.status === 'error') {
      switch (processingResponse.error) {
        case 'fetch_failed':
          throw new Error('Unable to fetch staging record details from Twenty.');
        case 'payload_invalid':
          throw new Error('Staging payload is invalid. Please review the staging record.');
        case 'gift_api_failed':
          throw new Error(
            'Twenty API failed to create the gift. Try again once the issue is resolved.',
          );
        default:
          throw new Error('An unknown error occurred while processing the staging record.');
      }
    }

    throw new Error('Gift staging processing did not complete successfully.');
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

      const result = await stageAndProcessGift();
      handleSuccess(result);
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
      const result = await stageAndProcessGift(selectedDuplicateId);
      handleSuccess(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const handleCreateWithNewContact = async () => {
    setStatus({ state: 'submitting' });
    try {
      const result = await stageAndProcessGift();
      handleSuccess(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const giftLink = status.state === 'success' ? '/objects/gifts' : undefined;

  return (
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
            Gift committed in Twenty (gift id {status.giftId}) from staging record {status.stagingId}.
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
  );
}

function buildGiftPayload(state: GiftFormState, existingContactId?: string): GiftCreatePayload {
  const amountValue = Number.parseFloat(state.amountValue);
  if (Number.isNaN(amountValue)) {
    throw new Error('Amount must be numeric');
  }

  const contactFirstName = state.contactFirstName.trim();
  const contactLastName = state.contactLastName.trim();
  const contactEmail = state.contactEmail.trim();

  const payload: GiftCreatePayload = {
    amount: {
      currencyCode: state.currencyCode,
      value: amountValue,
    },
    giftDate: state.giftDate,
    name: state.giftName.trim() || undefined,
  };

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
  const parts: string[] = [];
  const firstName = match.name?.firstName?.trim() ?? '';
  const lastName = match.name?.lastName?.trim() ?? '';
  const fullName = match.name?.fullName?.trim() ?? '';
  const email = match.emails?.primaryEmail?.trim() ?? '';

  if (fullName.length > 0) {
    parts.push(fullName);
  } else if (firstName || lastName) {
    parts.push(`${firstName} ${lastName}`.trim());
  }

  if (email.length > 0) {
    parts.push(`<${email}>`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Existing supporter';
}
