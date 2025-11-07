import { BadRequestException } from '@nestjs/common';

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

export interface HouseholdMemberRecord {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  householdId?: string | null;
  mailingAddress?: MailingAddress | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HouseholdMemberListResponse {
  members: HouseholdMemberRecord[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export interface HouseholdWritePayload extends Record<string, unknown> {
  name?: string;
  primaryContactId?: string | null;
  envelopeName?: string | null;
  salutationFormal?: string | null;
  salutationInformal?: string | null;
  mailingAddress?: MailingAddress | null;
}

export interface AssignHouseholdMemberPayload {
  contactId: string;
  makePrimary?: boolean;
}

export interface CopyHouseholdAddressPayload {
  contactId: string;
  mailingAddress: MailingAddress | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ADDRESS_KEYS: Array<keyof MailingAddress> = [
  'line1',
  'line2',
  'city',
  'region',
  'postalCode',
  'country',
  'type',
];

const normalizeOptionalId = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  { allowNull = true }: { allowNull?: boolean } = {},
): void => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (allowNull) {
      target[key] = null;
      return;
    }
    throw new BadRequestException(`${key} cannot be null`);
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (allowNull) {
      target[key] = null;
      return;
    }
    throw new BadRequestException(`${key} must not be empty`);
  }

  target[key] = trimmed;
};

const normalizeOptionalTrimmedString = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  { allowNull = true }: { allowNull?: boolean } = {},
): void => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (allowNull) {
      target[key] = null;
      return;
    }
    throw new BadRequestException(`${key} cannot be null`);
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (allowNull) {
      target[key] = null;
      return;
    }
    return;
  }

  target[key] = trimmed;
};

const normalizeMailingAddressInput = (
  value: unknown,
  { required }: { required: boolean },
): MailingAddress | null | undefined => {
  if (value === undefined) {
    if (required) {
      throw new BadRequestException('mailingAddress is required');
    }
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new BadRequestException('mailingAddress must be an object or null');
  }

  const result: MailingAddress = {};

  for (const key of ADDRESS_KEYS) {
    const raw = value[key as keyof typeof value];
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    result[key] = trimmed;
  }

  return Object.keys(result).length > 0 ? result : {};
};

const normalizeMailingAddressFromRecord = (
  value: unknown,
): MailingAddress | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  const result: MailingAddress = {};
  for (const key of ADDRESS_KEYS) {
    const raw = value[key as keyof typeof value];
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    result[key] = trimmed;
  }
  return Object.keys(result).length > 0 ? result : {};
};

const normalizeHouseholdRecord = (entry: unknown): HouseholdRecord | null => {
  if (!isPlainObject(entry)) {
    return null;
  }

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (id.length === 0) {
    return null;
  }

  const record: HouseholdRecord = { id };

  if (typeof entry.name === 'string' && entry.name.trim().length > 0) {
    record.name = entry.name.trim();
  }
  if (
    typeof entry.primaryContactId === 'string' &&
    entry.primaryContactId.trim().length > 0
  ) {
    record.primaryContactId = entry.primaryContactId.trim();
  }
  if (typeof entry.envelopeName === 'string') {
    const trimmed = entry.envelopeName.trim();
    if (trimmed.length > 0) {
      record.envelopeName = trimmed;
    }
  }
  if (typeof entry.salutationFormal === 'string') {
    const trimmed = entry.salutationFormal.trim();
    if (trimmed.length > 0) {
      record.salutationFormal = trimmed;
    }
  }
  if (typeof entry.salutationInformal === 'string') {
    const trimmed = entry.salutationInformal.trim();
    if (trimmed.length > 0) {
      record.salutationInformal = trimmed;
    }
  }

  const mailingAddress = normalizeMailingAddressFromRecord(
    entry.mailingAddress,
  );
  if (mailingAddress !== undefined) {
    record.mailingAddress = mailingAddress;
  }

  if (
    typeof entry.createdAt === 'string' &&
    entry.createdAt.trim().length > 0
  ) {
    record.createdAt = entry.createdAt.trim();
  }
  if (
    typeof entry.updatedAt === 'string' &&
    entry.updatedAt.trim().length > 0
  ) {
    record.updatedAt = entry.updatedAt.trim();
  }

  return record;
};

