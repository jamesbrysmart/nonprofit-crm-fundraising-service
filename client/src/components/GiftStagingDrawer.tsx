import { useMemo, useState } from 'react';
import { useGiftStagingDetail } from '../hooks/useGiftStagingDetail';

interface GiftStagingDrawerProps {
  stagingId: string | null;
  onClose: () => void;
  onRefreshList: () => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

function formatDedupeStatus(status?: string): string {
  switch (status) {
    case 'matched_existing':
      return 'Auto-matched to existing donor';
    case 'needs_review':
      return 'Needs reviewer attention';
    default:
      return status ?? '—';
  }
}

export function GiftStagingDrawer({
  stagingId,
  onClose,
  onRefreshList,
}: GiftStagingDrawerProps): JSX.Element | null {
  const [showRawPayload, setShowRawPayload] = useState(false);

  const { detail, loading, error, reload } = useGiftStagingDetail(stagingId);

  const formattedAmount = useMemo(() => {
    if (!detail?.amountMinor || !detail.currency) {
      return '—';
    }
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: detail.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(detail.amountMinor / 100);
  }, [detail]);

  const dedupeDiagnostics = useMemo(
    () => extractDedupeDiagnostics(detail?.rawPayload),
    [detail?.rawPayload],
  );

  const donorName = useMemo(() => {
    if (!detail) {
      return '';
    }
    return [detail.donorFirstName, detail.donorLastName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }, [detail]);

  if (!stagingId) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h3>Staging record</h3>
            <p className="small-text">
              ID <code>{stagingId}</code>
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <div className="queue-state">Loading record…</div>
        ) : error ? (
          <div className="queue-state queue-state-error" role="alert">
            {error}
            <div>
              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: '0.75rem' }}
                onClick={() => {
                  void reload();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : !detail ? (
          <div className="queue-state">Record not found.</div>
        ) : (
          <>
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
                  <dd>{formatDedupeStatus(detail.dedupeStatus)}</dd>
                </div>
                <div>
                  <dt>Error detail</dt>
                  <dd>{detail.errorDetail ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="drawer-section">
              <h4>Duplicate check</h4>
              {dedupeDiagnostics ? (
                <dl className="drawer-meta">
                  <div>
                    <dt>Match type</dt>
                    <dd>
                      {dedupeDiagnostics.matchType === 'email'
                        ? 'Exact email match'
                        : dedupeDiagnostics.matchType === 'name'
                          ? 'Name match (requires review)'
                          : 'Partial match'}
                    </dd>
                  </div>
                  <div>
                    <dt>Matched donor</dt>
                    <dd>{dedupeDiagnostics.matchedDonorId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Matched by</dt>
                    <dd>{dedupeDiagnostics.matchedBy ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>
                      {typeof dedupeDiagnostics.confidence === 'number'
                        ? `${Math.round(dedupeDiagnostics.confidence * 100)}%`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Candidate donors</dt>
                    <dd>
                      {dedupeDiagnostics.candidateDonorIds && dedupeDiagnostics.candidateDonorIds.length > 0
                        ? dedupeDiagnostics.candidateDonorIds.join(', ')
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="small-text">No duplicate diagnostics available.</p>
              )}
            </section>

            <section className="drawer-section">
              <h4>Details</h4>
              <dl className="drawer-meta">
                <div>
                  <dt>Amount</dt>
                  <dd>{formattedAmount}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{detail.currency ?? '—'}</dd>
                </div>
                <div>
                  <dt>Donor name</dt>
                  <dd>{donorName || '—'}</dd>
                </div>
                <div>
                  <dt>Donor email</dt>
                  <dd>{detail.donorEmail ?? '—'}</dd>
                </div>
                <div>
                  <dt>Donor ID</dt>
                  <dd>{detail.donorId ?? 'Pending resolution'}</dd>
                </div>
                <div>
                  <dt>Intake source</dt>
                  <dd>{detail.intakeSource ?? '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(detail.updatedAt)}</dd>
                </div>
                <div>
                  <dt>External ID</dt>
                  <dd>{detail.externalId ?? '—'}</dd>
                </div>
                <div>
                  <dt>Gift ID</dt>
                  <dd>{detail.giftId ?? 'Not committed yet'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{detail.notes ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="drawer-section">
              <div className="drawer-section-header">
                <h4>Raw payload</h4>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowRawPayload((prev) => !prev)}
                >
                  {showRawPayload ? 'Hide JSON' : 'Show JSON'}
                </button>
              </div>
              {showRawPayload ? (
                detail.rawPayload ? (
                  <pre className="drawer-json">
                    {safePrettyJson(detail.rawPayload)}
                  </pre>
                ) : (
                  <div className="queue-state">Raw payload not available.</div>
                )
              ) : (
                <p className="small-text">Raw staging JSON remains hidden. Toggle to show.</p>
              )}
            </section>
          </>
        )}

        <footer className="drawer-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void reload();
            }}
            disabled={loading}
          >
            Reload record
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onRefreshList();
            }}
          >
            Refresh list
          </button>
        </footer>
      </div>
    </div>
  );
}

function safePrettyJson(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    return payload;
  }
}

interface ParsedDedupeDiagnostics {
  matchType: 'email' | 'partial';
  matchedDonorId?: string;
  matchedBy?: string;
  confidence?: number;
  candidateDonorIds?: string[];
}

function extractDedupeDiagnostics(rawPayload?: string | null): ParsedDedupeDiagnostics | null {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    const diagnostics = parsed?.dedupeDiagnostics;
    if (!diagnostics || typeof diagnostics !== 'object') {
      return null;
    }

    const matchType =
      diagnostics.matchType === 'email'
        ? 'email'
        : diagnostics.matchType === 'name'
          ? 'name'
          : diagnostics.matchType === 'partial'
            ? 'partial'
            : undefined;

    if (!matchType) {
      return null;
    }

    const candidateIds = Array.isArray(diagnostics.candidateDonorIds)
      ? diagnostics.candidateDonorIds.filter((candidate: unknown) => typeof candidate === 'string')
      : undefined;

    return {
      matchType,
      matchedDonorId:
        typeof diagnostics.matchedDonorId === 'string' && diagnostics.matchedDonorId.length > 0
          ? diagnostics.matchedDonorId
          : undefined,
      matchedBy:
        typeof diagnostics.matchedBy === 'string' && diagnostics.matchedBy.length > 0
          ? diagnostics.matchedBy
          : undefined,
      confidence:
        typeof diagnostics.confidence === 'number'
          ? diagnostics.confidence
          : undefined,
      candidateDonorIds: candidateIds && candidateIds.length > 0 ? candidateIds : undefined,
    };
  } catch (error) {
    console.warn('Failed to parse dedupe diagnostics', error);
    return null;
  }
}
