import { fetchJson } from '../api-shared/http';

export interface RecurringAgreementListItem {
  id: string;
  contactId?: string;
  status?: string;
  cadence?: string;
  intervalCount?: number;
  amountMicros?: number;
  currencyCode?: string;
  nextExpectedAt?: string;
  autoProcessEnabled?: boolean;
  provider?: string;
  providerAgreementId?: string;
  providerPaymentMethodId?: string;
}

export async function fetchRecurringAgreements(
  params: { limit?: number } = {},
): Promise<RecurringAgreementListItem[]> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }

  const payload = await fetchJson<{
    data?: { recurringAgreements?: unknown[] };
  }>('/api/fundraising/recurring-agreements', { params: queryParams });

  const items = Array.isArray(payload.data?.recurringAgreements)
    ? payload.data?.recurringAgreements
    : [];

  return items
    .map((entry) => normalizeRecurringAgreement(entry))
    .filter((entry): entry is RecurringAgreementListItem => Boolean(entry));
}

function normalizeRecurringAgreement(entry: unknown): RecurringAgreementListItem | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : null;
  if (!id) {
    return null;
  }

  const amountField = record.amount;
  const amountMicros =
    amountField && typeof amountField === 'object'
      ? typeof (amountField as Record<string, unknown>).amountMicros === 'number' &&
        Number.isFinite((amountField as Record<string, unknown>).amountMicros as number)
        ? ((amountField as Record<string, unknown>).amountMicros as number)
        : undefined
      : undefined;
  const currencyCode =
    amountField && typeof amountField === 'object'
      ? typeof (amountField as Record<string, unknown>).currencyCode === 'string'
        ? ((amountField as Record<string, unknown>).currencyCode as string)
        : undefined
      : undefined;

  return {
    id,
    contactId: typeof record.contactId === 'string' ? record.contactId : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    cadence: typeof record.cadence === 'string' ? record.cadence : undefined,
    intervalCount:
      typeof record.intervalCount === 'number' && Number.isFinite(record.intervalCount)
        ? record.intervalCount
        : undefined,
    amountMicros,
    currencyCode,
    nextExpectedAt: typeof record.nextExpectedAt === 'string' ? record.nextExpectedAt : undefined,
    autoProcessEnabled:
      typeof record.autoProcessEnabled === 'boolean' ? record.autoProcessEnabled : undefined,
    provider: typeof record.provider === 'string' ? record.provider : undefined,
    providerAgreementId:
      typeof record.providerAgreementId === 'string' ? record.providerAgreementId : undefined,
    providerPaymentMethodId:
      typeof record.providerPaymentMethodId === 'string'
        ? record.providerPaymentMethodId
        : undefined,
  };
}
