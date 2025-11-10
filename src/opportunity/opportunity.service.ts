import { BadRequestException, Injectable } from '@nestjs/common';
import { TwentyApiService } from '../twenty/twenty-api.service';

type SearchQuery = Record<string, unknown>;

@Injectable()
export class OpportunityService {
  private readonly logContext = OpportunityService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async searchOpportunities(query: SearchQuery): Promise<unknown> {
    const normalizedQuery = this.normalizeSearchQuery(query ?? {});
    const path = this.buildPath('/opportunities', normalizedQuery);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  async updateOpportunity(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const normalizedId = this.normalizeId(id, 'opportunityId');
    const sanitized = this.sanitizeUpdatePayload(payload ?? {});
    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException(
        'No supported fields provided for opportunity update',
      );
    }

    return this.twentyApiService.request(
      'PATCH',
      `/opportunities/${encodeURIComponent(normalizedId)}`,
      sanitized,
      this.logContext,
    );
  }

  private sanitizeUpdatePayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (typeof payload.stage === 'string') {
      const stage = payload.stage.trim().toUpperCase();
      if (stage.length > 0) {
        result.stage = stage;
      }
    }

    if (typeof payload.closeDate === 'string') {
      const closeDate = payload.closeDate.trim();
      if (closeDate.length > 0) {
        result.closeDate = closeDate;
      }
    }

    return result;
  }

  private normalizeSearchQuery(query: SearchQuery): Record<string, unknown> {
    const result: Record<string, unknown> = {
      limit: 20,
      orderBy: '-updatedAt',
    };

    const addStringParam = (key: string, value?: unknown) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          result[key] = trimmed;
        }
      }
    };

    addStringParam('search', query.search);
    addStringParam('companyId', query.companyId);
    addStringParam('pointOfContactId', query.pointOfContactId);

    const stageValues = this.normalizeArray(query.stage ?? query.stages);
    if (stageValues.length > 0) {
      result.stage = stageValues;
    }

    const typeValues = this.normalizeArray(
      query.opportunityType ?? query.opportunityTypes,
    );
    if (typeValues.length > 0) {
      result.opportunityType = typeValues;
    }

    if (typeof query.limit === 'string' || typeof query.limit === 'number') {
      const parsed = Number(query.limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.limit = Math.min(parsed, 100);
      }
    }

    if (typeof query.orderBy === 'string' && query.orderBy.trim().length > 0) {
      result.orderBy = query.orderBy.trim();
    }

    return result;
  }

  private normalizeArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) =>
          typeof entry === 'string' ? entry.trim() : String(entry ?? ''),
        )
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === 'string') {
      const trimmed = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      return trimmed;
    }

    return [];
  }

  private normalizeId(id: string, fieldName: string): string {
    if (typeof id !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }
    const trimmed = id.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }
    return trimmed;
  }

  private buildPath(basePath: string, query: Record<string, unknown>): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
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

    const serialized = params.toString();
    return serialized ? `${basePath}?${serialized}` : basePath;
  }
}
