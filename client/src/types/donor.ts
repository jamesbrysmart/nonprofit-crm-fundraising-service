export type DonorType = 'person' | 'company';

export interface DonorDisplay {
  id: string;
  displayName: string;
  email?: string | null;
  type: DonorType;
  updatedAt?: string | null;
  createdAt?: string | null;
  tier?: 'exact' | 'review' | 'partial';
}
