export interface CreateGiftDto {
  contactId: string;
  campaignId?: string;
  amountCurrencyCode: string;
  amountValue: string;
  date: string;
}
