import type {
  GiftStagingUpdateInput,
  GiftStagingRecordModel,
} from '../gift-staging.service';
import type { NormalizedGiftCreatePayload } from '../../gift/gift.types';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNullableString = (value: unknown): string | undefined =>
  value === null ? undefined : toTrimmedString(value);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const parseRawPayload = (
  rawPayload?: string,
): NormalizedGiftCreatePayload | undefined => {
  if (!rawPayload || rawPayload.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(rawPayload);
    if (isPlainObject(parsed)) {
      return parsed as NormalizedGiftCreatePayload;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const buildPayloadFromEntity = (
  entity: GiftStagingRecordModel,
): NormalizedGiftCreatePayload => {
  const amountMicros =
    typeof entity.amountMicros === 'number' ? entity.amountMicros : 0;
  const currencyCode = entity.currencyCode ?? 'GBP';

  const payload: NormalizedGiftCreatePayload = {
    amount: {
      currencyCode,
      amountMicros,
    },
    donorId: entity.donorId,
    donorFirstName: entity.donorFirstName,
    donorLastName: entity.donorLastName,
    donorEmail: entity.donorEmail,
    giftDate: entity.giftDate,
    expectedAt: entity.expectedAt,
    fundId: entity.fundId,
    appealId: entity.appealId,
    appealSegmentId: entity.appealSegmentId,
    trackingCodeId: entity.trackingCodeId,
    notes: entity.notes,
    giftAidEligible: entity.giftAidEligible,
    intakeSource: entity.intakeSource,
    sourceFingerprint: entity.sourceFingerprint,
    provider: entity.provider,
    providerPaymentId: entity.providerPaymentId,
    providerContext: entity.providerContext,
    recurringAgreementId: entity.recurringAgreementId,
    giftBatchId: entity.giftBatchId,
    autoProcess: entity.autoProcess,
    opportunityId: entity.opportunityId,
    giftIntent: entity.giftIntent,
    isInKind: entity.isInKind,
    inKindDescription: entity.inKindDescription,
    estimatedValue: entity.estimatedValue,
  };

  return payload;
};

export const mergePayloadForUpdate = (
  existing: GiftStagingRecordModel,
  updates: GiftStagingUpdateInput,
): NormalizedGiftCreatePayload => {
  const basePayload =
    parseRawPayload(existing.rawPayload) ?? buildPayloadFromEntity(existing);

  const merged: NormalizedGiftCreatePayload = {
    ...basePayload,
    amount: {
      ...(basePayload.amount ?? {
        currencyCode: existing.currencyCode ?? 'GBP',
        amountMicros: existing.amountMicros ?? 0,
      }),
    },
    providerContext: basePayload.providerContext,
  };

  if (updates.donorId !== undefined) {
    merged.donorId = toNullableString(updates.donorId);
  }
  if (updates.donorFirstName !== undefined) {
    merged.donorFirstName = toNullableString(updates.donorFirstName);
  }
  if (updates.donorLastName !== undefined) {
    merged.donorLastName = toNullableString(updates.donorLastName);
  }
  if (updates.donorEmail !== undefined) {
    merged.donorEmail = toNullableString(updates.donorEmail);
  }

  if (typeof updates.amountMicros === 'number') {
    merged.amount.amountMicros = updates.amountMicros;
  }

  if (updates.currencyCode !== undefined) {
    const normalized = toNullableString(updates.currencyCode);
    if (normalized) {
      merged.amount.currencyCode = normalized;
    }
  }

  if (
    typeof updates.feeAmountMicros === 'number' &&
    Number.isFinite(updates.feeAmountMicros)
  ) {
    merged.feeAmount = {
      amountMicros: updates.feeAmountMicros,
      currencyCode:
        merged.feeAmount?.currencyCode ??
        merged.amount.currencyCode ??
        'GBP',
    };
  }

  if (updates.feeCurrencyCode !== undefined) {
    const normalized = toNullableString(updates.feeCurrencyCode);
    if (normalized) {
      merged.feeAmount = {
        amountMicros: merged.feeAmount?.amountMicros ?? 0,
        currencyCode: normalized,
      };
    }
  }

  const assignString = (
    key: keyof NormalizedGiftCreatePayload,
    value: unknown,
  ) => {
    const normalized = toNullableString(value);
    if (normalized) {
      merged[key] = normalized as never;
    } else {
      delete merged[key];
    }
  };

  if (updates.giftDate !== undefined) {
    const date = toNullableString(updates.giftDate);
    if (date) {
      merged.giftDate = date;
    } else {
      delete merged.giftDate;
    }
  }

  if (updates.expectedAt !== undefined) {
    assignString('expectedAt', updates.expectedAt);
  }
  if (updates.fundId !== undefined) {
    assignString('fundId', updates.fundId);
  }
  if (updates.appealId !== undefined) {
    assignString('appealId', updates.appealId);
  }
  if (updates.appealSegmentId !== undefined) {
    assignString('appealSegmentId', updates.appealSegmentId);
  }
  if (updates.trackingCodeId !== undefined) {
    assignString('trackingCodeId', updates.trackingCodeId);
  }
  if (updates.opportunityId !== undefined) {
    assignString('opportunityId', updates.opportunityId);
  }
  if (updates.giftIntent !== undefined) {
    assignString('giftIntent', updates.giftIntent);
  }
  if (updates.inKindDescription !== undefined) {
    assignString('inKindDescription', updates.inKindDescription);
  }

  if (updates.isInKind !== undefined) {
    merged.isInKind = updates.isInKind === null ? undefined : updates.isInKind;
  }

  if (updates.estimatedValue !== undefined) {
    const value = toNumber(updates.estimatedValue);
    if (value !== undefined) {
      merged.estimatedValue = value;
    } else {
      delete merged.estimatedValue;
    }
  }

  if (updates.notes !== undefined) {
    assignString('notes', updates.notes);
  }

  if (updates.giftAidEligible !== undefined) {
    merged.giftAidEligible = updates.giftAidEligible;
  }

  if (updates.giftBatchId !== undefined) {
    const batchId = toNullableString(updates.giftBatchId);
    if (batchId) {
      merged.giftBatchId = batchId;
    } else {
      delete merged.giftBatchId;
    }
  }

  if (updates.giftPayoutId !== undefined) {
    const payoutId = toNullableString(updates.giftPayoutId);
    if (payoutId) {
      merged.giftPayoutId = payoutId;
    } else {
      delete merged.giftPayoutId;
    }
  }

  return merged;
};
