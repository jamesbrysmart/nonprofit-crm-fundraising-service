import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URLSearchParams } from 'url';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import {
  ensureCreateGiftResponse,
  ensureDeleteGiftResponse,
  ensureGiftGetResponse,
  ensureGiftListResponse,
  ensureUpdateGiftResponse,
  validateCreateGiftPayload,
  validateUpdateGiftPayload,
} from './gift.validation';

@Injectable()
export class GiftService {
  private readonly logContext = GiftService.name;
  private readonly twentyApiBaseUrl: string;
  private readonly twentyApiKey: string;
  private readonly maxAttempts = 3;
  private readonly retryStatusCodes = new Set([429, 500, 502, 503, 504]);
  private readonly retryDelaysMs = [250, 500];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    const configuredBaseUrl =
      this.configService.get<string>('TWENTY_API_BASE_URL') ??
      this.configService.get<string>('TWENTY_REST_BASE_URL') ??
      'http://server:3000/rest';

    this.twentyApiBaseUrl = configuredBaseUrl.replace(/\/$/, '');
    this.twentyApiKey = this.configService.get<string>('TWENTY_API_KEY') ?? '';
  }

  async createGift(payload: unknown): Promise<unknown> {
    this.ensureConfigured();
    const sanitizedPayload = validateCreateGiftPayload(payload);
    const response = await this.callTwenty('POST', '/gifts', sanitizedPayload);
    ensureCreateGiftResponse(response);
    return response;
  }

  async listGifts(query: Record<string, unknown>): Promise<unknown> {
    this.ensureConfigured();
    const path = this.buildPath('/gifts', query);
    const response = await this.callTwenty('GET', path);
    ensureGiftListResponse(response);
    return response;
  }

  async getGift(id: string, query: Record<string, unknown>): Promise<unknown> {
    this.ensureConfigured();
    const basePath = `/gifts/${encodeURIComponent(id)}`;
    const path = this.buildPath(basePath, query);
    const response = await this.callTwenty('GET', path);
    ensureGiftGetResponse(response);
    return response;
  }

  async updateGift(id: string, payload: unknown): Promise<unknown> {
    this.ensureConfigured();
    const path = `/gifts/${encodeURIComponent(id)}`;
    const sanitizedPayload = validateUpdateGiftPayload(payload);
    const response = await this.callTwenty('PATCH', path, sanitizedPayload);
    ensureUpdateGiftResponse(response);
    return response;
  }

  async deleteGift(id: string): Promise<unknown> {
    this.ensureConfigured();
    const path = `/gifts/${encodeURIComponent(id)}`;
    const response = await this.callTwenty('DELETE', path);
    ensureDeleteGiftResponse(response);
    return response;
  }

  private ensureConfigured(): void {
    if (!this.twentyApiKey) {
      throw new ServiceUnavailableException('TWENTY_API_KEY not configured');
    }
  }

  private buildPath(
    basePath: string,
    query: Record<string, unknown>,
  ): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry !== undefined && entry !== null) {
            params.append(key, String(entry));
          }
        }
        continue;
      }

      params.append(key, String(value));
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  private async callTwenty(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.twentyApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.twentyApiKey}`,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const attemptDetails = {
        method,
        path,
        url,
        attempt,
        maxAttempts: this.maxAttempts,
      } as const;
      const startedAt = Date.now();

      this.logger.debug(
        'Forwarding request to Twenty',
        {
          ...attemptDetails,
          event: 'twenty_proxy_attempt',
        },
        this.logContext,
      );

      let response: Response;

      try {
        response = await fetch(url, init);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        this.logger.error(
          'Network error contacting Twenty API',
          {
            ...attemptDetails,
            event: 'twenty_proxy_network_error',
            durationMs,
          },
          this.logContext,
          error instanceof Error ? error : undefined,
        );

        if (attempt >= this.maxAttempts) {
          throw new HttpException('Failed to reach Twenty API', 502);
        }

        const delayMs = this.nextDelay(attempt);
        this.logger.warn(
          'Retrying after network failure',
          {
            ...attemptDetails,
            event: 'twenty_proxy_retry',
            delayMs,
            durationMs,
          },
          this.logContext,
        );
        await this.sleep(delayMs);
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
          this.logger.warn(
            'Retrying after error response from Twenty API',
            {
              ...baseMetadata,
              event: 'twenty_proxy_retry',
              delayMs,
              responseBody: bodyPreview,
            },
            this.logContext,
          );
          await this.sleep(delayMs);
          continue;
        }

        this.logger.error(
          'Twenty API responded with an error status',
          {
            ...baseMetadata,
            event: 'twenty_proxy_http_error',
            responseBody: bodyPreview,
          },
          this.logContext,
        );
        throw new HttpException(
          rawBody || 'Twenty API request failed',
          response.status,
        );
      }

      if (!rawBody) {
        if (attempt > 1) {
          this.logger.info(
            'Twenty API request succeeded after retries',
            {
              ...baseMetadata,
              event: 'twenty_proxy_success',
            },
            this.logContext,
          );
        }
        return null;
      }

      try {
        const parsed = JSON.parse(rawBody);

        if (attempt > 1) {
          this.logger.info(
            'Twenty API request succeeded after retries',
            {
              ...baseMetadata,
              event: 'twenty_proxy_success',
            },
            this.logContext,
          );
        }

        return parsed;
      } catch (error) {
        this.logger.error(
          'Failed to parse Twenty API response body',
          {
            ...baseMetadata,
            event: 'twenty_proxy_parse_error',
            responseBody: this.formatBodyForLogs(rawBody),
          },
          this.logContext,
          error instanceof Error ? error : undefined,
        );
        throw new HttpException('Failed to parse Twenty API response', 502);
      }
    }

    this.logger.error(
      'Exhausted retries contacting Twenty API',
      {
        method,
        path,
        url,
        event: 'twenty_proxy_exhausted_retries',
        maxAttempts: this.maxAttempts,
      },
      this.logContext,
    );
    throw new HttpException('Failed to reach Twenty API', 502);
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
    return this.retryDelaysMs[index] ?? this.retryDelaysMs[this.retryDelaysMs.length - 1] ?? 0;
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
