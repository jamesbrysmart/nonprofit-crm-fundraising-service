import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  HouseholdMemberRecord,
  HouseholdRecord,
  MailingAddress,
  PersonDuplicate,
  PersonRecord,
  addHouseholdMember,
  copyHouseholdAddressToMember,
  createHousehold,
  fetchHousehold,
  fetchHouseholdMembers,
  fetchHouseholds,
  fetchPerson,
  removeHouseholdMember,
  updateHousehold,
} from '../api';
import { ContactSearch } from './ContactSearch';

type AddressFormState = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  type: string;
};

const emptyAddressForm: AddressFormState = {
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  type: '',
};

const addressFormFromRecord = (address?: MailingAddress | null): AddressFormState => ({
  line1: address?.line1 ?? '',
  line2: address?.line2 ?? '',
  city: address?.city ?? '',
  region: address?.region ?? '',
  postalCode: address?.postalCode ?? '',
  country: address?.country ?? '',
  type: address?.type ?? '',
});

const mailingAddressFromForm = (form: AddressFormState): MailingAddress | null => {
  const entries = Object.entries(form)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries) as MailingAddress;
};

const formatMemberName = (member: HouseholdMemberRecord): string =>
  member.fullName ||
  [member.firstName, member.lastName].filter(Boolean).join(' ').trim() ||
  member.email ||
  member.id;

const buildEnvelopeName = (person?: PersonRecord | null): string => {
  if (!person) {
    return '';
  }
  if (person.fullName) {
    return person.fullName;
  }
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : '';
};

