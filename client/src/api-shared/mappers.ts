import type { CurrencyAmount, GiftPayoutRecord, GiftRecord } from '../api';

export const normalizeCurrencyField = (entry: unknown): CurrencyAmount | undefined => {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  const record = entry as Record<string, unknown>;
  const value =
    typeof record.value === 'number' && Number.isFinite(record.value)
      ? record.value
      : typeof record.amountMinor === 'number' && Number.isFinite(record.amountMinor)
        ? Number((record.amountMinor / 100).toFixed(2))
        : undefined;

  const currencyCode =
    typeof record.currencyCode === 'string'
      ? record.currencyCode
      : typeof record.currency === 'string'
        ? record.currency
        : undefined;

  if (value === undefined && !currencyCode) {
    return undefined;
  }

  return {
    value,
    currencyCode,
  };
};

export const normalizeGiftPayoutRecord = (entry: unknown): GiftPayoutRecord | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) {
    return null;
  }

  return {
    id,
    sourceSystem: typeof record.sourceSystem === 'string' ? record.sourceSystem : undefined,
    payoutReference:
      typeof record.payoutReference === 'string' ? record.payoutReference : undefined,
    depositDate:
      typeof record.depositDate === 'string' && record.depositDate.length > 0
        ? record.depositDate
        : undefined,
    depositGrossAmount: normalizeCurrencyField(record.depositGrossAmount),
    depositFeeAmount: normalizeCurrencyField(record.depositFeeAmount),
    depositNetAmount: normalizeCurrencyField(record.depositNetAmount),
    expectedItemCount:
      typeof record.expectedItemCount === 'number' && Number.isFinite(record.expectedItemCount)
        ? record.expectedItemCount
        : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    varianceAmount: normalizeCurrencyField(record.varianceAmount),
    varianceReason:
      typeof record.varianceReason === 'string' ? record.varianceReason : undefined,
    note: typeof record.note === 'string' ? record.note : undefined,
    confirmedAt:
      typeof record.confirmedAt === 'string' && record.confirmedAt.length > 0
        ? record.confirmedAt
        : undefined,
    matchedGrossAmount: normalizeCurrencyField(record.matchedGrossAmount),
    matchedFeeAmount: normalizeCurrencyField(record.matchedFeeAmount),
    matchedGiftCount:
      typeof record.matchedGiftCount === 'number' && Number.isFinite(record.matchedGiftCount)
        ? record.matchedGiftCount
        : undefined,
    pendingStagingCount:
      typeof record.pendingStagingCount === 'number' &&
      Number.isFinite(record.pendingStagingCount)
        ? record.pendingStagingCount
        : undefined,
    createdAt:
      typeof record.createdAt === 'string' && record.createdAt.length > 0
        ? record.createdAt
        : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' && record.updatedAt.length > 0
        ? record.updatedAt
        : undefined,
  };
};

export const toGiftRecord = (entry: unknown): GiftRecord | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) {
    return null;
  }

  const contact = record.contact;
  let contactName: string | undefined;
  if (contact && typeof contact === 'object') {
    const name = (contact as Record<string, unknown>).name;
    if (name && typeof name === 'object') {
      const nameRecord = name as Record<string, unknown>;
      if (typeof nameRecord.fullName === 'string' && nameRecord.fullName.trim().length > 0) {
        contactName = nameRecord.fullName.trim();
      } else {
        const first = typeof nameRecord.firstName === 'string' ? nameRecord.firstName.trim() : '';
        const last = typeof nameRecord.lastName === 'string' ? nameRecord.lastName.trim() : '';
        contactName = [first, last].filter(Boolean).join(' ').trim() || undefined;
      }
    }
  }

  const amount =
    record.amount && typeof record.amount === 'object'
      ? normalizeCurrencyField(record.amount)
      : undefined;

  return {
    id,
    name: typeof record.name === 'string' ? record.name : undefined,
    amount,
    giftDate: typeof record.giftDate === 'string' ? record.giftDate : undefined,
    contactId: typeof record.contactId === 'string' ? record.contactId : undefined,
    contactName,
    externalId: typeof record.externalId === 'string' ? record.externalId : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    giftPayoutId:
      typeof record.giftPayoutId === 'string' && record.giftPayoutId.length > 0
        ? record.giftPayoutId
        : undefined,
    intakeSource:
      typeof record.intakeSource === 'string' && record.intakeSource.length > 0
        ? record.intakeSource
        : undefined,
    receiptStatus:
      typeof record.receiptStatus === 'string' && record.receiptStatus.length > 0
        ? record.receiptStatus
        : undefined,
    receiptPolicyApplied:
      typeof record.receiptPolicyApplied === 'string' && record.receiptPolicyApplied.length > 0
        ? record.receiptPolicyApplied
        : undefined,
    receiptChannel:
      typeof record.receiptChannel === 'string' && record.receiptChannel.length > 0
        ? record.receiptChannel
        : undefined,
    receiptTemplateVersion:
      typeof record.receiptTemplateVersion === 'string' && record.receiptTemplateVersion.length > 0
        ? record.receiptTemplateVersion
        : undefined,
    receiptError:
      typeof record.receiptError === 'string' && record.receiptError.length > 0
        ? record.receiptError
        : undefined,
    receiptDedupeKey:
      typeof record.receiptDedupeKey === 'string' && record.receiptDedupeKey.length > 0
        ? record.receiptDedupeKey
        : undefined,
    receiptSentAt:
      typeof record.receiptSentAt === 'string' && record.receiptSentAt.length > 0
        ? record.receiptSentAt
        : undefined,
  };
};
