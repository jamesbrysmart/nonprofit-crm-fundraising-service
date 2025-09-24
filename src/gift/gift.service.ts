import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GiftResponseDto } from './dto/gift-response.dto';

type TwentyGift = {
  id?: string | null;
  contactId?: string | null;
  campaignId?: string | null;
  amount?: {
    currencyCode?: string | null;
    value?: unknown;
  } | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CreateGiftResponse = { data?: { createGift?: TwentyGift } };
type ListGiftsResponse = { data?: { gifts?: TwentyGift[] } };

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

  async createGift(dto: CreateGiftDto): Promise<GiftResponseDto> {
    this.ensureConfigured();

    const payload = this.buildCreatePayload(dto);
    const body = await this.callTwenty<CreateGiftResponse>('POST', '/gifts', payload);
    const gift = body?.data?.createGift;

    if (!gift) {
      this.logger.error('Twenty API create response missing gift payload', {
        body,
      });
      throw new InternalServerErrorException('Unexpected response from Twenty API');
    }

    return this.mapFromTwentyGift(gift, dto);
  }

  async listGifts(): Promise<GiftResponseDto[]> {
    this.ensureConfigured();

    const body = await this.callTwenty<ListGiftsResponse>('GET', '/gifts');
    const gifts = Array.isArray(body?.data?.gifts) ? body.data.gifts : [];

    return gifts.reduce<GiftResponseDto[]>((acc, gift) => {
      try {
        acc.push(this.mapFromTwentyGift(gift));
      } catch (error) {
        this.logger.warn(
          `Skipping gift due to mapping error: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }

      return acc;
    }, []);
  }

  private ensureConfigured(): void {
    if (!this.twentyApiKey) {
      throw new ServiceUnavailableException('TWENTY_API_KEY not configured');
    }
  }

  private async callTwenty<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
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

    try {
      response = await fetch(url, init);
    } catch (error) {
      this.logger.error(
        `Failed to reach Twenty API (${method} ${url}): ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new InternalServerErrorException('Failed to reach Twenty API');
    }

    const rawBody = await response.text();

    if (!response.ok) {
      this.logger.error(
        `Twenty API (${method} ${url}) responded with ${response.status}: ${rawBody}`,
      );
      throw new InternalServerErrorException('Twenty API request failed');
    }

    if (!rawBody) {
      return {} as T;
    }

    try {
      return JSON.parse(rawBody) as T;
    } catch (error) {
      this.logger.error(
        `Failed to parse Twenty API response for ${method} ${url}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new InternalServerErrorException('Failed to parse Twenty API response');
    }
  }

  private mapFromTwentyGift(gift: TwentyGift, fallback?: CreateGiftDto): GiftResponseDto {
    if (!gift?.id) {
      throw new InternalServerErrorException('Twenty gift payload missing id');
    }

    const currencyCode =
      gift.amount?.currencyCode ?? fallback?.amountCurrencyCode ?? 'USD';
    const amountValue = this.normalizeAmountValue(
      gift.amount?.value,
      fallback?.amountValue,
    );

    const contactId = gift.contactId ?? fallback?.contactId ?? '';
    const date = gift.date ?? fallback?.date ?? new Date().toISOString().slice(0, 10);

    if (!contactId) {
      this.logger.warn(`Twenty gift ${gift.id} missing contactId; defaulting to empty string`);
    }

    return {
      id: gift.id,
      contactId,
      campaignId: gift.campaignId ?? fallback?.campaignId ?? null,
      amount: {
        currencyCode,
        value: amountValue,
      },
      date,
      createdAt: this.ensureIsoString(gift.createdAt),
      updatedAt: this.ensureIsoString(gift.updatedAt ?? gift.createdAt),
    };
  }

  private buildCreatePayload(dto: CreateGiftDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      amount: {
        currencyCode: dto.amountCurrencyCode,
        value: dto.amountValue,
      },
    };

    if (dto.contactId) {
      payload.contactId = dto.contactId;
    }

    if (dto.campaignId) {
      payload.campaignId = dto.campaignId;
    }

    if (dto.date) {
      payload.date = dto.date;
    }

    return payload;
  }

  private normalizeAmountValue(value: unknown, fallback?: string): string {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (fallback && fallback.trim().length > 0) {
      return fallback;
    }

    return '0';
  }

  private ensureIsoString(value?: string | null): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) {
        return date.toISOString();
      }
    }

    return new Date().toISOString();
  }
}
