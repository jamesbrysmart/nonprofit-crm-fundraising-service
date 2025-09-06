import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { Gift } from './gift/gift.entity';
import { Campaign } from './campaign/campaign.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService) => ({
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
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
