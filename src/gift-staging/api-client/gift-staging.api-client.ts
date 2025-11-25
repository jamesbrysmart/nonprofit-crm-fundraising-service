import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TwentyApiService } from '../../twenty/twenty-api.service';
import {
  mapGiftStagingGetResponse,
  mapGiftStagingListResponse,
} from '../mappers/twenty-to-domain.mapper';
import type { GiftStagingRecordModel } from '../domain/staging-record.model';

export interface GiftStagingListApiResult {
  records: GiftStagingRecordModel[];
  hasMore: boolean;
  nextCursor?: string;
}

@Injectable()
export class GiftStagingApiClient {
  private readonly logContext = GiftStagingApiClient.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async getById(stagingId: string): Promise<GiftStagingRecordModel> {
    try {
      const response = await this.twentyApiService.request(
        'GET',
        `/giftStagings/${encodeURIComponent(stagingId)}`,
        undefined,
        this.logContext,
      );

      const record = mapGiftStagingGetResponse(response);
      if (!record) {
        throw new NotFoundException('Gift staging record not found');
      }

      return record;
    } catch (error) {
      this.handleError(error);
    }
  }

  async list(path: string): Promise<GiftStagingListApiResult> {
    const response = await this.twentyApiService
      .request('GET', path, undefined, this.logContext)
      .catch((error) => {
        this.handleError(error);
      });

    const extracted = mapGiftStagingListResponse(response);
    return {
      records: extracted.records,
      hasMore: extracted.hasMore,
      nextCursor: extracted.nextCursor,
    };
  }

  async create(payload: unknown): Promise<unknown> {
    try {
      return await this.twentyApiService.request(
        'POST',
        '/giftStagings',
        payload,
        this.logContext,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async patch(stagingId: string, payload: unknown): Promise<unknown> {
    try {
      return await this.twentyApiService.request(
        'PATCH',
        `/giftStagings/${encodeURIComponent(stagingId)}`,
        payload,
        this.logContext,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof NotFoundException) {
      throw error;
    }

    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      throw new NotFoundException('Gift staging record not found');
    }
    if (status === 429) {
      throw new ServiceUnavailableException('Twenty API rate limited');
    }
    if (status && status >= 500) {
      throw new ServiceUnavailableException('Twenty API unavailable');
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}
