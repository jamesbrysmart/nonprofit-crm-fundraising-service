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

  delete body.amountMinor;
  delete body.currency;
  delete body.dateReceived;
  delete body.giftBatchId;
  delete body.intakeSource;
  delete body.sourceFingerprint;
  delete body.autoPromote;
  delete body.giftAidEligible;
  delete body.amountMajor;
  delete body.expectedAt;

  if (!body.giftDate && typeof payload.dateReceived === 'string') {
    body.giftDate = payload.dateReceived;
  }

  if (payload.amountMajor && payload.currency) {
    body.amount = {
      value: payload.amountMajor,
      currencyCode: payload.currency,
    };
  }

  if (
    typeof payload.feeAmountMajor === 'number' &&
    (typeof payload.feeCurrency === 'string' ||
      typeof payload.currency === 'string')
  ) {
    body.feeAmount = {
      value: payload.feeAmountMajor,
      currencyCode: payload.feeCurrency ?? payload.currency,
    };
  } else if (
    typeof payload.feeAmountMinor === 'number' &&
    typeof payload.currency === 'string'
  ) {
    body.feeAmount = {
      value: Number((payload.feeAmountMinor / 100).toFixed(2)),
      currencyCode: payload.currency,
    };
  }

  const providerContext = normalizeProviderContext(payload.providerContext);
  if (providerContext && !body.recurringMetadata) {
    body.recurringMetadata = providerContext;
  }

  delete body.providerContext;
  delete body.feeAmountMajor;
  delete body.feeAmountMinor;
  delete body.feeCurrency;
  delete body.dedupeDiagnostics;
  delete body.appealSegmentId;
  delete body.trackingCodeId;
  delete body.fundId;

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
