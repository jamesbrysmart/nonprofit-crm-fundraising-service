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

      const existingPersonId = await this.findExistingPersonId(contactInput);

      if (existingPersonId) {
        this.loggerInstance.log(
          `Reusing existing person ${existingPersonId} for gift contact`,
          this.logContext,
        );
        prepared.donorId = existingPersonId;
      } else {
        const personId = await this.createPerson(contactInput);
        prepared.donorId = personId;
      }
    }

    if (
      typeof prepared.contactId === 'string' &&
      prepared.contactId.trim().length > 0 &&
      typeof prepared.donorId !== 'string'
    ) {
      prepared.donorId = prepared.contactId.trim();
      delete prepared.contactId;
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

  private async findExistingPersonId(
    contact: Record<string, unknown>,
  ): Promise<string | undefined> {
    const firstName =
      typeof contact.firstName === 'string' ? contact.firstName.trim() : undefined;
    const lastName =
      typeof contact.lastName === 'string' ? contact.lastName.trim() : undefined;
    const email =
      typeof contact.email === 'string' && contact.email.trim().length > 0
        ? contact.email.trim()
        : undefined;

    if (!firstName || !lastName || !email) {
      return undefined;
    }

    const requestBody: Record<string, unknown> = {
      data: [
        {
          name: {
            firstName,
            lastName,
          },
          emails: {
            primaryEmail: email,
          },
        },
      ],
    };

    this.loggerInstance.log(
      `Checking for existing person via /people/duplicates (email=${email})`,
      this.logContext,
    );

    try {
      const response = await this.twentyApiService.request(
        'POST',
        '/people/duplicates?depth=0',
        requestBody,
        this.logContext,
      );

      this.loggerInstance.log(
        `Duplicate lookup response: ${this.previewResponse(response)}`,
        this.logContext,
      );

      const duplicateId = this.extractDuplicatePersonId(response, email);
      if (duplicateId) {
        return duplicateId;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown error resolving existing person';
      this.loggerInstance.warn(
        `Failed to query duplicates for contact email=${email}: ${message}`,
        this.logContext,
      );
    }

    return undefined;
  }

  private extractDuplicatePersonId(
    response: unknown,
    email?: string,
  ): string | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const data = (response as Record<string, unknown>).data;
    if (!Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    const normalizedEmail = email?.trim().toLowerCase();

    for (const entry of data) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const duplicates = (entry as Record<string, unknown>).personDuplicates;
      if (!Array.isArray(duplicates) || duplicates.length === 0) {
        continue;
      }

      let fallbackId: string | undefined;

      for (const duplicate of duplicates) {
        if (!duplicate || typeof duplicate !== 'object') {
          continue;
        }

        const duplicateId = (duplicate as Record<string, unknown>).id;
        if (typeof duplicateId !== 'string' || duplicateId.length === 0) {
          continue;
        }

        if (normalizedEmail) {
          const emails = (duplicate as Record<string, unknown>).emails;
          if (emails && typeof emails === 'object') {
            const primaryEmail = (emails as Record<string, unknown>).primaryEmail;
            if (
              typeof primaryEmail === 'string' &&
              primaryEmail.trim().toLowerCase() === normalizedEmail
            ) {
              return duplicateId;
            }
          }
        }

        if (!fallbackId) {
          fallbackId = duplicateId;
        }
      }

      if (fallbackId) {
        return fallbackId;
      }
    }

    return undefined;
  }

  private previewResponse(response: unknown): string {
    try {
      const serialized = JSON.stringify(response);
      if (!serialized) {
        return '[empty response]';
      }
      return serialized.length > 500 ? `${serialized.slice(0, 500)}…` : serialized;
    } catch (error) {
      return `[unserializable response: ${error instanceof Error ? error.message : error}]`;
    }
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
