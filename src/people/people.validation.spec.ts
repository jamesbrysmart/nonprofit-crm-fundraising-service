import { BadRequestException } from '@nestjs/common';
import {
  ensurePeopleDuplicatesResponse,
  validatePeopleDuplicateLookupPayload,
} from './people.validation';

describe('people.validation', () => {
  describe('validatePeopleDuplicateLookupPayload', () => {
    it('sanitizes and returns valid payload', () => {
      const result = validatePeopleDuplicateLookupPayload({
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        email: ' ada@example.org ',
        depth: 2,
      });

      expect(result).toEqual({
        candidate: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.org',
        },
        depth: 2,
      });
    });

    it('defaults depth when not provided', () => {
      const result = validatePeopleDuplicateLookupPayload({
        firstName: 'Alan',
        lastName: 'Turing',
      });

      expect(result).toEqual({
        candidate: {
          firstName: 'Alan',
          lastName: 'Turing',
        },
        depth: undefined,
      });
    });

    it('rejects missing names', () => {
      expect(() =>
        validatePeopleDuplicateLookupPayload({ firstName: 'A', lastName: '' }),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid depth', () => {
      expect(() =>
        validatePeopleDuplicateLookupPayload({
          firstName: 'Grace',
          lastName: 'Hopper',
          depth: 3,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('ensurePeopleDuplicatesResponse', () => {
    it('accepts valid response structure', () => {
      expect(() =>
        ensurePeopleDuplicatesResponse({
          data: [
            {
              personDuplicates: [],
            },
          ],
        }),
      ).not.toThrow();
    });

    it('rejects missing data array', () => {
      expect(() => ensurePeopleDuplicatesResponse({})).toThrow(
        BadRequestException,
      );
    });
  });
});
