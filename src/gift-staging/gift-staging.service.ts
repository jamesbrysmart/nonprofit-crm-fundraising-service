import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { GiftStagingRecord, NormalizedGiftCreatePayload } from '../gift/gift.types';

@Injectable()
export class GiftStagingService {
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {
    this.enabled =
      (this.configService.get<string>('FUNDRAISING_ENABLE_GIFT_STAGING') ?? 'false').toLowerCase() ===
      'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async stageGift(payload: NormalizedGiftCreatePayload): Promise<GiftStagingRecord | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const stagingId = randomUUID();
    const batchId = typeof payload.giftBatchId === 'string' ? payload.giftBatchId : undefined;

    const record: GiftStagingRecord = {
      id: stagingId,
      autoPromote: true,
      payload,
    };

    this.structuredLogger.info(
      'Staging gift payload (temporary scaffold)',
      {
        event: 'gift_staging_stage',
        stagingId,
        batchId,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        externalId: payload.externalId,
        paymentMethod: payload.paymentMethod,
      },
      GiftStagingService.name,
    );

    return record;
  }

  async markCommitted(record: GiftStagingRecord | undefined, giftId: string): Promise<void> {
    if (!record) {
      return;
    }

    this.structuredLogger.info(
      'Gift staging record committed (temporary scaffold)',
      {
        event: 'gift_staging_committed',
        stagingId: record.id,
        giftId,
      },
      GiftStagingService.name,
    );
  }
}
