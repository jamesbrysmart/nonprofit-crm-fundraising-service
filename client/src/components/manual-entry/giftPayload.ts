import { GiftCreatePayload } from '../../api';
import type { GiftFormState } from '../ManualGiftEntry';

export function buildGiftPayload(state: GiftFormState, existingContactId?: string): GiftCreatePayload {
  const amountValue = Number.parseFloat(state.amountValue);
  if (Number.isNaN(amountValue)) {
    throw new Error('Amount must be numeric');
  }

  const contactFirstName = state.contactFirstName.trim();
  const contactLastName = state.contactLastName.trim();
  const contactEmail = state.contactEmail.trim();

  const payload: GiftCreatePayload = {
    amount: {
      currencyCode: state.currencyCode,
      value: amountValue,
    },
    giftDate: state.giftDate,
    name: state.giftName.trim() || undefined,
  };

  const appealId = state.appealId.trim();
  if (appealId.length > 0) {
    payload.appealId = appealId;
  }

  const intent = state.giftIntent;
  if (intent && intent !== 'standard') {
    payload.giftIntent = intent;
  }

  const trimmedOpportunityId = state.opportunityId.trim();
  if (trimmedOpportunityId.length > 0) {
    payload.opportunityId = trimmedOpportunityId;
  }

  if (state.isInKind || intent === 'corporateInKind') {
    payload.isInKind = state.isInKind || intent === 'corporateInKind';
    const description = state.inKindDescription.trim();
    if (description.length > 0) {
      payload.inKindDescription = description;
    }
    const estimatedValueInput = state.estimatedValue.trim();
    if (estimatedValueInput.length > 0) {
      const estimatedNumber = Number.parseFloat(estimatedValueInput);
      if (Number.isNaN(estimatedNumber)) {
        throw new Error('Estimated value must be numeric');
      }
      payload.estimatedValue = estimatedNumber;
    }
  }

  if (existingContactId) {
    return {
      ...payload,
      contactId: existingContactId,
    };
  }

  return {
    ...payload,
    contact: {
      firstName: contactFirstName,
      lastName: contactLastName,
      ...(contactEmail.length > 0 ? { email: contactEmail } : {}),
    },
  };
}
