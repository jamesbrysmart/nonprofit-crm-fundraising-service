import { fetchJson } from '../api-shared/http';
import { toGiftRecord } from '../api-shared/mappers';

export interface GiftCreateResponse {
  data?: {
    createGift?: {
      id?: string;
      name?: string;
      amount?: {
        amountMicros?: number;
        currencyCode?: string;
      };
    };
  };
}

export interface GiftCreatePayload {
  amount: {
    currencyCode: string;
    amountMicros: number;
  };
  appealId?: string;
  giftDate?: string;
  name?: string;
  contact?: {
    firstName: string;
    lastName: string;
    email?: string;
  };
  contactId?: string;
  companyId?: string;
  autoPromote?: boolean;
  opportunityId?: string;
  giftIntent?: string;
  isInKind?: boolean;
  inKindDescription?: string;
  estimatedValue?: number;
}

export async function createGift(payload: GiftCreatePayload): Promise<GiftCreateResponse> {
  return fetchJson<GiftCreateResponse>('/api/fundraising/gifts', {
    method: 'POST',
    body: payload,
  });
}

export interface MoneyValue {
  value?: number;
  currencyCode?: string;
}

export interface GiftRecord {
  id: string;
  name?: string;
  amount?: MoneyValue;
  giftDate?: string;
  contactId?: string;
  contactName?: string;
  externalId?: string;
  status?: string;
  giftPayoutId?: string;
  intakeSource?: string;
  receiptStatus?: string;
  receiptPolicyApplied?: string;
  receiptChannel?: string;
  receiptTemplateVersion?: string;
  receiptError?: string;
  receiptDedupeKey?: string;
  receiptSentAt?: string;
}

export interface GiftListParams {
  giftPayoutId?: string;
  limit?: number;
  search?: string;
  sort?: string;
}

export async function fetchGifts(params: GiftListParams = {}): Promise<GiftRecord[]> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }
  if (typeof params.giftPayoutId === 'string' && params.giftPayoutId.trim().length > 0) {
    queryParams.giftPayoutId = params.giftPayoutId.trim();
  }
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }
  if (typeof params.sort === 'string' && params.sort.trim().length > 0) {
    queryParams.sort = params.sort.trim();
  }

  const payload = await fetchJson<{ data?: { gifts?: unknown[] } } | unknown>(
    '/api/fundraising/gifts',
    {
      params: queryParams,
    },
  );
  const data = Array.isArray((payload as { data?: { gifts?: unknown[] } }).data?.gifts)
    ? ((payload as { data?: { gifts?: unknown[] } }).data?.gifts as unknown[])
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

  return data
    .map((entry) => toGiftRecord(entry))
    .filter((record): record is GiftRecord => Boolean(record));
}
