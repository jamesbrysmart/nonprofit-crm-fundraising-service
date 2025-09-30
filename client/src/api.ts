export interface GiftCreateResponse {
  data?: {
    createGift?: {
      id?: string;
      name?: string;
      amount?: {
        currencyCode?: string;
        value?: number;
      };
    };
  };
}

export interface GiftCreatePayload {
  amount: {
    currencyCode: string;
    value: number;
  };
  giftDate?: string;
  name?: string;
  contact?: {
    firstName: string;
    lastName: string;
    email?: string;
  };
  contactId?: string;
}

export async function createGift(payload: GiftCreatePayload): Promise<GiftCreateResponse> {
  const response = await fetch('/api/fundraising/gifts', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as GiftCreateResponse;
}

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
  const response = await fetch('/api/fundraising/people/duplicates', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const json = (await response.json()) as PeopleDuplicatesResponse;
  const duplicates: PersonDuplicate[] = [];

  for (const entry of json.data ?? []) {
    if (entry?.personDuplicates) {
      duplicates.push(...entry.personDuplicates.filter(Boolean));
    }
  }

  return duplicates;
}
