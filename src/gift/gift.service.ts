import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { URLSearchParams } from 'url';
import { stringifyQueryValue } from '../common/query-string.utils';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  ensureCreateGiftResponse,
  ensureDeleteGiftResponse,
  ensureGiftGetResponse,
  ensureGiftListResponse,
  ensureUpdateGiftResponse,
  validateCreateGiftPayload,
  validateCreateGiftStagingPayload,
  validateUpdateGiftPayload,
} from './gift.validation';
import type { GiftCreatePayload } from './gift.validation';
import { GiftStagingService } from '../gift-staging/gift-staging.service';
import {
  buildTwentyGiftPayload,
  extractCreateGiftId,
} from './gift-payload.util';
import {
  GiftDedupeDiagnostics,
  GiftStagingRecord,
  NormalizedGiftCreatePayload,
  ProcessingDiagnostics,
  ProcessingBlocker,
  ProcessingWarning,
  IdentityConfidence,
} from './gift.types';
import { ReceiptPolicyService } from '../receipt/receipt-policy.service';

interface ExistingPersonMatch {
  personId: string;
  matchedBy: 'email' | 'name';
  confidence?: number;
  candidateIds?: string[];
}

const ORG_INTENTS = new Set(['grant', 'corporateInKind']);
const RECURRING_INTENTS = new Set(['recurring']);

@Injectable()
export class GiftService {
  private readonly logContext = GiftService.name;

  private readonly loggerInstance = new Logger(GiftService.name);

  constructor(
    private readonly twentyApiService: TwentyApiService,
    private readonly giftStagingService: GiftStagingService,
    private readonly receiptPolicyService: ReceiptPolicyService,
  ) {}

  async normalizeCreateGiftPayload(
    payload: unknown,
  ): Promise<NormalizedGiftCreatePayload> {
    const sanitizedPayload = validateCreateGiftPayload(payload);
    const prepared = await this.prepareGiftPayload(sanitizedPayload, {
      resolveContacts: true,
    });
    prepared.processingDiagnostics = this.buildProcessingDiagnostics(prepared);
    return prepared;
  }

  async normalizeCreateGiftStagingPayload(
    payload: unknown,
  ): Promise<NormalizedGiftCreatePayload> {
    const sanitizedPayload = validateCreateGiftStagingPayload(payload);
    const prepared = await this.prepareGiftPayload(sanitizedPayload, {
      resolveContacts: false,
    });
    prepared.processingDiagnostics = this.buildProcessingDiagnostics(prepared);
    return prepared;
  }

  async createGift(payload: unknown): Promise<unknown> {
    const sanitizedPayload = validateCreateGiftPayload(payload);
    const preparedPayload = await this.prepareGiftPayload(sanitizedPayload, {
      resolveContacts: true,
    });

    let stagingRecord: GiftStagingRecord | undefined;
    let shouldProcessImmediately = true;
    try {
      if (this.giftStagingService.isEnabled()) {
        const processingDiagnostics =
          this.buildProcessingDiagnostics(preparedPayload);
        preparedPayload.processingDiagnostics = processingDiagnostics;
        this.applyAutoProcessDecision(preparedPayload, processingDiagnostics);
      }
      stagingRecord = await this.giftStagingService.stageGift(preparedPayload);
      if (this.giftStagingService.isEnabled() && stagingRecord) {
        await this.applyDedupeStatusToStaging(
          stagingRecord.id,
          preparedPayload,
        );
        if (!stagingRecord.autoProcess) {
          shouldProcessImmediately = false;
        }
      }
    } catch (error) {
      this.loggerInstance.warn(
        `Failed to stage gift payload: ${error instanceof Error ? error.message : error}`,
      );
    }

    if (!shouldProcessImmediately && stagingRecord) {
      this.loggerInstance.log(
        `Gift staged without auto-process; returning acknowledgement for stagingId=${stagingRecord.id}`,
        this.logContext,
      );
      return this.buildStagingAcknowledgementResponse(
        stagingRecord,
        preparedPayload.processingDiagnostics,
      );
    }

    const response = await this.createGiftInTwenty(preparedPayload);
    ensureCreateGiftResponse(response);

    const giftId = extractCreateGiftId(response);
    if (giftId) {
      await this.giftStagingService.markProcessed(stagingRecord, giftId);
    }

    return response;
  }

