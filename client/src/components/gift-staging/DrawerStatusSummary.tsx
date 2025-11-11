import { GiftStagingDetailResponse } from '../../api';

type GiftStagingRecord = NonNullable<GiftStagingDetailResponse['data']['giftStaging']>;

interface DrawerStatusSummaryProps {
  detail: GiftStagingRecord;
  actionError: string | null;
  actionNotice: string | null;
}

export function DrawerStatusSummary({
  detail,
  actionError,
  actionNotice,
}: DrawerStatusSummaryProps): JSX.Element {
  return (
    <section className="drawer-section status-summary">
      {actionError ? (
        <div className="f-alert f-alert--error" role="alert">
          {actionError}
        </div>
      ) : null}
      {actionNotice ? (
        <div className="f-alert f-alert--info" role="status">
          {actionNotice}
        </div>
      ) : null}
      <div className="f-flex f-flex-wrap f-gap-2">
        <span className="f-badge f-bg-slate-200 f-text-ink">
          Processing: {detail.promotionStatus ?? 'unknown'}
        </span>
        <span className="f-badge f-bg-slate-200 f-text-ink">
          Validation: {detail.validationStatus ?? 'unknown'}
        </span>
        <span className="f-badge f-bg-slate-200 f-text-ink">
          Dedupe: {detail.dedupeStatus ?? 'unknown'}
        </span>
      </div>
      <dl className="drawer-meta compact">
        <div>
          <dt>Batch</dt>
          <dd>{detail.giftBatchId ? <code>{detail.giftBatchId}</code> : '—'}</dd>
        </div>
        <div>
          <dt>Intake source</dt>
          <dd>{detail.intakeSource ?? '—'}</dd>
        </div>
        <div>
          <dt>Recurring agreement</dt>
          <dd>{detail.recurringAgreementId ? <code>{detail.recurringAgreementId}</code> : '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
