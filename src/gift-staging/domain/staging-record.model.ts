import { Expose, Transform } from 'class-transformer';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const toAmountMicros = (value: unknown): number | undefined => {
  if (isPlainObject(value)) {
    const amountMicros = toFiniteNumber(value.amountMicros);
    if (amountMicros !== undefined) {
      return Math.round(amountMicros);
    }
  }

  return undefined;
};

const toCurrencyCode = (value: unknown): string | undefined => {
  if (isPlainObject(value) && typeof value.currencyCode === 'string') {
    return toTrimmedString(value.currencyCode);
  }
  return undefined;
};

const toJsonObject = (value: unknown): Record<string, unknown> | undefined => {
  if (isPlainObject(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const toRawPayload = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (isPlainObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => toTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
};

export class GiftStagingRecordModel {
  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  id!: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  processingStatus?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  validationStatus?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  dedupeStatus?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  giftId?: string;

  @Expose()
  @Transform(({ value }) => toBoolean(value))
  autoProcess?: boolean;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  giftBatchId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  createdAt?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  updatedAt?: string;

  @Expose()
  @Transform(({ value, obj }) =>
    toAmountMicros(value ?? (obj as Record<string, unknown>)?.amount),
  )
  amountMicros?: number;

  @Expose()
  @Transform(({ value, obj }) =>
    toCurrencyCode(value ?? (obj as Record<string, unknown>)?.amount),
  )
  currencyCode?: string;

  @Expose()
  @Transform(({ value, obj }) =>
    toAmountMicros(value ?? (obj as Record<string, unknown>)?.feeAmount),
  )
  feeAmountMicros?: number;

  @Expose()
  @Transform(({ value, obj }) =>
    toCurrencyCode(value ?? (obj as Record<string, unknown>)?.feeAmount),
  )
  feeCurrencyCode?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  intakeSource?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  sourceFingerprint?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  externalId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  paymentMethod?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  giftDate?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  expectedAt?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  provider?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  providerPaymentId?: string;

  @Expose()
  @Transform(({ value }) => toJsonObject(value))
  providerContext?: Record<string, unknown>;

  @Expose()
  @Transform(({ value }) => toBoolean(value))
  giftAidEligible?: boolean;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  giftPayoutId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  donorId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  companyId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  donorFirstName?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  donorLastName?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  donorEmail?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  fundId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  appealId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  appealSegmentId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  trackingCodeId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  opportunityId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  giftIntent?: string;

  @Expose()
  @Transform(({ value }) => toBoolean(value))
  isInKind?: boolean;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  inKindDescription?: string;

  @Expose()
  @Transform(({ value }) => toFiniteNumber(value))
  estimatedValue?: number;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  recurringAgreementId?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  notes?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  errorDetail?: string;

  @Expose()
  @Transform(({ value }) => toJsonObject(value))
  processingDiagnostics?: Record<string, unknown>;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptStatus?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptPolicyApplied?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptChannel?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptTemplateVersion?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptError?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptDedupeKey?: string;

  @Expose()
  @Transform(({ value }) => toTrimmedString(value))
  receiptSentAt?: string;

  @Expose()
  @Transform(({ value }) => toStringArray(value))
  receiptWarnings?: string[];

  @Expose()
  @Transform(({ value }) => toRawPayload(value))
  rawPayload?: string;
}
