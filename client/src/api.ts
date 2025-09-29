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
  };
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
