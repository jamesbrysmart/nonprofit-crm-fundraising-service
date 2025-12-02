import { BadRequestException } from '@nestjs/common';

export interface CurrencyAmount {
  currencyCode: string;
  amountMicros: number;
}

export interface AppealWritePayload extends Record<string, unknown> {
  name?: string;
  description?: string | null;
  appealType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  goalAmount?: CurrencyAmount | null;
  budgetAmount?: CurrencyAmount | null;
  targetSolicitedCount?: number | null;
}

export interface SolicitationSnapshotCreatePayload
  extends Record<string, unknown> {
  appealId?: string;
  appealSegmentId?: string | null;
  countSolicited: number;
  source?: string | null;
  capturedAt: string;
  notes?: string | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeOptionalString = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  options: { allowNull?: boolean } = {},
): void => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (options.allowNull) {
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
    if (options.allowNull) {
      target[key] = null;
    }
    return;
  }

  target[key] = trimmed;
};

const normalizeDateString = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    target[key] = null;
    return;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be an ISO date string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    target[key] = null;
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException(`${key} must be a YYYY-MM-DD string`);
  }

  target[key] = trimmed;
};

const normalizeTargetCount = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    target[key] = null;
    return;
  }

  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    throw new BadRequestException(`${key} must be a number`);
  }

  if (numeric < 0) {
    throw new BadRequestException(`${key} cannot be negative`);
  }

  target[key] = Math.trunc(numeric);
};

const normalizeCurrencyAmount = (
  value: unknown,
  fieldName: string,
): CurrencyAmount | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  let rawValue: unknown;
  let rawCurrency: unknown;

  if (isPlainObject(value)) {
    rawValue =
      value.amountMicros ??
      value.value ??
      value.amount ??
      value.total ??
      value.num;
    rawCurrency = value.currencyCode ?? value.currency ?? value.ccy;
  } else if (typeof value === 'number' || typeof value === 'string') {
    rawValue = value;
  } else {
    throw new BadRequestException(
      `${fieldName} must be a number or an object with value and currencyCode`,
    );
  }

  const isMicrosInput = isPlainObject(value) && (value as Record<string, unknown>).amountMicros !== undefined;

  const numericRaw =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number.parseFloat(rawValue.trim())
        : Number.NaN;

  if (!Number.isFinite(numericRaw)) {
    throw new BadRequestException(`${fieldName} must contain a numeric value`);
  }

  if (numericRaw < 0) {
    throw new BadRequestException(`${fieldName} cannot be negative`);
  }

  let currency: string | undefined;

  if (typeof rawCurrency === 'string' && rawCurrency.trim().length > 0) {
    currency = rawCurrency.trim().toUpperCase();
  }

  const amountMicros = isMicrosInput
    ? Math.round(numericRaw)
    : Math.round(numericRaw * 1_000_000);

  return {
    amountMicros,
    currencyCode: currency ?? 'GBP',
  };
};

const normalizeAppealPayload = (
  payload: unknown,
  options: { requireName: boolean },
): AppealWritePayload => {
  if (!isPlainObject(payload)) {
    throw new BadRequestException('Appeal payload must be an object');
  }

  const result: AppealWritePayload = {};

  if (
    options.requireName ||
    Object.prototype.hasOwnProperty.call(payload, 'name')
  ) {
    const value = payload.name;
    if (typeof value !== 'string') {
      throw new BadRequestException('name must be a string');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('name is required');
    }
    result.name = trimmed;
  }

  normalizeOptionalString(result, 'description', payload.description, {
    allowNull: true,
  });

  normalizeOptionalString(result, 'appealType', payload.appealType, {
    allowNull: true,
  });
  normalizeDateString(result, 'startDate', payload.startDate);
  normalizeDateString(result, 'endDate', payload.endDate);

  const goalAmount = normalizeCurrencyAmount(payload.goalAmount, 'goalAmount');
  if (goalAmount !== undefined) {
    result.goalAmount = goalAmount;
  }

  const budgetAmount = normalizeCurrencyAmount(
    payload.budgetAmount,
    'budgetAmount',
  );
  if (budgetAmount !== undefined) {
    result.budgetAmount = budgetAmount;
  }

  normalizeTargetCount(
    result,
    'targetSolicitedCount',
    payload.targetSolicitedCount,
  );

  return result;
};

