import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gift } from './gift.entity';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GiftResponseDto } from './dto/gift-response.dto';

@Injectable()
export class GiftService {
  constructor(
    @InjectRepository(Gift)
    private readonly giftRepository: Repository<Gift>,
  ) {}

  async createGift(dto: CreateGiftDto): Promise<GiftResponseDto> {
    const gift = this.giftRepository.create({
      contactId: dto.contactId,
      campaignId: dto.campaignId ?? null,
      amountCurrencyCode: dto.amountCurrencyCode,
      amountValue: dto.amountValue,
      date: dto.date,
    });

    const saved = await this.giftRepository.save(gift);

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
}
