import { GiftStagingListItem } from '../../api';
import { StagingStatusTone } from './queueStatusTone';
import {
  getIdentityConfidenceLabel,
  getProcessingDiagnosticsDisplay,
} from './processingDiagnosticsUtils';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export const HIGH_VALUE_THRESHOLD = 100000;

const intentLabels: Record<string, string> = {
  grant: 'Grant',
  legacy: 'Legacy',
  corporateInKind: 'Corporate',
  standard: 'Standard',
};

export type QueueRow = GiftStagingListItem & {
  formattedDate: string;
  formattedAmount: string;
  donorSummary: string;
  dedupeStatusMeta: { label: string; tone: 'info' | 'success' | 'warning' };
  statusMeta: { label: string; tone: StagingStatusTone };
  eligibilityMeta: { label: string; tone: StagingStatusTone };
  expectedAtDisplay: string;
  hasRecurringMetadata: boolean;
  hasGiftDuplicate: boolean;
  alertFlags: string[];
  isHighValue: boolean;
  intentLabel?: string;
  hasBlockers: boolean;
  blockerLabels: string[];
  warningLabels: string[];
  identityConfidenceLabel?: string | null;
  isLowIdentityConfidence: boolean;
  receiptMeta?: {
    label: string;
    tone: 'info' | 'success' | 'warning' | 'danger';
    policy?: string;
  };
};

export function mapQueueRows(items: GiftStagingListItem[]): QueueRow[] {
  return items.map((item) => {
    const diagnostics = getProcessingDiagnosticsDisplay(
      item.processingDiagnostics,
    );
    const identityConfidenceLabel = getIdentityConfidenceLabel(
      diagnostics.identityConfidence,
    );
    return {
      ...item,
      formattedDate: formatDate(item.updatedAt ?? item.createdAt),
      formattedAmount: formatAmount(item),
      donorSummary: resolveDonor(item),
      dedupeStatusMeta: formatDedupeStatus(item.dedupeStatus),
      statusMeta: getProcessingStatusMeta(item),
      eligibilityMeta: getEligibilityMeta(item, diagnostics),
      expectedAtDisplay: item.expectedAt ? formatDate(item.expectedAt) : '—',
      hasRecurringMetadata: Boolean(
        item.provider || item.providerPaymentId || item.recurringAgreementId || item.expectedAt,
      ),
      hasGiftDuplicate:
        typeof item.errorDetail === 'string' &&
        item.errorDetail.toLowerCase().includes('duplicate'),
      alertFlags: getAlertFlags(item, diagnostics),
      isHighValue: isHighValueAmount(item),
      intentLabel: getIntentLabel(item.giftIntent),
      hasBlockers: diagnostics.hasBlockers || !diagnostics.hasDiagnostics,
      blockerLabels: diagnostics.blockers,
      warningLabels: diagnostics.warnings,
      identityConfidenceLabel,
      isLowIdentityConfidence: diagnostics.isLowIdentityConfidence,
      receiptMeta: formatReceiptStatus(item),
    };
  });
}

function getProcessingStatusMeta(
  item: GiftStagingListItem,
): { label: string; tone: StagingStatusTone } {
  const processingStatus = item.processingStatus ?? 'pending';
  const validationStatus = item.validationStatus ?? 'pending';
  const dedupeStatus = item.dedupeStatus ?? 'pending';

  if (processingStatus === 'process_failed') {
    return { label: 'Process failed', tone: 'danger' };
  }

  if (processingStatus === 'processed') {
    return { label: 'Processed', tone: 'success' };
  }

  if (processingStatus === 'ready_for_process') {
    return { label: 'Ready to process', tone: 'info' };
  }

  const needsValidation = validationStatus !== 'passed';
  const needsDedupeReview = dedupeStatus === 'needs_review';

  if (needsValidation || needsDedupeReview) {
    return { label: 'Needs review', tone: 'warning' };
  }

  return { label: 'Pending', tone: 'info' };
}

