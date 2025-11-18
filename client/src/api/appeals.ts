import { fetchJson } from '../api-shared/http';
import type { MoneyValue } from './gifts';

export interface FetchAppealsParams {
  limit?: number;
  cursor?: string;
  sort?: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toMoneyValue = (value: unknown): MoneyValue | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const rawValue = value.value;
  const rawCurrency = value.currencyCode ?? value.currency;

  const numeric =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number.parseFloat(rawValue)
        : undefined;

  if (numeric === undefined || Number.isNaN(numeric)) {
    return undefined;
  }

  const currency =
    typeof rawCurrency === 'string' && rawCurrency.trim().length > 0
      ? rawCurrency.trim().toUpperCase()
      : undefined;

  return {
    value: Number.parseFloat(numeric.toFixed(2)),
    currencyCode: currency,
  };
};

export interface AppealRecord {
  id: string;
  name?: string;
  description?: string | null;
  appealType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  goalAmount?: MoneyValue | null;
  budgetAmount?: MoneyValue | null;
  raisedAmount?: MoneyValue | null;
  giftCount?: number | null;
  donorCount?: number | null;
  responseRate?: number | null;
  costPerPound?: number | null;
  lastGiftAt?: string | null;
  targetSolicitedCount?: number | null;
}

const toAppealRecord = (value: unknown): AppealRecord | undefined => {
  if (!isPlainObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : undefined,
    description: typeof value.description === 'string' ? value.description : null,
    appealType: typeof value.appealType === 'string' ? value.appealType : undefined,
    startDate: typeof value.startDate === 'string' ? value.startDate : null,
    endDate: typeof value.endDate === 'string' ? value.endDate : null,
    goalAmount: toMoneyValue(value.goalAmount) ?? null,
    budgetAmount: toMoneyValue(value.budgetAmount) ?? null,
    raisedAmount: toMoneyValue(value.raisedAmount) ?? null,
    giftCount:
      typeof value.giftCount === 'number'
        ? value.giftCount
        : typeof value.giftCount === 'string'
          ? Number.parseInt(value.giftCount, 10)
          : null,
    donorCount:
      typeof value.donorCount === 'number'
        ? value.donorCount
        : typeof value.donorCount === 'string'
          ? Number.parseInt(value.donorCount, 10)
          : null,
    responseRate:
      typeof value.responseRate === 'number'
        ? value.responseRate
        : typeof value.responseRate === 'string'
          ? Number.parseFloat(value.responseRate)
          : null,
    costPerPound:
      typeof value.costPerPound === 'number'
        ? value.costPerPound
        : typeof value.costPerPound === 'string'
          ? Number.parseFloat(value.costPerPound)
          : null,
    lastGiftAt: typeof value.lastGiftAt === 'string' ? value.lastGiftAt : null,
    targetSolicitedCount:
      typeof value.targetSolicitedCount === 'number'
        ? value.targetSolicitedCount
        : typeof value.targetSolicitedCount === 'string'
          ? Number.parseInt(value.targetSolicitedCount, 10)
          : null,
  };
};

export async function fetchAppeals(params: FetchAppealsParams = {}): Promise<AppealRecord[]> {
  const queryParams: Record<string, unknown> = {};

  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    queryParams.limit = Math.max(1, params.limit);
  }
  if (typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    queryParams.cursor = params.cursor.trim();
  }
  if (typeof params.sort === 'string' && params.sort.trim().length > 0) {
    queryParams.sort = params.sort.trim();
  }

  const json = await fetchJson<{
    data?: { appeals?: unknown[] };
  }>('/api/fundraising/appeals', { params: queryParams });

  const appeals: AppealRecord[] = [];

  for (const entry of json.data?.appeals ?? []) {
    const record = toAppealRecord(entry);
    if (record) {
      appeals.push(record);
    }
  }

  return appeals;
}

