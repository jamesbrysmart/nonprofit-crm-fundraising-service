import { plainToInstance } from 'class-transformer';
import { GiftStagingRecordModel } from '../domain/staging-record.model';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface GiftStagingListTransformResult {
  records: GiftStagingRecordModel[];
  hasMore: boolean;
  nextCursor?: string;
}

export const mapGiftStagingRecord = (
  record: unknown,
): GiftStagingRecordModel | undefined => {
  const instance = plainToInstance(GiftStagingRecordModel, record ?? {}, {
    excludeExtraneousValues: true,
    exposeUnsetFields: false,
  });

  return instance.id ? instance : undefined;
};

export const mapGiftStagingGetResponse = (
  response: unknown,
): GiftStagingRecordModel | undefined => {
  if (!isPlainObject(response) || !isPlainObject(response.data)) {
    return undefined;
  }

  const giftStaging = response.data.giftStaging;
  return mapGiftStagingRecord(giftStaging);
};

export const mapGiftStagingListResponse = (
  response: unknown,
): GiftStagingListTransformResult => {
  if (!isPlainObject(response) || !isPlainObject(response.data)) {
    return { records: [], hasMore: false };
  }

  const data = response.data;
  const pageInfoRaw = data.pageInfo;
  const giftStagings = data.giftStagings;

  const records: GiftStagingRecordModel[] = Array.isArray(giftStagings)
    ? giftStagings
        .map((entry) => mapGiftStagingRecord(entry))
        .filter((entry): entry is GiftStagingRecordModel => Boolean(entry))
    : [];

  const pageInfo = isPlainObject(pageInfoRaw) ? pageInfoRaw : undefined;
  const hasMore =
    typeof pageInfo?.hasNextPage === 'boolean'
      ? pageInfo.hasNextPage
      : Boolean(pageInfo?.hasMore);

  const nextCursor =
    typeof pageInfo?.endCursor === 'string'
      ? pageInfo.endCursor
      : typeof pageInfo?.nextCursor === 'string'
        ? pageInfo.nextCursor
        : undefined;

  return { records, hasMore, nextCursor };
};
