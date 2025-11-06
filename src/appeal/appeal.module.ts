import { Module } from '@nestjs/common';
import { AppealController } from './appeal.controller';
import { AppealService } from './appeal.service';
import { TwentyModule } from '../twenty/twenty.module';

@Module({
  imports: [TwentyModule],
  controllers: [AppealController],
  providers: [AppealService],
  exports: [AppealService],
})
export class AppealModule {}
