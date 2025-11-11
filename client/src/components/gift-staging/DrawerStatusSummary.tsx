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
        <div className="queue-state queue-state-error" role="alert">
          {actionError}
        </div>
      ) : null}
      {actionNotice ? (
        <div className="queue-state" role="status">
          {actionNotice}
        </div>
      ) : null}
      <div className="status-pill-row">
        <span className="status-pill">Processing: {detail.promotionStatus ?? 'unknown'}</span>
        <span className="status-pill">Validation: {detail.validationStatus ?? 'unknown'}</span>
        <span className="status-pill">Dedupe: {detail.dedupeStatus ?? 'unknown'}</span>
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
