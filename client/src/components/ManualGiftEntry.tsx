import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGift,
  findPersonDuplicates,
  fetchGiftStagingList,
  fetchRecurringAgreements,
  PersonDuplicate,
} from '../api';
import type {
  GiftCreatePayload,
  GiftCreateResponse,
  GiftStagingListItem,
  RecurringAgreementListItem,
} from '../api';

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
  | { state: 'success'; giftId: string };

const initialStatus: FormStatus = { state: 'idle' };

export function ManualGiftEntry(): JSX.Element {
  const [formState, setFormState] = useState<GiftFormState>(() => defaultFormState());
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const [duplicateMatches, setDuplicateMatches] = useState<PersonDuplicate[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  const [duplicateLookupError, setDuplicateLookupError] = useState<string | null>(null);
  const [potentialDuplicateMessage, setPotentialDuplicateMessage] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringSearch, setRecurringSearch] = useState('');
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);
  const [recurringOptions, setRecurringOptions] = useState<RecurringAgreementListItem[]>([]);
  const duplicateLookupTimeout = useRef<number | undefined>(undefined);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PersonDuplicate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const openSearchModal = () => {
    setIsSearchModalOpen(true);
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchLoading(false);
  };

  const handleSelectSupporter = (
    supporterId: string | null | undefined,
    options: { closeModal?: boolean } = {},
  ) => {
    if (!supporterId) {
      return;
    }
    setSelectedDuplicateId(supporterId);
    setShowDuplicates(false);
    if (options.closeModal ?? true) {
      closeSearchModal();
    }
  };

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();

    let firstName = formState.contactFirstName.trim();
    let lastName = formState.contactLastName.trim();
    let email = formState.contactEmail.trim();

    if (trimmed.length > 0) {
      if (trimmed.includes('@')) {
        email = trimmed;
      } else {
        const parts = trimmed.split(/\s+/);
        if (parts.length === 1) {
          firstName = parts[0];
          // keep existing last name as fallback
        } else {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    if (firstName.length < 2 || lastName.length < 2) {
      setSearchError('Provide at least a first and last name, or include an email address.');
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    try {
      const matches = await findPersonDuplicates({
        firstName,
        lastName,
        email: email && email.length > 0 ? email : undefined,
        depth: 1,
      });
      setSearchResults(matches);
      if (matches.length === 0) {
        setSearchError('No supporters found for that search.');
      }
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!showDuplicates) {
      return;
    }

    setShowDuplicates(false);
    setDuplicateMatches([]);
    setSelectedDuplicateId(null);
  }, [formState.contactFirstName, formState.contactLastName, formState.contactEmail]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const agreements = await fetchRecurringAgreements({ limit: 100 });
        if (!cancelled) {
          setRecurringOptions(agreements);
        }
      } catch {
        // ignore failures for now
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (duplicateLookupTimeout.current) {
      window.clearTimeout(duplicateLookupTimeout.current);
    }

    const firstName = formState.contactFirstName.trim();
    const lastName = formState.contactLastName.trim();
    const email = formState.contactEmail.trim();

    if (firstName.length < 2 || lastName.length < 2) {
      setDuplicateLookupError(null);
      if (!showDuplicates) {
        setDuplicateMatches([]);
        setSelectedDuplicateId(null);
      }
      return;
    }

    duplicateLookupTimeout.current = window.setTimeout(() => {
      void (async () => {
        try {
          const matches = await findPersonDuplicates({
            firstName,
            lastName,
            email: email.length > 0 ? email : undefined,
            depth: 1,
          });
          setDuplicateLookupError(null);
          if (!showDuplicates) {
            setDuplicateMatches(matches);
            if (matches.length === 0) {
              setSelectedDuplicateId(null);
            } else if (!selectedDuplicateId && matches.length === 1 && matches[0]?.id) {
              setSelectedDuplicateId(matches[0].id);
            }
          }
        } catch (error) {
          setDuplicateLookupError(
            error instanceof Error ? error.message : 'Unable to check for duplicates.',
          );
        }
      })();
    }, 400);

    return () => {
      if (duplicateLookupTimeout.current) {
        window.clearTimeout(duplicateLookupTimeout.current);
      }
    };
  }, [
    formState.contactFirstName,
    formState.contactLastName,
    formState.contactEmail,
    showDuplicates,
    selectedDuplicateId,
  ]);

  useEffect(() => {
    setPotentialDuplicateMessage(null);
    const donorId = selectedDuplicateId;
    if (!donorId) {
      return;
    }
    const amountMajor = Number.parseFloat(formState.amountValue);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      return;
    }
    const giftDate = formState.giftDate;
    if (!giftDate) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchGiftStagingList({ limit: 50 });
        if (cancelled) {
          return;
        }
        const amountMinor = Math.round(amountMajor * 100);
        const target = new Date(giftDate).getTime();
        const duplicate = (response.data ?? []).find((item: GiftStagingListItem) => {
          if (item.donorId !== donorId) {
            return false;
          }
          if (typeof item.amountMinor !== 'number') {
            return false;
          }
          if (item.amountMinor !== amountMinor) {
            return false;
          }
          if (!item.dateReceived) {
            return false;
          }
          const existing = new Date(item.dateReceived).getTime();
          return Math.abs(existing - target) <= 24 * 60 * 60 * 1000;
        });
        if (duplicate) {
          setPotentialDuplicateMessage(
            'A staged gift with the same supporter, amount, and date already exists. Double-check before continuing.',
          );
        } else {
          setPotentialDuplicateMessage(null);
        }
      } catch {
        // ignore lookup failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDuplicateId, formState.amountValue, formState.giftDate]);

  const isSubmitDisabled = useMemo(() => {
    if (!formState.amountValue || Number.isNaN(Number.parseFloat(formState.amountValue))) {
      return true;
    }
    if (!formState.contactFirstName.trim() || !formState.contactLastName.trim()) {
      return true;
    }
    if (isRecurring && !selectedRecurringId) {
      return true;
    }
    return false;
  }, [
    formState.amountValue,
    formState.contactFirstName,
    formState.contactLastName,
    isRecurring,
    selectedRecurringId,
  ]);

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

  const handleSuccess = (giftId: string) => {
    setStatus({
      state: 'success',
      giftId,
    });
    setFormState(defaultFormState());
    setShowDuplicates(false);
    setDuplicateMatches([]);
    setSelectedDuplicateId(null);
    setDuplicateLookupError(null);
    setPotentialDuplicateMessage(null);
    setIsRecurring(false);
    setSelectedRecurringId(null);
    setRecurringSearch('');
    closeSearchModal();
  };

  const createGiftForContact = async (contactId?: string): Promise<string> => {
    if (isRecurring && !selectedRecurringId) {
      throw new Error('Select a recurring agreement before creating the gift.');
    }
    const payload: GiftCreatePayload = {
      ...buildGiftPayload(formState, contactId ?? undefined),
      autoPromote: true,
    };

    if (isRecurring && selectedRecurringId) {
      payload.recurringAgreementId = selectedRecurringId;
    }

    const response: GiftCreateResponse = await createGift(payload);
    const giftId = response.data?.createGift?.id;

    if (!giftId) {
      throw new Error('Create gift response missing id');
    }

    return giftId;
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

      const giftId = await createGiftForContact();
      handleSuccess(giftId);
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
      const giftId = await createGiftForContact(selectedDuplicateId);
      handleSuccess(giftId);
      setShowDuplicates(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const handleCreateWithNewContact = async () => {
    setStatus({ state: 'submitting' });
    try {
      const giftId = await createGiftForContact();
      handleSuccess(giftId);
      setShowDuplicates(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create gift. Please try again.';
      setStatus({ state: 'error', message });
    }
  };

  const giftLink = status.state === 'success' ? '/objects/gifts' : undefined;

  const filteredRecurringOptions = useMemo(() => {
    const query = recurringSearch.trim().toLowerCase();
    if (query.length === 0) {
      return recurringOptions;
    }
    return recurringOptions.filter((agreement) => {
      return (
        agreement.id.toLowerCase().includes(query) ||
        (agreement.contactId && agreement.contactId.toLowerCase().includes(query)) ||
        (agreement.status && agreement.status.toLowerCase().includes(query))
      );
    });
  }, [recurringOptions, recurringSearch]);

  const classifiedDuplicates = useMemo(() => {
    const order: Record<DuplicateTier, number> = {
      exact: 0,
      review: 1,
      partial: 2,
    };
    return duplicateMatches
      .map((match) => ({
        match,
        tier: classifyDuplicate(match, formState),
      }))
      .sort((a, b) => order[a.tier] - order[b.tier]);
  }, [duplicateMatches, formState]);

  const selectedSupporter = useMemo(() => {
    if (!selectedDuplicateId) {
      return undefined;
    }
    const merged: Record<string, PersonDuplicate> = {};
    for (const candidate of duplicateMatches.concat(searchResults)) {
      if (candidate?.id) {
        merged[candidate.id] = candidate;
      }
    }
    return merged[selectedDuplicateId];
  }, [duplicateMatches, searchResults, selectedDuplicateId]);

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

          {selectedSupporter ? (
            <div className="supporter-summary" role="status" aria-live="polite">
              <div className="supporter-summary-header">
                <h4>Selected supporter</h4>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={openSearchModal}
                  disabled={status.state === 'submitting'}
                >
                  Change supporter
                </button>
              </div>
              <dl className="supporter-summary-meta">
                <div>
                  <dt>Name</dt>
                  <dd>{describeDuplicate(selectedSupporter)}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedSupporter.emails?.primaryEmail ?? '—'}</dd>
                </div>
                <div>
                  <dt>Supporter ID</dt>
                  <dd>{selectedSupporter.id}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatMatchDate(selectedSupporter.updatedAt ?? selectedSupporter.createdAt)}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {duplicateLookupError ? (
            <div className="form-alert form-alert-error" role="alert">
              {duplicateLookupError}
            </div>
          ) : null}

          {!showDuplicates && classifiedDuplicates.length > 0 ? (
            <div className="duplicate-hint">
              <div className="duplicate-hint-header">
                <p className="small-text">Possible existing supporters:</p>
                <button type="button" className="secondary-button" onClick={openSearchModal}>
                  Search supporters…
                </button>
              </div>
              <table className="duplicate-table">
                <thead>
                  <tr>
                    <th scope="col">Match</th>
                    <th scope="col">Supporter</th>
                    <th scope="col">Email</th>
                    <th scope="col">Updated</th>
                    <th scope="col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {classifiedDuplicates.map(({ match, tier }) => {
                    if (!match?.id) {
                      return null;
                    }
                    const isSelected = selectedDuplicateId === match.id;
                    const fullName = describeDuplicate(match);
                    const email = match.emails?.primaryEmail ?? '—';
                    return (
                      <tr
                        key={match.id}
                        className={isSelected ? 'duplicate-row--selected' : undefined}
                      >
                        <td>
                          <span className={`duplicate-tier-badge duplicate-tier-badge--${tier}`}>
                            {duplicateTierLabel(tier)}
                          </span>
                        </td>
                        <td>{fullName}</td>
                        <td>{email}</td>
                        <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleSelectSupporter(match.id, { closeModal: false })}
                          >
                            {isSelected ? 'Selected' : 'Use supporter'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedDuplicateId ? (
                <p className="small-text">
                  Selected supporter:&nbsp;
                  <code>{selectedDuplicateId}</code>
                </p>
              ) : (
                <p className="small-text">
                  Select a supporter or search the directory.
                </p>
              )}
            </div>
          ) : (
            <div className="duplicate-hint-actions">
              <button type="button" className="secondary-button" onClick={openSearchModal}>
                Search supporters…
              </button>
            </div>
          )}

          {potentialDuplicateMessage ? (
            <div className="form-alert form-alert-warning" role="alert">
              {potentialDuplicateMessage}
            </div>
          ) : null}

          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIsRecurring(checked);
                  if (!checked) {
                    setSelectedRecurringId(null);
                    setRecurringSearch('');
                  }
                }}
              />
              Part of a recurring agreement
            </label>
          </div>

          {isRecurring ? (
            <div className="form-row">
              <label htmlFor="recurringSearch">Find recurring agreement</label>
              <input
                id="recurringSearch"
                type="text"
                value={recurringSearch}
                onChange={(event) => setRecurringSearch(event.target.value)}
                placeholder="Search by agreement ID or supporter"
              />
              <div className="recurring-options">
                {recurringOptions.length === 0 ? (
                  <p className="small-text">No agreements available yet.</p>
                ) : filteredRecurringOptions.length === 0 ? (
                  <p className="small-text">No agreement matches your search.</p>
                ) : (
                  filteredRecurringOptions.slice(0, 8).map((agreement) => (
                    <button
                      key={agreement.id}
                      type="button"
                      className={`secondary-button recurring-option ${
                        selectedRecurringId === agreement.id ? 'secondary-button--active' : ''
                      }`}
                      onClick={() => setSelectedRecurringId(agreement.id)}
                    >
                      {agreement.id}
                      {agreement.contactId ? ` · ${agreement.contactId}` : ''}
                      {agreement.status ? ` (${agreement.status})` : ''}
                    </button>
                  ))
                )}
                {selectedRecurringId ? (
                  <p className="small-text">
                    Selected agreement:&nbsp;
                    <code>{selectedRecurringId}</code>
                  </p>
                ) : (
                  <p className="small-text">Select an agreement before continuing.</p>
                )}
              </div>
            </div>
          ) : null}
        </fieldset>

        {status.state === 'error' && (
          <div className="form-alert form-alert-error" role="alert">
            {status.message}
          </div>
        )}

        {status.state === 'success' && (
          <div className="form-alert form-alert-success" role="status">
            Gift committed in Twenty (gift id {status.giftId}).
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

      {showDuplicates && classifiedDuplicates.length > 0 ? (
        <div className="duplicate-panel" role="status" aria-live="polite">
          <h2>Possible existing supporters</h2>
          <p className="small-text">
            We found supporters that match the details you entered. Select one to reuse their
            record or continue to create a new contact.
          </p>
          <table className="duplicate-table">
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Supporter</th>
                <th scope="col">Email</th>
                <th scope="col">Updated</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {classifiedDuplicates.map(({ match, tier }) => {
                if (!match?.id) {
                  return null;
                }
                const isSelected = selectedDuplicateId === match.id;
                const fullName = describeDuplicate(match);
                const email = match.emails?.primaryEmail ?? '—';
                return (
                  <tr
                    key={match.id}
                    className={isSelected ? 'duplicate-row--selected' : undefined}
                  >
                    <td>
                      <span className={`duplicate-tier-badge duplicate-tier-badge--${tier}`}>
                        {duplicateTierLabel(tier)}
                      </span>
                    </td>
                    <td>{fullName}</td>
                    <td>{email}</td>
                    <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleSelectSupporter(match.id, { closeModal: false })}
                        disabled={status.state === 'submitting'}
                      >
                        {isSelected ? 'Selected' : 'Use supporter'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              Use selected supporter
            </button>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={openSearchModal}
            disabled={status.state === 'submitting'}
          >
            Search supporters…
          </button>
        </div>
      ) : null}

      {isSearchModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h3>Search supporters</h3>
              <button type="button" className="secondary-button" onClick={closeSearchModal}>
                Close
              </button>
            </div>
            <form className="modal-search" onSubmit={handleSearchSubmit}>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name or email"
              />
              <button type="submit" className="secondary-button" disabled={searchLoading}>
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </form>
            {searchError ? (
              <div className="form-alert form-alert-error" role="alert">
                {searchError}
              </div>
            ) : null}
            {searchLoading ? (
              <div className="queue-state">Searching supporters…</div>
            ) : searchResults.length > 0 ? (
              <table className="modal-table">
                <thead>
                  <tr>
                    <th scope="col">Match</th>
                    <th scope="col">Supporter</th>
                    <th scope="col">Email</th>
                    <th scope="col">Updated</th>
                    <th scope="col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((match) => {
                    if (!match?.id) {
                      return null;
                    }
                    const tier = classifyDuplicate(match, formState);
                    const fullName = describeDuplicate(match);
                    const email = match.emails?.primaryEmail ?? '—';
                    return (
                      <tr key={match.id}>
                        <td>
                          <span className={`duplicate-tier-badge duplicate-tier-badge--${tier}`}>
                            {duplicateTierLabel(tier)}
                          </span>
                        </td>
                        <td>{fullName}</td>
                        <td>{email}</td>
                        <td>{formatMatchDate(match.updatedAt ?? match.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleSelectSupporter(match.id)}
                          >
                            Use supporter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              !searchError && <p className="small-text">Enter a name or email to search.</p>
            )}
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

type DuplicateTier = 'exact' | 'review' | 'partial';

function classifyDuplicate(match: PersonDuplicate, state: GiftFormState): DuplicateTier {
  const contactEmail = state.contactEmail.trim().toLowerCase();
  const matchEmail = match.emails?.primaryEmail?.trim().toLowerCase() ?? '';
  if (contactEmail && matchEmail && contactEmail === matchEmail) {
    return 'exact';
  }

  const contactFull = `${state.contactFirstName} ${state.contactLastName}`
    .trim()
    .toLowerCase();
  const matchFull = (
    match.name?.fullName ??
    `${match.name?.firstName ?? ''} ${match.name?.lastName ?? ''}`
  )
    .trim()
    .toLowerCase();

  if (contactFull && matchFull && contactFull === matchFull) {
    return 'review';
  }

  if (matchFull) {
    const first = state.contactFirstName.trim().toLowerCase();
    const last = state.contactLastName.trim().toLowerCase();
    if ((last && matchFull.includes(last)) || (first && matchFull.includes(first))) {
      return 'review';
    }
  }

  return 'partial';
}

function duplicateTierLabel(tier: DuplicateTier): string {
  switch (tier) {
    case 'exact':
      return 'Exact email';
    case 'review':
      return 'Likely match';
    default:
      return 'Partial match';
  }
}

function formatMatchDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
}
