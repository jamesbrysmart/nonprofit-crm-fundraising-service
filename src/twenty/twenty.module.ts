import { Global, Module } from '@nestjs/common';
import { TwentyApiService } from './twenty-api.service';

@Global()
@Module({
  providers: [TwentyApiService],
  exports: [TwentyApiService],
})
export class TwentyModule {}
