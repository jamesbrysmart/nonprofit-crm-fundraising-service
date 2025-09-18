import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gift } from './gift.entity';
import { GiftService } from './gift.service';
import { GiftController } from './gift.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Gift])],
  controllers: [GiftController],
  providers: [GiftService],
  exports: [GiftService],
})
export class GiftModule {}