export const validateCreateAppealPayload = (
  payload: unknown,
): AppealWritePayload => {
  return normalizeAppealPayload(payload, { requireName: true });
};

export const validateUpdateAppealPayload = (
  payload: unknown,
): AppealWritePayload => {
  const normalized = normalizeAppealPayload(payload, { requireName: false });
  if (Object.keys(normalized).length === 0) {
    throw new BadRequestException('No appeal fields provided for update');
  }
  return normalized;
};

export const validateCreateSolicitationSnapshotPayload = (
  payload: unknown,
): SolicitationSnapshotCreatePayload => {
  if (!isPlainObject(payload)) {
    throw new BadRequestException(
      'Solicitation snapshot payload must be an object',
    );
  }

  const countRaw =
    payload.countSolicited ??
    payload.count ??
    payload.total ??
    payload.recipients ??
    undefined;

  const count =
    typeof countRaw === 'number'
      ? countRaw
      : typeof countRaw === 'string'
        ? Number.parseInt(countRaw.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(count)) {
    throw new BadRequestException('countSolicited must be numeric');
  }

  if (count <= 0) {
    throw new BadRequestException('countSolicited must be greater than zero');
  }

  const result: SolicitationSnapshotCreatePayload = {
    countSolicited: Math.trunc(count),
    capturedAt: new Date().toISOString(),
  };

  normalizeOptionalString(result, 'source', payload.source, {
    allowNull: true,
  });
  normalizeOptionalString(result, 'appealSegmentId', payload.appealSegmentId, {
    allowNull: true,
  });
  normalizeOptionalString(result, 'notes', payload.notes, { allowNull: true });

  if (typeof payload.capturedAt === 'string') {
    const trimmed = payload.capturedAt.trim();
    if (trimmed.length > 0) {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          'capturedAt must be a valid ISO date-time string',
        );
      }
      result.capturedAt = parsed.toISOString();
    }
  } else if (payload.capturedAt !== undefined && payload.capturedAt !== null) {
    throw new BadRequestException('capturedAt must be a string when provided');
  }

  return result;
};

export const ensureCreateAppealResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const createAppeal = body.data.createAppeal;
  if (!isPlainObject(createAppeal) || typeof createAppeal.id !== 'string') {
    throw new BadRequestException(
      'unexpected Twenty response (missing createAppeal)',
    );
  }
};

export const ensureAppealListResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const appeals = body.data.appeals;
  if (!Array.isArray(appeals)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing appeals array)',
    );
  }
};

export const ensureGetAppealResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const appeal = body.data.appeal;
  if (!isPlainObject(appeal) || typeof appeal.id !== 'string') {
    throw new BadRequestException(
      'unexpected Twenty response (missing appeal)',
    );
  }
};

export const ensureUpdateAppealResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const updateAppeal = body.data.updateAppeal;
  if (!isPlainObject(updateAppeal) || typeof updateAppeal.id !== 'string') {
    throw new BadRequestException(
      'unexpected Twenty response (missing updateAppeal)',
    );
  }
};

export const ensureCreateSolicitationSnapshotResponse = (
  body: unknown,
): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const createSnapshot = body.data.createSolicitationSnapshot;
  if (!isPlainObject(createSnapshot) || typeof createSnapshot.id !== 'string') {
    throw new BadRequestException(
      'unexpected Twenty response (missing createSolicitationSnapshot)',
    );
  }
};

export const ensureSolicitationSnapshotListResponse = (body: unknown): void => {
  if (!isPlainObject(body) || !isPlainObject(body.data)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const snapshots = body.data.solicitationSnapshots;
  if (!Array.isArray(snapshots)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing solicitationSnapshots)',
    );
  }
};
