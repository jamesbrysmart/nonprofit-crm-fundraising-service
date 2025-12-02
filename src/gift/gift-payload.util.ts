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
      : typeof payload.amountMinor === 'number' && Number.isFinite(payload.amountMinor)
        ? Math.round(payload.amountMinor * 10_000)
        : typeof payload.amountMajor === 'number'
          ? Math.round(payload.amountMajor * 1_000_000)
          : undefined;

  const currencyCode =
    payload.currency ??
    payload.amount?.currencyCode ??
    (typeof payload.feeCurrency === 'string' ? payload.feeCurrency : undefined);

  delete body.amountMinor;
  delete body.currency;
  delete body.dateReceived;
  delete body.intakeSource;
  delete body.sourceFingerprint;
  delete body.autoPromote;
  delete body.amountMajor;

  if (!body.giftDate && typeof payload.dateReceived === 'string') {
    body.giftDate = payload.dateReceived;
  }

  if (typeof amountMicros === 'number' && currencyCode) {
    body.amount = {
      amountMicros,
      currencyCode,
    };
  }

  if (
    (typeof payload.feeAmountMajor === 'number' ||
      typeof payload.feeAmountMinor === 'number') &&
    (typeof payload.feeCurrency === 'string' || typeof payload.currency === 'string')
  ) {
    const feeAmountMinor =
      typeof payload.feeAmountMinor === 'number' && Number.isFinite(payload.feeAmountMinor)
        ? payload.feeAmountMinor
        : typeof payload.feeAmountMajor === 'number'
          ? Math.round(payload.feeAmountMajor * 100)
          : undefined;

    const feeAmountMicros =
      typeof feeAmountMinor === 'number' ? Math.round(feeAmountMinor * 10_000) : undefined;

    const feeCurrencyCode = payload.feeCurrency ?? payload.currency ?? currencyCode;

    if (typeof feeAmountMicros === 'number' && feeCurrencyCode) {
      body.feeAmount = {
        amountMicros: feeAmountMicros,
        currencyCode: feeCurrencyCode,
      };
    }
  } else if (
    typeof payload.feeAmountMinor === 'number' &&
    typeof payload.currency === 'string'
  ) {
    body.feeAmount = {
      amountMicros: Math.round(payload.feeAmountMinor * 10_000),
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
