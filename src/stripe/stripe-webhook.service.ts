import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { GiftService } from '../gift/gift.service';
import { RecurringAgreementService } from '../recurring-agreement/recurring-agreement.service';
import { RecurringAgreementPayload } from '../recurring-agreement/recurring-agreement.types';

interface HandleIncomingEventArgs {
  signature: string | string[] | undefined;
  rawBody?: Buffer;
  parsedBody: unknown;
}

@Injectable()
export class StripeWebhookService {
  private readonly webhookSecret: string | undefined;
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly giftService: GiftService,
    private readonly recurringAgreementService: RecurringAgreementService,
    private readonly logger: StructuredLoggerService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_API_KEY') ?? '';
    this.webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    // The Stripe SDK requires an API key even when only validating webhooks.
    this.stripe = new Stripe(apiKey || 'placeholder', {
      apiVersion: '2025-09-30.clover',
    });
  }

  async handleIncomingEvent(args: HandleIncomingEventArgs): Promise<void> {
    const { signature, rawBody, parsedBody } = args;

    if (!this.webhookSecret) {
      this.logger.warn('Stripe webhook secret not configured; dropping event', {
        event: 'stripe_webhook_missing_secret',
      });
      throw new ServiceUnavailableException('Stripe webhook not configured');
    }

    const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

    if (!signatureHeader) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const bodyBuffer = this.resolveRawBody(rawBody, parsedBody);

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        bodyBuffer,
        signatureHeader,
        this.webhookSecret,
      );
    } catch (error) {
      this.logger.warn('Failed to validate Stripe webhook signature', {
        event: 'stripe_webhook_invalid_signature',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type !== 'checkout.session.completed') {
      this.logger.debug('Ignoring unsupported Stripe webhook event', {
        event: 'stripe_webhook_ignored_event',
        stripeEventType: event.type,
      });
      return;
    }

    await this.handleCheckoutSessionCompleted(event as Stripe.Event);
  }

  private resolveRawBody(
    rawBody: Buffer | undefined,
    parsedBody: unknown,
  ): Buffer {
    if (rawBody) {
      return rawBody;
    }

    if (typeof parsedBody === 'string') {
      return Buffer.from(parsedBody, 'utf8');
    }

    if (parsedBody && typeof parsedBody === 'object') {
      return Buffer.from(JSON.stringify(parsedBody));
    }

    return Buffer.alloc(0);
  }

  private async handleCheckoutSessionCompleted(
    event: Stripe.Event,
  ): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    const amountTotal = session.amount_total ?? 0;
    const currency = session.currency ?? 'usd';
    const metadata = session.metadata ?? {};
    const paymentIntentId = this.extractPaymentIntentId(session);

    const giftPayload: Record<string, unknown> = {
      amount: {
        currencyCode: currency.toUpperCase(),
        value: this.convertAmountToMajorUnits(amountTotal),
      },
      amountMinor: amountTotal,
      currency: currency.toUpperCase(),
      giftDate: this.formatEventDate(event.created),
      paymentMethod: 'card',
      externalId: paymentIntentId ?? session.id,
      intakeSource: 'stripe_webhook',
      sourceFingerprint: paymentIntentId ?? session.id,
      autoPromote: true,
    };

    const contact = this.buildContact(session, metadata);
    if (contact) {
      giftPayload.contact = contact;
    }

    // Downgrade auto-promote when the contact cannot be matched exactly
    if (giftPayload.contact && contact?.email) {
      giftPayload.autoPromote = true;
    } else if (!giftPayload.contact) {
      giftPayload.autoPromote = false;
    }

    await this.enrichWithRecurringAgreement(
      session,
      metadata,
      giftPayload,
      paymentIntentId,
    );

    this.logger.info(
      'Forwarding Stripe checkout session to fundraising proxy',
      {
        event: 'stripe_checkout_session_forward',
        stripeSessionId: session.id,
        paymentIntentId,
      },
    );

    try {
      await this.giftService.createGift(giftPayload);
      if (giftPayload.autoPromote === false) {
        this.logger.info('Stripe webhook staged gift for manual review', {
          event: 'stripe_checkout_session_staged',
          stripeSessionId: session.id,
        });
      }
    } catch (error) {
      this.logger.error(
        'Fundraising proxy failed to ingest Stripe checkout session',
        {
          event: 'stripe_checkout_session_forward_failed',
          stripeSessionId: session.id,
        },
        StripeWebhookService.name,
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  private formatEventDate(
    timestampSeconds: number | undefined,
  ): string | undefined {
    if (!timestampSeconds) {
      return undefined;
    }

    const date = new Date(timestampSeconds * 1000);
    if (Number.isNaN(date.valueOf())) {
      return undefined;
    }

    return date.toISOString().slice(0, 10);
  }

  private convertAmountToMajorUnits(amountMinor: number): number {
    return amountMinor / 100;
  }

  private buildSessionNote(): undefined {
    return undefined;
  }

  private extractPaymentIntentId(
    session: Stripe.Checkout.Session,
  ): string | undefined {
    if (!session.payment_intent) {
      return undefined;
    }

    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;
  }

  private buildContact(
    session: Stripe.Checkout.Session,
    metadata: Stripe.Metadata,
  ): Record<string, string> | undefined {
    const metaFirstName = this.normalizeName(
      this.lookupMetadataValue(metadata, ['firstName', 'first_name']),
    );
    const metaLastName = this.normalizeName(
      this.lookupMetadataValue(metadata, ['lastName', 'last_name']),
    );
    const metadataEmail = this.normalizeEmail(
      this.lookupMetadataValue(metadata, ['email']),
    );

    let firstName = metaFirstName;
    let lastName = metaLastName;

    if (!firstName || !lastName) {
      const customerDetails = session.customer_details;
      if (customerDetails?.name) {
        const split = this.splitFullName(customerDetails.name);
        firstName = firstName ?? split.firstName;
        lastName = lastName ?? split.lastName;
      }
    }

    if (!firstName || !lastName) {
      return undefined;
    }

    const email = this.normalizeEmail(
      metadataEmail ?? session.customer_details?.email ?? undefined,
    );

    const contact: Record<string, string> = {
      firstName,
      lastName,
    };

    if (email) {
      contact.email = email;
    }

    return contact;
  }

  private async enrichWithRecurringAgreement(
    session: Stripe.Checkout.Session,
    metadata: Stripe.Metadata,
    giftPayload: Record<string, unknown>,
    paymentIntentId?: string,
  ): Promise<void> {
    giftPayload.provider = 'stripe';
    giftPayload.providerPaymentId = paymentIntentId ?? session.id;
    giftPayload.providerContext = this.buildStripeProviderContext(
      session,
      metadata,
      paymentIntentId,
    );

    const subscriptionId = this.extractSubscriptionId(session);
    if (subscriptionId) {
      giftPayload.recurringStatus = 'active';
    }

    const metadataAgreementId = this.lookupMetadataValue(metadata, [
      'recurringAgreementId',
      'recurring_agreement_id',
    ]);
    const trimmedAgreementId = metadataAgreementId?.trim();
    if (!trimmedAgreementId) {
      this.logger.debug(
        'Stripe webhook missing recurring agreement metadata; skipping agreement sync',
        {
          event: 'stripe_webhook_missing_recurring_agreement_id',
          stripeSessionId: session.id,
        },
      );
      return;
    }

    giftPayload.recurringAgreementId = trimmedAgreementId;

    const nextExpectedAt =
      this.lookupMetadataValue(metadata, [
        'nextExpectedAt',
        'next_expected_at',
      ]) ?? undefined;
    if (nextExpectedAt) {
      giftPayload.expectedAt = nextExpectedAt;
    }

    const agreementUpdate: RecurringAgreementPayload = {
      status: 'active',
      provider: 'stripe',
      providerAgreementId: subscriptionId,
      providerPaymentMethodId: this.extractPaymentMethodId(session),
      providerContext: this.buildStripeProviderContext(
        session,
        metadata,
        paymentIntentId,
      ),
      nextExpectedAt,
    };

    try {
      await this.recurringAgreementService.updateAgreement(
        trimmedAgreementId,
        agreementUpdate,
      );
    } catch (error) {
      this.logger.warn(
        'Failed to update recurring agreement from Stripe webhook',
        {
          event: 'stripe_webhook_recurring_agreement_update_failed',
          recurringAgreementId: trimmedAgreementId,
          stripeSessionId: session.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        StripeWebhookService.name,
      );
    }
  }

  private normalizeName(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeEmail(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private lookupMetadataValue(
    metadata: Stripe.Metadata,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = metadata?.[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private extractSubscriptionId(
    session: Stripe.Checkout.Session,
  ): string | undefined {
    const { subscription } = session;
    if (!subscription) {
      return undefined;
    }

    if (typeof subscription === 'string') {
      return subscription;
    }

    return subscription.id ?? undefined;
  }

  private extractPaymentMethodId(
    session: Stripe.Checkout.Session,
  ): string | undefined {
    const paymentIntent = session.payment_intent;
    if (!paymentIntent) {
      return undefined;
    }

    if (typeof paymentIntent === 'string') {
      return undefined;
    }

    const method = paymentIntent.payment_method;
    if (!method) {
      return undefined;
    }

    return typeof method === 'string' ? method : method.id;
  }

  private buildStripeProviderContext(
    session: Stripe.Checkout.Session,
    metadata: Stripe.Metadata,
    paymentIntentId?: string,
  ): Record<string, unknown> {
    const subscriptionId = this.extractSubscriptionId(session);
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer
          ? session.customer.id
          : undefined;

    const cleanedMetadata: Record<string, string> = {};
    Object.entries(metadata ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        cleanedMetadata[key] = value;
      }
    });

    const context: Record<string, unknown> = {
      checkoutSessionId: session.id,
      paymentIntentId,
      subscriptionId,
      customerId,
      mode: session.mode,
      metadata:
        Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : undefined,
    };

    return this.pruneUndefined(context);
  }

  private pruneUndefined(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null) {
        output[key] = value;
      }
    }
    return output;
  }

  private splitFullName(fullName: string): {
    firstName?: string;
    lastName?: string;
  } {
    const normalized = fullName.trim();
    if (!normalized) {
      return {};
    }

    const parts = normalized.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0] };
    }

    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return {
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    };
  }
}
