import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { NormalizedGiftCreatePayload } from '../gift/gift.types';

type ReceiptStatus = 'pending' | 'sent' | 'failed' | 'suppressed';

@Injectable()
export class ReceiptPolicyService {
  private readonly defaultOneOffPolicy: string;

  private readonly defaultRecurringPolicy: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.defaultOneOffPolicy = this.resolvePolicy(
      'FUNDRAISING_RECEIPT_POLICY_ONE_OFF',
      'per_gift',
    );
    this.defaultRecurringPolicy = this.resolvePolicy(
      'FUNDRAISING_RECEIPT_POLICY_RECURRING',
      'first_installment_only',
    );
  }

  applyReceiptMetadata(
    payload: NormalizedGiftCreatePayload,
  ): NormalizedGiftCreatePayload {
    const clone: NormalizedGiftCreatePayload = { ...payload };

    const amountMinor =
      typeof payload.amount?.amountMicros === 'number' &&
      Number.isFinite(payload.amount.amountMicros)
        ? Math.round(payload.amount.amountMicros / 10_000)
        : undefined;

    const dedupeKey =
      this.normalizeString(payload.receiptDedupeKey) ??
      this.normalizeString(payload.providerPaymentId) ??
      this.normalizeString(payload.sourceFingerprint) ??
      this.normalizeString(payload.externalId);

    const isRecurring = Boolean(
      this.normalizeString(payload.recurringAgreementId),
    );
    const policy =
      clone.receiptPolicyApplied ??
      (isRecurring ? this.defaultRecurringPolicy : this.defaultOneOffPolicy);

    const threshold = this.resolveThresholdMinor();
    const autoSuppressed =
      threshold !== undefined &&
      amountMinor !== undefined &&
      amountMinor > threshold;

    const status: ReceiptStatus = autoSuppressed
      ? 'suppressed'
      : ((clone.receiptStatus as ReceiptStatus) ?? 'pending');

    clone.receiptPolicyApplied = policy;
    clone.receiptStatus = status;
    clone.receiptChannel = clone.receiptChannel ?? 'email';
    clone.receiptDedupeKey = dedupeKey;

    if (autoSuppressed) {
      clone.receiptSentAt = undefined;
      clone.receiptError = undefined;
    }

    this.logger.info(
      'Evaluated receipt policy for gift payload',
      {
        event: 'receipt_policy_evaluated',
        policy,
        status,
        dedupeKey,
        isRecurring,
        amountMinor,
        threshold,
        suppressed: autoSuppressed,
        channel: clone.receiptChannel,
      },
      ReceiptPolicyService.name,
    );

    return clone;
  }

  private resolveThresholdMinor(): number | undefined {
    const raw = this.configService.get<string>(
      'FUNDRAISING_RECEIPT_AUTO_SEND_THRESHOLD_MINOR',
    );
    if (!raw) {
      return undefined;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private resolvePolicy(envKey: string, fallback: string): string {
    const value = this.normalizeString(this.configService.get<string>(envKey));
    return value ?? fallback;
  }
}
