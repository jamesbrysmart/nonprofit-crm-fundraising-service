import { NormalizedGiftCreatePayload } from './gift.types';

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

  if (!body.giftDate && typeof payload.dateReceived === 'string') {
    body.giftDate = payload.dateReceived;
  }

  delete body.appealId;
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
