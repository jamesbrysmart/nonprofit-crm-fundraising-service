import { fetchJson } from '../api-shared/http';

export interface DuplicateLookupRequest {
  firstName: string;
  lastName: string;
  email?: string;
  depth?: number;
}

export interface PersonDuplicate {
  id?: string;
  name?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
  emails?: {
    primaryEmail?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface PeopleDuplicatesResponse {
  data?: Array<{
    personDuplicates?: PersonDuplicate[];
  }>;
}

export async function findPersonDuplicates(
  payload: DuplicateLookupRequest,
): Promise<PersonDuplicate[]> {
  const json = await fetchJson<PeopleDuplicatesResponse>('/api/fundraising/people/duplicates', {
    method: 'POST',
    body: payload,
  });
  const duplicates: PersonDuplicate[] = [];

  for (const entry of json.data ?? []) {
    if (entry?.personDuplicates) {
      duplicates.push(...entry.personDuplicates.filter(Boolean));
    }
  }

  return duplicates;
}
