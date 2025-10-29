import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../logging/structured-logger.service';

interface GoCardlessEventSummary {
  type?: string;
  resourceType?: string;
  action?: string;
  id?: string;
  mandateId?: string;
  paymentId?: string;
  subscriptionId?: string;
}

@Injectable()
export class GoCardlessWebhookService {
  private readonly logContext = GoCardlessWebhookService.name;

  constructor(private readonly logger: StructuredLoggerService) {}

  async handleWebhook(payload: unknown): Promise<void> {
    const summaries = this.extractEventSummaries(payload);
    this.logger.info(
      'Received GoCardless webhook (skeleton handler)',
      {
        event: 'gocardless_webhook_received',
        eventCount: summaries.length,
        events: summaries,
      },
      this.logContext,
    );
  }

  private extractEventSummaries(payload: unknown): GoCardlessEventSummary[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return [];
    }

    const events = (payload as Record<string, unknown>).events;
    if (!Array.isArray(events)) {
      return [];
    }

    return events
      .map((entry) => this.summariseEvent(entry))
      .filter((summary): summary is GoCardlessEventSummary => Boolean(summary));
  }

  private summariseEvent(entry: unknown): GoCardlessEventSummary | null {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }

    const event = entry as Record<string, unknown>;
    const links = event.links;

    const summary: GoCardlessEventSummary = {
      id: this.safeString(event.id),
      type: this.safeString(event.event_type ?? event.type),
      resourceType: this.safeString(event.resource_type),
      action: this.safeString(event.action),
      mandateId: this.safeString(this.lookupLinkId(links, 'mandate')),
      paymentId: this.safeString(this.lookupLinkId(links, 'payment')),
      subscriptionId: this.safeString(this.lookupLinkId(links, 'subscription')),
    };

    return summary;
  }

  private lookupLinkId(rawLinks: unknown, key: string): string | undefined {
    if (!rawLinks || typeof rawLinks !== 'object' || Array.isArray(rawLinks)) {
      return undefined;
    }

    const links = rawLinks as Record<string, unknown>;
    const value = links[key];
    return typeof value === 'string' ? value : undefined;
  }

  private safeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
