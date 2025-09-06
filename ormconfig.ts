import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Gift } from './src/gift/gift.entity';
import { Campaign } from './src/campaign/campaign.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Gift, Campaign],
  migrations: [__dirname + '/migrations/**/*.ts'],
  synchronize: false,
  logging: true,
});

export default AppDataSource;
