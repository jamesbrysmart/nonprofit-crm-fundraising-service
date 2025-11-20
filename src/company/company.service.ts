import { Injectable } from '@nestjs/common';
import { stringifyQueryValue } from '../common/query-string.utils';
import { TwentyApiService } from '../twenty/twenty-api.service';

@Injectable()
export class CompanyService {
  private readonly logContext = CompanyService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async searchCompanies(query: Record<string, unknown>): Promise<unknown> {
    const normalized = this.normalizeSearchQuery(query ?? {});
    const path = this.buildPath('/companies', normalized);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  private normalizeSearchQuery(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      limit: 20,
      orderBy: 'name',
    };

    if (typeof query.search === 'string') {
      const search = query.search.trim();
      if (search.length > 0) {
        result.search = search;
      }
    }

    if (typeof query.limit === 'string' || typeof query.limit === 'number') {
      const parsed = Number(query.limit);
      if (Number.isFinite(parsed) && parsed > 0) {
        result.limit = Math.min(parsed, 100);
      }
    }

    return result;
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
            params.append(key, stringifyQueryValue(entry));
          }
        }
        continue;
      }

      params.append(key, stringifyQueryValue(value));
    }

    const serialized = params.toString();
    return serialized ? `${basePath}?${serialized}` : basePath;
  }
}
