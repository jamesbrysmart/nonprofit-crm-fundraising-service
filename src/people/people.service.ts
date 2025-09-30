import { Injectable } from '@nestjs/common';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  ensurePeopleDuplicatesResponse,
  validatePeopleDuplicateLookupPayload,
} from './people.validation';

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
}
