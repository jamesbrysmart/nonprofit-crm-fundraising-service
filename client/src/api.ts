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
  rawPayload?: string;
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
  params: { limit?: number; sort?: string; recurringAgreementId?: string } = {},
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
