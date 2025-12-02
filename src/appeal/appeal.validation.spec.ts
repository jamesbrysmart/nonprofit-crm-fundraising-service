import { BadRequestException } from '@nestjs/common';
import {
  validateCreateAppealPayload,
  validateUpdateAppealPayload,
  validateCreateSolicitationSnapshotPayload,
} from './appeal.validation';

describe('appeal.validation', () => {
  describe('validateCreateAppealPayload', () => {
    it('requires a non-empty name', () => {
      expect(() => validateCreateAppealPayload({})).toThrow(
        BadRequestException,
      );

      expect(() => validateCreateAppealPayload({ name: '   ' })).toThrow(
        BadRequestException,
      );

      expect(() => validateCreateAppealPayload({ name: 42 })).toThrow(
        BadRequestException,
      );
    });

    it('normalises optional fields and currency amounts', () => {
      const payload = validateCreateAppealPayload({
        name: ' Spring Appeal ',
        appealType: ' email ',
        startDate: '2026-03-15',
        endDate: '2026-04-15',
        goalAmount: { amountMicros: 25_000_000_000, currencyCode: 'gbp' },
        targetSolicitedCount: '5000',
      });

      expect(payload).toMatchObject({
        name: 'Spring Appeal',
        appealType: 'email',
        startDate: '2026-03-15',
        endDate: '2026-04-15',
        targetSolicitedCount: 5000,
        goalAmount: { amountMicros: 25_000_000_000, currencyCode: 'GBP' },
      });
    });
  });

  describe('validateUpdateAppealPayload', () => {
    it('requires at least one updatable field', () => {
      expect(() => validateUpdateAppealPayload({})).toThrow(
        BadRequestException,
      );
    });

    it('accepts partial updates', () => {
      const payload = validateUpdateAppealPayload({
        description: 'Updated copy',
        budgetAmount: { amountMicros: 1_250_000_000, currencyCode: 'GBP' },
      });

      expect(payload).toEqual({
        description: 'Updated copy',
        budgetAmount: { amountMicros: 1_250_000_000, currencyCode: 'GBP' },
      });
    });
  });

  describe('validateCreateSolicitationSnapshotPayload', () => {
    it('normalises counts and timestamps', () => {
      const payload = validateCreateSolicitationSnapshotPayload({
        countSolicited: '2500',
        source: 'Mailchimp Audience 2026-03-15',
      });

      expect(payload.countSolicited).toBe(2500);
      expect(payload.source).toBe('Mailchimp Audience 2026-03-15');
      expect(payload.capturedAt).toEqual(expect.any(String));
      expect(new Date(payload.capturedAt).toString()).not.toBe('Invalid Date');
    });

    it('rejects invalid counts', () => {
      expect(() =>
        validateCreateSolicitationSnapshotPayload({ countSolicited: 0 }),
      ).toThrow(BadRequestException);
    });
  });
});
