import { Injectable } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMetadata = Record<string, unknown> | undefined;

@Injectable()
export class StructuredLoggerService {
  constructor(private readonly requestContextService: RequestContextService) {}

  debug(message: string, metadata?: LogMetadata, context?: string): void {
    this.write('debug', message, metadata, context);
  }

  info(message: string, metadata?: LogMetadata, context?: string): void {
    this.write('info', message, metadata, context);
  }

  warn(message: string, metadata?: LogMetadata, context?: string): void {
    this.write('warn', message, metadata, context);
  }

  error(
    message: string,
    metadata?: LogMetadata,
    context?: string,
    error?: Error,
  ): void {
    this.write('error', message, metadata, context, error);
  }

  private write(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    context?: string,
    error?: Error,
  ): void {
    const baseEntry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    const requestId = this.requestContextService.getRequestId();
    if (requestId) {
      baseEntry.requestId = requestId;
    }

    if (context) {
      baseEntry.context = context;
    }

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined) {
          baseEntry[key] = value;
        }
      }
    }

    if (error) {
      baseEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const serialized = JSON.stringify(baseEntry);

    switch (level) {
      case 'error':
        console.error(serialized);
        break;
      case 'warn':
        console.warn(serialized);
        break;
      case 'debug':
        console.debug(serialized);
        break;
      default:
        console.log(serialized);
        break;
    }
  }
}
