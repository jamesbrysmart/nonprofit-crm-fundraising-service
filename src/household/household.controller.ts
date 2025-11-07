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
import { HouseholdService } from './household.service';
import {
  HouseholdListResponse,
  HouseholdMemberListResponse,
  HouseholdMemberRecord,
  HouseholdRecord,
} from './household.validation';

@Controller('households')
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get()
  async listHouseholds(
    @Query() query: Record<string, unknown>,
  ): Promise<HouseholdListResponse> {
    return this.householdService.listHouseholds(query ?? {});
  }

  @Get(':id')
  async getHousehold(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<HouseholdRecord> {
    return this.householdService.getHousehold(id, query ?? {});
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createHousehold(@Body() body: unknown): Promise<HouseholdRecord> {
    return this.householdService.createHousehold(body ?? {});
  }

  @Patch(':id')
  async updateHousehold(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HouseholdRecord> {
    return this.householdService.updateHousehold(id, body ?? {});
  }

  @Get(':id/members')
  async listHouseholdMembers(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<HouseholdMemberListResponse> {
    return this.householdService.listMembers(id, query ?? {});
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  async addHouseholdMember(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HouseholdMemberRecord> {
    return this.householdService.addMember(id, body ?? {});
  }

  @Delete(':id/members/:contactId')
  async removeHouseholdMember(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ): Promise<HouseholdMemberRecord> {
    return this.householdService.removeMember(id, contactId);
  }

  @Post(':id/copy-address')
  @HttpCode(HttpStatus.OK)
  async copyAddressToContact(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HouseholdMemberRecord> {
    return this.householdService.copyAddressToContact(id, body ?? {});
  }
}
