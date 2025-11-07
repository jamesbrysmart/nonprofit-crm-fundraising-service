import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../logging/structured-logger.service';

export type TwentyHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

@Injectable()
export class TwentyApiService {
  private readonly twentyApiBaseUrl: string;
  private readonly maxAttempts = 3;
  private readonly retryStatusCodes = new Set([429, 500, 502, 503, 504]);
  private readonly retryDelaysMs = [250, 500];

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {
    const configuredBaseUrl =
      this.configService.get<string>('TWENTY_API_BASE_URL') ??
      this.configService.get<string>('TWENTY_REST_BASE_URL') ??
      'http://server:3000/rest';

    this.twentyApiBaseUrl = configuredBaseUrl.replace(/\/$/, '');
  }

  async request(
    method: TwentyHttpMethod,
    path: string,
    body?: unknown,
    context = TwentyApiService.name,
  ): Promise<unknown> {
    const apiKey = this.configService.get<string>('TWENTY_API_KEY') ?? '';

    if (!apiKey) {
      throw new ServiceUnavailableException('TWENTY_API_KEY not configured');
    }

    const url = `${this.twentyApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const attemptDetails = {
        method,
        path,
        url,
        attempt,
        maxAttempts: this.maxAttempts,
      } as const;
      const startedAt = Date.now();

      this.structuredLogger.debug(
        'Forwarding request to Twenty',
        {
          ...attemptDetails,
          event: 'twenty_proxy_attempt',
        },
        context,
      );

      let response: Response;

      try {
        response = await fetch(url, init);
      } catch (error) {
        lastError = error;
        const durationMs = Date.now() - startedAt;
        this.structuredLogger.error(
          'Network error contacting Twenty API',
          {
            ...attemptDetails,
            event: 'twenty_proxy_network_error',
            durationMs,
          },
          context,
          error instanceof Error ? error : undefined,
        );

        if (attempt >= this.maxAttempts) {
          break;
        }

        const delayMs = this.nextDelay(attempt);
        await this.sleepWithLog(delayMs, attemptDetails, durationMs, context);
        continue;
      }

      const rawBody = await response.text();
      const durationMs = Date.now() - startedAt;
      const baseMetadata = {
        ...attemptDetails,
        status: response.status,
        durationMs,
      };

      if (!response.ok) {
        const bodyPreview = rawBody
          ? this.formatBodyForLogs(rawBody)
          : undefined;

        if (this.shouldRetry(response.status) && attempt < this.maxAttempts) {
          const delayMs = this.computeRetryDelay(response, attempt);
          this.structuredLogger.warn(
            'Retrying after error response from Twenty API',
            {
              ...baseMetadata,
              event: 'twenty_proxy_retry',
              delayMs,
              responseBody: bodyPreview,
            },
            context,
          );
          await this.sleep(delayMs);
          continue;
        }

        this.structuredLogger.error(
          'Twenty API responded with an error status',
          {
            ...baseMetadata,
            event: 'twenty_proxy_http_error',
            responseBody: bodyPreview,
          },
          context,
        );

        const error = new Error(rawBody || 'Twenty API request failed');
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      if (!rawBody) {
        if (attempt > 1) {
          this.structuredLogger.info(
            'Twenty API request succeeded after retries',
            {
              ...baseMetadata,
              event: 'twenty_proxy_success',
            },
            context,
          );
        }
        return null;
      }

      try {
        const parsed = JSON.parse(rawBody);

        if (attempt > 1) {
          this.structuredLogger.info(
            'Twenty API request succeeded after retries',
            {
              ...baseMetadata,
              event: 'twenty_proxy_success',
            },
            context,
          );
        }

        return parsed;
      } catch (error) {
        lastError = error;
        this.structuredLogger.error(
          'Failed to parse Twenty API response body',
          {
            ...baseMetadata,
            event: 'twenty_proxy_parse_error',
            responseBody: this.formatBodyForLogs(rawBody),
          },
          context,
          error instanceof Error ? error : undefined,
        );
        break;
      }
    }

    this.structuredLogger.error(
      'Exhausted retries contacting Twenty API',
      {
        method,
        path,
        url,
        event: 'twenty_proxy_exhausted_retries',
        maxAttempts: this.maxAttempts,
      },
      context,
      lastError instanceof Error ? lastError : undefined,
    );

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to reach Twenty API');
  }

  private shouldRetry(status: number): boolean {
    return this.retryStatusCodes.has(status);
  }

  private computeRetryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const parsed = Number.parseFloat(retryAfter);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return Math.max(parsed, 0) * 1000;
      }
    }

    return this.nextDelay(attempt);
  }

  private nextDelay(attempt: number): number {
    const index = attempt - 1;
    return (
      this.retryDelaysMs[index] ??
      this.retryDelaysMs[this.retryDelaysMs.length - 1] ??
      0
    );
  }

  private async sleepWithLog(
    ms: number,
    attemptDetails: {
      method: string;
      path: string;
      url: string;
      attempt: number;
      maxAttempts: number;
    },
    durationMs: number,
    context: string,
  ): Promise<void> {
    this.structuredLogger.warn(
      'Retrying after network failure',
      {
        ...attemptDetails,
        event: 'twenty_proxy_retry',
        delayMs: ms,
        durationMs,
      },
      context,
    );
    await this.sleep(ms);
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatBodyForLogs(body: string): string {
    const maxLength = 2000;
    if (body.length <= maxLength) {
      return body;
    }

    return `${body.slice(0, maxLength)}... (truncated)`;
  }
}
