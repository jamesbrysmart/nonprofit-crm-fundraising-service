import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { URLSearchParams } from 'url';
import { TwentyApiService } from '../twenty/twenty-api.service';
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

  private readonly loggerInstance = new Logger(GiftService.name);

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async createGift(payload: unknown): Promise<unknown> {
    const sanitizedPayload = validateCreateGiftPayload(payload);
    const preparedPayload = await this.prepareGiftPayload(sanitizedPayload);
    const response = await this.twentyApiService.request(
      'POST',
      '/gifts',
      preparedPayload,
      this.logContext,
    );
    ensureCreateGiftResponse(response);
    return response;
  }

  async listGifts(query: Record<string, unknown>): Promise<unknown> {
    const path = this.buildPath('/gifts', query);
    const response = await this.twentyApiService.request('GET', path, undefined, this.logContext);
    ensureGiftListResponse(response);
    return response;
  }

  async getGift(id: string, query: Record<string, unknown>): Promise<unknown> {
    const basePath = `/gifts/${encodeURIComponent(id)}`;
    const path = this.buildPath(basePath, query);
    const response = await this.twentyApiService.request('GET', path, undefined, this.logContext);
    ensureGiftGetResponse(response);
    return response;
  }

  async updateGift(id: string, payload: unknown): Promise<unknown> {
    const path = `/gifts/${encodeURIComponent(id)}`;
    const sanitizedPayload = validateUpdateGiftPayload(payload);
    const response = await this.twentyApiService.request(
      'PATCH',
      path,
      sanitizedPayload,
      this.logContext,
    );
    ensureUpdateGiftResponse(response);
    return response;
  }

  async deleteGift(id: string): Promise<unknown> {
    const path = `/gifts/${encodeURIComponent(id)}`;
    const response = await this.twentyApiService.request(
      'DELETE',
      path,
      undefined,
      this.logContext,
    );
    ensureDeleteGiftResponse(response);
    return response;
  }

  private async prepareGiftPayload(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...payload };

    if (prepared.contact && typeof prepared.contact === 'object') {
      const contactInput = prepared.contact as Record<string, unknown>;
      delete prepared.contact;

      const personId = await this.createPerson(contactInput);
      prepared.donorId = personId;
    }

    return prepared;
  }

  private async createPerson(contact: Record<string, unknown>): Promise<string> {
    const firstName =
      typeof contact.firstName === 'string' ? contact.firstName.trim() : undefined;
    const lastName =
      typeof contact.lastName === 'string' ? contact.lastName.trim() : undefined;
    const email =
      typeof contact.email === 'string' && contact.email.trim().length > 0
        ? contact.email.trim()
        : undefined;

    if (!firstName || !lastName) {
      throw new BadRequestException('contact.firstName and contact.lastName must be provided');
    }

    const personPayload: Record<string, unknown> = {
      name: {
        firstName,
        lastName,
      },
    };

    if (email) {
      personPayload.emails = {
        primaryEmail: email,
      };
    }

    const response = await this.twentyApiService.request(
      'POST',
      '/people',
      personPayload,
      this.logContext,
    );
    const personId = this.extractPersonId(response);
    if (typeof personId !== 'string' || personId.length === 0) {
      this.loggerInstance.error('Failed to create contact in Twenty', {
        event: 'twenty_create_person_missing_id',
        response,
      });
      throw new HttpException('Failed to create contact in Twenty', 502);
    }

    return personId;
  }

  private extractPersonId(response: unknown): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const data = (response as Record<string, unknown>).data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const createPerson = (data as Record<string, unknown>).createPerson;
    if (!createPerson || typeof createPerson !== 'object') {
      return undefined;
    }

    const directId = (createPerson as Record<string, unknown>).id;
    if (typeof directId === 'string' && directId.length > 0) {
      return directId;
    }

    const nestedPerson = (createPerson as Record<string, unknown>).person;
    if (nestedPerson && typeof nestedPerson === 'object') {
      const nestedId = (nestedPerson as Record<string, unknown>).id;
      if (typeof nestedId === 'string' && nestedId.length > 0) {
        return nestedId;
      }
    }

    return undefined;
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

}
