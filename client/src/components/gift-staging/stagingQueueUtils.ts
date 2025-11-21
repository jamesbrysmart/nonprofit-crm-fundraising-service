import { GiftStagingListItem } from '../../api';
import { StagingStatusTone } from './queueStatusTone';

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
  expectedAtDisplay: string;
  hasRecurringMetadata: boolean;
  hasGiftDuplicate: boolean;
  alertFlags: string[];
  isHighValue: boolean;
  intentLabel?: string;
  receiptMeta?: {
    label: string;
    tone: 'info' | 'success' | 'warning' | 'danger';
    policy?: string;
  };
};

export function mapQueueRows(items: GiftStagingListItem[]): QueueRow[] {
  return items.map((item) => ({
    ...item,
    formattedDate: formatDate(item.updatedAt ?? item.createdAt),
    formattedAmount: formatAmount(item),
    donorSummary: resolveDonor(item),
    dedupeStatusMeta: formatDedupeStatus(item.dedupeStatus),
    statusMeta: getProcessingStatusMeta(item),
    expectedAtDisplay: item.expectedAt ? formatDate(item.expectedAt) : '—',
    hasRecurringMetadata: Boolean(
      item.provider || item.providerPaymentId || item.recurringAgreementId || item.expectedAt,
    ),
    hasGiftDuplicate:
      typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate'),
    alertFlags: getAlertFlags(item),
    isHighValue: typeof item.amountMinor === 'number' && item.amountMinor >= HIGH_VALUE_THRESHOLD,
    intentLabel: getIntentLabel(item.giftIntent),
    receiptMeta: formatReceiptStatus(item),
  }));
}

function getProcessingStatusMeta(
  item: GiftStagingListItem,
): { label: string; tone: StagingStatusTone } {
  const promotionStatus = item.processingStatus ?? item.promotionStatus ?? 'pending';
  const validationStatus = item.validationStatus ?? 'pending';
  const dedupeStatus = item.dedupeStatus ?? 'pending';

  if (promotionStatus === 'commit_failed') {
    return { label: 'Commit failed', tone: 'danger' };
  }

  if (promotionStatus === 'committed') {
    return { label: 'Committed', tone: 'success' };
  }

  if (promotionStatus === 'ready_for_commit') {
    return { label: 'Ready to process', tone: 'info' };
  }

  const needsValidation = validationStatus !== 'passed';
  const needsDedupeReview = dedupeStatus === 'needs_review';

  if (needsValidation || needsDedupeReview) {
    return { label: 'Needs review', tone: 'warning' };
  }

  return { label: 'Pending', tone: 'info' };
}

function getAlertFlags(item: GiftStagingListItem): string[] {
  const alerts = new Set<string>();
  if ((item.dedupeStatus ?? '') === 'needs_review') {
    alerts.add('Possible duplicate');
  }
  if (!item.donorId) {
    alerts.add('Donor unresolved');
  }
  if (typeof item.errorDetail === 'string' && item.errorDetail.toLowerCase().includes('duplicate')) {
    alerts.add('Duplicate warning');
  }
  if (item.recurringAgreementId) {
    alerts.add('Recurring');
  }
  if (typeof item.amountMinor === 'number' && item.amountMinor >= HIGH_VALUE_THRESHOLD) {
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
  if (typeof item.amountMinor !== 'number') {
    return '—';
  }
  const currency = item.currency ?? 'GBP';
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

  const pounds = item.amountMinor / 100;
  return formatter.format(pounds);
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
