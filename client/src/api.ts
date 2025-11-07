export interface GiftCreateResponse {
  data?: {
    createGift?: {
      id?: string;
      name?: string;
      amount?: {
        currencyCode?: string;
        value?: number;
      };
    };
  };
}

export interface GiftCreatePayload {
  amount: {
    currencyCode: string;
    value: number;
  };
  appealId?: string;
  giftDate?: string;
  name?: string;
  contact?: {
    firstName: string;
    lastName: string;
    email?: string;
  };
  contactId?: string;
  autoPromote?: boolean;
}

export async function createGift(payload: GiftCreatePayload): Promise<GiftCreateResponse> {
  const response = await fetch('/api/fundraising/gifts', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftCreateResponse;
}

export interface DuplicateLookupRequest {
  firstName: string;
  lastName: string;
  email?: string;
  depth?: number;
}

export interface PersonDuplicate {
  id?: string;
  name?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  emails?: {
    primaryEmail?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface PeopleDuplicatesResponse {
  data?: Array<{
    personDuplicates?: PersonDuplicate[];
  }>;
}

export async function findPersonDuplicates(
  payload: DuplicateLookupRequest,
): Promise<PersonDuplicate[]> {
  const response = await fetch('/api/fundraising/people/duplicates', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as PeopleDuplicatesResponse;
  const duplicates: PersonDuplicate[] = [];

  for (const entry of json.data ?? []) {
    if (entry?.personDuplicates) {
      duplicates.push(...entry.personDuplicates.filter(Boolean));
    }
  }

  return duplicates;
}

export interface MailingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string;
}

export interface HouseholdRecord {
  id: string;
  name?: string;
  primaryContactId?: string;
  envelopeName?: string;
  salutationFormal?: string;
  salutationInformal?: string;
  mailingAddress?: MailingAddress | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HouseholdListResponse {
  households: HouseholdRecord[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export interface HouseholdCreatePayload {
  name: string;
  primaryContactId?: string;
  envelopeName?: string | null;
  salutationFormal?: string | null;
  salutationInformal?: string | null;
  mailingAddress?: MailingAddress | null;
}

export type HouseholdUpdatePayload = Partial<HouseholdCreatePayload>;

export interface HouseholdMemberRecord {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  householdId?: string | null;
  mailingAddress?: MailingAddress | null;
}

export interface HouseholdMemberListResponse {
  members: HouseholdMemberRecord[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export interface HouseholdMemberAssignPayload {
  contactId: string;
  makePrimary?: boolean;
}

export interface HouseholdCopyAddressPayload {
  contactId: string;
  mailingAddress: MailingAddress | null;
}

export interface PersonRecord {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  householdId?: string | null;
  mailingAddress?: MailingAddress | null;
}

export interface GiftStagingCreateResponse {
  data?: {
    giftStaging?: {
      id?: string;
      autoPromote?: boolean;
      promotionStatus?: string;
      validationStatus?: string;
      dedupeStatus?: string;
    };
  };
  meta?: {
    stagedOnly?: boolean;
    rawPayload?: string;
    rawPayloadAvailable?: boolean;
  };
}

export async function createGiftStaging(
  payload: GiftCreatePayload,
): Promise<GiftStagingCreateResponse> {
  const response = await fetch('/api/fundraising/gift-staging', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftStagingCreateResponse;
}

export interface GiftStagingStatusUpdatePayload {
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string;
  giftBatchId?: string;
  rawPayload?: string;
}

export interface GiftStagingUpdatePayload {
  donorId?: string | null;
  donorFirstName?: string | null;
  donorLastName?: string | null;
  donorEmail?: string | null;
  amountMinor?: number;
  amountMajor?: number;
  currency?: string | null;
  dateReceived?: string | null;
  expectedAt?: string | null;
  fundId?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
  trackingCodeId?: string | null;
  notes?: string | null;
  giftAidEligible?: boolean;
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string | null;
  giftBatchId?: string | null;
}

export async function updateGiftStagingStatus(
  stagingId: string,
  payload: GiftStagingStatusUpdatePayload,
): Promise<void> {
  const response = await fetch(`/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}/status`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }
}

export type ProcessGiftDeferredReason = 'not_ready' | 'locked' | 'missing_payload';
export type ProcessGiftErrorReason = 'fetch_failed' | 'payload_invalid' | 'gift_api_failed';

export type ProcessGiftResponse =
  | { status: 'committed'; giftId: string; stagingId: string }
  | { status: 'deferred'; stagingId: string; reason: ProcessGiftDeferredReason }
  | { status: 'error'; stagingId: string; error: ProcessGiftErrorReason };

export async function processGiftStaging(stagingId: string): Promise<ProcessGiftResponse> {
  const response = await fetch(`/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}/process`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as ProcessGiftResponse;
}

export interface GiftStagingListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  processingStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  externalId?: string;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  dateReceived?: string;
  expectedAt?: string;
  paymentMethod?: string;
  giftBatchId?: string;
  autoPromote?: boolean;
  giftAidEligible?: boolean;
  donorId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  fundId?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown>;
  recurringAgreementId?: string;
  rawPayloadAvailable?: boolean;
  errorDetail?: string;
  notes?: string;
}

export interface GiftStagingListResponse {
  data: GiftStagingListItem[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export interface RecurringAgreementListItem {
  id: string;
  contactId?: string;
  status?: string;
  cadence?: string;
  intervalCount?: number;
  amountMinor?: number;
  currency?: string;
  nextExpectedAt?: string;
  autoPromoteEnabled?: boolean;
  provider?: string;
  providerAgreementId?: string;
  providerPaymentMethodId?: string;
}

export async function fetchGiftStagingList(
  params: {
    limit?: number;
    sort?: string;
    recurringAgreementId?: string;
    statuses?: string[];
    intakeSources?: string[];
    search?: string;
  } = {},
): Promise<GiftStagingListResponse> {
  const query = new URLSearchParams();
  if (typeof params.limit === 'number') {
    query.set('limit', params.limit.toString());
  }
  if (typeof params.sort === 'string' && params.sort.trim().length > 0) {
    query.set('sort', params.sort.trim());
  }
  if (typeof params.recurringAgreementId === 'string' && params.recurringAgreementId.trim().length > 0) {
    query.set('recurringAgreementId', params.recurringAgreementId.trim());
  }
  if (Array.isArray(params.statuses) && params.statuses.length > 0) {
    query.set('statuses', params.statuses.join(','));
  }
  if (Array.isArray(params.intakeSources) && params.intakeSources.length > 0) {
    query.set('intakeSources', params.intakeSources.join(','));
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    query.set('search', params.search.trim());
  }

  const url =
    query.size > 0
      ? `/api/fundraising/gift-staging?${query.toString()}`
      : '/api/fundraising/gift-staging';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftStagingListResponse;
}

export async function fetchRecurringAgreements(
  params: { limit?: number } = {},
): Promise<RecurringAgreementListItem[]> {
  const query = new URLSearchParams();
  if (typeof params.limit === 'number') {
    query.set('limit', params.limit.toString());
  }

  const url =
    query.size > 0
      ? `/api/fundraising/recurring-agreements?${query.toString()}`
      : '/api/fundraising/recurring-agreements';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const payload = (await response.json()) as {
    data?: { recurringAgreements?: unknown[] };
  };

  const items = Array.isArray(payload.data?.recurringAgreements)
    ? payload.data?.recurringAgreements
    : [];

  return items
    .map((entry) => normalizeRecurringAgreement(entry))
    .filter((entry): entry is RecurringAgreementListItem => Boolean(entry));
}

function normalizeRecurringAgreement(entry: unknown): RecurringAgreementListItem | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : null;
  if (!id) {
    return null;
  }

  const amountMinor =
    typeof record.amountMinor === 'number' && Number.isFinite(record.amountMinor)
      ? record.amountMinor
      : undefined;

  return {
    id,
    contactId: typeof record.contactId === 'string' ? record.contactId : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    cadence: typeof record.cadence === 'string' ? record.cadence : undefined,
    intervalCount:
      typeof record.intervalCount === 'number' && Number.isFinite(record.intervalCount)
        ? record.intervalCount
        : undefined,
    amountMinor,
    currency: typeof record.currency === 'string' ? record.currency : undefined,
    nextExpectedAt: typeof record.nextExpectedAt === 'string' ? record.nextExpectedAt : undefined,
    autoPromoteEnabled:
      typeof record.autoPromoteEnabled === 'boolean' ? record.autoPromoteEnabled : undefined,
    provider: typeof record.provider === 'string' ? record.provider : undefined,
    providerAgreementId:
      typeof record.providerAgreementId === 'string' ? record.providerAgreementId : undefined,
    providerPaymentMethodId:
      typeof record.providerPaymentMethodId === 'string'
        ? record.providerPaymentMethodId
        : undefined,
  };
}

const isHouseholdRecord = (value: HouseholdRecord | null | undefined): value is HouseholdRecord =>
  Boolean(value && typeof value.id === 'string' && value.id.length > 0);

const isHouseholdMemberRecord = (
  value: HouseholdMemberRecord | null | undefined,
): value is HouseholdMemberRecord => Boolean(value && typeof value.id === 'string' && value.id.length > 0);

export async function fetchHouseholds(
  params: { search?: string; limit?: number; cursor?: string } = {},
): Promise<HouseholdListResponse> {
  const query = new URLSearchParams();
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', params.limit.toString());
  }
  if (typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    query.set('cursor', params.cursor.trim());
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    query.set('search', params.search.trim());
  }

  const url =
    query.size > 0
      ? `/api/fundraising/households?${query.toString()}`
      : '/api/fundraising/households';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const payload = (await response.json()) as HouseholdListResponse;
  return {
    households: Array.isArray(payload.households)
      ? payload.households.filter(isHouseholdRecord)
      : [],
    meta: payload.meta,
  };
}

export async function fetchHousehold(id: string): Promise<HouseholdRecord | null> {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const response = await fetch(`/api/fundraising/households/${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const payload = (await response.json()) as HouseholdRecord | null;
  return isHouseholdRecord(payload) ? payload : null;
}

export async function createHousehold(
  payload: HouseholdCreatePayload,
): Promise<HouseholdRecord> {
  const response = await fetch('/api/fundraising/households', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdRecord;
  if (!isHouseholdRecord(record)) {
    throw new Error('Invalid household response');
  }
  return record;
}

export async function updateHousehold(
  householdId: string,
  payload: HouseholdUpdatePayload,
): Promise<HouseholdRecord> {
  const trimmed = householdId.trim();
  const response = await fetch(`/api/fundraising/households/${encodeURIComponent(trimmed)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdRecord;
  if (!isHouseholdRecord(record)) {
    throw new Error('Invalid household response');
  }
  return record;
}

export async function fetchHouseholdMembers(
  householdId: string,
  params: { limit?: number } = {},
): Promise<HouseholdMemberListResponse> {
  const trimmed = householdId.trim();
  const query = new URLSearchParams();
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', params.limit.toString());
  }

  const base = `/api/fundraising/households/${encodeURIComponent(trimmed)}/members`;
  const response = await fetch(query.size > 0 ? `${base}?${query.toString()}` : base, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const payload = (await response.json()) as HouseholdMemberListResponse;
  return {
    members: Array.isArray(payload.members)
      ? payload.members.filter(isHouseholdMemberRecord)
      : [],
    meta: payload.meta,
  };
}

export async function addHouseholdMember(
  householdId: string,
  payload: HouseholdMemberAssignPayload,
): Promise<HouseholdMemberRecord> {
  const trimmed = householdId.trim();
  const response = await fetch(`/api/fundraising/households/${encodeURIComponent(trimmed)}/members`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdMemberRecord;
  if (!isHouseholdMemberRecord(record)) {
    throw new Error('Invalid household member response');
  }
  return record;
}

export async function removeHouseholdMember(
  householdId: string,
  contactId: string,
): Promise<HouseholdMemberRecord> {
  const response = await fetch(
    `/api/fundraising/households/${encodeURIComponent(householdId.trim())}/members/${encodeURIComponent(contactId.trim())}`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdMemberRecord;
  if (!isHouseholdMemberRecord(record)) {
    throw new Error('Invalid household member response');
  }
  return record;
}

export async function copyHouseholdAddressToMember(
  householdId: string,
  payload: HouseholdCopyAddressPayload,
): Promise<HouseholdMemberRecord> {
  const response = await fetch(
    `/api/fundraising/households/${encodeURIComponent(householdId.trim())}/copy-address`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdMemberRecord;
  if (!isHouseholdMemberRecord(record)) {
    throw new Error('Invalid household member response');
  }
  return record;
}

export async function fetchPerson(personId: string): Promise<PersonRecord | null> {
  const trimmed = personId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const response = await fetch(`/api/fundraising/people/${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const record = (await response.json()) as HouseholdMemberRecord;
  if (!isHouseholdMemberRecord(record)) {
    return null;
  }

  return {
    id: record.id,
    fullName: record.fullName,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    householdId: record.householdId,
    mailingAddress: record.mailingAddress,
  };
}

export interface GiftStagingDetailResponse {
  data?: {
    giftStaging?: {
      id?: string;
      promotionStatus?: string;
      validationStatus?: string;
      dedupeStatus?: string;
      errorDetail?: string;
      rawPayload?: string;
      giftBatchId?: string;
      giftId?: string;
      autoPromote?: boolean;
      createdAt?: string;
      updatedAt?: string;
      amountMinor?: number;
      currency?: string;
      intakeSource?: string;
      sourceFingerprint?: string;
      externalId?: string;
      amount?: number;
      paymentMethod?: string;
      dateReceived?: string;
      giftAidEligible?: boolean;
      donorId?: string;
      donorFirstName?: string;
      donorLastName?: string;
      donorEmail?: string;
      fundId?: string;
      appealId?: string;
      appealSegmentId?: string;
      trackingCodeId?: string;
      expectedAt?: string;
      provider?: string;
      providerPaymentId?: string;
      providerContext?: Record<string, unknown>;
      recurringAgreementId?: string;
      notes?: string;
    };
  };
}

export async function updateGiftStaging(
  stagingId: string,
  payload: GiftStagingUpdatePayload,
): Promise<GiftStagingDetailResponse> {
  const response = await fetch(`/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftStagingDetailResponse;
}

export async function fetchGiftStagingById(
  stagingId: string,
): Promise<GiftStagingDetailResponse> {
  const response = await fetch(`/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftStagingDetailResponse;
}

export interface MoneyValue {
  value?: number;
  currencyCode?: string;
}

export interface MoneyInput {
  value: number;
  currencyCode?: string;
}

export interface AppealRecord {
  id: string;
  name?: string;
  description?: string | null;
  appealType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  goalAmount?: MoneyValue | null;
  budgetAmount?: MoneyValue | null;
  raisedAmount?: MoneyValue | null;
  giftCount?: number | null;
  donorCount?: number | null;
  responseRate?: number | null;
  costPerPound?: number | null;
  lastGiftAt?: string | null;
  targetSolicitedCount?: number | null;
}

export interface FetchAppealsParams {
  limit?: number;
  cursor?: string;
  sort?: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toMoneyValue = (value: unknown): MoneyValue | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const rawValue = value.value;
  const rawCurrency = value.currencyCode ?? value.currency;

  const numeric =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number.parseFloat(rawValue)
        : undefined;

  if (numeric === undefined || Number.isNaN(numeric)) {
    return undefined;
  }

  const currency =
    typeof rawCurrency === 'string' && rawCurrency.trim().length > 0
      ? rawCurrency.trim().toUpperCase()
      : undefined;

  return {
    value: Number.parseFloat(numeric.toFixed(2)),
    currencyCode: currency,
  };
};

const toAppealRecord = (value: unknown): AppealRecord | undefined => {
  if (!isPlainObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : undefined,
    description: typeof value.description === 'string' ? value.description : null,
    appealType: typeof value.appealType === 'string' ? value.appealType : undefined,
    startDate: typeof value.startDate === 'string' ? value.startDate : null,
    endDate: typeof value.endDate === 'string' ? value.endDate : null,
    goalAmount: toMoneyValue(value.goalAmount) ?? null,
    budgetAmount: toMoneyValue(value.budgetAmount) ?? null,
    raisedAmount: toMoneyValue(value.raisedAmount) ?? null,
    giftCount:
      typeof value.giftCount === 'number'
        ? value.giftCount
        : typeof value.giftCount === 'string'
          ? Number.parseInt(value.giftCount, 10)
          : null,
    donorCount:
      typeof value.donorCount === 'number'
        ? value.donorCount
        : typeof value.donorCount === 'string'
          ? Number.parseInt(value.donorCount, 10)
          : null,
    responseRate:
      typeof value.responseRate === 'number'
        ? value.responseRate
        : typeof value.responseRate === 'string'
          ? Number.parseFloat(value.responseRate)
          : null,
    costPerPound:
      typeof value.costPerPound === 'number'
        ? value.costPerPound
        : typeof value.costPerPound === 'string'
          ? Number.parseFloat(value.costPerPound)
          : null,
    lastGiftAt: typeof value.lastGiftAt === 'string' ? value.lastGiftAt : null,
    targetSolicitedCount:
      typeof value.targetSolicitedCount === 'number'
        ? value.targetSolicitedCount
        : typeof value.targetSolicitedCount === 'string'
          ? Number.parseInt(value.targetSolicitedCount, 10)
          : null,
  };
};

export async function fetchAppeals(params: FetchAppealsParams = {}): Promise<AppealRecord[]> {
  const search = new URLSearchParams();

  if (params.limit && Number.isFinite(params.limit)) {
    search.set('limit', String(params.limit));
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }

  const queryString = search.toString();
  const response = await fetch(
    `/api/fundraising/appeals${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as {
    data?: { appeals?: unknown[] };
  };

  const appeals: AppealRecord[] = [];

  for (const entry of json.data?.appeals ?? []) {
    const record = toAppealRecord(entry);
    if (record) {
      appeals.push(record);
    }
  }

  return appeals;
}

const serializeMoneyInput = (input: MoneyInput | undefined | null) => {
  if (!input) {
    return undefined;
  }
  const currency =
    typeof input.currencyCode === 'string' && input.currencyCode.trim().length > 0
      ? input.currencyCode.trim().toUpperCase()
      : 'GBP';
  return {
    value: Number.parseFloat(input.value.toFixed(2)),
    currencyCode: currency,
  };
};

export interface AppealCreateRequest {
  name: string;
  description?: string;
  appealType?: string;
  startDate?: string;
  endDate?: string;
  goalAmount?: MoneyInput | null;
  budgetAmount?: MoneyInput | null;
  targetSolicitedCount?: number | null;
}

export type AppealUpdateRequest = Partial<AppealCreateRequest>;

export async function createAppeal(payload: AppealCreateRequest): Promise<string> {
  const response = await fetch('/api/fundraising/appeals', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      goalAmount: serializeMoneyInput(payload.goalAmount ?? undefined),
      budgetAmount: serializeMoneyInput(payload.budgetAmount ?? undefined),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as {
    data?: { createAppeal?: { id?: string } };
  };

  const id = json.data?.createAppeal?.id;
  if (!id) {
    throw new Error('Twenty did not return an appeal id');
  }
  return id;
}

export async function updateAppeal(
  appealId: string,
  payload: AppealUpdateRequest,
): Promise<void> {
  const response = await fetch(`/api/fundraising/appeals/${encodeURIComponent(appealId)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      goalAmount: serializeMoneyInput(payload.goalAmount ?? undefined),
      budgetAmount: serializeMoneyInput(payload.budgetAmount ?? undefined),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }
}

export interface SolicitationSnapshotRecord {
  id: string;
  countSolicited?: number | null;
  source?: string | null;
  capturedAt?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
}

const toSolicitationSnapshotRecord = (value: unknown): SolicitationSnapshotRecord | undefined => {
  if (!isPlainObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  return {
    id: value.id,
    countSolicited:
      typeof value.countSolicited === 'number'
        ? value.countSolicited
        : typeof value.countSolicited === 'string'
          ? Number.parseInt(value.countSolicited, 10)
          : null,
    source: typeof value.source === 'string' ? value.source : null,
    capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : null,
    appealId: typeof value.appealId === 'string' ? value.appealId : null,
    appealSegmentId: typeof value.appealSegmentId === 'string' ? value.appealSegmentId : null,
  };
};

export async function fetchSolicitationSnapshots(
  appealId: string,
): Promise<SolicitationSnapshotRecord[]> {
  const response = await fetch(
    `/api/fundraising/appeals/${encodeURIComponent(appealId)}/solicitation-snapshots`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as {
    data?: { solicitationSnapshots?: unknown[] };
  };

  const snapshots: SolicitationSnapshotRecord[] = [];
  for (const entry of json.data?.solicitationSnapshots ?? []) {
    const record = toSolicitationSnapshotRecord(entry);
    if (record) {
      snapshots.push(record);
    }
  }
  return snapshots.filter(
    (snapshot) => typeof snapshot.appealId !== 'string' || snapshot.appealId === appealId,
  );
}

export interface SolicitationSnapshotCreateRequest {
  countSolicited: number;
  source?: string;
  capturedAt?: string;
  appealSegmentId?: string;
  notes?: string;
}

export async function createSolicitationSnapshot(
  appealId: string,
  payload: SolicitationSnapshotCreateRequest,
): Promise<string> {
  const response = await fetch(
    `/api/fundraising/appeals/${encodeURIComponent(appealId)}/solicitation-snapshots`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as {
    data?: { createSolicitationSnapshot?: { id?: string } };
  };

  const id = json.data?.createSolicitationSnapshot?.id;
  if (!id) {
    throw new Error('Twenty did not return a solicitation snapshot id');
  }
  return id;
}
