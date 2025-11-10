import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { OpportunityService } from './opportunity.service';

@Controller('opportunities')
export class OpportunityController {
  constructor(private readonly opportunityService: OpportunityService) {}

  @Get('search')
  async searchOpportunities(
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.opportunityService.searchOpportunities(query ?? {});
  }

  @Patch(':id')
  async updateOpportunity(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.opportunityService.updateOpportunity(id, body ?? {});
  }
}
