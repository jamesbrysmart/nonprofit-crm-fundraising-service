import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GiftService } from './gift.service';

@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createGift(@Body() body: unknown): Promise<unknown> {
    return this.giftService.createGift(body ?? {});
  }

  @Get()
  async listGifts(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.giftService.listGifts(query ?? {});
  }

  @Get(':id')
  async getGift(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.giftService.getGift(id, query ?? {});
  }

  @Patch(':id')
  async updateGift(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.giftService.updateGift(id, body ?? {});
  }

  @Delete(':id')
  async deleteGift(@Param('id') id: string): Promise<unknown> {
    return this.giftService.deleteGift(id);
  }
}
