import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { Gift } from './gift/gift.entity';
import { Campaign } from './campaign/campaign.entity';
import { GiftModule } from './gift/gift.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        entities: [Gift, Campaign],
      }),
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('DataSource options are undefined.');
        }
        return new DataSource(options as any).initialize();
      },
    }),
    GiftModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
