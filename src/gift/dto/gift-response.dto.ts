export class GiftResponseDto {
  id: string;
  contactId: string;
  campaignId?: string | null;
  amount: {
    currencyCode: string;
    value: string;
  };
  date: string;
  createdAt: string;
  updatedAt: string;
}
