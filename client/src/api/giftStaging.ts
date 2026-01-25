import { fetchJson } from '../api-shared/http';
import type { GiftCreatePayload } from './gifts';

export interface GiftStagingCreateResponse {
  data?: {
    giftStaging?: {
      id?: string;
      autoPromote?: boolean;
      promotionStatus?: string;
      validationStatus?: string;
      dedupeStatus?: string;
    };
  };
}

export async function createGiftStaging(
  payload: GiftCreatePayload,
): Promise<GiftStagingCreateResponse> {
  return fetchJson<GiftStagingCreateResponse>('/api/fundraising/gift-staging', {
    method: 'POST',
    body: payload,
  });
}

export interface GiftStagingStatusUpdatePayload {
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string;
  giftBatchId?: string;
  rawPayload?: string;
}

export interface GiftStagingUpdatePayload {
  donorId?: string | null;
  donorFirstName?: string | null;
  donorLastName?: string | null;
  donorEmail?: string | null;
  amountMicros?: number;
  currencyCode?: string | null;
  giftDate?: string | null;
  expectedAt?: string | null;
  fundId?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
  trackingCodeId?: string | null;
  opportunityId?: string | null;
  giftIntent?: string | null;
  inKindDescription?: string | null;
  isInKind?: boolean | null;
  estimatedValue?: number | null;
  notes?: string | null;
  giftAidEligible?: boolean;
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string | null;
  giftBatchId?: string | null;
}

export async function updateGiftStagingStatus(
  stagingId: string,
  payload: GiftStagingStatusUpdatePayload,
): Promise<void> {
  await fetchJson(`/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}/status`, {
    method: 'PATCH',
    body: payload,
  });
}

export type ProcessGiftDeferredReason = 'not_ready' | 'locked' | 'missing_payload';
export type ProcessGiftErrorReason = 'fetch_failed' | 'payload_invalid' | 'gift_api_failed';

export type ProcessGiftResponse =
  | { status: 'committed'; giftId: string; stagingId: string }
  | { status: 'deferred'; stagingId: string; reason: ProcessGiftDeferredReason }
  | { status: 'error'; stagingId: string; error: ProcessGiftErrorReason };

export async function processGiftStaging(stagingId: string): Promise<ProcessGiftResponse> {
  return fetchJson<ProcessGiftResponse>(
    `/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}/process`,
    { method: 'POST' },
  );
}

export interface GiftStagingListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  processingStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  externalId?: string;
  amountMicros?: number;
  currencyCode?: string;
  giftDate?: string;
  expectedAt?: string;
  paymentMethod?: string;
  giftBatchId?: string;
  autoPromote?: boolean;
  giftAidEligible?: boolean;
  donorId?: string;
  companyId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  fundId?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  opportunityId?: string;
  giftIntent?: string;
  isInKind?: boolean;
  inKindDescription?: string;
  estimatedValue?: number;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown>;
  recurringAgreementId?: string;
  rawPayloadAvailable?: boolean;
  errorDetail?: string;
  notes?: string;
  receiptStatus?: string;
  receiptPolicyApplied?: string;
  receiptChannel?: string;
  receiptTemplateVersion?: string;
  receiptError?: string;
  receiptDedupeKey?: string;
  receiptSentAt?: string;
  receiptWarnings?: string[];
}

export interface GiftStagingListResponse {
  data: GiftStagingListItem[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export async function fetchGiftStagingList(
  params: {
    limit?: number;
    sort?: string;
    recurringAgreementId?: string;
    statuses?: string[];
    intakeSources?: string[];
    search?: string;
    giftBatchId?: string;
  } = {},
): Promise<GiftStagingListResponse> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = params.limit;
  }
  if (typeof params.sort === 'string' && params.sort.trim().length > 0) {
    queryParams.sort = params.sort.trim();
  }
  if (
    typeof params.recurringAgreementId === 'string' &&
    params.recurringAgreementId.trim().length > 0
  ) {
    queryParams.recurringAgreementId = params.recurringAgreementId.trim();
  }
  if (Array.isArray(params.statuses) && params.statuses.length > 0) {
    queryParams.statuses = params.statuses;
  }
  if (Array.isArray(params.intakeSources) && params.intakeSources.length > 0) {
    queryParams.intakeSources = params.intakeSources;
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }
  if (typeof params.giftBatchId === 'string' && params.giftBatchId.trim().length > 0) {
    queryParams.giftBatchId = params.giftBatchId.trim();
  }

  return fetchJson<GiftStagingListResponse>('/api/fundraising/gift-staging', {
    params: queryParams,
  });
}

export interface GiftStagingDetailResponse {
  data?: {
    giftStaging?: {
      id?: string;
      promotionStatus?: string;
      validationStatus?: string;
      dedupeStatus?: string;
      errorDetail?: string;
      rawPayload?: string;
      giftBatchId?: string;
      giftId?: string;
      autoPromote?: boolean;
      createdAt?: string;
      updatedAt?: string;
      amountMicros?: number;
      currencyCode?: string;
      intakeSource?: string;
      sourceFingerprint?: string;
      externalId?: string;
      paymentMethod?: string;
      giftDate?: string;
      giftAidEligible?: boolean;
      donorId?: string;
      donorFirstName?: string;
      donorLastName?: string;
      donorEmail?: string;
      fundId?: string;
      appealId?: string;
      appealSegmentId?: string;
      trackingCodeId?: string;
      expectedAt?: string;
      provider?: string;
      providerPaymentId?: string;
      providerContext?: Record<string, unknown>;
      recurringAgreementId?: string;
      opportunityId?: string;
      giftIntent?: string;
      isInKind?: boolean;
      inKindDescription?: string;
      estimatedValue?: number;
      notes?: string;
      receiptStatus?: string;
      receiptPolicyApplied?: string;
      receiptChannel?: string;
      receiptTemplateVersion?: string;
      receiptError?: string;
      receiptDedupeKey?: string;
      receiptSentAt?: string;
      receiptWarnings?: string[];
    };
  };
}

export async function updateGiftStaging(
  stagingId: string,
  payload: GiftStagingUpdatePayload,
): Promise<GiftStagingDetailResponse> {
  return fetchJson<GiftStagingDetailResponse>(
    `/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
}

export async function fetchGiftStagingById(
  stagingId: string,
): Promise<GiftStagingDetailResponse> {
  return fetchJson<GiftStagingDetailResponse>(
    `/api/fundraising/gift-staging/${encodeURIComponent(stagingId)}`,
  );
}
