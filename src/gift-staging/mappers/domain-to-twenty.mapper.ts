import { CreateGiftStagingDto } from '../dtos/create-gift-staging.dto';
import type { NormalizedGiftCreatePayload } from '../../gift/gift.types';

export const mapCreateGiftStagingPayload = (
  payload: NormalizedGiftCreatePayload,
  autoProcess: boolean,
): CreateGiftStagingDto & { rawPayload: string } => {
  const processingStatus = autoProcess ? 'processing' : 'pending';

  const amountMicros =
    typeof payload.amount?.amountMicros === 'number'
      ? Math.round(payload.amount.amountMicros)
      : 0;

  const currencyCode = payload.amount?.currencyCode ?? 'GBP';

  const rawPayload = JSON.stringify(payload);

  const providerContext: Record<string, unknown> | undefined =
    typeof payload.providerContext === 'string'
      ? safeParseJson(payload.providerContext)
      : payload.providerContext;

  const body: CreateGiftStagingDto & { rawPayload: string } = {
    autoProcess,
    processingStatus,
    amount: {
      amountMicros,
      currencyCode,
    },
    feeAmount: payload.feeAmount,
    intakeSource: payload.intakeSource,
    sourceFingerprint: payload.sourceFingerprint,
    externalId: payload.externalId,
    paymentMethod: payload.paymentMethod,
    giftDate: payload.giftDate,
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
    processingDiagnostics: payload.processingDiagnostics
      ? (payload.processingDiagnostics as unknown as Record<string, unknown>)
      : undefined,
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
