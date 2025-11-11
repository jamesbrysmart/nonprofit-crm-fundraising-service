import { GiftStagingDetailResponse } from '../../api';

type GiftStagingRecord = NonNullable<GiftStagingDetailResponse['data']['giftStaging']>;

interface DrawerStatusDetailsProps {
  detail: GiftStagingRecord;
  dedupeStatusLabel: string;
  intentLabel?: string;
}

export function DrawerStatusDetails({
  detail,
  dedupeStatusLabel,
  intentLabel,
}: DrawerStatusDetailsProps): JSX.Element {
  return (
    <section className="drawer-section">
      <h4>Status</h4>
      <dl className="drawer-meta">
        <div>
          <dt>Processing</dt>
          <dd>{detail.promotionStatus ?? '—'}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{detail.validationStatus ?? '—'}</dd>
        </div>
        <div>
          <dt>Dedupe</dt>
          <dd>{dedupeStatusLabel}</dd>
        </div>
        <div>
          <dt>Error detail</dt>
          <dd>{detail.errorDetail ?? '—'}</dd>
        </div>
        <div>
          <dt>Intent</dt>
          <dd>{intentLabel ?? '—'}</dd>
        </div>
        <div>
          <dt>Opportunity</dt>
          <dd>{detail.opportunityId ? <code>{detail.opportunityId}</code> : '—'}</dd>
        </div>
        <div>
          <dt>In-kind</dt>
          <dd>{detail.isInKind ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
    </section>
  );
}
