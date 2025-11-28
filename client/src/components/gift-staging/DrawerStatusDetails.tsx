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
      <h4>Donor & duplicates</h4>
      <dl className="drawer-meta">
        <div>
          <dt>Staged donor name</dt>
          <dd>
            {[detail.donorFirstName, detail.donorLastName].filter(Boolean).join(' ') || '—'}
          </dd>
        </div>
        <div>
          <dt>Staged donor email</dt>
          <dd>{detail.donorEmail || '—'}</dd>
        </div>
        <div>
          <dt>Linked donor</dt>
          <dd>{detail.donorId ? <code>{detail.donorId}</code> : 'New donor'}</dd>
        </div>
        <div>
          <dt>Duplicate check</dt>
          <dd>{dedupeStatusLabel}</dd>
        </div>
        <div>
          <dt>Intent</dt>
          <dd>{intentLabel ?? '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
