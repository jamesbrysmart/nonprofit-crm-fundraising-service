import { BadRequestException } from '@nestjs/common';
import {
  ensureCreateGiftResponse,
  validateCreateGiftPayload,
} from './gift.validation';

describe('gift.validation', () => {
  describe('validateCreateGiftPayload', () => {
    it('accepts minimal payload with contact', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'GBP', amountMicros: 10_000_000 },
        contact: { firstName: 'Ada', lastName: 'Lovelace' },
      });

      expect(result.amount).toEqual({
        currencyCode: 'GBP',
        amountMicros: 10_000_000,
      });
      expect(result.contact).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
    });

    it('retains optional email on contact', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'USD', amountMicros: 25_000_000 },
        contact: {
          firstName: 'Alan',
          lastName: 'Turing',
          email: 'alan@example.org ',
        },
      });

      expect(result.contact).toEqual({
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.org',
      });
    });

    it('throws when contact fields are missing', () => {
      expect(() =>
        validateCreateGiftPayload({
          amount: { currencyCode: 'GBP', amountMicros: 10_000_000 },
          contact: {},
        }),
      ).toThrow(BadRequestException);
    });

    it('throws when email is present but empty', () => {
      expect(() =>
        validateCreateGiftPayload({
          amount: { currencyCode: 'USD', amountMicros: 30_000_000 },
          contact: { firstName: 'Mary', lastName: 'Seacole', email: ' ' },
        }),
      ).toThrow(BadRequestException);
    });

    it('retains appealId when provided directly', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'GBP', amountMicros: 5_000_000 },
        contact: { firstName: 'Edsger', lastName: 'Dijkstra' },
        appealId: 'apl-456',
      });

      expect(result.appealId).toBe('apl-456');
    });

    it('allows intake metadata fields', () => {
      const result = validateCreateGiftPayload({
        amount: { currencyCode: 'USD', amountMicros: 1_000_000 },
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