const normalizeHouseholdMemberRecord = (
  entry: unknown,
): HouseholdMemberRecord | null => {
  if (!isPlainObject(entry)) {
    return null;
  }

  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (id.length === 0) {
    return null;
  }

  const result: HouseholdMemberRecord = { id };

  const name = isPlainObject(entry.name) ? entry.name : undefined;
  const firstName =
    typeof name?.firstName === 'string' && name.firstName.trim().length > 0
      ? name.firstName.trim()
      : undefined;
  const lastName =
    typeof name?.lastName === 'string' && name.lastName.trim().length > 0
      ? name.lastName.trim()
      : undefined;
  const fullName =
    typeof name?.fullName === 'string' && name.fullName.trim().length > 0
      ? name.fullName.trim()
      : undefined;

  result.firstName = firstName;
  result.lastName = lastName;
  const derivedFullName = [firstName, lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  result.fullName =
    fullName ?? (derivedFullName.length > 0 ? derivedFullName : undefined);

  const emails = isPlainObject(entry.emails) ? entry.emails : undefined;
  if (
    typeof emails?.primaryEmail === 'string' &&
    emails.primaryEmail.trim().length > 0
  ) {
    result.email = emails.primaryEmail.trim();
  }

  if (typeof entry.householdId === 'string') {
    const trimmed = entry.householdId.trim();
    result.householdId = trimmed.length > 0 ? trimmed : null;
  } else if (entry.householdId === null) {
    result.householdId = null;
  }

  const mailingAddress = normalizeMailingAddressFromRecord(
    entry.mailingAddress,
  );
  if (mailingAddress !== undefined) {
    result.mailingAddress = mailingAddress;
  }

  if (
    typeof entry.createdAt === 'string' &&
    entry.createdAt.trim().length > 0
  ) {
    result.createdAt = entry.createdAt.trim();
  }
  if (
    typeof entry.updatedAt === 'string' &&
    entry.updatedAt.trim().length > 0
  ) {
    result.updatedAt = entry.updatedAt.trim();
  }

  return result;
};

const normalizeMeta = (
  value: unknown,
):
  | {
      nextCursor?: string;
      hasMore?: boolean;
      totalCount?: number;
    }
  | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const meta: Record<string, unknown> = {};
  if (
    typeof value.nextCursor === 'string' &&
    value.nextCursor.trim().length > 0
  ) {
    meta.nextCursor = value.nextCursor.trim();
  }
  if (typeof value.hasMore === 'boolean') {
    meta.hasMore = value.hasMore;
  }
  if (
    typeof value.totalCount === 'number' &&
    Number.isFinite(value.totalCount)
  ) {
    meta.totalCount = value.totalCount;
  }
  return Object.keys(meta).length > 0
    ? (meta as HouseholdListResponse['meta'])
    : undefined;
};

const extractRecordFromData = (data: Record<string, unknown>): unknown => {
  const candidates = [
    data.household,
    data.households,
    data.createHousehold,
    data.createOneHousehold,
    data.updateHousehold,
    data.updateOneHousehold,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate[0];
    }
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }

  return undefined;
};

export const ensureHouseholdListResponse = (
  body: unknown,
): HouseholdListResponse => {
  if (!isPlainObject(body)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing root object)',
    );
  }
  const data = body.data;
  if (!isPlainObject(data)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing data block)',
    );
  }

  const collectionCandidate = Array.isArray(data.households)
    ? data.households
    : Array.isArray(data.records)
      ? data.records
      : [];

  if (!Array.isArray(collectionCandidate)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing households array)',
    );
  }

  const households = collectionCandidate
    .map((entry) => normalizeHouseholdRecord(entry))
    .filter((entry): entry is HouseholdRecord => entry !== null);

  return {
    households,
    meta: normalizeMeta(data.meta),
  };
};

export const ensureHouseholdResponse = (body: unknown): HouseholdRecord => {
  if (!isPlainObject(body)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing root object)',
    );
  }
  const data = body.data;
  if (!isPlainObject(data)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing data block)',
    );
  }

  const record = extractRecordFromData(data);
  const normalized = normalizeHouseholdRecord(record);

  if (!normalized) {
    throw new BadRequestException(
      'unexpected Twenty response (missing household record)',
    );
  }

  return normalized;
};

