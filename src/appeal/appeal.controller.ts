import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AppealService } from './appeal.service';

@Controller('appeals')
export class AppealController {
  constructor(private readonly appealService: AppealService) {}

  @Get()
  async listAppeals(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.appealService.listAppeals(query ?? {});
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async createAppeal(@Body() body: unknown): Promise<unknown> {
    return this.appealService.createAppeal(body ?? {});
  }

  @Get(':id')
  async getAppeal(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.appealService.getAppeal(id, query ?? {});
  }

  @Patch(':id')
  async updateAppeal(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.appealService.updateAppeal(id, body ?? {});
  }

  @Get(':id/solicitation-snapshots')
  async listSolicitationSnapshots(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.appealService.listSolicitationSnapshots(id, query ?? {});
  }

  @Post(':id/solicitation-snapshots')
  @HttpCode(HttpStatus.OK)
  async createSolicitationSnapshot(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.appealService.createSolicitationSnapshot(id, body ?? {});
  }
}
