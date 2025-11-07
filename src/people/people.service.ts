import { BadRequestException, Injectable } from '@nestjs/common';
import { URLSearchParams } from 'url';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  ensurePeopleDuplicatesResponse,
  validatePeopleDuplicateLookupPayload,
} from './people.validation';
import {
  HouseholdMemberRecord,
  ensureHouseholdMemberResponse,
} from '../household/household.validation';

@Injectable()
export class PeopleService {
  private readonly logContext = PeopleService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async findDuplicates(payload: unknown): Promise<unknown> {
    const { candidate, depth } = validatePeopleDuplicateLookupPayload(payload);

    const requestRecord: Record<string, unknown> = {
      name: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
      },
    };

    if (candidate.email) {
      requestRecord.emails = {
        primaryEmail: candidate.email,
      };
    }

    const requestBody = {
      data: [requestRecord],
    };

    const depthParam = depth ?? 1;
    const path = `/people/duplicates?depth=${depthParam}`;

    const response = await this.twentyApiService.request(
      'POST',
      path,
      requestBody,
      this.logContext,
    );

    ensurePeopleDuplicatesResponse(response);

    return response;
  }

  async getPerson(
    id: string,
    query: Record<string, unknown>,
  ): Promise<HouseholdMemberRecord> {
    const normalizedId = this.normalizeId(id, 'id');
    const basePath = `/people/${encodeURIComponent(normalizedId)}`;
    const path = this.buildPath(basePath, query ?? {});
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    return ensureHouseholdMemberResponse(response);
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
    if (!query || Object.keys(query).length === 0) {
      return basePath;
    }

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
    return serialized.length > 0 ? `${basePath}?${serialized}` : basePath;
  }
}
