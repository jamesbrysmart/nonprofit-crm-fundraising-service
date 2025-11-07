import { BadRequestException } from '@nestjs/common';

const MIN_NAME_LENGTH = 2;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface PersonDuplicateCandidate {
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string;
}

export interface PeopleDuplicateLookupPayload {
  readonly candidate: PersonDuplicateCandidate;
  readonly depth?: number;
}

export const validatePeopleDuplicateLookupPayload = (
  body: unknown,
): PeopleDuplicateLookupPayload => {
  if (!isPlainObject(body)) {
    throw new BadRequestException('payload must be an object');
  }

  const { firstName, lastName, email, depth } = body;

  if (
    typeof firstName !== 'string' ||
    firstName.trim().length < MIN_NAME_LENGTH
  ) {
    throw new BadRequestException(
      `firstName must be a string with at least ${MIN_NAME_LENGTH} characters`,
    );
  }

  if (
    typeof lastName !== 'string' ||
    lastName.trim().length < MIN_NAME_LENGTH
  ) {
    throw new BadRequestException(
      `lastName must be a string with at least ${MIN_NAME_LENGTH} characters`,
    );
  }

  let normalizedEmail: string | undefined;
  if (email !== undefined) {
    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new BadRequestException(
        'email, if provided, must be a non-empty string',
      );
    }
    normalizedEmail = email.trim();
  }

  let normalizedDepth: number | undefined;
  if (depth !== undefined) {
    if (typeof depth !== 'number' || !Number.isInteger(depth)) {
      throw new BadRequestException('depth must be an integer if provided');
    }

    if (depth < 0 || depth > 2) {
      throw new BadRequestException('depth must be between 0 and 2');
    }

    normalizedDepth = depth;
  }

  return {
    candidate: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
    },
    depth: normalizedDepth,
  };
};

export const ensurePeopleDuplicatesResponse = (body: unknown): void => {
  if (!isPlainObject(body)) {
    throw new BadRequestException('unexpected Twenty response (missing data)');
  }

  const data = body.data;
  if (!Array.isArray(data)) {
    throw new BadRequestException(
      'unexpected Twenty response (missing data array)',
    );
  }

  for (const entry of data) {
    if (!isPlainObject(entry)) {
      throw new BadRequestException(
        'unexpected Twenty response (invalid entry)',
      );
    }

    const duplicates = entry.personDuplicates;
    if (!Array.isArray(duplicates)) {
      throw new BadRequestException(
        'unexpected Twenty response (missing personDuplicates array)',
      );
    }
  }
};
