import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AmountDto {
  @IsNumber()
  amountMicros!: number;

  @IsString()
  currencyCode!: string;
}

export class CreateGiftStagingDto {
  @IsOptional()
  @IsString()
  promotionStatus?: string;

  @IsOptional()
  @IsString()
  validationStatus?: string;

  @IsOptional()
  @IsString()
  dedupeStatus?: string;

  @ValidateNested()
  @Type(() => AmountDto)
  amount!: AmountDto;

  @IsOptional()
  @IsNumber()
  amountMinor?: number;

  @IsOptional()
  @IsNumber()
  feeAmountMinor?: number;

  @IsOptional()
  @IsNumber()
  amountMajor?: number;

  @IsOptional()
  @IsString()
  intakeSource?: string;

  @IsOptional()
  @IsString()
  sourceFingerprint?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  dateReceived?: string;

  @IsOptional()
  @IsString()
  expectedAt?: string;

  @IsOptional()
  @IsBoolean()
  giftAidEligible?: boolean;

  @IsOptional()
  @IsString()
  fundId?: string;

  @IsOptional()
  @IsString()
  appealId?: string;

  @IsOptional()
  @IsString()
  appealSegmentId?: string;

  @IsOptional()
  @IsString()
  trackingCodeId?: string;

  @IsOptional()
  @IsString()
  donorId?: string;

  @IsOptional()
  @IsString()
  donorFirstName?: string;

  @IsOptional()
  @IsString()
  donorLastName?: string;

  @IsOptional()
  @IsString()
  donorEmail?: string;

  @IsOptional()
  @IsString()
  giftBatchId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerPaymentId?: string;

  @IsOptional()
  providerContext?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  recurringAgreementId?: string;

  @IsOptional()
  @IsString()
  giftPayoutId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsOptional()
  @IsString()
  giftIntent?: string;

  @IsOptional()
  @IsBoolean()
  isInKind?: boolean;

  @IsOptional()
  @IsString()
  inKindDescription?: string;

  @IsOptional()
  @IsNumber()
  estimatedValue?: number;

  @IsOptional()
  @IsBoolean()
  autoPromote?: boolean;
}
