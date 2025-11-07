import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PeopleService } from './people.service';
import { HouseholdMemberRecord } from '../household/household.validation';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post('duplicates')
  async findDuplicates(@Body() body: unknown): Promise<unknown> {
    return this.peopleService.findDuplicates(body ?? {});
  }

  @Get(':id')
  async getPerson(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<HouseholdMemberRecord> {
    return this.peopleService.getPerson(id, query ?? {});
  }
}
