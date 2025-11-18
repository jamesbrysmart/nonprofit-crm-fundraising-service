import { fetchJson } from '../api-shared/http';

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

const isHouseholdRecord = (value: HouseholdRecord | null | undefined): value is HouseholdRecord =>
  Boolean(value && typeof value.id === 'string' && value.id.length > 0);

const isHouseholdMemberRecord = (
  value: HouseholdMemberRecord | null | undefined,
): value is HouseholdMemberRecord => Boolean(value && typeof value.id === 'string' && value.id.length > 0);

export async function fetchHouseholds(
  params: { search?: string; limit?: number; cursor?: string } = {},
): Promise<HouseholdListResponse> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }
  if (typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    queryParams.cursor = params.cursor.trim();
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }

  const payload = await fetchJson<HouseholdListResponse>('/api/fundraising/households', {
    params: queryParams,
  });
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

  const payload = await fetchJson<HouseholdRecord | null>(
    `/api/fundraising/households/${encodeURIComponent(trimmed)}`,
  );
  return isHouseholdRecord(payload) ? payload : null;
}

export async function createHousehold(
  payload: HouseholdCreatePayload,
): Promise<HouseholdRecord> {
  const record = await fetchJson<HouseholdRecord>('/api/fundraising/households', {
    method: 'POST',
    body: payload,
  });
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
  const record = await fetchJson<HouseholdRecord>(
    `/api/fundraising/households/${encodeURIComponent(trimmed)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
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
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }

  const payload = await fetchJson<HouseholdMemberListResponse>(
    `/api/fundraising/households/${encodeURIComponent(trimmed)}/members`,
    { params: queryParams },
  );
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
  const record = await fetchJson<HouseholdMemberRecord>(
    `/api/fundraising/households/${encodeURIComponent(trimmed)}/members`,
    {
      method: 'POST',
      body: payload,
    },
  );
  if (!isHouseholdMemberRecord(record)) {
    throw new Error('Invalid household member response');
  }
  return record;
}

export async function removeHouseholdMember(
  householdId: string,
  contactId: string,
): Promise<HouseholdMemberRecord> {
  const record = await fetchJson<HouseholdMemberRecord>(
    `/api/fundraising/households/${encodeURIComponent(householdId.trim())}/members/${encodeURIComponent(
      contactId.trim(),
    )}`,
    { method: 'DELETE' },
  );

  if (!isHouseholdMemberRecord(record)) {
    throw new Error('Invalid household member response');
  }
  return record;
}

export async function copyHouseholdAddressToMember(
  householdId: string,
  payload: HouseholdCopyAddressPayload,
): Promise<HouseholdMemberRecord> {
  const record = await fetchJson<HouseholdMemberRecord>(
    `/api/fundraising/households/${encodeURIComponent(householdId.trim())}/copy-address`,
    {
      method: 'POST',
      body: payload,
    },
  );

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

  const record = await fetchJson<HouseholdMemberRecord>(
    `/api/fundraising/people/${encodeURIComponent(trimmed)}`,
  );
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
