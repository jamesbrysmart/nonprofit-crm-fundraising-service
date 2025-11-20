import { BadRequestException, Injectable } from '@nestjs/common';
import { URLSearchParams } from 'url';
import { stringifyQueryValue } from '../common/query-string.utils';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { RecurringAgreementPayload } from './recurring-agreement.types';

@Injectable()
export class RecurringAgreementService {
  private readonly logContext = RecurringAgreementService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async createAgreement(payload: unknown): Promise<unknown> {
    const sanitized = this.ensurePayload(
      payload,
      'Recurring agreement create payload must be an object.',
    );
    return this.twentyApiService.request(
      'POST',
      '/recurringAgreements',
      sanitized,
      this.logContext,
    );
  }

  async listAgreements(query: Record<string, unknown>): Promise<unknown> {
    const path = this.buildPath('/recurringAgreements', query);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  async getAgreement(
    id: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const basePath = `/recurringAgreements/${encodeURIComponent(id)}`;
    const path = this.buildPath(basePath, query);
    return this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
  }

  async updateAgreement(id: string, payload: unknown): Promise<unknown> {
    const sanitized = this.ensurePayload(
      payload,
      'Recurring agreement update payload must be an object.',
    );
    const path = `/recurringAgreements/${encodeURIComponent(id)}`;
    return this.twentyApiService.request(
      'PATCH',
      path,
      sanitized,
      this.logContext,
    );
  }

  async deleteAgreement(id: string): Promise<unknown> {
    const path = `/recurringAgreements/${encodeURIComponent(id)}`;
    return this.twentyApiService.request(
      'DELETE',
      path,
      undefined,
      this.logContext,
    );
  }

  private ensurePayload(
    payload: unknown,
    errorMessage: string,
  ): RecurringAgreementPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException(errorMessage);
    }

    return payload as RecurringAgreementPayload;
  }

  private buildPath(basePath: string, query: Record<string, unknown>): string {
    if (!query || Object.keys(query).length === 0) {
      return basePath;
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((item) =>
          searchParams.append(key, stringifyQueryValue(item)),
        );
      } else {
        searchParams.append(key, stringifyQueryValue(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString.length > 0 ? `${basePath}?${queryString}` : basePath;
  }
}
