import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'amountMinor']);
const SORT_DIRECTIONS = new Set(['asc', 'desc']);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : undefined;

  if (!source) {
    return undefined;
  }

  const normalized = source
    .map((entry) => toTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length > 0 ? normalized : undefined;
};

const toLimit = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : undefined;

  if (num === undefined || Number.isNaN(num) || !Number.isFinite(num)) {
    return undefined;
  }

  const clamped = Math.max(1, Math.min(100, Math.floor(num)));
  return clamped;
};

const toSort = (value: unknown): string | undefined => {
  const raw = toTrimmedString(value);
  if (!raw) {
    return undefined;
  }

  const [field, direction] = raw.split(':');
  const safeField = SORT_FIELDS.has(field) ? field : 'createdAt';
  const safeDirection = SORT_DIRECTIONS.has(direction) ? direction : 'desc';

  return `${safeField}:${safeDirection}`;
};

export class GiftStagingListQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  statuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toStringArray(value))
  intakeSources?: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  search?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => toLimit(value))
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => toSort(value))
  sort?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => toTrimmedString(value))
  recurringAgreementId?: string;
}
