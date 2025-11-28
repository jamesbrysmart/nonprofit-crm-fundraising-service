import { fetchJson } from '../api-shared/http';

export interface PersonRecord {
  id: string;
  name?: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  } | null;
  emails?: {
    primaryEmail?: string | null;
  } | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export async function fetchPersonById(personId: string): Promise<PersonRecord | null> {
  if (!personId || personId.trim().length === 0) {
    return null;
  }
  try {
    const response = await fetchJson<{ data?: { person?: PersonRecord } }>(
      `/api/fundraising/people/${encodeURIComponent(personId)}`,
    );
    return response.data?.person ?? null;
  } catch (error) {
    // Surface no result on failure; caller can decide how to handle missing details.
    return null;
  }
}
