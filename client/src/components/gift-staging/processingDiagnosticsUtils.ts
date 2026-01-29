import type { ProcessingDiagnostics } from '../../api';

const BLOCKER_LABELS: Record<string, string> = {
  identity_missing: 'Donor unresolved',
  company_missing_for_org_intent: 'Company required',
  recurring_agreement_missing: 'Recurring agreement missing',
  gift_date_missing: 'Gift date missing',
};

const WARNING_LABELS: Record<string, string> = {
  identity_low_confidence: 'Low identity confidence',
  appeal_missing: 'Appeal missing',
  fund_missing: 'Fund missing',
  opportunity_missing: 'Opportunity missing',
  payout_missing: 'Payout missing',
  payment_method_missing: 'Payment method missing',
};

const humanizeCode = (value: string): string => value.replace(/_/g, ' ');

const mapCodes = (
  values: unknown,
  labelMap: Record<string, string>,
): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .map((code) => labelMap[code] ?? humanizeCode(code));
};

export type DiagnosticsDisplay = {
  blockers: string[];
  warnings: string[];
  identityConfidence?: ProcessingDiagnostics['identityConfidence'];
  hasBlockers: boolean;
  hasWarnings: boolean;
  hasDiagnostics: boolean;
  isLowIdentityConfidence: boolean;
};

export function getProcessingDiagnosticsDisplay(
  diagnostics?: ProcessingDiagnostics | null,
): DiagnosticsDisplay {
  if (!diagnostics) {
    return {
      blockers: [],
      warnings: [],
      identityConfidence: undefined,
      hasBlockers: false,
      hasWarnings: false,
      hasDiagnostics: false,
      isLowIdentityConfidence: false,
    };
  }

  const blockers = mapCodes(diagnostics.processingBlockers, BLOCKER_LABELS);
  const warnings = mapCodes(diagnostics.processingWarnings, WARNING_LABELS);
  const identityConfidence = diagnostics.identityConfidence;
  const hasBlockers =
    blockers.length > 0 || diagnostics.processingEligibility === 'blocked';
  const hasWarnings = warnings.length > 0;
  const isLowIdentityConfidence =
    identityConfidence === 'weak' || identityConfidence === 'none';

  return {
    blockers,
    warnings,
    identityConfidence,
    hasBlockers,
    hasWarnings,
    hasDiagnostics: true,
    isLowIdentityConfidence,
  };
}

export function getIdentityConfidenceLabel(
  confidence?: ProcessingDiagnostics['identityConfidence'],
): string | null {
  if (!confidence) {
    return null;
  }
  switch (confidence) {
    case 'explicit':
      return 'Identity: explicit';
    case 'strong':
      return 'Identity: strong';
    case 'weak':
      return 'Identity: weak';
    case 'none':
      return 'Identity: unresolved';
    default:
      return `Identity: ${confidence}`;
  }
}

export function getTrustPostureLabel(intakeSource?: string): string {
  const normalized =
    typeof intakeSource === 'string' && intakeSource.trim().length > 0
      ? intakeSource.trim().toLowerCase()
      : 'manual_ui';
  if (normalized === 'manual_ui') {
    return 'High trust';
  }
  if (normalized === 'csv_import') {
    return 'Low trust';
  }
  return 'Medium trust';
}
