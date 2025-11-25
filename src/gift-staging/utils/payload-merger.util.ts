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
  const inferredAmountMinor =
    typeof entity.amountMinor === 'number'
      ? entity.amountMinor
      : typeof entity.amount === 'number'
        ? Math.round(entity.amount * 100)
        : 0;

  const inferredAmountMajor =
    typeof entity.amount === 'number'
      ? entity.amount
      : Number((inferredAmountMinor / 100).toFixed(2));

  const currency = entity.currency ?? 'GBP';

  const payload: NormalizedGiftCreatePayload = {
    amount: {
      currencyCode: currency,
      value: inferredAmountMajor,
    },
    amountMinor: inferredAmountMinor,
    amountMajor: inferredAmountMajor,
    currency,
    donorId: entity.donorId,
    donorFirstName: entity.donorFirstName,
    donorLastName: entity.donorLastName,
    donorEmail: entity.donorEmail,
    dateReceived: entity.dateReceived,
    giftDate: entity.dateReceived,
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
    autoPromote: entity.autoPromote,
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
        currencyCode: existing.currency ?? 'GBP',
        value: basePayload.amountMajor ?? 0,
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

  let amountMinor =
    updates.amountMinor !== undefined
      ? (updates.amountMinor ?? undefined)
      : undefined;
  let amountMajor =
    updates.amountMajor !== undefined
      ? (updates.amountMajor ?? undefined)
      : undefined;

  if (amountMinor === undefined && amountMajor === undefined) {
    amountMinor = merged.amountMinor ?? existing.amountMinor;
    amountMajor = merged.amountMajor ?? existing.amount;
  }

  if (amountMinor === undefined && amountMajor !== undefined) {
    amountMinor = Math.round(amountMajor * 100);
  }
  if (amountMajor === undefined && amountMinor !== undefined) {
    amountMajor = Number((amountMinor / 100).toFixed(2));
  }

  if (typeof amountMinor === 'number') {
    merged.amountMinor = amountMinor;
  }

  if (typeof amountMajor === 'number') {
    merged.amountMajor = amountMajor;
  }

  const resolvedAmountMajor =
    typeof merged.amountMajor === 'number'
      ? merged.amountMajor
      : typeof merged.amountMinor === 'number'
        ? Number((merged.amountMinor / 100).toFixed(2))
        : merged.amount?.value;

  if (!merged.amount) {
    merged.amount = {
      value: resolvedAmountMajor ?? 0,
      currencyCode: merged.currency ?? 'GBP',
    };
  } else {
    if (resolvedAmountMajor !== undefined) {
      merged.amount.value = resolvedAmountMajor;
    }
    if (merged.currency) {
      merged.amount.currencyCode = merged.currency;
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

  if (updates.dateReceived !== undefined) {
    const date = toNullableString(updates.dateReceived);
    if (date) {
      merged.dateReceived = date;
      merged.giftDate = date;
    } else {
      delete merged.dateReceived;
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
