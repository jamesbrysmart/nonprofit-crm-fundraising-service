import { BadRequestException } from '@nestjs/common';
import {
  ensureCreateGiftResponse,
  validateCreateGiftPayload,
} from './gift.validation';

describe('gift.validation', () => {
  describe('validateCreateGiftPayload', () => {
    it('accepts minimal payload with contact', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'GBP', value: 10 },
        contact: { firstName: 'Ada', lastName: 'Lovelace' },
      });

      expect(result.amount).toEqual({ currencyCode: 'GBP', value: 10 });
      expect(result.contact).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('retains optional email on contact', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'USD', value: 25 },
        contact: { firstName: 'Alan', lastName: 'Turing', email: 'alan@example.org ' },
      });

      expect(result.contact).toEqual({
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.org',
      });
    });

    it('throws when contact fields are missing', () => {
      expect(() =>
        validateCreateGiftPayload({ amount: { currencyCode: 'GBP', value: 10 }, contact: {} }),
      ).toThrow(BadRequestException);
    });

    it('throws when email is present but empty', () => {
      expect(() =>
        validateCreateGiftPayload({
          amount: { currencyCode: 'USD', value: 30 },
          contact: { firstName: 'Mary', lastName: 'Seacole', email: ' ' },
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('ensureCreateGiftResponse', () => {
    it('accepts a valid response', () => {
      expect(() =>
        ensureCreateGiftResponse({ data: { createGift: { id: '123' } } }),
      ).not.toThrow();
    });

    it('rejects missing id', () => {
      expect(() =>
        ensureCreateGiftResponse({ data: { createGift: {} } }),
      ).toThrow(BadRequestException);
    });
  });
});
