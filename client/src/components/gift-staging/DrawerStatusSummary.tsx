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
    </section>
  );
}
