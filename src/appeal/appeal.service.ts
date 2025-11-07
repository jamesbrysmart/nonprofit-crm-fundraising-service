import { Injectable, BadRequestException } from '@nestjs/common';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  ensureAppealListResponse,
  ensureCreateAppealResponse,
  ensureCreateSolicitationSnapshotResponse,
  ensureGetAppealResponse,
  ensureSolicitationSnapshotListResponse,
  ensureUpdateAppealResponse,
  validateCreateAppealPayload,
  validateCreateSolicitationSnapshotPayload,
  validateUpdateAppealPayload,
} from './appeal.validation';

@Injectable()
export class AppealService {
  private readonly logContext = AppealService.name;

  constructor(private readonly twentyApiService: TwentyApiService) {}

  async listAppeals(query: Record<string, unknown>): Promise<unknown> {
    const path = this.buildPath('/appeals', query ?? {});
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    ensureAppealListResponse(response);
    return response;
  }

  async getAppeal(
    id: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const normalizedId = this.normalizeId(id, 'id');
    const basePath = `/appeals/${encodeURIComponent(normalizedId)}`;
    const path = this.buildPath(basePath, query ?? {});
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    ensureGetAppealResponse(response);
    return response;
  }

  async createAppeal(payload: unknown): Promise<unknown> {
    const sanitizedPayload = validateCreateAppealPayload(payload);
    const response = await this.twentyApiService.request(
      'POST',
      '/appeals',
      sanitizedPayload,
      this.logContext,
    );
    ensureCreateAppealResponse(response);
    return response;
  }

  async updateAppeal(id: string, payload: unknown): Promise<unknown> {
    const normalizedId = this.normalizeId(id, 'id');
    const sanitizedPayload = validateUpdateAppealPayload(payload);
    const response = await this.twentyApiService.request(
      'PATCH',
      `/appeals/${encodeURIComponent(normalizedId)}`,
      sanitizedPayload,
      this.logContext,
    );
    ensureUpdateAppealResponse(response);
    return response;
  }

  async createSolicitationSnapshot(
    id: string,
    payload: unknown,
  ): Promise<unknown> {
    const normalizedId = this.normalizeId(id, 'appealId');
    const sanitizedPayload = validateCreateSolicitationSnapshotPayload(payload);
    sanitizedPayload.appealId = normalizedId;

    const response = await this.twentyApiService.request(
      'POST',
      '/solicitationSnapshots',
      sanitizedPayload,
      this.logContext,
    );
    ensureCreateSolicitationSnapshotResponse(response);
    return response;
  }

  async listSolicitationSnapshots(
    appealId: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const normalizedId = this.normalizeId(appealId, 'appealId');
    const path = this.buildPath('/solicitationSnapshots', {
      ...query,
      appealId: normalizedId,
    });
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    ensureSolicitationSnapshotListResponse(response);
    return response;
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
    if (!serialized) {
      return basePath;
    }

    return `${basePath}?${serialized}`;
  }
}
