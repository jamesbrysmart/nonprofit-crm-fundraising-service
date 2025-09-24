import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URLSearchParams } from 'url';

@Injectable()
export class GiftService {
  private readonly logger = new Logger(GiftService.name);
  private readonly twentyApiBaseUrl: string;
  private readonly twentyApiKey: string;

  constructor(private readonly configService: ConfigService) {
    const configuredBaseUrl =
      this.configService.get<string>('TWENTY_API_BASE_URL') ??
      this.configService.get<string>('TWENTY_REST_BASE_URL') ??
      'http://server:3000/rest';

    this.twentyApiBaseUrl = configuredBaseUrl.replace(/\/$/, '');
    this.twentyApiKey = this.configService.get<string>('TWENTY_API_KEY') ?? '';
  }

  async createGift(payload: unknown): Promise<unknown> {
    this.ensureConfigured();
    return this.callTwenty('POST', '/gifts', payload);
  }

  async listGifts(query: Record<string, unknown>): Promise<unknown> {
    this.ensureConfigured();
    const path = this.buildPath('/gifts', query);
    return this.callTwenty('GET', path);
  }

  async getGift(id: string, query: Record<string, unknown>): Promise<unknown> {
    this.ensureConfigured();
    const basePath = `/gifts/${encodeURIComponent(id)}`;
    const path = this.buildPath(basePath, query);
    return this.callTwenty('GET', path);
  }

  async updateGift(id: string, payload: unknown): Promise<unknown> {
    this.ensureConfigured();
    const path = `/gifts/${encodeURIComponent(id)}`;
    return this.callTwenty('PATCH', path, payload);
  }

  async deleteGift(id: string): Promise<unknown> {
    this.ensureConfigured();
    const path = `/gifts/${encodeURIComponent(id)}`;
    return this.callTwenty('DELETE', path);
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

    let response: Response;

    this.logger.log(`Forwarding ${method} ${path} to Twenty`);

    try {
      response = await fetch(url, init);
    } catch (error) {
      this.logger.error(
        `Failed to reach Twenty API (${method} ${url}): ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new HttpException('Failed to reach Twenty API', 502);
    }

    const rawBody = await response.text();

    if (!response.ok) {
      this.logger.error(
        `Twenty API (${method} ${url}) responded with ${response.status}: ${rawBody}`,
      );
      throw new HttpException(
        rawBody || 'Twenty API request failed',
        response.status,
      );
    }

    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody);
    } catch (error) {
      this.logger.warn(
        `Returning raw response for ${method} ${url} due to JSON parse failure: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return rawBody;
    }
  }
}
