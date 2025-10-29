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
import { RecurringAgreementService } from './recurring-agreement.service';

@Controller('recurring-agreements')
export class RecurringAgreementController {
  constructor(private readonly recurringAgreementService: RecurringAgreementService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createAgreement(@Body() body: unknown): Promise<unknown> {
    return this.recurringAgreementService.createAgreement(body ?? {});
  }

  @Get()
  async listAgreements(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.recurringAgreementService.listAgreements(query ?? {});
  }

  @Get(':id')
  async getAgreement(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.recurringAgreementService.getAgreement(id, query ?? {});
  }

  @Patch(':id')
  async updateAgreement(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.recurringAgreementService.updateAgreement(id, body ?? {});
  }

  @Delete(':id')
  async deleteAgreement(@Param('id') id: string): Promise<unknown> {
    return this.recurringAgreementService.deleteAgreement(id);
  }
}
