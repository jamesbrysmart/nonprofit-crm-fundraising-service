import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [RequestContextService, StructuredLoggerService],
  exports: [RequestContextService, StructuredLoggerService],
})
export class LoggingModule {}
