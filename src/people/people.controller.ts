import { Body, Controller, Post } from '@nestjs/common';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post('duplicates')
  async findDuplicates(@Body() body: unknown): Promise<unknown> {
    return this.peopleService.findDuplicates(body ?? {});
  }
}
