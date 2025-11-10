#!/usr/bin/env ts-node

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GiftService } from '../src/gift/gift.service';
import {
  GiftStagingService,
  GiftStagingEntity,
  GiftStagingStatusUpdate,
} from '../src/gift-staging/gift-staging.service';
import { NormalizedGiftCreatePayload } from '../src/gift/gift.types';
import { RecurringAgreementService } from '../src/recurring-agreement/recurring-agreement.service';
import { TwentyApiService } from '../src/twenty/twenty-api.service';

type SeededStagingSummary = {
  id: string;
  donorId?: string;
  scenario: string;
  status?: string;
  intakeSource?: string;
  recurringAgreementId?: string;
  provider?: string;
  giftIntent?: string;
  opportunityId?: string;
};

async function main(): Promise<void> {
  if (!process.env.TWENTY_API_BASE_URL && !process.env.TWENTY_REST_BASE_URL) {
    process.env.TWENTY_API_BASE_URL = 'http://localhost:3000/rest';
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const giftService = app.get(GiftService);
    const giftStagingService = app.get(GiftStagingService);
    const recurringAgreementService = app.get(RecurringAgreementService);
    const twentyApiService = app.get(TwentyApiService);

    if (!giftStagingService.isEnabled()) {
      throw new Error(
        'Gift staging is disabled (set FUNDRAISING_ENABLE_GIFT_STAGING=true before running seeds).',
      );
    }

    const runId = randomUUID().slice(0, 8);
    const today = new Date().toISOString().slice(0, 10);
    const stagingSummaries: SeededStagingSummary[] = [];
    const { companyId, companyName, opportunityId } = await ensureTestOpportunity(
      twentyApiService,
      runId,
    );

    const pendingReview = await seedManualStaging({
      label: 'pending-review',
      giftService,
      giftStagingService,
      amountMinor: 1850,
      giftDate: today,
      runId,
      statuses: {
        promotionStatus: 'pending',
        validationStatus: 'pending',
        dedupeStatus: 'needs_review',
      },
      notes: 'Seeded test fixture (pending review)',
      giftIntent: 'standard',
      opportunityId,
      isInKind: false,
    });
    stagingSummaries.push({
      id: pendingReview.entity.id,
      donorId: pendingReview.preparedPayload.donorId,
      scenario: 'Pending review',
      status: pendingReview.entity.promotionStatus,
      intakeSource: pendingReview.entity.intakeSource,
      giftIntent: pendingReview.preparedPayload.giftIntent,
      opportunityId,
    });

    const readyForCommit = await seedManualStaging({
      label: 'ready-for-commit',
      giftService,
      giftStagingService,
      amountMinor: 3200,
      giftDate: today,
      runId,
      statuses: {
        promotionStatus: 'ready_for_commit',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
      },
      notes: 'Seeded test fixture (ready for commit)',
      giftIntent: 'standard',
      opportunityId,
    });
    stagingSummaries.push({
      id: readyForCommit.entity.id,
      donorId: readyForCommit.preparedPayload.donorId,
      scenario: 'Ready for commit',
      status: readyForCommit.entity.promotionStatus,
      intakeSource: readyForCommit.entity.intakeSource,
      giftIntent: readyForCommit.preparedPayload.giftIntent,
      opportunityId,
    });

    const commitFailed = await seedManualStaging({
      label: 'commit-failed',
      giftService,
      giftStagingService,
      amountMinor: 2700,
      giftDate: today,
      runId,
    statuses: {
      promotionStatus: 'commit_failed',
      validationStatus: 'passed',
      dedupeStatus: 'matched_existing',
    },
    notes: 'Seeded test fixture (commit failed)',
    giftIntent: 'legacy',
  });
    stagingSummaries.push({
      id: commitFailed.entity.id,
      donorId: commitFailed.preparedPayload.donorId,
      scenario: 'Commit failed',
      status: commitFailed.entity.promotionStatus,
      intakeSource: commitFailed.entity.intakeSource,
      giftIntent: commitFailed.preparedPayload.giftIntent,
    });

    const recurringAgreementId = await seedRecurringAgreement({
      giftService,
      recurringAgreementService,
      giftStagingService,
      basePreparedPayload: readyForCommit.preparedPayload,
      runId,
      today,
    });

    const grantHighValue = await seedManualStaging({
      label: 'grant-high-value',
      giftService,
      giftStagingService,
      amountMinor: 250000,
      giftDate: today,
      runId,
      giftIntent: 'grant',
      opportunityId,
      notes: `High-value grant staged gift (${companyName ?? 'company'})`,
      statuses: {
        promotionStatus: 'ready_for_commit',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
      },
    });
    stagingSummaries.push({
      id: grantHighValue.entity.id,
      donorId: grantHighValue.preparedPayload.donorId,
      scenario: 'Grant high value',
      status: grantHighValue.entity.promotionStatus,
      intakeSource: grantHighValue.entity.intakeSource,
      giftIntent: 'grant',
      opportunityId,
    });

    const corporateInKind = await seedManualStaging({
      label: 'corporate-in-kind',
      giftService,
      giftStagingService,
      amountMinor: 7800,
      giftDate: today,
      runId,
      giftIntent: 'corporateInKind',
      inKindDescription: 'Seeded equipment donation',
      estimatedValue: 4800,
      isInKind: true,
      notes: 'Corporate in-kind test fixture',
      statuses: {
        promotionStatus: 'pending',
        validationStatus: 'pending',
        dedupeStatus: 'needs_review',
      },
    });
    stagingSummaries.push({
      id: corporateInKind.entity.id,
      donorId: corporateInKind.preparedPayload.donorId,
      scenario: 'Corporate in-kind',
      status: corporateInKind.entity.promotionStatus,
      intakeSource: corporateInKind.entity.intakeSource,
      giftIntent: 'corporateInKind',
    });

    const recurringRow = await seedManualStaging({
      label: 'recurring-stripe',
      giftService,
      giftStagingService,
      amountMinor: 1550,
      giftDate: today,
      runId,
      recurringAgreementId,
      providerMetadata: {
        provider: 'stripe',
        providerPaymentId: `pi_seed_${runId}`,
        intakeSource: 'stripe_webhook',
        expectedAt: today,
      },
      statuses: {
        promotionStatus: 'ready_for_commit',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
      },
      notes: 'Seeded recurring webhook fixture',
      giftIntent: 'standard',
    });
    stagingSummaries.push({
      id: recurringRow.entity.id,
      donorId: recurringRow.preparedPayload.donorId,
      scenario: recurringAgreementId ? 'Recurring linked' : 'Recurring (unlinked)',
      status: recurringRow.entity.promotionStatus,
      intakeSource: recurringRow.entity.intakeSource,
      recurringAgreementId: recurringRow.entity.recurringAgreementId,
      provider: recurringRow.entity.provider,
      giftIntent: recurringRow.preparedPayload.giftIntent,
    });

  const committedGift = await giftService.createGift({
    amount: {
      currencyCode: 'GBP',
      value: 45,
    },
    giftDate: today,
    name: `Seeded committed gift ${runId}`,
    autoPromote: true,
    contact: {
      firstName: 'Seeded',
      lastName: `Donor${runId}`,
      email: `seeded.donor+${runId}@example.org`,
    },
    notes: 'Seeded committed gift for manual verification',
  });

    console.log('\nSeed fixtures complete ✅');
    console.log('Staging rows created:');
    for (const summary of stagingSummaries) {
      console.log(
        `  • ${summary.id} – ${summary.scenario} (status=${summary.status}, intake=${summary.intakeSource})`,
      );
      if (summary.recurringAgreementId || summary.provider) {
        console.log(
          `      recurringAgreement=${summary.recurringAgreementId ?? '—'}, provider=${summary.provider ?? '—'}`,
        );
      }
      if (summary.giftIntent || summary.opportunityId) {
        console.log(
          `      intent=${summary.giftIntent ?? '—'}, opportunity=${summary.opportunityId ?? '—'}`,
        );
      }
    }

    console.log('\nCommitted gift response snippet:');
    console.dir(committedGift, { depth: 2 });

    if (!recurringAgreementId) {
      console.warn(
        '\n⚠️ Recurring agreement creation failed or is unsupported. Recurring staging row remains unlinked.',
      );
    }
  } finally {
    await app.close();
  }
}