const serializeMoneyInput = (input: MoneyInput | undefined | null) => {
  if (!input) {
    return undefined;
  }
  const currency =
    typeof input.currencyCode === 'string' && input.currencyCode.trim().length > 0
      ? input.currencyCode.trim().toUpperCase()
      : 'GBP';
  return {
    value: Number.parseFloat(input.value.toFixed(2)),
    currencyCode: currency,
  };
};

export interface MoneyInput {
  value: number;
  currencyCode?: string;
}

export interface AppealCreateRequest {
  name: string;
  description?: string;
  appealType?: string;
  startDate?: string;
  endDate?: string;
  goalAmount?: MoneyInput | null;
  budgetAmount?: MoneyInput | null;
  targetSolicitedCount?: number | null;
}

export type AppealUpdateRequest = Partial<AppealCreateRequest>;

export async function createAppeal(payload: AppealCreateRequest): Promise<string> {
  const json = await fetchJson<{
    data?: { createAppeal?: { id?: string } };
  }>('/api/fundraising/appeals', {
    method: 'POST',
    body: {
      ...payload,
      goalAmount: serializeMoneyInput(payload.goalAmount ?? undefined),
      budgetAmount: serializeMoneyInput(payload.budgetAmount ?? undefined),
    },
  });

  const id = json.data?.createAppeal?.id;
  if (!id) {
    throw new Error('Twenty did not return an appeal id');
  }
  return id;
}

export async function updateAppeal(
  appealId: string,
  payload: AppealUpdateRequest,
): Promise<void> {
  await fetchJson(`/api/fundraising/appeals/${encodeURIComponent(appealId)}`, {
    method: 'PATCH',
    body: {
      ...payload,
      goalAmount: serializeMoneyInput(payload.goalAmount ?? undefined),
      budgetAmount: serializeMoneyInput(payload.budgetAmount ?? undefined),
    },
  });
}

export interface SolicitationSnapshotRecord {
  id: string;
  countSolicited?: number | null;
  source?: string | null;
  capturedAt?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
}

const toSolicitationSnapshotRecord = (value: unknown): SolicitationSnapshotRecord | undefined => {
  if (!isPlainObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  return {
    id: value.id,
    countSolicited:
      typeof value.countSolicited === 'number'
        ? value.countSolicited
        : typeof value.countSolicited === 'string'
          ? Number.parseInt(value.countSolicited, 10)
          : null,
    source: typeof value.source === 'string' ? value.source : null,
    capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : null,
    appealId: typeof value.appealId === 'string' ? value.appealId : null,
    appealSegmentId: typeof value.appealSegmentId === 'string' ? value.appealSegmentId : null,
  };
};

export async function fetchSolicitationSnapshots(
  appealId: string,
): Promise<SolicitationSnapshotRecord[]> {
  const json = await fetchJson<{
    data?: { solicitationSnapshots?: unknown[] };
  }>(`/api/fundraising/appeals/${encodeURIComponent(appealId)}/solicitation-snapshots`);

  const snapshots: SolicitationSnapshotRecord[] = [];
  for (const entry of json.data?.solicitationSnapshots ?? []) {
    const record = toSolicitationSnapshotRecord(entry);
    if (record) {
      snapshots.push(record);
    }
  }
  return snapshots.filter(
    (snapshot) => typeof snapshot.appealId !== 'string' || snapshot.appealId === appealId,
  );
}

export interface SolicitationSnapshotCreateRequest {
  countSolicited: number;
  source?: string;
  capturedAt?: string;
  appealSegmentId?: string;
  notes?: string;
}

export async function createSolicitationSnapshot(
  appealId: string,
  payload: SolicitationSnapshotCreateRequest,
): Promise<string> {
  const json = await fetchJson<{
    data?: { createSolicitationSnapshot?: { id?: string } };
  }>(`/api/fundraising/appeals/${encodeURIComponent(appealId)}/solicitation-snapshots`, {
    method: 'POST',
    body: payload,
  });

  const id = json.data?.createSolicitationSnapshot?.id;
  if (!id) {
    throw new Error('Twenty did not return a solicitation snapshot id');
  }
  return id;
}