export const ensureHouseholdMemberListResponse = (
  body: unknown,
): HouseholdMemberListResponse => {
  if (!isPlainObject(body)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing root object)',
    );
  }
  const data = body.data;
  if (!isPlainObject(data)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing data block)',
    );
  }

  const collectionCandidate = Array.isArray(data.people)
    ? data.people
    : Array.isArray(data.persons)
      ? data.persons
      : Array.isArray(data.records)
        ? data.records
        : [];

  if (!Array.isArray(collectionCandidate)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing people array)',
    );
  }

  const members = collectionCandidate
    .map((entry) => normalizeHouseholdMemberRecord(entry))
    .filter((entry): entry is HouseholdMemberRecord => entry !== null);

  return {
    members,
    meta: normalizeMeta(data.meta),
  };
};

export const ensureHouseholdMemberResponse = (
  body: unknown,
): HouseholdMemberRecord => {
  if (!isPlainObject(body)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing root object)',
    );
  }
  const data = body.data;
  if (!isPlainObject(data)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing data block)',
    );
  }

  const record = extractRecordFromData(data) ?? data.person;
  const normalized = normalizeHouseholdMemberRecord(record);
  if (!normalized) {
    throw new BadRequestException(
      'unexpected Twenty response (missing person record)',
    );
  }
  return normalized;
};

const normalizeHouseholdPayload = (
  payload: unknown,
  { requireName }: { requireName: boolean },
): HouseholdWritePayload => {
  if (!isPlainObject(payload)) {
    throw new BadRequestException('payload must be an object');
  }

  const result: Record<string, unknown> = {};

  if (requireName) {
    if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      throw new BadRequestException('name is required');
    }
    result.name = payload.name.trim();
  } else if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    normalizeOptionalTrimmedString(result, 'name', payload.name, {
      allowNull: false,
    });
  }

  normalizeOptionalId(result, 'primaryContactId', payload.primaryContactId);
  normalizeOptionalTrimmedString(result, 'envelopeName', payload.envelopeName);
  normalizeOptionalTrimmedString(
    result,
    'salutationFormal',
    payload.salutationFormal,
  );
  normalizeOptionalTrimmedString(
    result,
    'salutationInformal',
    payload.salutationInformal,
  );

  const normalizedAddress = normalizeMailingAddressInput(
    payload.mailingAddress,
    {
      required: false,
    },
  );
  if (normalizedAddress !== undefined) {
    result.mailingAddress =
      normalizedAddress === null || Object.keys(normalizedAddress).length > 0
        ? normalizedAddress
        : undefined;
  }

  return result as HouseholdWritePayload;
};

export const validateCreateHouseholdPayload = (
  payload: unknown,
): HouseholdWritePayload => {
  const normalized = normalizeHouseholdPayload(payload, { requireName: true });
  return normalized;
};

export const validateUpdateHouseholdPayload = (
  payload: unknown,
): HouseholdWritePayload => {
  const normalized = normalizeHouseholdPayload(payload, { requireName: false });
  if (Object.keys(normalized).length === 0) {
    throw new BadRequestException(
      'At least one field must be provided to update a household',
    );
  }
  return normalized;
};

export const validateAssignHouseholdMemberPayload = (
  payload: unknown,
): AssignHouseholdMemberPayload => {
  if (!isPlainObject(payload)) {
    throw new BadRequestException('payload must be an object');
  }

  const { contactId, makePrimary } = payload;

  if (typeof contactId !== 'string' || contactId.trim().length === 0) {
    throw new BadRequestException('contactId is required');
  }

  let normalizedMakePrimary: boolean | undefined;
  if (makePrimary !== undefined) {
    if (typeof makePrimary !== 'boolean') {
      throw new BadRequestException(
        'makePrimary must be a boolean if provided',
      );
    }
    normalizedMakePrimary = makePrimary;
  }

  return {
    contactId: contactId.trim(),
    makePrimary: normalizedMakePrimary,
  };
};

export const validateCopyAddressPayload = (
  payload: unknown,
): CopyHouseholdAddressPayload => {
  if (!isPlainObject(payload)) {
    throw new BadRequestException('payload must be an object');
  }

  const { contactId } = payload;

  if (typeof contactId !== 'string' || contactId.trim().length === 0) {
    throw new BadRequestException('contactId is required');
  }

  const normalizedAddress = normalizeMailingAddressInput(
    payload.mailingAddress,
    {
      required: true,
    },
  );

  if (normalizedAddress === null) {
    return {
      contactId: contactId.trim(),
      mailingAddress: null,
    };
  }

  if (!normalizedAddress || Object.keys(normalizedAddress).length === 0) {
    throw new BadRequestException(
      'mailingAddress must include at least one field when copying to a contact',
    );
  }

  return {
    contactId: contactId.trim(),
    mailingAddress: normalizedAddress,
  };
};