async function seedManualStaging(options: {
  label: string;
  giftService: GiftService;
  giftStagingService: GiftStagingService;
  amountMinor: number;
  giftDate: string;
  runId: string;
  statuses?: GiftStagingStatusUpdate;
  notes?: string;
  recurringAgreementId?: string;
  providerMetadata?: {
    provider?: string;
    providerPaymentId?: string;
    expectedAt?: string;
    intakeSource?: string;
  };
  giftIntent?: string;
  opportunityId?: string;
  inKindDescription?: string;
  isInKind?: boolean;
  estimatedValue?: number;
}): Promise<{
  entity: GiftStagingEntity;
  preparedPayload: NormalizedGiftCreatePayload;
}> {
  const {
    label,
    giftService,
    giftStagingService,
    amountMinor,
    giftDate,
    runId,
  statuses,
  notes,
  recurringAgreementId,
  providerMetadata = {},
  giftIntent,
  opportunityId,
  inKindDescription,
  isInKind,
  estimatedValue,
  } =
    options;

  const amountMajor = Number((amountMinor / 100).toFixed(2));
  const payload = {
    amount: {
      currencyCode: 'GBP',
      value: amountMajor,
    },
    amountMinor,
    currency: 'GBP',
    giftDate,
    name: `Seeded gift ${label} ${runId}`,
    contact: {
      firstName: `Seeded${label.replace(/[^a-z0-9]/gi, '') || 'Donor'}`,
      lastName: `Scenario${runId}`,
      email: `seeded.${label.replace(/[^a-z0-9]/gi, '').toLowerCase()}+${runId}@example.org`,
    },
    autoPromote: false,
    notes,
    intakeSource: providerMetadata.intakeSource ?? 'manual_ui',
    recurringAgreementId,
    provider: providerMetadata.provider,
    providerPaymentId: providerMetadata.providerPaymentId,
    expectedAt: providerMetadata.expectedAt,
    giftIntent,
    opportunityId,
  } as Record<string, unknown>;

  if (typeof inKindDescription === 'string' && inKindDescription.trim().length > 0) {
    payload.inKindDescription = inKindDescription.trim();
  }

  if (typeof isInKind === 'boolean') {
    payload.isInKind = isInKind;
  }

  if (typeof estimatedValue === 'number') {
    payload.estimatedValue = estimatedValue;
  }

  const prepared = await giftService.normalizeCreateGiftPayload(payload);
  prepared.autoPromote = false;
  const staged = await giftStagingService.stageGift(prepared);

  if (!staged?.id) {
    throw new Error(`Failed to stage gift payload for scenario ${label}`);
  }

  const statusUpdate = statuses ?? {};
  const { errorDetail, ...statusOnly } = statusUpdate;
  const hasStatusUpdates = Object.values(statusOnly).some((value) => value !== undefined);
  if (hasStatusUpdates) {
    await giftStagingService.updateStatusById(staged.id, statusOnly);
  }
  // Leave error detail unset for now; metadata support is inconsistent across environments.

  const entity =
    (await giftStagingService.getGiftStagingById(staged.id)) ??
    (() => {
      throw new Error(`Staging row ${staged.id} not retrievable after creation`);
    })();

  return {
    entity,
    preparedPayload: prepared,
  };
}