  async listGifts(query: Record<string, unknown>): Promise<unknown> {
    const path = this.buildPath('/gifts', query);
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
    ensureGiftListResponse(response);
    return response;
  }

  async getGift(id: string, query: Record<string, unknown>): Promise<unknown> {
    const basePath = `/gifts/${encodeURIComponent(id)}`;
    const path = this.buildPath(basePath, query);
    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      this.logContext,
    );
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
    payload: GiftCreatePayload,
    options?: { resolveContacts?: boolean },
  ): Promise<NormalizedGiftCreatePayload> {
    const resolveContacts = options?.resolveContacts !== false;
    let contactFirstName: string | undefined;
    let contactLastName: string | undefined;
    let contactEmail: string | undefined;

    if (payload.contact && typeof payload.contact === 'object') {
      const contactPayload = payload.contact as Record<string, unknown>;
      contactFirstName =
        typeof contactPayload.firstName === 'string'
          ? contactPayload.firstName.trim()
          : undefined;
      contactLastName =
        typeof contactPayload.lastName === 'string'
          ? contactPayload.lastName.trim()
          : undefined;
      contactEmail =
        typeof contactPayload.email === 'string' &&
        contactPayload.email.trim().length > 0
          ? contactPayload.email.trim()
          : undefined;
    }

    const amountMicros =
      typeof payload.amount?.amountMicros === 'number'
        ? Math.round(payload.amount.amountMicros)
        : undefined;

    const currencyCode =
      payload.amount?.currencyCode ?? 'GBP';

    const prepared: NormalizedGiftCreatePayload = {
      ...payload,
      amount: {
        amountMicros: amountMicros ?? 0,
        currencyCode,
      },
    };

    if (payload.feeAmount && typeof payload.feeAmount === 'object') {
      const feeMicros =
        typeof payload.feeAmount.amountMicros === 'number'
          ? Math.round(payload.feeAmount.amountMicros)
          : undefined;
      if (typeof feeMicros === 'number' && Number.isFinite(feeMicros)) {
        prepared.feeAmount = {
          amountMicros: feeMicros,
          currencyCode:
            typeof payload.feeAmount.currencyCode === 'string'
              ? payload.feeAmount.currencyCode
              : currencyCode,
        };
      }
    }

    if (
      typeof payload.companyId === 'string' &&
      payload.companyId.trim().length > 0
    ) {
      prepared.companyId = payload.companyId.trim();
    } else {
      delete prepared.companyId;
    }

    let dedupeDiagnostics: GiftDedupeDiagnostics | undefined;
    let contactInput: Record<string, unknown> | undefined;

    if (prepared.contact && typeof prepared.contact === 'object') {
      contactInput = prepared.contact as Record<string, unknown>;
      delete prepared.contact;
    }

    const resolvedFirstName =
      typeof prepared.donorFirstName === 'string'
        ? prepared.donorFirstName.trim()
        : contactFirstName;
    const resolvedLastName =
      typeof prepared.donorLastName === 'string'
        ? prepared.donorLastName.trim()
        : contactLastName;
    const resolvedEmail =
      typeof prepared.donorEmail === 'string' &&
      prepared.donorEmail.trim().length > 0
        ? prepared.donorEmail.trim()
        : contactEmail;

    if (!contactInput && resolvedFirstName && resolvedLastName) {
      contactInput = {
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
      };
      if (resolvedEmail) {
        contactInput.email = resolvedEmail;
      }
    }

    if (
      contactInput &&
      !this.hasNonEmptyString(prepared.donorId) &&
      !this.hasNonEmptyString(prepared.companyId)
    ) {
      const existingPersonMatch =
        await this.findExistingPersonMatch(contactInput);

      if (existingPersonMatch) {
        this.loggerInstance.log(
          `Found existing person ${existingPersonMatch.personId} for gift contact (match=${existingPersonMatch.matchedBy})`,
          this.logContext,
        );
        dedupeDiagnostics = {
          matchType:
            existingPersonMatch.matchedBy === 'email' ? 'email' : 'name',
          matchedDonorId: existingPersonMatch.personId,
          matchedBy: existingPersonMatch.matchedBy,
          confidence: existingPersonMatch.confidence,
          candidateDonorIds: existingPersonMatch.candidateIds,
        };
        if (resolveContacts) {
          prepared.donorId = existingPersonMatch.personId;
        }
      } else if (resolveContacts) {
        const personId = await this.createPerson(contactInput);
        prepared.donorId = personId;
      }
    }

    if (contactFirstName) {
      prepared.donorFirstName = contactFirstName;
    }
    if (contactLastName) {
      prepared.donorLastName = contactLastName;
    }
    if (contactEmail) {
      prepared.donorEmail = contactEmail;
    }

    if (
      typeof prepared.contactId === 'string' &&
      prepared.contactId.trim().length > 0 &&
      typeof prepared.donorId !== 'string'
    ) {
      prepared.donorId = prepared.contactId.trim();
      delete prepared.contactId;
    }

    if (typeof prepared.externalId === 'string') {
      prepared.externalId = prepared.externalId.trim();
    }

    if (typeof prepared.paymentMethod === 'string') {
      prepared.paymentMethod = prepared.paymentMethod.trim();
    }

    if (typeof prepared.recurringAgreementId === 'string') {
      prepared.recurringAgreementId = prepared.recurringAgreementId.trim();
      if (prepared.recurringAgreementId.length === 0) {
        delete prepared.recurringAgreementId;
      }
    }

    if (
      typeof prepared.giftPayoutId === 'string' &&
      prepared.giftPayoutId.trim().length > 0
    ) {
      prepared.giftPayoutId = prepared.giftPayoutId.trim();
    } else {
      delete prepared.giftPayoutId;
    }

    if (typeof prepared.provider === 'string') {
      prepared.provider = prepared.provider.trim();
      if (prepared.provider.length === 0) {
        delete prepared.provider;
      }
    }

    if (typeof prepared.providerPaymentId === 'string') {
      prepared.providerPaymentId = prepared.providerPaymentId.trim();
      if (prepared.providerPaymentId.length === 0) {
        delete prepared.providerPaymentId;
      }
    }

    if (typeof prepared.recurringStatus === 'string') {
      prepared.recurringStatus = prepared.recurringStatus.trim();
      if (prepared.recurringStatus.length === 0) {
        delete prepared.recurringStatus;
      }
    }

    if (typeof prepared.expectedAt === 'string') {
      const trimmed = prepared.expectedAt.trim();
      prepared.expectedAt = trimmed.length > 0 ? trimmed : undefined;
    }

    if (
      typeof prepared.intakeSource !== 'string' ||
      prepared.intakeSource.trim().length === 0
    ) {
      prepared.intakeSource = 'manual_ui';
    } else {
      prepared.intakeSource = prepared.intakeSource.trim();
    }

    if (
      typeof prepared.sourceFingerprint !== 'string' ||
      prepared.sourceFingerprint.trim().length === 0
    ) {
      const fingerprintSeed = [
        prepared.externalId,
        prepared.donorId,
        prepared.companyId,
        prepared.recurringAgreementId,
        typeof prepared.amount?.amountMicros === 'number'
          ? prepared.amount.amountMicros.toString()
          : undefined,
        prepared.amount?.currencyCode,
      ]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join('|');

      prepared.sourceFingerprint =
        fingerprintSeed.length > 0
          ? fingerprintSeed
          : this.generateFallbackFingerprint();
    } else {
      prepared.sourceFingerprint = prepared.sourceFingerprint.trim();
    }

    if (dedupeDiagnostics) {
      prepared.dedupeDiagnostics = dedupeDiagnostics;
    }

    return this.receiptPolicyService.applyReceiptMetadata(prepared);
  }

  private async createPerson(
    contact: Record<string, unknown>,
  ): Promise<string> {
    const firstName =
      typeof contact.firstName === 'string'
        ? contact.firstName.trim()
        : undefined;
    const lastName =
      typeof contact.lastName === 'string'
        ? contact.lastName.trim()
        : undefined;
    const email =
      typeof contact.email === 'string' && contact.email.trim().length > 0
        ? contact.email.trim()
        : undefined;

    if (!firstName || !lastName) {
      throw new BadRequestException(
        'contact.firstName and contact.lastName must be provided',
      );
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

  private async findExistingPersonMatch(
    contact: Record<string, unknown>,
  ): Promise<ExistingPersonMatch | undefined> {
    const firstName =
      typeof contact.firstName === 'string'
        ? contact.firstName.trim()
        : undefined;
    const lastName =
      typeof contact.lastName === 'string'
        ? contact.lastName.trim()
        : undefined;
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

      const match = this.extractDuplicatePersonMatch(response, email);
      if (match) {
        return match;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'unknown error resolving existing person';
      this.loggerInstance.warn(
        `Failed to query duplicates for contact email=${email}: ${message}`,
        this.logContext,
      );
    }

    return undefined;
  }

  private extractDuplicatePersonMatch(
    response: unknown,
    email?: string,
  ): ExistingPersonMatch | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const data = (response as Record<string, unknown>).data;
    if (!Array.isArray(data) || data.length === 0) {
      return undefined;
    }

    const normalizedEmail = email?.trim().toLowerCase();
    const candidateIds = new Set<string>();
    let emailMatchedId: string | undefined;
    let fallbackId: string | undefined;

    for (const entry of data) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const duplicates = (entry as Record<string, unknown>).personDuplicates;
      if (!Array.isArray(duplicates) || duplicates.length === 0) {
        continue;
      }

      for (const duplicate of duplicates) {
        if (!duplicate || typeof duplicate !== 'object') {
          continue;
        }

        const duplicateId = (duplicate as Record<string, unknown>).id;
        if (typeof duplicateId !== 'string' || duplicateId.length === 0) {
          continue;
        }

        candidateIds.add(duplicateId);

        if (normalizedEmail) {
          const emails = (duplicate as Record<string, unknown>).emails;
          if (emails && typeof emails === 'object') {
            const primaryEmail = (emails as Record<string, unknown>)
              .primaryEmail;
            if (
              typeof primaryEmail === 'string' &&
              primaryEmail.trim().toLowerCase() === normalizedEmail
            ) {
              emailMatchedId = duplicateId;
              break;
            }
          }
        }

        if (!fallbackId) {
          fallbackId = duplicateId;
        }
      }

      if (emailMatchedId) {
        break;
      }
    }

    const candidateList = Array.from(candidateIds);

    if (emailMatchedId) {
      return {
        personId: emailMatchedId,
        matchedBy: 'email',
        confidence: 1,
        candidateIds: candidateList,
      };
    }

    if (fallbackId) {
      return {
        personId: fallbackId,
        matchedBy: 'name',
        confidence: 0.5,
        candidateIds: candidateList,
      };
    }

    return undefined;
  }

  private previewResponse(response: unknown): string {
    try {
      const serialized = JSON.stringify(response);
      if (!serialized) {
        return '[empty response]';
      }
      return serialized.length > 500
        ? `${serialized.slice(0, 500)}…`
        : serialized;
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

  private async createGiftInTwenty(
    payload: NormalizedGiftCreatePayload,
  ): Promise<unknown> {
    const requestBody = buildTwentyGiftPayload(payload);
    return this.twentyApiService.request(
      'POST',
      '/gifts',
      requestBody,
      this.logContext,
    );
  }

  private buildPath(basePath: string, query: Record<string, unknown>): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
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

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  private generateFallbackFingerprint(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private applyAutoProcessDecision(
    payload: NormalizedGiftCreatePayload,
    diagnostics: ProcessingDiagnostics,
  ): void {
    const autoProcessIntent =
      this.giftStagingService.resolveAutoProcessIntent(payload);
    const trustLevel = this.resolveTrustLevel(payload.intakeSource);
    const eligible = diagnostics.processingEligibility === 'eligible';
    let allowAutoProcess = false;

    if (autoProcessIntent && eligible) {
      if (trustLevel === 'high') {
        allowAutoProcess = true;
      } else if (trustLevel === 'medium') {
        allowAutoProcess =
          diagnostics.identityConfidence === 'strong' ||
          diagnostics.identityConfidence === 'explicit';
      } else if (trustLevel === 'low') {
        allowAutoProcess = diagnostics.identityConfidence === 'strong';
      }
    }

    payload.autoProcess = allowAutoProcess;
  }

  private buildProcessingDiagnostics(
    payload: NormalizedGiftCreatePayload,
  ): ProcessingDiagnostics {
    const blockers: ProcessingBlocker[] = [];
    const warnings: ProcessingWarning[] = [];

    const identityConfidence = this.resolveIdentityConfidence(payload);
    const giftIntent = this.normalizeOptionalString(payload.giftIntent);
    const hasCompanyId = this.hasNonEmptyString(payload.companyId);
    const hasDonorId = this.hasNonEmptyString(payload.donorId);
    const hasDonorName =
      this.hasNonEmptyString(payload.donorFirstName) &&
      this.hasNonEmptyString(payload.donorLastName);
    const hasDonorIdentity = hasDonorId || hasDonorName;
    const isOrgIntent = giftIntent ? ORG_INTENTS.has(giftIntent) : false;

    if (isOrgIntent) {
      if (!hasCompanyId) {
        blockers.push('company_missing_for_org_intent');
      }
    } else if (!hasDonorIdentity) {
      blockers.push('identity_missing');
    }

    if (
      this.isRecurringIntent(payload) &&
      !this.hasNonEmptyString(payload.recurringAgreementId)
    ) {
      blockers.push('recurring_agreement_missing');
    }

    if (!this.hasNonEmptyString(payload.giftDate)) {
      blockers.push('gift_date_missing');
    }

    if (identityConfidence === 'weak') {
      warnings.push('identity_low_confidence');
    }

    if (!this.hasNonEmptyString(payload.appealId)) {
      warnings.push('appeal_missing');
    }
    if (!this.hasNonEmptyString(payload.fundId)) {
      warnings.push('fund_missing');
    }
    if (!this.hasNonEmptyString(payload.opportunityId)) {
      warnings.push('opportunity_missing');
    }
    if (!this.hasNonEmptyString(payload.giftPayoutId)) {
      warnings.push('payout_missing');
    }
    if (!this.hasNonEmptyString(payload.paymentMethod)) {
      warnings.push('payment_method_missing');
    }

    return {
      processingEligibility: blockers.length > 0 ? 'blocked' : 'eligible',
      processingBlockers: blockers,
      processingWarnings: warnings,
      identityConfidence,
    };
  }

  private resolveIdentityConfidence(
    payload: NormalizedGiftCreatePayload,
  ): IdentityConfidence {
    if (payload.dedupeDiagnostics) {
      return payload.dedupeDiagnostics.matchType === 'email'
        ? 'strong'
        : 'weak';
    }

    if (
      this.hasNonEmptyString(payload.donorId) ||
      this.hasNonEmptyString(payload.companyId)
    ) {
      return 'explicit';
    }

    if (
      this.hasNonEmptyString(payload.donorFirstName) &&
      this.hasNonEmptyString(payload.donorLastName)
    ) {
      return 'weak';
    }

    return 'none';
  }

  async resolveDonorFromStagingPayload(
    payload: NormalizedGiftCreatePayload,
  ): Promise<NormalizedGiftCreatePayload> {
    if (this.hasNonEmptyString(payload.donorId)) {
      return payload;
    }

    const donorFirstName =
      typeof payload.donorFirstName === 'string'
        ? payload.donorFirstName.trim()
        : undefined;
    const donorLastName =
      typeof payload.donorLastName === 'string'
        ? payload.donorLastName.trim()
        : undefined;
    const donorEmail =
      typeof payload.donorEmail === 'string' &&
      payload.donorEmail.trim().length > 0
        ? payload.donorEmail.trim()
        : undefined;

    if (!donorFirstName || !donorLastName) {
      return payload;
    }

    const contactInput: Record<string, unknown> = {
      firstName: donorFirstName,
      lastName: donorLastName,
    };
    if (donorEmail) {
      contactInput.email = donorEmail;
    }

    const existingPersonMatch =
      await this.findExistingPersonMatch(contactInput);

    if (existingPersonMatch) {
      this.loggerInstance.log(
        `Reusing existing person ${existingPersonMatch.personId} for staged gift (match=${existingPersonMatch.matchedBy})`,
        this.logContext,
      );
      return {
        ...payload,
        donorId: existingPersonMatch.personId,
      };
    }

    const personId = await this.createPerson(contactInput);
    return {
      ...payload,
      donorId: personId,
    };
  }

  private isRecurringIntent(payload: NormalizedGiftCreatePayload): boolean {
    const giftIntent = this.normalizeOptionalString(payload.giftIntent);
    if (giftIntent && RECURRING_INTENTS.has(giftIntent)) {
      return true;
    }

    if (this.hasNonEmptyString(payload.recurringStatus)) {
      return true;
    }

    if (
      payload.recurringMetadata &&
      typeof payload.recurringMetadata === 'object'
    ) {
      return true;
    }

    return false;
  }

  private resolveTrustLevel(
    intakeSource?: string,
  ): 'high' | 'medium' | 'low' {
    const normalized =
      typeof intakeSource === 'string' && intakeSource.trim().length > 0
        ? intakeSource.trim().toLowerCase()
        : 'manual_ui';

    if (normalized === 'manual_ui') {
      return 'high';
    }
    if (normalized === 'csv_import') {
      return 'low';
    }
    return 'medium';
  }

  private hasNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private async applyDedupeStatusToStaging(
    stagingId: string,
    payload: NormalizedGiftCreatePayload,
  ): Promise<void> {
    const diagnostics = payload.dedupeDiagnostics;
    if (!diagnostics) {
      return;
    }

    const dedupeStatus =
      diagnostics.matchType === 'email' ? 'matched_existing' : 'needs_review';

    try {
      await this.giftStagingService.updateStatusById(stagingId, {
        dedupeStatus,
      });
    } catch (error) {
      this.loggerInstance.warn(
        `Failed to update dedupe status for stagingId=${stagingId}: ${
          error instanceof Error ? error.message : error
        }`,
        this.logContext,
      );
    }
  }

  private buildStagingAcknowledgementResponse(
    record: GiftStagingRecord,
    processingDiagnostics?: ProcessingDiagnostics,
  ): Record<string, unknown> {
    const processingStatus = record.processingStatus
      ? record.processingStatus
      : record.autoProcess
        ? 'processing'
        : 'pending';

    const meta: Record<string, unknown> = {
      stagedOnly: true,
    };
    if (processingDiagnostics) {
      meta.processingDiagnostics = processingDiagnostics;
    }

    return {
      data: {
        giftStaging: {
          id: record.id,
          autoProcess: record.autoProcess,
          processingStatus,
        },
      },
      meta,
    } as Record<string, unknown>;
  }
}
