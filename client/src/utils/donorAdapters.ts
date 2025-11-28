import { PersonDuplicate } from '../api';
import { PersonRecord } from '../api/people';
import { DonorDisplay } from '../types/donor';

export function personDuplicateToDisplay(
  duplicate: PersonDuplicate,
  tier?: 'exact' | 'review' | 'partial',
): DonorDisplay {
  const fullName = duplicate.name?.fullName?.trim();
  const firstName = duplicate.name?.firstName?.trim();
  const lastName = duplicate.name?.lastName?.trim();
  const displayName = fullName || `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown donor';

  return {
    id: duplicate.id ?? 'unknown',
    displayName,
    email: duplicate.emails?.primaryEmail ?? null,
    type: 'person',
    updatedAt: duplicate.updatedAt ?? null,
    createdAt: duplicate.createdAt ?? null,
    tier,
  };
}

export function personRecordToDisplay(record: PersonRecord): DonorDisplay {
  const fullName = record.name?.fullName?.trim();
  const firstName = record.name?.firstName?.trim();
  const lastName = record.name?.lastName?.trim();
  const displayName = fullName || `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Unknown person';

  return {
    id: record.id,
    displayName,
    email: record.emails?.primaryEmail ?? null,
    updatedAt: record.updatedAt ?? null,
    createdAt: record.createdAt ?? null,
    type: 'person',
  };
}

export function fallbackCompanyDisplay(id: string): DonorDisplay {
  return {
    id,
    displayName: `Company/Entity (${id})`,
    type: 'company',
  };
}
