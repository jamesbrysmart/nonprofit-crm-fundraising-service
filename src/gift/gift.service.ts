import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gift } from './gift.entity';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GiftResponseDto } from './dto/gift-response.dto';

@Injectable()
export class GiftService {
  private readonly logger = new Logger(GiftService.name);
  private readonly twentyApiBaseUrl: string;
  private readonly twentyApiKey: string;

  constructor(
    @InjectRepository(Gift)
    private readonly giftRepository: Repository<Gift>,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl =
      this.configService.get<string>('TWENTY_API_BASE_URL') ??
      this.configService.get<string>('TWENTY_REST_BASE_URL') ??
      'http://server:3000/rest';

    this.twentyApiBaseUrl = configuredBaseUrl.replace(/\/$/, '');
    this.twentyApiKey = this.configService.get<string>('TWENTY_API_KEY') ?? '';
  }

  async createGift(dto: CreateGiftDto): Promise<GiftResponseDto> {
    const gift = this.giftRepository.create({
      contactId: dto.contactId,
      campaignId: dto.campaignId ?? null,
      amountCurrencyCode: dto.amountCurrencyCode,
      amountValue: dto.amountValue,
      date: dto.date,
    });

    const saved = await this.giftRepository.save(gift);

    await this.mirrorToTwenty(dto).catch((error) => {
      this.logger.warn(
        `Failed to mirror gift to Twenty: ${error instanceof Error ? error.message : error}`,
      );
    });

    return this.mapToResponse(saved);
  }

  async listGifts(): Promise<GiftResponseDto[]> {
    const gifts = await this.giftRepository.find({
      order: { createdAt: 'DESC' },
    });

    return gifts.map((gift) => this.mapToResponse(gift));
  }

  private mapToResponse(gift: Gift): GiftResponseDto {
    return {
      id: gift.id,
      contactId: gift.contactId,
      campaignId: gift.campaignId,
      amount: {
        currencyCode: gift.amountCurrencyCode,
        value: gift.amountValue,
      },
      date: gift.date,
      createdAt: gift.createdAt.toISOString(),
      updatedAt: gift.updatedAt.toISOString(),
    };
  }

  private async mirrorToTwenty(dto: CreateGiftDto): Promise<void> {
    if (!this.twentyApiKey) {
      this.logger.debug('TWENTY_API_KEY not set; skipping mirror to Twenty.');
      return;
    }

    const payload: Record<string, unknown> = {
      amount: {
        currencyCode: dto.amountCurrencyCode,
        value: dto.amountValue,
      },
    };

    if (dto.contactId) {
      payload.contactId = dto.contactId;
    }

    if (dto.campaignId) {
      payload.campaignId = dto.campaignId;
    }

    if (dto.date) {
      payload.date = dto.date;
    }

    const response = await fetch(`${this.twentyApiBaseUrl}/gifts`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.twentyApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Status ${response.status}: ${body}`);
    }
  }
}
