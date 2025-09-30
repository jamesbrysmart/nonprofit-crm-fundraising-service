import { BadRequestException } from '@nestjs/common';

const ALLOWED_STRING_FIELDS = new Set([
  'contactId',
  'campaignId',
  'date',
  'giftDate',
  'name',
  'description',
  'notes',
  'externalId',
]);

const ALLOWED_NUMBER_FIELDS = new Set(['amountMicros']);

type Writable<T> = { -readonly [K in keyof T]: T[K] };

export type GiftAmount = {
  currencyCode: string;
  value: number;
};

export type GiftCreatePayload = Writable<
  {
    amount: GiftAmount;
  } & Record<string, unknown>
>;

export type GiftUpdatePayload = Partial<GiftCreatePayload>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseAmount = (input: unknown, context: 'create' | 'update'): GiftAmount => {
  if (!isPlainObject(input)) {
    throw new BadRequestException('amount must be an object');
  }

  const { currencyCode, value } = input;

  if (typeof currencyCode !== 'string' || currencyCode.trim() === '') {
    throw new BadRequestException('amount.currencyCode must be a non-empty string');
  }

  if (value === undefined || value === null) {
    if (context === 'create') {
      throw new BadRequestException('amount.value is required');
    }
    throw new BadRequestException('amount.value cannot be null');
  }

  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value));

  if (Number.isNaN(numericValue)) {
    throw new BadRequestException('amount.value must be numeric');
  }

  return {
    currencyCode: currencyCode.trim(),
    value: numericValue,
  };
};

const normalizeStringField = (
  payload: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  payload[key] = trimmed;
};

const normalizeNumberField = (
  payload: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  if (typeof value !== 'number') {
    throw new BadRequestException(`${key} must be a number`);
  }

  payload[key] = value;
};

const collectAllowedFields = (
  source: Record<string, unknown>,
  context: 'create' | 'update',
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'amount') {
      continue;
    }

    if (key === 'contact' && isPlainObject(value)) {
      const contact = normalizeContact(value, context);
      if (contact) {
        result.contact = contact;
      }
      continue;
    }

    if (ALLOWED_STRING_FIELDS.has(key)) {
      normalizeStringField(result, key, value);
      continue;
    }

    if (ALLOWED_NUMBER_FIELDS.has(key)) {
      normalizeNumberField(result, key, value);
      continue;
    }

    if (context === 'update') {
      result[key] = value;
    }
  }

  return result;
};

const normalizeContact = (
  payload: Record<string, unknown>,
  context: 'create' | 'update',
): Record<string, string> | undefined => {
  const { firstName, lastName } = payload;
  const normalized: Record<string, string> = {};

  const normalizedFirstName =
    typeof firstName === 'string' && firstName.trim().length > 0
      ? firstName.trim()
      : undefined;
  const normalizedLastName =
    typeof lastName === 'string' && lastName.trim().length > 0
      ? lastName.trim()
      : undefined;

  if (normalizedFirstName) {
    normalized.firstName = normalizedFirstName;
  }
  if (normalizedLastName) {
    normalized.lastName = normalizedLastName;
  }

  if (context === 'create' && (!normalizedFirstName || !normalizedLastName)) {
    throw new BadRequestException(
      'contact.firstName and contact.lastName are required when creating a gift contact',
    );
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const validateCreateGiftPayload = (
  body: unknown,
): GiftCreatePayload => {
  if (!isPlainObject(body)) {
    throw new BadRequestException('payload must be an object');
  }

  if (body.amount === undefined) {
    throw new BadRequestException('amount is required');
  }

  const sanitized: Record<string, unknown> = collectAllowedFields(
    body,
    'create',
  );

  sanitized.amount = parseAmount(body.amount, 'create');

  return sanitized as GiftCreatePayload;
};

export const validateUpdateGiftPayload = (
  body: unknown,
): GiftUpdatePayload => {
  if (!isPlainObject(body)) {
    throw new BadRequestException('payload must be an object');
  }

  if (Object.keys(body).length === 0) {
    throw new BadRequestException('update payload must include at least one field');
  }

  const sanitized: Record<string, unknown> = collectAllowedFields(
    body,
    'update',
  );

  if (body.amount !== undefined) {
    sanitized.amount = parseAmount(body.amount, 'update');
  }

  if (Object.keys(sanitized).length === 0) {
    throw new BadRequestException('no supported fields supplied for update');
  }

  return sanitized as GiftUpdatePayload;
};

export const ensureCreateGiftResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const createGift = body.data?.createGift;
  if (!isPlainObject(createGift) || typeof createGift.id !== 'string') {
    throw new BadRequestException('unexpected Twenty response (missing createGift)');
  }
};

export const ensureUpdateGiftResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const updateGift = body.data?.updateGift;
  if (!isPlainObject(updateGift) || typeof updateGift.id !== 'string') {
    throw new BadRequestException('unexpected Twenty response (missing updateGift)');
  }
};

export const ensureDeleteGiftResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const deleteGift = body.data?.deleteGift;
  if (!isPlainObject(deleteGift) || typeof deleteGift.id !== 'string') {
    throw new BadRequestException('unexpected Twenty response (missing deleteGift)');
  }
};

export const ensureGiftListResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const gifts = (body.data as Record<string, unknown>).gifts;
  if (!Array.isArray(gifts)) {
    throw new BadRequestException('unexpected Twenty response (missing gifts array)');
  }
};

export const ensureGiftGetResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const gift = (body.data as Record<string, unknown>).gift;
  if (!isPlainObject(gift) || typeof gift.id !== 'string') {
    throw new BadRequestException('unexpected Twenty response (missing gift)');
  }
};