export function HouseholdManager(): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<HouseholdRecord[]>([]);

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdRecord | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMemberRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  const [editEnvelopeName, setEditEnvelopeName] = useState('');
  const [editSalutationFormal, setEditSalutationFormal] = useState('');
  const [editSalutationInformal, setEditSalutationInformal] = useState('');
  const [editAddress, setEditAddress] = useState<AddressFormState>(emptyAddressForm);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'saving' | 'error' | 'success'>(
    'idle',
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [createName, setCreateName] = useState('');
  const [createEnvelopeName, setCreateEnvelopeName] = useState('');
  const [createSalutationFormal, setCreateSalutationFormal] = useState('');
  const [createSalutationInformal, setCreateSalutationInformal] = useState('');
  const [createAddress, setCreateAddress] = useState<AddressFormState>(emptyAddressForm);
  const [pendingMembers, setPendingMembers] = useState<PersonRecord[]>([]);
  const [primaryPendingId, setPrimaryPendingId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'error' | 'success'>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [duplicateHouseholds, setDuplicateHouseholds] = useState<HouseholdRecord[]>([]);

  const [addMemberContact, setAddMemberContact] = useState<PersonDuplicate | null>(null);
  const [addMemberPerson, setAddMemberPerson] = useState<PersonRecord | null>(null);
  const [addMakePrimary, setAddMakePrimary] = useState(false);
  const [addStatus, setAddStatus] = useState<'idle' | 'saving'>('idle');
  const [addError, setAddError] = useState<string | null>(null);

  const loadHouseholdList = useCallback(
    async (term: string) => {
      setListLoading(true);
      setListError(null);
      try {
        const response = await fetchHouseholds({
          search: term,
          limit: 25,
        });
        const normalizedTerm = term.toLowerCase();
        const filtered = response.households.filter((household) =>
          (household.name ?? '').toLowerCase().includes(normalizedTerm),
        );
        setHouseholds(filtered);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load households.';
        setListError(message);
        setHouseholds([]);
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const loadHouseholdDetails = useCallback(
    async (householdId: string) => {
      setSelectedHouseholdId(householdId);
      setHouseholdLoading(true);
      setHouseholdError(null);
      setUpdateStatus('idle');
      setUpdateError(null);
      setMemberActionError(null);
      try {
        const [record, memberList] = await Promise.all([
          fetchHousehold(householdId),
          fetchHouseholdMembers(householdId, { limit: 50 }),
        ]);

        if (!record) {
          throw new Error('Household not found.');
        }

        setSelectedHousehold(record);
        setMembers(memberList.members);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load household details.';
        setHouseholdError(message);
        setSelectedHousehold(null);
        setMembers([]);
      } finally {
        setHouseholdLoading(false);
        setMembersLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedHousehold) {
      setEditEnvelopeName('');
      setEditSalutationFormal('');
      setEditSalutationInformal('');
      setEditAddress(emptyAddressForm);
      return;
    }

    setEditEnvelopeName(selectedHousehold.envelopeName ?? '');
    setEditSalutationFormal(selectedHousehold.salutationFormal ?? '');
    setEditSalutationInformal(selectedHousehold.salutationInformal ?? '');
    setEditAddress(addressFormFromRecord(selectedHousehold.mailingAddress));
  }, [selectedHousehold]);

  useEffect(() => {
    let cancelled = false;
    const householdIds = new Set<string>();

    for (const member of pendingMembers) {
      if (member.householdId) {
        householdIds.add(member.householdId);
      }
    }

    if (householdIds.size === 0) {
      setDuplicateHouseholds([]);
      return;
    }

    void (async () => {
      const matches: HouseholdRecord[] = [];

      for (const id of householdIds) {
        try {
          const record = await fetchHousehold(id);
          if (!cancelled && record) {
            matches.push(record);
          }
        } catch {
          // ignore missing households
        }
      }

      if (!cancelled) {
        setDuplicateHouseholds(matches);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingMembers]);

  useEffect(() => {
    if (!addMemberContact?.id) {
      setAddMemberPerson(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const person = await fetchPerson(addMemberContact.id ?? '');
        if (!cancelled) {
          setAddMemberPerson(person);
        }
      } catch {
        if (!cancelled) {
          setAddMemberPerson(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addMemberContact]);

  const handleHouseholdSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) {
      setHouseholds([]);
      setListError('Enter at least two characters to search for a household name.');
      return;
    }
    await loadHouseholdList(term);
  };

  const handleQueueMember = async (contact: PersonDuplicate | null) => {
    if (!contact?.id) {
      setCreateError('Select an existing contact to add.');
      return;
    }

    if (pendingMembers.some((member) => member.id === contact.id)) {
      setCreateError('That contact is already in the pending list.');
      return;
    }

    try {
      const person = await fetchPerson(contact.id);
      if (!person) {
        setCreateError('Unable to load contact details. Try again.');
        return;
      }

      setPendingMembers((current) => [...current, person]);
      if (!primaryPendingId) {
        setPrimaryPendingId(person.id);
      }
      if (person.lastName && createName.trim().length === 0) {
        setCreateName(`${person.lastName} Household`);
      }
      if (createEnvelopeName.trim().length === 0) {
        setCreateEnvelopeName(buildEnvelopeName(person));
      }
      setCreateError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load contact details.';
      setCreateError(message);
    }
  };

  const handleRemovePendingMember = (contactId: string) => {
    setPendingMembers((current) => {
      const next = current.filter((member) => member.id !== contactId);
      if (primaryPendingId === contactId) {
        setPrimaryPendingId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleCopyAddressFromPrimary = async () => {
    if (!primaryPendingId) {
      setCreateError('Select a primary member before copying their address.');
      return;
    }
    try {
      const person = await fetchPerson(primaryPendingId);
      if (person?.mailingAddress) {
        setCreateAddress(addressFormFromRecord(person.mailingAddress));
        setCreateError(null);
      } else {
        setCreateError('Primary member has no mailing address to copy.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to copy address.';
      setCreateError(message);
    }
  };

  const handleCreateHousehold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateStatus('saving');
    setCreateError(null);
    setMemberActionError(null);
    try {
      if (pendingMembers.length === 0) {
        throw new Error('Add at least one pending member before creating a household.');
      }

      const payload: Record<string, unknown> = {
        name: createName.trim(),
      };

      const primaryMember = pendingMembers.find((member) => member.id === primaryPendingId);
      if (primaryMember?.id) {
        payload.primaryContactId = primaryMember.id;
      }

      const envelope = createEnvelopeName.trim();
      if (envelope.length > 0) {
        payload.envelopeName = envelope;
      }

      const salutationFormal = createSalutationFormal.trim();
      if (salutationFormal.length > 0) {
        payload.salutationFormal = salutationFormal;
      }

      const salutationInformal = createSalutationInformal.trim();
      if (salutationInformal.length > 0) {
        payload.salutationInformal = salutationInformal;
      }

      const mailingAddress = mailingAddressFromForm(createAddress);
      if (mailingAddress) {
        payload.mailingAddress = mailingAddress;
      }

      if (payload.name.length === 0) {
        throw new Error('Household name is required.');
      }

      const created = await createHousehold(payload);
      setCreateStatus('success');
      const activeSearch = searchTerm.trim().toLowerCase();
      setHouseholds((prev) => {
        if (
          activeSearch.length >= 2 &&
          !(created.name ?? '').toLowerCase().includes(activeSearch)
        ) {
          return prev;
        }

        return [created, ...prev.filter((entry) => entry.id !== created.id)];
      });
      setCreateName('');
      setCreateEnvelopeName('');
      setCreateSalutationFormal('');
      setCreateSalutationInformal('');
      setCreateAddress(emptyAddressForm);
      setPendingMembers([]);
      setPrimaryPendingId(null);
      setDuplicateHouseholds([]);

      for (const member of pendingMembers) {
        await addHouseholdMember(created.id, {
          contactId: member.id,
          makePrimary: member.id === primaryMember?.id,
        });
      }

      await loadHouseholdDetails(created.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create household.';
      setCreateStatus('error');
      setCreateError(message);
    }
  };

  const handleUpdateHousehold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedHouseholdId) {
      return;
    }
    setUpdateStatus('saving');
    setUpdateError(null);
    try {
      const payload = {
        envelopeName: editEnvelopeName.trim() || null,
        salutationFormal: editSalutationFormal.trim() || null,
        salutationInformal: editSalutationInformal.trim() || null,
        mailingAddress: mailingAddressFromForm(editAddress),
      };

      const updated = await updateHousehold(selectedHouseholdId, payload);
      setSelectedHousehold(updated);
      setHouseholds((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setUpdateStatus('success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update household.';
      setUpdateStatus('error');
      setUpdateError(message);
    }
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedHouseholdId) {
      return;
    }
    if (!addMemberContact?.id) {
      setAddError('Select an existing contact to add.');
      return;
    }

    setAddStatus('saving');
    setAddError(null);
    setMemberActionError(null);

    try {
      const member = await addHouseholdMember(selectedHouseholdId, {
        contactId: addMemberContact.id,
        makePrimary: addMakePrimary,
      });
      setMembers((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.id === member.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = member;
          return next;
        }
        return [...prev, member];
      });

      if (addMakePrimary) {
        setSelectedHousehold((current) =>
          current ? { ...current, primaryContactId: member.id } : current,
        );
      }

      setAddMemberContact(null);
      setAddMemberPerson(null);
      setAddMakePrimary(false);
      setAddStatus('idle');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add member.';
      setAddStatus('idle');
      setAddError(message);
    }
  };

  const handleRemoveMember = async (contactId: string) => {
    if (!selectedHouseholdId) {
      return;
    }
    setMemberActionError(null);
    try {
      const record = await removeHouseholdMember(selectedHouseholdId, contactId);
      setMembers((prev) => prev.filter((entry) => entry.id !== record.id));
      if (selectedHousehold?.primaryContactId === record.id) {
        setSelectedHousehold((current) =>
          current ? { ...current, primaryContactId: undefined } : current,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove member.';
      setMemberActionError(message);
    }
  };

  const handleCopyAddress = async (contactId: string) => {
    if (!selectedHouseholdId) {
      return;
    }
    if (!selectedHousehold?.mailingAddress) {
      setMemberActionError('Add a household address before copying to members.');
      return;
    }
    setMemberActionError(null);
    try {
      const updated = await copyHouseholdAddressToMember(selectedHouseholdId, {
        contactId,
        mailingAddress: selectedHousehold.mailingAddress,
      });
      setMembers((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to copy address to contact.';
      setMemberActionError(message);
    }
  };

  const createMailingAddressPreview = useMemo(() => {
    const address = mailingAddressFromForm(createAddress);
    if (!address) {
      return '';
    }

    return [
      address.line1,
      address.line2,
      [address.city, address.region].filter(Boolean).join(', '),
      address.postalCode,
      address.country,
    ]
      .filter(Boolean)
      .join('\n');
  }, [createAddress]);

  return (
    <div className="household-manager">
      <section>
        <h2>Find an existing household</h2>
        <form onSubmit={handleHouseholdSearch} className="horizontal-form">
          <label>
            Search
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Household name"
            />
          </label>
          <button type="submit" disabled={listLoading}>
            {listLoading ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setHouseholds([]);
              setListError(null);
              setSelectedHouseholdId(null);
              setSelectedHousehold(null);
              setMembers([]);
            }}
            disabled={listLoading || searchTerm.trim().length === 0}
          >
            Reset
          </button>
        </form>
        {listError ? <p className="error-text">{listError}</p> : null}
        <ul className="card-list">
          {households.map((household) => (
            <li key={household.id}>
              <button
                type="button"
                className="card-button"
                onClick={() => void loadHouseholdDetails(household.id)}
              >
                <strong>{household.name ?? 'Untitled household'}</strong>
                {household.mailingAddress?.line1 ? (
                  <span className="muted-text">{household.mailingAddress.line1}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedHousehold ? (
        <section>
          <h2>Household details</h2>
          {householdLoading ? <p>Loading household…</p> : null}
          {householdError ? <p className="error-text">{householdError}</p> : null}
          <p>
            <strong>Name:</strong> {selectedHousehold.name}
            {selectedHousehold.primaryContactId ? (
              <>
                {' '}
                · <strong>Primary contact:</strong> {selectedHousehold.primaryContactId}
              </>
            ) : null}
          </p>

          <form onSubmit={handleUpdateHousehold} className="stacked-form">
            <fieldset>
              <legend>Shared salutations &amp; address</legend>
              <label>
                Envelope name
                <input
                  type="text"
                  value={editEnvelopeName}
                  onChange={(event) => setEditEnvelopeName(event.target.value)}
                />
              </label>
              <label>
                Salutation (formal)
                <input
                  type="text"
                  value={editSalutationFormal}
                  onChange={(event) => setEditSalutationFormal(event.target.value)}
                />
              </label>
              <label>
                Salutation (informal)
                <input
                  type="text"
                  value={editSalutationInformal}
                  onChange={(event) => setEditSalutationInformal(event.target.value)}
                />
              </label>
              <label>
                Address line 1
                <input
                  type="text"
                  value={editAddress.line1}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, line1: event.target.value }))
                  }
                />
              </label>
              <label>
                Address line 2
                <input
                  type="text"
                  value={editAddress.line2}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, line2: event.target.value }))
                  }
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  value={editAddress.city}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </label>
              <label>
                Region / County
                <input
                  type="text"
                  value={editAddress.region}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, region: event.target.value }))
                  }
                />
              </label>
              <label>
                Postal code
                <input
                  type="text"
                  value={editAddress.postalCode}
                  onChange={(event) =>
                    setEditAddress((current) => ({
                      ...current,
                      postalCode: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Country
                <input
                  type="text"
                  value={editAddress.country}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, country: event.target.value }))
                  }
                />
              </label>
              <label>
                Address type
                <input
                  type="text"
                  value={editAddress.type}
                  onChange={(event) =>
                    setEditAddress((current) => ({ ...current, type: event.target.value }))
                  }
                  placeholder="e.g. home, mailing"
                />
              </label>
            </fieldset>
            <button type="submit" disabled={updateStatus === 'saving'}>
              {updateStatus === 'saving' ? 'Saving…' : 'Save household'}
            </button>
            {updateStatus === 'success' ? (
              <p className="success-text">Household updated.</p>
            ) : null}
            {updateStatus === 'error' && updateError ? (
              <p className="error-text">{updateError}</p>
            ) : null}
          </form>

          <section>
            <h3>Members</h3>
            {memberActionError ? <p className="error-text">{memberActionError}</p> : null}
            {membersLoading ? <p>Loading members…</p> : null}
            <div className="pending-members">
              <table className="pending-members__table">
                <thead>
                  <tr>
                    <th>Primary</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Current household</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <span>
                          {selectedHousehold?.primaryContactId === member.id ? 'Primary' : '—'}
                        </span>
                      </td>
                      <td>{formatMemberName(member)}</td>
                      <td>{member.email ?? '—'}</td>
                      <td>
                        {member.mailingAddress?.line1 ? (
                          <>
                            {member.mailingAddress.line1}
                            {member.mailingAddress.city ? `, ${member.mailingAddress.city}` : ''}
                          </>
                        ) : (
                          <span className="muted-text">No address</span>
                        )}
                      </td>
                      <td>{member.householdId ?? <span className="muted-text">None</span>}</td>
                      <td>
                        <div className="pending-members__actions">
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void handleCopyAddress(member.id)}
                            disabled={!selectedHousehold?.mailingAddress}
                          >
                            Copy household address
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void handleRemoveMember(member.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleAddMember} className="pending-members pending-members--form">
              <ContactSearch
                label="Add existing contact"
                selectedContact={addMemberContact}
                onSelect={setAddMemberContact}
                helperText="Search by name (add email for better matching)."
              />
              {addMemberPerson?.householdId ? (
                <p className="warning-text">
                  This contact already belongs to household{' '}
                  <strong>{addMemberPerson.householdId}</strong>. Adding them here will move them.
                </p>
              ) : null}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={addMakePrimary}
                  onChange={(event) => setAddMakePrimary(event.target.checked)}
                />
                Make primary contact
              </label>
              <button type="submit" className="primary-button" disabled={addStatus === 'saving'}>
                {addStatus === 'saving' ? 'Adding…' : 'Add to household'}
              </button>
              {addError ? <p className="error-text">{addError}</p> : null}
            </form>
          </section>
        </section>
      ) : null}

      <section>
        <h2>Create new household</h2>
        <form onSubmit={handleCreateHousehold} className="stacked-form">
          <label>
            Household name
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="e.g. Smith Household"
              required
            />
          </label>
          <ContactSearch
            label="Add household member"
            selectedContact={null}
            onSelect={handleQueueMember}
            helperText="Search for each existing contact you want to include."
          />
          {pendingMembers.length > 0 ? (
            <div className="pending-members">
              <div className="pending-members__header">
                <h3>Pending members</h3>
                <p className="small-text">Select the primary contact before creating the household.</p>
              </div>
              <table className="pending-members__table">
                <thead>
                  <tr>
                    <th>Primary</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Current household</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pendingMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <label className="radio">
                          <input
                            type="radio"
                            name="pendingPrimary"
                            checked={primaryPendingId === member.id}
                            onChange={() => setPrimaryPendingId(member.id)}
                          />
                          <span className="sr-only">Primary</span>
                        </label>
                      </td>
                      <td>{member.fullName ?? formatMemberName(member)}</td>
                    <td>{member.email ?? '—'}</td>
                    <td>
                      {member.mailingAddress?.line1 ? (
                        <>
                          {member.mailingAddress.line1}
                          {member.mailingAddress.city ? `, ${member.mailingAddress.city}` : ''}
                          {member.mailingAddress.postalCode
                            ? ` ${member.mailingAddress.postalCode}`
                            : ''}
                        </>
                      ) : (
                        <span className="muted-text">No address</span>
                      )}
                    </td>
                      <td>
                        {member.householdId ? (
                          <span className="warning-text">{member.householdId} (will move)</span>
                        ) : (
                          <span className="muted-text">None</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleRemovePendingMember(member.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small-text">No pending members yet. Add at least one contact.</p>
          )}
          {duplicateHouseholds.length > 0 ? (
            <div className="duplicate-warning">
              <p>
                <strong>These contacts already belong to a household:</strong>
              </p>
              {duplicateHouseholds.map((household) => (
                <div key={household.id} className="duplicate-warning__item">
                  <div className="duplicate-warning__header">
                    <span>{household.name}</span>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setSearchTerm(household.name ?? '');
                        setHouseholds([]);
                        void loadHouseholdDetails(household.id);
                      }}
                    >
                      Open household
                    </button>
                  </div>
                  {household.mailingAddress?.line1 ? (
                    <p className="small-text">
                      {household.mailingAddress.line1}
                      {household.mailingAddress.city ? `, ${household.mailingAddress.city}` : ''}
                      {household.mailingAddress.postalCode
                        ? ` ${household.mailingAddress.postalCode}`
                        : ''}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <label>
            Envelope name
            <input
              type="text"
              value={createEnvelopeName}
              onChange={(event) => setCreateEnvelopeName(event.target.value)}
            />
          </label>
          <label>
            Salutation (formal)
            <input
              type="text"
              value={createSalutationFormal}
              onChange={(event) => setCreateSalutationFormal(event.target.value)}
            />
          </label>
          <label>
            Salutation (informal)
            <input
              type="text"
              value={createSalutationInformal}
              onChange={(event) => setCreateSalutationInformal(event.target.value)}
            />
          </label>

          <fieldset>
            <legend>Household address (optional)</legend>
            <button
              type="button"
              className="address-copy-btn"
              onClick={() => void handleCopyAddressFromPrimary()}
              disabled={!primaryPendingId || createStatus === 'saving'}
            >
              Copy from primary member
            </button>
            <label>
              Address line 1
              <input
                type="text"
                value={createAddress.line1}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, line1: event.target.value }))
                }
              />
            </label>
            <label>
              Address line 2
              <input
                type="text"
                value={createAddress.line2}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, line2: event.target.value }))
                }
              />
            </label>
            <label>
              City
              <input
                type="text"
                value={createAddress.city}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, city: event.target.value }))
                }
              />
            </label>
            <label>
              Region / County
              <input
                type="text"
                value={createAddress.region}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, region: event.target.value }))
                }
              />
            </label>
            <label>
              Postal code
              <input
                type="text"
                value={createAddress.postalCode}
                onChange={(event) =>
                  setCreateAddress((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Country
              <input
                type="text"
                value={createAddress.country}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, country: event.target.value }))
                }
              />
            </label>
            <label>
              Address type
              <input
                type="text"
                value={createAddress.type}
                onChange={(event) =>
                  setCreateAddress((current) => ({ ...current, type: event.target.value }))
                }
                placeholder="e.g. home, mailing"
              />
            </label>
            {createMailingAddressPreview ? (
              <pre className="address-preview">{createMailingAddressPreview}</pre>
            ) : null}
          </fieldset>

          <button type="submit" disabled={createStatus === 'saving'}>
            {createStatus === 'saving' ? 'Creating…' : 'Create household'}
          </button>
          {createStatus === 'success' ? (
            <p className="success-text">Household created.</p>
          ) : null}
          {createStatus === 'error' && createError ? (
            <p className="error-text">{createError}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
