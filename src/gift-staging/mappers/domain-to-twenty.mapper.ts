import { CreateGiftStagingDto } from '../dtos/create-gift-staging.dto';
import type { NormalizedGiftCreatePayload } from '../../gift/gift.types';

export const mapCreateGiftStagingPayload = (
  payload: NormalizedGiftCreatePayload,
  autoPromote: boolean,
): CreateGiftStagingDto & { rawPayload: string } => {
  const promotionStatus = autoPromote ? 'committing' : 'pending';

  const rawPayload = JSON.stringify(payload);

  const providerContext: Record<string, unknown> | undefined =
    typeof payload.providerContext === 'string'
      ? safeParseJson(payload.providerContext)
      : payload.providerContext;

  const body: CreateGiftStagingDto & { rawPayload: string } = {
    autoPromote,
    promotionStatus,
    amount: {
      value: payload.amountMajor ?? payload.amount?.value ?? 0,
      currencyCode: payload.currency ?? payload.amount?.currencyCode ?? 'GBP',
    },
    amountMinor: payload.amountMinor,
    amountMajor: payload.amountMajor,
    currency: payload.currency ?? payload.amount?.currencyCode ?? 'GBP',
    feeAmountMinor: payload.feeAmountMinor,
    intakeSource: payload.intakeSource,
    sourceFingerprint: payload.sourceFingerprint,
    externalId: payload.externalId,
    paymentMethod: payload.paymentMethod,
    dateReceived: payload.dateReceived ?? payload.giftDate,
    expectedAt: payload.expectedAt,
    giftAidEligible: payload.giftAidEligible ?? false,
    fundId: payload.fundId,
    appealId: payload.appealId,
    appealSegmentId: payload.appealSegmentId,
    trackingCodeId: payload.trackingCodeId,
    donorId: payload.donorId,
    donorFirstName: payload.donorFirstName,
    donorLastName: payload.donorLastName,
    donorEmail: payload.donorEmail,
    giftBatchId: payload.giftBatchId,
    provider: payload.provider,
    providerPaymentId: payload.providerPaymentId,
    providerContext,
    recurringAgreementId: payload.recurringAgreementId,
    giftPayoutId: payload.giftPayoutId,
    notes: payload.notes,
    opportunityId: payload.opportunityId,
    giftIntent: payload.giftIntent,
    isInKind: payload.isInKind,
    inKindDescription: payload.inKindDescription,
    estimatedValue: payload.estimatedValue,
    rawPayload,
  };

  return body;
};

const safeParseJson = (value: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};
