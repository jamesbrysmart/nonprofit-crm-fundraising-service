import { fetchJson } from '../api-shared/http';
import { normalizeGiftPayoutRecord } from '../api-shared/mappers';

export interface CurrencyAmount {
  value?: number;
  currencyCode?: string;
}

export interface GiftPayoutRecord {
  id: string;
  sourceSystem?: string;
  payoutReference?: string;
  depositDate?: string;
  depositGrossAmount?: CurrencyAmount;
  depositFeeAmount?: CurrencyAmount;
  depositNetAmount?: CurrencyAmount;
  expectedItemCount?: number;
  status?: string;
  varianceAmount?: CurrencyAmount;
  varianceReason?: string;
  note?: string;
  confirmedAt?: string;
  matchedGrossAmount?: CurrencyAmount;
  matchedFeeAmount?: CurrencyAmount;
  matchedGiftCount?: number;
  pendingStagingCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GiftPayoutListResponse {
  data: GiftPayoutRecord[];
  meta?: {
    nextCursor?: string;
    hasMore?: boolean;
    totalCount?: number;
  };
}

export async function fetchGiftPayouts(
  params: {
    limit?: number;
    cursor?: string;
    statuses?: string[];
    sourceSystems?: string[];
    search?: string;
    sort?: string;
  } = {},
): Promise<GiftPayoutListResponse> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }
  if (typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    queryParams.cursor = params.cursor.trim();
  }
  if (Array.isArray(params.statuses) && params.statuses.length > 0) {
    queryParams.statuses = params.statuses;
  }
  if (Array.isArray(params.sourceSystems) && params.sourceSystems.length > 0) {
    queryParams.sourceSystems = params.sourceSystems;
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }
  if (typeof params.sort === 'string' && params.sort.trim().length > 0) {
    queryParams.sort = params.sort.trim();
  }

  const payload = await fetchJson<{
    data?: { giftPayouts?: unknown[] } | GiftPayoutRecord[];
    meta?: GiftPayoutListResponse['meta'];
  }>('/api/fundraising/gift-payouts', {
    params: queryParams,
  });

  const list =
    Array.isArray((payload.data as { giftPayouts?: unknown[] })?.giftPayouts)
      ? ((payload.data as { giftPayouts?: unknown[] })?.giftPayouts as unknown[])
      : Array.isArray(payload.data)
        ? (payload.data as unknown[])
        : [];

  const data = list
    .map((entry) => normalizeGiftPayoutRecord(entry))
    .filter((entry): entry is GiftPayoutRecord => Boolean(entry));

  return {
    data,
    meta: payload.meta,
  };
}

export async function createGiftPayout(payload: Record<string, unknown>): Promise<GiftPayoutRecord | null> {
  const json = await fetchJson<{ data?: { giftPayout?: unknown } } | unknown>(
    '/api/fundraising/gift-payouts',
    {
      method: 'POST',
      body: payload ?? {},
    },
  );
  const record = (json as { data?: { giftPayout?: unknown } })?.data?.giftPayout ?? json;
  return normalizeGiftPayoutRecord(record ?? null);
}

export async function updateGiftPayout(
  payoutId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const trimmedId = payoutId.trim();
  if (!trimmedId) {
    throw new Error('payoutId is required');
  }

  await fetchJson(`/api/fundraising/gift-payouts/${encodeURIComponent(trimmedId)}`, {
    method: 'PATCH',
    body: payload ?? {},
  });
}

export async function linkGiftsToPayout(
  payoutId: string,
  giftIds: string[],
): Promise<{ linkedGiftIds: string[] }> {
  const trimmedId = payoutId.trim();
  if (!trimmedId) {
    throw new Error('payoutId is required');
  }

  return fetchJson<{ linkedGiftIds: string[] }>(
    `/api/fundraising/gift-payouts/${encodeURIComponent(trimmedId)}/gifts/link`,
    {
      method: 'POST',
      body: { giftIds },
    },
  );
}

export async function unlinkGiftsFromPayout(
  payoutId: string,
  giftIds: string[],
): Promise<{ unlinkedGiftIds: string[] }> {
  const trimmedId = payoutId.trim();
  if (!trimmedId) {
    throw new Error('payoutId is required');
  }

  return fetchJson<{ unlinkedGiftIds: string[] }>(
    `/api/fundraising/gift-payouts/${encodeURIComponent(trimmedId)}/gifts/unlink`,
    {
      method: 'POST',
      body: { giftIds },
    },
  );
}
