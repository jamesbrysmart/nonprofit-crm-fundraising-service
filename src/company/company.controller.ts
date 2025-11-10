import { Controller, Get, Query } from '@nestjs/common';
import { CompanyService } from './company.service';

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('search')
  async searchCompanies(
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.companyService.searchCompanies(query ?? {});
  }
}
