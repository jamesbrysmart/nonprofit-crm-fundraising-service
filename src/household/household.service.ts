import { BadRequestException, Injectable } from '@nestjs/common';
import { URLSearchParams } from 'url';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  AssignHouseholdMemberPayload,
  CopyHouseholdAddressPayload,
  HouseholdListResponse,
  HouseholdMemberListResponse,
  HouseholdMemberRecord,
  HouseholdRecord,
  ensureHouseholdListResponse,
  ensureHouseholdMemberListResponse,
  ensureHouseholdMemberResponse,
  ensureHouseholdResponse,
  validateAssignHouseholdMemberPayload,
  validateCopyAddressPayload,
  validateCreateHouseholdPayload,
  validateUpdateHouseholdPayload,
} from './household.validation';

@Injectable()
export class HouseholdService {
  private readonly logContext = HouseholdService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async listHouseholds(
    query: Record<string, unknown>,
  ): Promise<HouseholdListResponse> {
    const path = this.buildPath('/households', query ?? {});
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    return ensureHouseholdListResponse(response);
  }

  async getHousehold(
    id: string,
    query: Record<string, unknown>,
  ): Promise<HouseholdRecord> {
    const normalizedId = this.normalizeId(id, 'id');
    const basePath = `/households/${encodeURIComponent(normalizedId)}`;
    const path = this.buildPath(basePath, query ?? {});
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    return ensureHouseholdResponse(response);
  }

  async createHousehold(payload: unknown): Promise<HouseholdRecord> {
    const sanitizedPayload = validateCreateHouseholdPayload(payload);
    const response = await this.twentyApiService.request(
      'POST',
      '/households',
      sanitizedPayload,
      this.logContext,
    );
    return ensureHouseholdResponse(response);
  }

  async updateHousehold(
    id: string,
    payload: unknown,
  ): Promise<HouseholdRecord> {
    const normalizedId = this.normalizeId(id, 'id');
    const sanitizedPayload = validateUpdateHouseholdPayload(payload);
    const response = await this.twentyApiService.request(
      'PATCH',
      `/households/${encodeURIComponent(normalizedId)}`,
      sanitizedPayload,
      this.logContext,
    );
    return ensureHouseholdResponse(response);
  }

  async listMembers(
    householdId: string,
    query: Record<string, unknown>,
  ): Promise<HouseholdMemberListResponse> {
    const normalizedId = this.normalizeId(householdId, 'householdId');
    const path = this.buildPath('/people', {
      ...query,
      householdId: normalizedId,
    });
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    const result = ensureHouseholdMemberListResponse(response);
    const filteredMembers = result.members.filter(
      (member) => member.householdId === normalizedId,
    );

    return {
      ...result,
      members: filteredMembers,
    };
  }

  async addMember(
    householdId: string,
    payload: unknown,
  ): Promise<HouseholdMemberRecord> {
    const normalizedId = this.normalizeId(householdId, 'householdId');
    const sanitized: AssignHouseholdMemberPayload =
      validateAssignHouseholdMemberPayload(payload);
    const normalizedContactId = this.normalizeId(
      sanitized.contactId,
      'contactId',
    );

    await this.twentyApiService.request(
      'PATCH',
      `/people/${encodeURIComponent(normalizedContactId)}`,
      { householdId: normalizedId },
      this.logContext,
    );

    if (sanitized.makePrimary) {
      await this.twentyApiService.request(
        'PATCH',
        `/households/${encodeURIComponent(normalizedId)}`,
        { primaryContactId: normalizedContactId },
        this.logContext,
      );
    }

    return this.fetchPerson(normalizedContactId);
  }

  async removeMember(
    householdId: string,
    contactId: string,
  ): Promise<HouseholdMemberRecord> {
    const normalizedId = this.normalizeId(householdId, 'householdId');
    const normalizedContactId = this.normalizeId(contactId, 'contactId');

    await this.twentyApiService.request(
      'PATCH',
      `/people/${encodeURIComponent(normalizedContactId)}`,
      { householdId: null },
      this.logContext,
    );

    return this.fetchPerson(normalizedContactId);
  }

  async copyAddressToContact(
    householdId: string,
    payload: unknown,
  ): Promise<HouseholdMemberRecord> {
    const normalizedId = this.normalizeId(householdId, 'householdId');
    const sanitized: CopyHouseholdAddressPayload =
      validateCopyAddressPayload(payload);
    const normalizedContactId = this.normalizeId(
      sanitized.contactId,
      'contactId',
    );

    const updateBody: Record<string, unknown> = {
      mailingAddress: sanitized.mailingAddress,
      householdId: normalizedId,
    };

    await this.twentyApiService.request(
      'PATCH',
      `/people/${encodeURIComponent(normalizedContactId)}`,
      updateBody,
      this.logContext,
    );

    return this.fetchPerson(normalizedContactId);
  }

  private async fetchPerson(contactId: string): Promise<HouseholdMemberRecord> {
    const response = await this.twentyApiService.request(
      'GET',
      `/people/${encodeURIComponent(contactId)}`,
      undefined,
      this.logContext,
    );
    return ensureHouseholdMemberResponse(response);
  }

  private normalizeId(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string`);
    }
    const trimmed = value.trim();
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
          if (entry === undefined || entry === null) {
            continue;
          }
          params.append(key, String(entry));
        }
        continue;
      }

      params.append(key, String(value));
    }

    const serialized = params.toString();
    if (!serialized) {
      return basePath;
    }

    return `${basePath}?${serialized}`;
  }
}
