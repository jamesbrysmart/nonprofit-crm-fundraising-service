import type { GiftStagingRecordModel } from '../gift-staging.service';

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const extractReceiptMeta = (
  entity: GiftStagingRecordModel,
):
  | {
      receiptStatus?: string;
      receiptPolicyApplied?: string;
      receiptChannel?: string;
      receiptTemplateVersion?: string;
      receiptError?: string;
      receiptDedupeKey?: string;
      receiptSentAt?: string;
      receiptWarnings?: string[];
    }
  | undefined => {
  const raw = entity.rawPayload;
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }

  let parsed: Record<string, unknown> | undefined;
  try {
    const maybe: unknown = JSON.parse(raw);
    parsed =
      maybe && typeof maybe === 'object' && !Array.isArray(maybe)
        ? (maybe as Record<string, unknown>)
        : undefined;
  } catch {
    return undefined;
  }

  if (!parsed) {
    return undefined;
  }

  const normalize = (value: unknown): string | undefined =>
    toTrimmedString(value);

  const receiptStatus = normalize(parsed.receiptStatus);
  const receiptPolicyApplied = normalize(parsed.receiptPolicyApplied);
  const receiptChannel = normalize(parsed.receiptChannel);
  const receiptTemplateVersion = normalize(parsed.receiptTemplateVersion);
  const receiptError = normalize(parsed.receiptError);
  const receiptDedupeKey = normalize(parsed.receiptDedupeKey);
  const receiptSentAt = normalize(parsed.receiptSentAt);

  const warnings: string[] = [];
  if ((receiptChannel ?? 'email') === 'email') {
    const donorEmail =
      normalize(entity.donorEmail) ?? normalize(parsed.donorEmail);
    if (!donorEmail && receiptStatus !== 'suppressed') {
      warnings.push('Missing email for receipt');
    }
    const donorFirst =
      normalize(entity.donorFirstName) ?? normalize(parsed.donorFirstName);
    const donorLast =
      normalize(entity.donorLastName) ?? normalize(parsed.donorLastName);
    if (!donorFirst || !donorLast) {
      warnings.push('Missing donor name');
    }
  }
  if (receiptStatus === 'suppressed') {
    warnings.push('Receipt suppressed');
  }
  if (receiptStatus === 'failed') {
    warnings.push('Receipt failed');
  }

  return {
    receiptStatus,
    receiptPolicyApplied,
    receiptChannel,
    receiptTemplateVersion,
    receiptError,
    receiptDedupeKey,
    receiptSentAt,
    receiptWarnings: warnings.length > 0 ? warnings : undefined,
  };
};
