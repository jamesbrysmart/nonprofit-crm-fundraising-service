import { BadRequestException, Injectable } from '@nestjs/common';
import { TwentyApiService } from '../twenty/twenty-api.service';

interface GiftIdPayload {
  giftIds?: string[];
}

@Injectable()
export class GiftPayoutService {
  private readonly logContext = GiftPayoutService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async createGiftPayout(payload: unknown): Promise<unknown> {
    return this.twentyApiService.request(
      'POST',
      '/giftPayouts',
      payload,
      this.logContext,
    );
  }

  async listGiftPayouts(query: Record<string, unknown>): Promise<unknown> {
    const path = this.buildPath('/giftPayouts', query);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  async getGiftPayout(
    payoutId: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const trimmedId = this.ensureId(payoutId);
    const basePath = `/giftPayouts/${encodeURIComponent(trimmedId)}`;
    const path = this.buildPath(basePath, query);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  async updateGiftPayout(payoutId: string, payload: unknown): Promise<unknown> {
    const trimmedId = this.ensureId(payoutId);
    return this.twentyApiService.request(
      'PATCH',
      `/giftPayouts/${encodeURIComponent(trimmedId)}`,
      payload,
      this.logContext,
    );
  }

  async linkGifts(
    payoutId: string,
    payload: GiftIdPayload,
  ): Promise<{ linkedGiftIds: string[] }> {
    const trimmedId = this.ensureId(payoutId);
    const giftIds = this.normalizeGiftIds(payload?.giftIds);
    if (giftIds.length === 0) {
      throw new BadRequestException('giftIds must include at least one id');
    }

    await this.applyGiftPayout(trimmedId, giftIds, true);
    return { linkedGiftIds: giftIds };
  }

  async unlinkGifts(
    payoutId: string,
    payload: GiftIdPayload,
  ): Promise<{ unlinkedGiftIds: string[] }> {
    const trimmedId = this.ensureId(payoutId);
    const giftIds = this.normalizeGiftIds(payload?.giftIds);
    if (giftIds.length === 0) {
      throw new BadRequestException('giftIds must include at least one id');
    }

    await this.applyGiftPayout(trimmedId, giftIds, false);
    return { unlinkedGiftIds: giftIds };
  }

  private async applyGiftPayout(
    payoutId: string,
    giftIds: string[],
    link: boolean,
  ): Promise<void> {
    for (const giftId of giftIds) {
      await this.twentyApiService.request(
        'PATCH',
        `/gifts/${encodeURIComponent(giftId)}`,
        {
          giftPayoutId: link ? payoutId : null,
        },
        this.logContext,
      );
    }
  }

  private buildPath(basePath: string, query: Record<string, unknown>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry !== undefined && entry !== null) {
            params.append(key, this.stringifyQueryValue(entry));
          }
        });
        continue;
      }

      params.append(key, this.stringifyQueryValue(value));
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  private normalizeGiftIds(ids: string[] | undefined): string[] {
    if (!Array.isArray(ids)) {
      return [];
    }

    const sanitized = ids
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    return Array.from(new Set(sanitized));
  }

  private ensureId(id: string): string {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new BadRequestException('payoutId is required');
    }
    return id.trim();
  }

  private stringifyQueryValue(value: unknown): string {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    if (value === undefined || value === null) {
      return '';
    }

    return JSON.stringify(value);
  }
}