async function seedRecurringAgreement(args: {
  giftService: GiftService;
  recurringAgreementService: RecurringAgreementService;
  giftStagingService: GiftStagingService;
  basePreparedPayload: NormalizedGiftCreatePayload;
  runId: string;
  today: string;
}): Promise<string | undefined> {
  const { basePreparedPayload, recurringAgreementService, runId, today } = args;
  const donorId = basePreparedPayload.donorId;

  if (!donorId) {
    return undefined;
  }

  const payload = {
    donorId,
    status: 'active',
    cadence: 'monthly',
    intervalCount: 1,
    amountMinor: basePreparedPayload.amountMinor ?? 2000,
    startDate: today,
    nextExpectedAt: today,
    autoPromoteEnabled: true,
    provider: 'seed_script',
    providerAgreementId: `seed_agreement_${runId}`,
    providerPaymentMethodId: `seed_pm_${runId}`,
    providerContext: {
      seeded: true,
      runId,
    },
    source: 'seed-test-fixtures',
  };

  try {
    const response = await recurringAgreementService.createAgreement(payload);
    const agreementId = extractFirstId(response);
    if (agreementId) {
      console.log(`Recurring agreement created with id ${agreementId}`);
    }
    return agreementId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Unable to create recurring agreement via Twenty API (${message}). Continuing without linkage.`,
    );
    return undefined;
  }
}

function extractFirstId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if (typeof (payload as Record<string, unknown>).id === 'string') {
    return (payload as Record<string, unknown>).id as string;
  }

  for (const value of Object.values(payload)) {
    if (typeof value === 'string' && value.startsWith('ra_')) {
      return value;
    }
    const nested =
      typeof value === 'object' && value !== null ? extractFirstId(value as Record<string, unknown>) : undefined;
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

async function ensureTestOpportunity(
  twentyApiService: TwentyApiService,
  runId: string,
): Promise<{ companyId?: string; companyName?: string; opportunityId?: string }> {
  let companyId: string | undefined;
  let companyName: string | undefined;
  const companyPayload = {
    name: `Seeded Org ${runId}`,
    domainName: {
      primaryLinkUrl: `https://seeded-org-${runId}.example.org`,
    },
  };

  try {
    const response = await twentyApiService.request(
      'POST',
      '/companies',
      companyPayload,
      'SeedTestFixtures',
    );
    companyId = extractFirstId(response);
    companyName = companyPayload.name;
    if (companyId) {
      console.log(`Created seeded company with id ${companyId}`);
    }
  } catch (error) {
    console.warn(
      `Unable to create company via Twenty API: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let opportunityId: string | undefined;
  if (companyId) {
    const opportunityPayload = {
      name: `Seeded Grant ${runId}`,
      stage: 'NEW',
      companyId,
      opportunityType: 'Grant',
      amount: {
        amountMicros: 500000000,
        currencyCode: 'GBP',
      },
    };

    try {
      const response = await twentyApiService.request(
        'POST',
        '/opportunities',
        opportunityPayload,
        'SeedTestFixtures',
      );
      opportunityId = extractFirstId(response);
      if (opportunityId) {
        console.log(`Created seeded opportunity with id ${opportunityId}`);
      }
    } catch (error) {
      console.warn(
        `Unable to create opportunity via Twenty API: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { companyId, companyName, opportunityId };
}

main().catch((error) => {
  console.error('\nSeed script failed:', error);
  process.exitCode = 1;
});
