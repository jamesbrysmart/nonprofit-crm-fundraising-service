import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createGift,
  findPersonDuplicates,
  fetchGiftStagingList,
  fetchRecurringAgreements,
  PersonDuplicate,
  OpportunityRecord,
  searchOpportunities,
  CompanyRecord,
  searchCompanies,
} from '../api';
import type {
  GiftCreatePayload,
  GiftCreateResponse,
  GiftStagingListItem,
  RecurringAgreementListItem,
} from '../api';
import { useAppealOptions } from '../hooks/useAppealOptions';
import { GiftBasicsCard } from './manual-entry/GiftBasicsCard';
import { DonorContactCard } from './manual-entry/DonorContactCard';
import { DonorSearchModal } from './manual-entry/DonorSearchModal';
import { DonorSelectionPanel } from './manual-entry/DonorSelectionPanel';
import { OpportunityCompanyCard } from './manual-entry/OpportunityCompanyCard';
import { RecurringAssociationsCard } from './manual-entry/RecurringAssociationsCard';
import { ManualGiftStatus } from './manual-entry/ManualGiftStatus';
import { RecurringAgreementSelector } from './manual-entry/RecurringAgreementSelector';
import {
  classifyDuplicate,
  describeDuplicate,
  duplicateTierLabel,
  formatMatchDate,
  DuplicateTier,
  buildDuplicateLookupPayload,
} from './manual-entry/duplicateHelpers';
import { DuplicatePanel } from './manual-entry/DuplicatePanel';
import { buildGiftPayload } from './manual-entry/giftPayload';

interface GiftFormState {
  amountValue: string;
  currencyCode: string;
  giftDate: string;
  giftName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  appealId: string;
  giftIntent: GiftIntentOption;
  opportunityId: string;
  companyId: string;
  companyName: string;
  isInKind: boolean;
  inKindDescription: string;
  estimatedValue: string;
}

type GiftIntentOption = 'standard' | 'grant' | 'legacy' | 'corporateInKind';

const GIFT_INTENT_OPTIONS: Array<{ value: GiftIntentOption; label: string }> = [
  { value: 'standard', label: 'Standard gift' },
  { value: 'grant', label: 'Grant installment' },
  { value: 'legacy', label: 'Legacy / Bequest' },
  { value: 'corporateInKind', label: 'Corporate / In-kind' },
];

