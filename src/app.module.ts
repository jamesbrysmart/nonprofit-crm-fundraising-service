import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GiftModule } from './gift/gift.module';
import { HealthController } from './health/health.controller';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    GiftModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