function getEligibilityMeta(
  item: GiftStagingListItem,
  diagnostics: ReturnType<typeof getProcessingDiagnosticsDisplay>,
): { label: string; tone: StagingStatusTone } {
  const processingStatus = item.processingStatus ?? 'pending';

  if (processingStatus === 'process_failed') {
    return { label: 'Process failed', tone: 'danger' };
  }

  if (processingStatus === 'processed') {
    return { label: 'Processed', tone: 'success' };
  }

  if (!diagnostics.hasDiagnostics || diagnostics.hasBlockers) {
    return { label: 'Needs attention', tone: 'warning' };
  }

  return { label: 'Eligible now', tone: 'success' };
}

function getAlertFlags(
  item: GiftStagingListItem,
  diagnostics: ReturnType<typeof getProcessingDiagnosticsDisplay>,
): string[] {
  const alerts = new Set<string>();
  if ((item.dedupeStatus ?? '') === 'needs_review') {
    alerts.add('Possible duplicate');
  }
  if (!item.donorId) {
    alerts.add('Donor unresolved');
  }
  if (diagnostics.isLowIdentityConfidence) {
    alerts.add('Low identity confidence');
  }
  if (typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate')) {
    alerts.add('Duplicate warning');
  }
  if (item.recurringAgreementId) {
    alerts.add('Recurring');
  }
  if (isHighValueAmount(item)) {
    alerts.add('High value');
  }
  if (item.receiptWarnings && item.receiptWarnings.length > 0) {
    for (const warning of item.receiptWarnings) {
      alerts.add(warning);
    }
  }
  if (item.receiptStatus === 'suppressed') {
    alerts.add('Receipt suppressed');
  }
  return Array.from(alerts);
}

function getIntentLabel(intent?: string): string | undefined {
  if (!intent) {
    return undefined;
  }
  return intentLabels[intent] ?? intent;
}

export function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

function formatAmount(item: GiftStagingListItem): string {
  if (typeof item.amountMicros !== 'number') {
    return '—';
  }
  const currency = item.currencyCode ?? 'GBP';
  const formatter =
    currencyFormatters.get(currency) ??
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(currency, formatter);
  }

  const amountMajor = item.amountMicros / 1_000_000;
  return formatter.format(amountMajor);
}

function isHighValueAmount(item: GiftStagingListItem): boolean {
  if (typeof item.amountMicros !== 'number') {
    return false;
  }
  const amountMinor = Math.round(item.amountMicros / 10_000);
  return amountMinor >= HIGH_VALUE_THRESHOLD;
}

function resolveDonor(item: GiftStagingListItem): string {
  const fullName = [item.donorFirstName, item.donorLastName]
    .filter((part) => part && part.trim().length > 0)
    .join(' ')
    .trim();
  const email = item.donorEmail?.trim();

  const segments: string[] = [];

  if (fullName.length > 0) {
    segments.push(fullName);
  }

  if (email && email.length > 0) {
    segments.push(`<${email}>`);
  }

  if (item.donorId) {
    if (segments.length > 0) {
      segments.push(`ID ${item.donorId}`);
    } else {
      segments.push(`Linked donor (${item.donorId})`);
    }
  }

  if (segments.length === 0) {
    return 'Pending donor resolution';
  }

  return segments.join(' · ');
}

export type DuplicateStatusMeta = { label: string; tone: 'info' | 'success' | 'warning' };

export function formatDedupeStatus(status?: string): DuplicateStatusMeta {
  switch (status) {
    case 'matched_existing':
      return { label: 'Auto-matched', tone: 'success' };
    case 'needs_review':
      return { label: 'Needs review', tone: 'warning' };
    default:
      return { label: status ?? '—', tone: 'info' };
  }
}

function formatReceiptStatus(
  item: GiftStagingListItem,
): { label: string; tone: 'info' | 'success' | 'warning' | 'danger'; policy?: string } | undefined {
  const status = (item.receiptStatus ?? '').toLowerCase();

  switch (status) {
    case 'sent':
      return { label: 'Receipt sent', tone: 'success', policy: item.receiptPolicyApplied };
    case 'pending':
      return { label: 'Receipt pending', tone: 'info', policy: item.receiptPolicyApplied };
    case 'failed':
      return { label: 'Receipt failed', tone: 'danger', policy: item.receiptPolicyApplied };
    case 'suppressed':
      return { label: 'Receipt suppressed', tone: 'warning', policy: item.receiptPolicyApplied };
    default:
      return undefined;
  }
}
