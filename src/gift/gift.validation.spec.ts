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
      expect(result.amountMinor).toBe(1000);
      expect(result.currency).toBe('GBP');
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
      expect(result.currency).toBe('USD');
      expect(result.amountMinor).toBe(2500);
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

    it('retains appealId when provided directly', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'GBP', value: 5 },
        contact: { firstName: 'Edsger', lastName: 'Dijkstra' },
        appealId: 'apl-456',
      });

      expect(result.appealId).toBe('apl-456');
    });

    it('preserves provided amountMinor/currency when supplied', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'GBP', value: 12.34 },
        amountMinor: 1235,
        currency: 'GBP',
        contact: { firstName: 'Grace', lastName: 'Hopper' },
      });

      expect(result.amountMinor).toBe(1235);
      expect(result.currency).toBe('GBP');
    });

    it('allows intake metadata fields', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'USD', value: 1 },
        contact: { firstName: 'Pat', lastName: 'Lee' },
        intakeSource: 'portal',
        sourceFingerprint: 'fingerprint-123',
        autoPromote: false,
      });

      expect(result.intakeSource).toBe('portal');
      expect(result.sourceFingerprint).toBe('fingerprint-123');
      expect(result.autoPromote).toBe(false);
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
