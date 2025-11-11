export type GiftIntentOption = 'standard' | 'grant' | 'legacy' | 'corporateInKind';

export const GIFT_INTENT_OPTIONS: Array<{ value: GiftIntentOption; label: string }> = [
  { value: 'standard', label: 'Standard gift' },
  { value: 'grant', label: 'Grant installment' },
  { value: 'legacy', label: 'Legacy / Bequest' },
  { value: 'corporateInKind', label: 'Corporate / In-kind' },
];

const GIFT_INTENT_LABELS: Record<GiftIntentOption, string> = {
  standard: 'Standard',
  grant: 'Grant',
  legacy: 'Legacy',
  corporateInKind: 'Corporate',
};

export function getGiftIntentLabel(intent?: string | null): string | undefined {
  if (!intent) {
    return undefined;
  }
  return GIFT_INTENT_LABELS[intent as GiftIntentOption] ?? intent;
}
