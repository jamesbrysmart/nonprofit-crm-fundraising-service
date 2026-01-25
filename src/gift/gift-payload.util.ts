import { NormalizedGiftCreatePayload } from './gift.types';

const normalizeProviderContext = (
  input: Record<string, unknown> | string | undefined,
): Record<string, unknown> | undefined => {
  if (!input) {
    return undefined;
  }

  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  return input;
};

export const buildTwentyGiftPayload = (
  payload: NormalizedGiftCreatePayload,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    ...payload,
  };

  const amountMicros =
    typeof payload.amount?.amountMicros === 'number' &&
    Number.isFinite(payload.amount.amountMicros)
      ? Math.round(payload.amount.amountMicros)
      : undefined;

  const currencyCode = payload.amount?.currencyCode;

  delete body.dateReceived;
  delete body.date;
  delete body.intakeSource;
  delete body.sourceFingerprint;
  delete body.autoPromote;

  const giftDate =
    typeof payload.giftDate === 'string' ? payload.giftDate : undefined;

  if (giftDate) {
    body.giftDate = giftDate;
  }

  if (typeof amountMicros === 'number' && currencyCode) {
    body.amount = {
      amountMicros,
      currencyCode,
    };
  }

  if (payload.feeAmount && typeof payload.feeAmount === 'object') {
    const feeAmountMicros =
      typeof payload.feeAmount.amountMicros === 'number' &&
      Number.isFinite(payload.feeAmount.amountMicros)
        ? Math.round(payload.feeAmount.amountMicros)
        : undefined;
    const feeCurrencyCode =
      typeof payload.feeAmount.currencyCode === 'string'
        ? payload.feeAmount.currencyCode
        : currencyCode;
    if (typeof feeAmountMicros === 'number' && feeCurrencyCode) {
      body.feeAmount = {
        amountMicros: feeAmountMicros,
        currencyCode: feeCurrencyCode,
      };
    }
  }

  const providerContext = normalizeProviderContext(payload.providerContext);
  if (providerContext && !body.recurringMetadata) {
    body.recurringMetadata = providerContext;
  }

  delete body.providerContext;
  delete body.dedupeDiagnostics;

  return body;
};

export const extractCreateGiftId = (response: unknown): string | undefined => {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const data = (response as Record<string, unknown>).data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const createGift = (data as Record<string, unknown>).createGift;
  if (createGift && typeof createGift === 'object') {
    const id = (createGift as Record<string, unknown>).id;
    if (typeof id === 'string') {
      return id;
    }
  }

  return undefined;
};
