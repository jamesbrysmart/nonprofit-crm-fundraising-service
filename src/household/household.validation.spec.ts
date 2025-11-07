import { BadRequestException } from '@nestjs/common';
import {
  validateAssignHouseholdMemberPayload,
  validateCopyAddressPayload,
  validateCreateHouseholdPayload,
  validateUpdateHouseholdPayload,
} from './household.validation';

describe('Household validation', () => {
  describe('validateCreateHouseholdPayload', () => {
    it('requires name and trims values', () => {
      const payload = validateCreateHouseholdPayload({
        name: '  Smith Household  ',
        primaryContactId: '  person-123 ',
        envelopeName: '  The Smiths ',
        salutationFormal: '  Mr & Mrs Smith ',
        salutationInformal: '  John & Jane ',
        mailingAddress: {
          line1: ' 10 High Street ',
          postalCode: ' SW1A 1AA ',
        },
      });

      expect(payload).toEqual({
        name: 'Smith Household',
        primaryContactId: 'person-123',
        envelopeName: 'The Smiths',
        salutationFormal: 'Mr & Mrs Smith',
        salutationInformal: 'John & Jane',
        mailingAddress: {
          line1: '10 High Street',
          postalCode: 'SW1A 1AA',
        },
      });
    });

    it('throws when name missing', () => {
      expect(() => validateCreateHouseholdPayload({})).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateUpdateHouseholdPayload', () => {
    it('rejects empty payload', () => {
      expect(() => validateUpdateHouseholdPayload({})).toThrow(
        BadRequestException,
      );
    });

    it('allows clearing fields', () => {
      const payload = validateUpdateHouseholdPayload({
        envelopeName: null,
        salutationInformal: '  Friends ',
        mailingAddress: null,
      });

      expect(payload).toEqual({
        envelopeName: null,
        salutationInformal: 'Friends',
        mailingAddress: null,
      });
    });
  });

  describe('validateAssignHouseholdMemberPayload', () => {
    it('normalizes contact id', () => {
      const payload = validateAssignHouseholdMemberPayload({
        contactId: ' person-456 ',
        makePrimary: true,
      });

      expect(payload).toEqual({
        contactId: 'person-456',
        makePrimary: true,
      });
    });

    it('throws when contact id missing', () => {
      expect(() =>
        validateAssignHouseholdMemberPayload({
          makePrimary: false,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateCopyAddressPayload', () => {
    it('requires non-empty address or null', () => {
      const payload = validateCopyAddressPayload({
        contactId: ' abc ',
        mailingAddress: {
          line1: ' 22 Test Road ',
          city: ' Testville ',
        },
      });

      expect(payload).toEqual({
        contactId: 'abc',
        mailingAddress: {
          line1: '22 Test Road',
          city: 'Testville',
        },
      });
    });

    it('allows clearing address by passing null', () => {
      const payload = validateCopyAddressPayload({
        contactId: 'abc',
        mailingAddress: null,
      });
      expect(payload).toEqual({
        contactId: 'abc',
        mailingAddress: null,
      });
    });

    it('throws for empty address object', () => {
      expect(() =>
        validateCopyAddressPayload({
          contactId: 'abc',
          mailingAddress: {},
        }),
      ).toThrow(BadRequestException);
    });
  });
});
