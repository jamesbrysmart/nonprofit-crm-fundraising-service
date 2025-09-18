import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GiftService } from './gift.service';
import { GiftResponseDto } from './dto/gift-response.dto';

@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGift(@Body() body: CreateGiftDto): Promise<{ data: { gift: GiftResponseDto } }> {
    this.validateCreateGift(body);
    const gift = await this.giftService.createGift(body);
    return { data: { gift } };
  }

  @Get()
  async listGifts(): Promise<{ data: { gifts: GiftResponseDto[] } }> {
    const gifts = await this.giftService.listGifts();
    return { data: { gifts } };
}

  private validateCreateGift(body: CreateGiftDto): void {
    const missing: string[] = [];

    if (!body.contactId) {
      missing.push('contactId');
    }
    if (!body.amountCurrencyCode) {
      missing.push('amountCurrencyCode');
    }
    if (!body.amountValue) {
      missing.push('amountValue');
    }
    if (!body.date) {
      missing.push('date');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missing.join(', ')}`,
      );
    }
  }
}