const defaultFormState = (): GiftFormState => ({
  amountValue: '',
  currencyCode: 'GBP',
  giftDate: new Date().toISOString().slice(0, 10),
  giftName: '',
  contactFirstName: '',
  contactLastName: '',
  contactEmail: '',
  appealId: '',
  giftIntent: 'standard',
  opportunityId: '',
  companyId: '',
  companyName: '',
  isInKind: false,
  inKindDescription: '',
  estimatedValue: '',
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
  const [opportunityOptions, setOpportunityOptions] = useState<OpportunityRecord[]>([]);
  const [opportunitySearchTerm, setOpportunitySearchTerm] = useState('');
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityLookupError, setOpportunityLookupError] = useState<string | null>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [companyResults, setCompanyResults] = useState<CompanyRecord[]>([]);
  const [companyLookupBusy, setCompanyLookupBusy] = useState(false);
  const [companyLookupError, setCompanyLookupError] = useState<string | null>(null);
  const [pinnedOpportunity, setPinnedOpportunity] = useState<OpportunityRecord | null>(null);
  const duplicateLookupTimeout = useRef<number | undefined>(undefined);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PersonDuplicate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const {
    options: appealOptions,
    loading: appealsLoading,
    error: appealLoadError,
  } = useAppealOptions();

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

  const handleSelectDonor = (
    donorId: string | null | undefined,
    options: { closeModal?: boolean } = {},
  ) => {
    if (!donorId) {
      return;
    }
    setSelectedDuplicateId(donorId);
    setShowDuplicates(false);
    if (options.closeModal ?? true) {
      closeSearchModal();
    }
  };

  const handleClearSelectedDonor = () => {
    setSelectedDuplicateId(null);
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
      setSearchError('No donors found for that search.');
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
    let cancelled = false;

    const trimmedCompanyId = formState.companyId.trim();
    const trimmedSearch = opportunitySearchTerm.trim();
    const shouldFetch =
      formState.giftIntent !== 'standard' ||
      trimmedCompanyId.length > 0 ||
      trimmedSearch.length > 0 ||
      Boolean(selectedDuplicateId);

    if (!shouldFetch) {
      setOpportunityOptions([]);
      setOpportunityLookupError(null);
      return;
    }

    const params: Record<string, unknown> = {
      limit: 15,
    };

    if (selectedDuplicateId) {
      params.pointOfContactId = selectedDuplicateId;
    }

    if (trimmedCompanyId.length > 0) {
      params.companyId = trimmedCompanyId;
    }

    if (trimmedSearch.length > 0) {
      params.search = trimmedSearch;
    }

    switch (formState.giftIntent) {
      case 'grant':
        params.opportunityType = 'Grant';
        break;
      case 'legacy':
        params.opportunityType = 'Legacy';
        break;
      case 'corporateInKind':
        params.opportunityType = 'Corporate';
        break;
      default:
        break;
    }

    setOpportunityLoading(true);
    setOpportunityLookupError(null);

    void searchOpportunities(params)
      .then((records) => {
        if (!cancelled) {
          const normalizedSearch = trimmedSearch.toLowerCase();
          const filtered = records.filter((record) => {
            if (selectedDuplicateId) {
              if (!record.pointOfContactId) {
                return false;
              }
              if (record.pointOfContactId !== selectedDuplicateId) {
                return false;
              }
            }
            if (trimmedCompanyId.length > 0) {
              if (!record.companyId) {
                return false;
              }
              if (record.companyId !== trimmedCompanyId) {
                return false;
              }
            }
            if (formState.giftIntent === 'grant') {
              if (
                record.opportunityType &&
                record.opportunityType.toLowerCase() !== 'grant'
              ) {
                return false;
              }
            }
            if (formState.giftIntent === 'legacy') {
              if (
                record.opportunityType &&
                record.opportunityType.toLowerCase() !== 'legacy'
              ) {
                return false;
              }
            }
            if (formState.giftIntent === 'corporateInKind') {
              if (
                record.opportunityType &&
                record.opportunityType.toLowerCase() !== 'corporate'
              ) {
                return false;
              }
            }
            if (normalizedSearch.length > 0) {
              const haystacks = [record.name, record.companyName, record.id]
                .filter(Boolean)
                .map((value) => value!.toLowerCase());
              return haystacks.some((value) =>
                value.includes(normalizedSearch),
              );
            }
            return true;
          });
          setOpportunityOptions(filtered);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setOpportunityLookupError(
            error instanceof Error
              ? error.message
              : 'Unable to load opportunities.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOpportunityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedDuplicateId,
    formState.companyId,
    formState.giftIntent,
    opportunitySearchTerm,
  ]);

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
            if (!matches.some((candidate) => candidate?.id === selectedDuplicateId)) {
              setSelectedDuplicateId(null);
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
            'A staged gift with the same donor, amount, and date already exists. Double-check before continuing.',
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
    if (name === 'giftIntent') {
      setFormState((prev) => ({
        ...prev,
        giftIntent: value as GiftIntentOption,
      }));
      return;
    }
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleInKindToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setFormState((prev) => ({
      ...prev,
      isInKind: checked,
    }));
  };


  const handleSuccess = (giftId: string) => {
    setStatus({
      state: 'success',
      giftId,
    });
    setFormState({
      ...defaultFormState(),
      appealId: formState.appealId,
      giftIntent: formState.giftIntent,
    });
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
        message: 'Select an existing donor below or create a new one to continue.',
      });
      return;
    }

    setStatus({ state: 'submitting' });

    try {
      const matches = await findPersonDuplicates(buildDuplicateLookupPayload(formState));
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

  const handleSelectOpportunity = (record: OpportunityRecord) => {
    if (!record?.id) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      opportunityId: record.id,
      companyId: record.companyId ?? prev.companyId,
      companyName: record.companyName ?? prev.companyName,
    }));
    setPinnedOpportunity(record);
    if (record.name) {
      setOpportunitySearchTerm(record.name);
    }
  };

  const handleClearOpportunity = () => {
    setFormState((prev) => ({
      ...prev,
      opportunityId: '',
    }));
    setPinnedOpportunity(null);
  };

  const handleCompanyLookup = async () => {
    const trimmed = companySearchTerm.trim();
    if (trimmed.length === 0) {
      setCompanyLookupError('Enter a company name to search.');
      setCompanyResults([]);
      return;
    }

    setCompanyLookupBusy(true);
    setCompanyLookupError(null);
    try {
      const results = await searchCompanies({ search: trimmed, limit: 10 });
      const normalizedTerm = trimmed.toLowerCase();
      const filtered = results.filter((company) => {
        const name = company.name?.toLowerCase() ?? '';
        return name.includes(normalizedTerm);
      });
      setCompanyResults(filtered);
      if (filtered.length === 0) {
        setCompanyLookupError('No matching companies found.');
      }
    } catch (error) {
      setCompanyResults([]);
      setCompanyLookupError(
        error instanceof Error ? error.message : 'Search failed.',
      );
    } finally {
      setCompanyLookupBusy(false);
    }
  };

  const handleSelectCompany = (company: CompanyRecord) => {
    if (!company?.id) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      companyId: company.id,
      companyName: company.name ?? company.id,
    }));
    setCompanyResults([]);
    setCompanyLookupError(null);
  };

  const handleClearCompany = () => {
    setFormState((prev) => ({
      ...prev,
      companyId: '',
      companyName: '',
    }));
    setCompanyResults([]);
  };

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

  const selectedDonor = useMemo(() => {
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

  const selectedOpportunity = useMemo(() => {
    if (!formState.opportunityId) {
      return null;
    }
    if (pinnedOpportunity && pinnedOpportunity.id === formState.opportunityId) {
      return pinnedOpportunity;
    }
    return (
      opportunityOptions.find((option) => option.id === formState.opportunityId) ?? null
    );
  }, [formState.opportunityId, opportunityOptions, pinnedOpportunity]);

  return (
    <div className="f-space-y-6">
      <form onSubmit={handleSubmit} className="f-space-y-6">
        <fieldset
          disabled={status.state === 'submitting'}
          className="f-space-y-6 f-border-0 f-p-0 f-m-0"
        >
          <GiftBasicsCard>
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
              <label htmlFor="appealId">Appeal (optional)</label>
              <select
                id="appealId"
                name="appealId"
                value={formState.appealId}
                onChange={handleChange}
                disabled={appealsLoading && appealOptions.length === 0}
              >
                <option value="">No appeal</option>
                {appealOptions.map((appeal) => (
                  <option key={appeal.id} value={appeal.id}>
                    {appeal.name ?? 'Untitled appeal'}
                  </option>
                ))}
              </select>
              {appealsLoading ? (
                <span className="small-text" style={{ color: '#64748b' }}>
                  Loading appeals…
                </span>
              ) : appealLoadError ? (
                <span className="small-text" style={{ color: '#991b1b' }}>
                  {appealLoadError}
                </span>
              ) : null}
            </div>

            <p className="f-text-sm f-font-semibold f-text-ink f-mt-4 f-mb-0">Gift context</p>

            <div className="form-row">
              <label htmlFor="giftIntent">Gift intent</label>
              <select
                id="giftIntent"
                name="giftIntent"
                value={formState.giftIntent}
                onChange={handleChange}
              >
                {GIFT_INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="small-text">
                Intent tags help surface the right workflows and keep reporting tidy.
              </p>
            </div>

            <OpportunityCompanyCard
              giftIntent={formState.giftIntent}
              companyId={formState.companyId}
              companyName={formState.companyName}
              companySearchTerm={companySearchTerm}
              companyLookupBusy={companyLookupBusy}
              companyLookupError={companyLookupError}
              companyResults={companyResults}
              onCompanySearchTermChange={setCompanySearchTerm}
              onCompanyLookup={handleCompanyLookup}
              onSelectCompany={handleSelectCompany}
              onClearCompany={handleClearCompany}
              opportunitySearchTerm={opportunitySearchTerm}
              onOpportunitySearchTermChange={setOpportunitySearchTerm}
              opportunityLoading={opportunityLoading}
              opportunityLookupError={opportunityLookupError}
              opportunityOptions={opportunityOptions}
              onSelectOpportunity={handleSelectOpportunity}
              onClearOpportunity={handleClearOpportunity}
              selectedOpportunity={selectedOpportunity}
              disabled={status.state === 'submitting'}
              formState={{
                isInKind: formState.isInKind,
                giftIntent: formState.giftIntent,
                inKindDescription: formState.inKindDescription,
                estimatedValue: formState.estimatedValue,
              }}
              onToggleInKind={handleInKindToggle}
              onFieldChange={handleChange}
            />

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
          </GiftBasicsCard>

          <DonorContactCard>
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

            <DonorSelectionPanel
              selectedDonor={selectedDonor}
              onChangeDonor={() => {
                handleClearSelectedDonor();
                openSearchModal();
              }}
              onClearSelectedDonor={handleClearSelectedDonor}
              duplicateLookupError={duplicateLookupError}
              showDuplicates={showDuplicates}
              classifiedDuplicates={classifiedDuplicates}
              selectedDuplicateId={selectedDuplicateId}
              onSelectDuplicate={(id) => handleSelectDonor(id, { closeModal: false })}
              onOpenSearch={openSearchModal}
              potentialDuplicateMessage={potentialDuplicateMessage}
              disableActions={status.state === 'submitting'}
            />
          </DonorContactCard>
          <RecurringAssociationsCard>
            <RecurringAgreementSelector
              isRecurring={isRecurring}
              onToggleRecurring={(checked) => {
                setIsRecurring(checked);
                if (!checked) {
                  setSelectedRecurringId(null);
                  setRecurringSearch('');
                }
              }}
              recurringSearch={recurringSearch}
              onRecurringSearchChange={setRecurringSearch}
              filteredRecurringOptions={filteredRecurringOptions}
              hasAnyAgreements={recurringOptions.length > 0}
              selectedRecurringId={selectedRecurringId}
              onSelectRecurring={setSelectedRecurringId}
            />
          </RecurringAssociationsCard>
        </fieldset>

        <ManualGiftStatus
          status={
            status.state === 'success'
              ? { state: 'success', message: `Gift committed in Twenty (gift id ${status.giftId}).`, link: giftLink }
              : status.state === 'error'
              ? { state: 'error', message: status.message }
              : { state: status.state }
          }
          isSubmitDisabled={isSubmitDisabled}
          showDuplicates={showDuplicates}
        />
      </form>

      {showDuplicates && classifiedDuplicates.length > 0 ? (
        <DuplicatePanel
          classifiedDuplicates={classifiedDuplicates}
          selectedDuplicateId={selectedDuplicateId}
          onSelectDuplicate={(id) => handleSelectDonor(id, { closeModal: false })}
          onCreateWithNewContact={handleCreateWithNewContact}
          onUseExistingContact={handleUseExistingContact}
          onOpenSearch={openSearchModal}
          disableActions={status.state === 'submitting'}
        />
      ) : null}

      <DonorSearchModal
        isOpen={isSearchModalOpen}
        onClose={closeSearchModal}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={handleSearchSubmit}
        searchLoading={searchLoading}
        searchError={searchError}
        searchResults={searchResults}
        onSelectDonor={handleSelectDonor}
        formState={{
          contactFirstName: formState.contactFirstName,
          contactLastName: formState.contactLastName,
          contactEmail: formState.contactEmail,
        }}
      />
    </div>
  );
}
