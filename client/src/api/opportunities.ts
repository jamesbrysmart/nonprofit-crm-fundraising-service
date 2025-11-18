import { fetchJson } from '../api-shared/http';
import type { MoneyValue } from './gifts';

export interface OpportunityRecord {
  id: string;
  name?: string;
  stage?: string;
  closeDate?: string;
  amount?: MoneyValue;
  companyId?: string;
  companyName?: string;
  pointOfContactId?: string;
  opportunityType?: string;
  giftsCount?: number;
  giftsReceivedAmount?: MoneyValue;
}

export interface OpportunitySearchParams {
  search?: string;
  companyId?: string;
  pointOfContactId?: string;
  opportunityType?: string;
  limit?: number;
}

export async function searchOpportunities(
  params: OpportunitySearchParams = {},
): Promise<OpportunityRecord[]> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }
  if (typeof params.companyId === 'string' && params.companyId.trim().length > 0) {
    queryParams.companyId = params.companyId.trim();
  }
  if (
    typeof params.pointOfContactId === 'string' &&
    params.pointOfContactId.trim().length > 0
  ) {
    queryParams.pointOfContactId = params.pointOfContactId.trim();
  }
  if (typeof params.opportunityType === 'string' && params.opportunityType.trim().length > 0) {
    queryParams.opportunityType = params.opportunityType.trim();
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.min(Math.max(Math.floor(params.limit), 1), 100);
  }

  const payload = await fetchJson<{
    data?: { opportunities?: unknown[] };
  }>('/api/fundraising/opportunities/search', { params: queryParams });

  const items = Array.isArray(payload.data?.opportunities)
    ? payload.data?.opportunities
    : [];

  return items
    .map((entry) => normalizeOpportunityRecord(entry))
    .filter((entry): entry is OpportunityRecord => Boolean(entry));
}

export async function updateOpportunity(
  opportunityId: string,
  payload: { stage?: string; closeDate?: string },
): Promise<void> {
  const trimmedId = opportunityId.trim();
  if (!trimmedId) {
    throw new Error('opportunityId is required');
  }

  await fetchJson(`/api/fundraising/opportunities/${encodeURIComponent(trimmedId)}`, {
    method: 'PATCH',
    body: payload ?? {},
  });
}

export interface CompanyRecord {
  id: string;
  name?: string;
  domainName?: string;
}

export async function searchCompanies(
  params: { search?: string; limit?: number } = {},
): Promise<CompanyRecord[]> {
  const queryParams: Record<string, unknown> = {};
  if (typeof params.search === 'string' && params.search.trim().length > 0) {
    queryParams.search = params.search.trim();
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.min(Math.max(Math.floor(params.limit), 1), 100);
  }

  const payload = await fetchJson<{
    data?: { companies?: unknown[] };
  }>('/api/fundraising/companies/search', { params: queryParams });

  const items = Array.isArray(payload.data?.companies)
    ? payload.data?.companies
    : [];

  return items
    .map((entry) => normalizeCompanyRecord(entry))
    .filter((entry): entry is CompanyRecord => Boolean(entry));
}

function normalizeOpportunityRecord(entry: unknown): OpportunityRecord | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : null;
  if (!id) {
    return null;
  }

  const toMoneyValue = (value: unknown): MoneyValue | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const money = value as Record<string, unknown>;
    const rawValue =
      typeof money.value === 'number' ? money.value : undefined;
    const amountMicros =
      typeof money.amountMicros === 'number' ? money.amountMicros : undefined;
    const currencyCode =
      typeof money.currencyCode === 'string' ? money.currencyCode : undefined;
    if (rawValue === undefined && amountMicros === undefined && !currencyCode) {
      return undefined;
    }
    const valueFromMicros =
      amountMicros !== undefined
        ? Number((amountMicros / 1_000_000).toFixed(2))
        : undefined;
    return {
      value: rawValue ?? valueFromMicros,
      currencyCode,
    };
  };

  const company =
    record.company && typeof record.company === 'object'
      ? (record.company as Record<string, unknown>)
      : undefined;

  return {
    id,
    name:
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : undefined,
    stage:
      typeof record.stage === 'string' && record.stage.trim().length > 0
        ? record.stage.trim()
        : undefined,
    closeDate:
      typeof record.closeDate === 'string' ? record.closeDate : undefined,
    amount: toMoneyValue(record.amount),
    companyId:
      typeof record.companyId === 'string'
        ? record.companyId
        : typeof company?.id === 'string'
          ? company.id
          : undefined,
    companyName:
      typeof record.companyName === 'string' && record.companyName.trim().length > 0
        ? record.companyName.trim()
        : typeof company?.name === 'string'
          ? (company.name as string)
          : undefined,
    pointOfContactId:
      typeof record.pointOfContactId === 'string'
        ? record.pointOfContactId
        : undefined,
    opportunityType:
      typeof record.opportunityType === 'string'
        ? record.opportunityType
        : undefined,
    giftsCount:
      typeof record.giftsCount === 'number' && Number.isFinite(record.giftsCount)
        ? record.giftsCount
        : undefined,
    giftsReceivedAmount: toMoneyValue(record.giftsReceivedAmount),
  };
}

function normalizeCompanyRecord(entry: unknown): CompanyRecord | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && record.id.trim().length > 0
      ? record.id.trim()
      : null;
  if (!id) {
    return null;
  }

  return {
    id,
    name:
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : undefined,
    domainName:
      typeof record.domainName === 'string' && record.domainName.trim().length > 0
        ? record.domainName.trim()
        : undefined,
  };
}
