import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  processGiftStaging,
  updateGiftStaging,
  updateGiftStagingStatus,
  type GiftStagingUpdatePayload,
} from '../api';
import { useAppealOptions } from '../hooks/useAppealOptions';
import { useGiftStagingDetail } from '../hooks/useGiftStagingDetail';

export type GiftDrawerFocus = 'overview' | 'duplicates' | 'recurring';

interface GiftStagingDrawerProps {
  stagingId: string | null;
  focus?: GiftDrawerFocus;
  onClose: () => void;
  onRefreshList: () => void;
}

type EditFormState = {
  amountMajor: string;
  currency: string;
  dateReceived: string;
  fundId: string;
  appealId: string;
  trackingCodeId: string;
  giftBatchId: string;
  notes: string;
};

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
  focus = 'overview',
  onClose,
  onRefreshList,
}: GiftStagingDrawerProps): JSX.Element | null {
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [activeSection, setActiveSection] = useState<GiftDrawerFocus>(focus);
  const [actionBusy, setActionBusy] = useState<'mark-ready' | 'process' | 'update' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    amountMajor: '',
    currency: '',
    dateReceived: '',
    fundId: '',
    appealId: '',
    trackingCodeId: '',
    giftBatchId: '',
    notes: '',
  });
  const {
    options: appealOptions,
    loading: appealsLoading,
    error: appealError,
  } = useAppealOptions();
  const appealListId = useMemo(
    () => (stagingId ? `drawer-appeal-options-${stagingId}` : 'drawer-appeal-options'),
    [stagingId],
  );

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

  const initializeEditForm = useCallback(() => {
    if (!detail) {
      setEditForm({
        amountMajor: '',
        currency: '',
        dateReceived: '',
        fundId: '',
        appealId: '',
        trackingCodeId: '',
        giftBatchId: '',
        notes: '',
      });
      return;
    }

    const derivedAmount =
      typeof detail.amountMinor === 'number'
        ? (detail.amountMinor / 100).toFixed(2)
        : typeof detail.amount === 'number'
          ? detail.amount.toFixed(2)
          : '';

    const derivedDate = detail.dateReceived ? detail.dateReceived.slice(0, 10) : '';

    setEditForm({
      amountMajor: derivedAmount,
      currency: detail.currency ?? '',
      dateReceived: derivedDate,
      fundId: detail.fundId ?? '',
      appealId: detail.appealId ?? '',
      trackingCodeId: detail.trackingCodeId ?? '',
      giftBatchId: detail.giftBatchId ?? '',
      notes: detail.notes ?? '',
    });
  }, [detail]);

  useEffect(() => {
    setActiveSection(focus);
  }, [focus]);

  useEffect(() => {
    initializeEditForm();
  }, [initializeEditForm]);

  const handleEditFieldChange = useCallback(
    (field: keyof EditFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setEditForm((prev) => ({
          ...prev,
          [field]: value,
        }));
      },
    [],
  );

  const handleResetEdits = useCallback(() => {
    initializeEditForm();
    setActionError(null);
    setActionNotice(null);
  }, [initializeEditForm]);

  const handleSaveEdits = useCallback(async () => {
    if (!detail?.id) {
      return;
    }

    const payload: GiftStagingUpdatePayload = {};

    const amountValue = editForm.amountMajor.trim();
    if (amountValue.length > 0) {
      const parsed = Number.parseFloat(amountValue);
      if (Number.isNaN(parsed)) {
        setActionError('Amount must be a valid number.');
        return;
      }
      payload.amountMajor = parsed;
    }

    const currencyInput = editForm.currency.trim();
    if (currencyInput.length > 0) {
      payload.currency = currencyInput.toUpperCase();
    } else if (detail.currency) {
      payload.currency = null;
    }

    const dateValue = editForm.dateReceived.trim();
    if (dateValue.length > 0) {
      payload.dateReceived = dateValue;
    } else if (detail.dateReceived) {
      payload.dateReceived = null;
    }

    const fundValue = editForm.fundId.trim();
    if (fundValue.length > 0) {
      payload.fundId = fundValue;
    } else if (detail.fundId) {
      payload.fundId = null;
    }

    const appealValue = editForm.appealId.trim();
    if (appealValue.length > 0) {
      payload.appealId = appealValue;
    } else if (detail.appealId) {
      payload.appealId = null;
    }

    const trackingValue = editForm.trackingCodeId.trim();
    if (trackingValue.length > 0) {
      payload.trackingCodeId = trackingValue;
    } else if (detail.trackingCodeId) {
      payload.trackingCodeId = null;
    }

    const batchValue = editForm.giftBatchId.trim();
    if (batchValue.length > 0) {
      payload.giftBatchId = batchValue;
    } else if (detail.giftBatchId) {
      payload.giftBatchId = null;
    }

    const notesValue = editForm.notes.trim();
    if (notesValue.length > 0) {
      payload.notes = notesValue;
    } else if (detail.notes) {
      payload.notes = null;
    }

    if (Object.keys(payload).length === 0) {
      setActionNotice('No changes to save.');
      return;
    }

    setActionBusy('update');
    setActionError(null);
    setActionNotice(null);

    try {
      await updateGiftStaging(detail.id, payload);
      await reload();
      onRefreshList();
      setActionNotice('Gift staging details updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update gift staging.');
    } finally {
      setActionBusy(null);
    }
  }, [detail, editForm, onRefreshList, reload]);

  const handleMarkReady = async () => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('mark-ready');
    setActionError(null);
    setActionNotice(null);
    try {
      await updateGiftStagingStatus(detail.id, {
        promotionStatus: 'ready_for_commit',
        validationStatus: detail.validationStatus === 'passed' ? detail.validationStatus : 'passed',
      });
      await reload();
      onRefreshList();
      setActionNotice('Staging record marked ready for processing.');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to mark staging record ready.',
      );
    } finally {
      setActionBusy(null);
    }
  };

  const handleProcessNow = async () => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('process');
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await processGiftStaging(detail.id);
      if (response.status !== 'committed') {
        const description =
          response.status === 'deferred'
            ? `Processing deferred (${response.reason ?? 'not ready'})`
            : `Processing failed (${response.error ?? 'unknown issue'})`;
        setActionError(description);
      } else {
        await reload();
        onRefreshList();
        setActionNotice('Gift committed in Twenty.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to process staging record.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleAssignDonor = async (donorId: string) => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('update');
    setActionError(null);
    setActionNotice(null);
    try {
      await updateGiftStaging(detail.id, {
        donorId,
        dedupeStatus: 'matched_existing',
      });
      await reload();
      onRefreshList();
      setActionNotice('Donor reassigned to existing supporter.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update donor.');
    } finally {
      setActionBusy(null);
    }
  };

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
          <div className="drawer-header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleMarkReady}
              disabled={actionBusy === 'mark-ready' || loading}
            >
              {actionBusy === 'mark-ready' ? 'Marking…' : 'Mark ready'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleProcessNow}
              disabled={actionBusy === 'process' || loading}
            >
              {actionBusy === 'process' ? 'Processing…' : 'Process now'}
            </button>
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
          </div>
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
                <span className="status-pill">
                  Processing: {detail.promotionStatus ?? 'unknown'}
                </span>
                <span className="status-pill">
                  Validation: {detail.validationStatus ?? 'unknown'}
                </span>
                <span className="status-pill">
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
                  <dd>
                    {detail.recurringAgreementId ? <code>{detail.recurringAgreementId}</code> : '—'}
                  </dd>
                </div>
              </dl>
            </section>

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
              <div className="drawer-section-header">
                <h4>Review</h4>
                <div className="drawer-section-tabs">
                  <button
                    type="button"
                    className={`secondary-button ${activeSection === 'overview' ? 'secondary-button--active' : ''}`}
                    onClick={() => setActiveSection('overview')}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${activeSection === 'duplicates' ? 'secondary-button--active' : ''}`}
                    onClick={() => setActiveSection('duplicates')}
                  >
                    Duplicates
                  </button>
                  <button
                    type="button"
                    className={`secondary-button ${activeSection === 'recurring' ? 'secondary-button--active' : ''}`}
                    onClick={() => setActiveSection('recurring')}
                  >
                    Recurring
                  </button>
                </div>
              </div>

              {activeSection === 'overview' ? (
                <>
                  <div className="drawer-edit-grid">
                    <label className="drawer-field">
                      <span>Amount (major)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amountMajor}
                        onChange={handleEditFieldChange('amountMajor')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                    <label className="drawer-field">
                      <span>Currency</span>
                      <input
                        type="text"
                        value={editForm.currency}
                        onChange={handleEditFieldChange('currency')}
                        disabled={actionBusy === 'update' || loading}
                        maxLength={3}
                      />
                    </label>
                    <label className="drawer-field">
                      <span>Date received</span>
                      <input
                        type="date"
                        value={editForm.dateReceived}
                        onChange={handleEditFieldChange('dateReceived')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                    <label className="drawer-field">
                      <span>Fund ID</span>
                      <input
                        type="text"
                        value={editForm.fundId}
                        onChange={handleEditFieldChange('fundId')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                    <label className="drawer-field">
                      <span>Appeal</span>
                      <input
                        type="text"
                        list={appealListId}
                        value={editForm.appealId}
                        onChange={handleEditFieldChange('appealId')}
                        disabled={actionBusy === 'update' || loading}
                        placeholder="Enter or select appeal id"
                      />
                      <datalist id={appealListId}>
                        {appealOptions.map((appeal) => (
                          <option key={appeal.id} value={appeal.id}>
                            {appeal.name ?? appeal.id}
                          </option>
                        ))}
                      </datalist>
                      {appealsLoading ? (
                        <span className="drawer-hint">Loading appeals…</span>
                      ) : appealError ? (
                        <span className="drawer-hint drawer-hint--error">{appealError}</span>
                      ) : null}
                    </label>
                    <label className="drawer-field">
                      <span>Tracking code ID</span>
                      <input
                        type="text"
                        value={editForm.trackingCodeId}
                        onChange={handleEditFieldChange('trackingCodeId')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                    <label className="drawer-field">
                      <span>Batch ID</span>
                      <input
                        type="text"
                        value={editForm.giftBatchId}
                        onChange={handleEditFieldChange('giftBatchId')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                    <label className="drawer-field drawer-field--textarea">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={editForm.notes}
                        onChange={handleEditFieldChange('notes')}
                        disabled={actionBusy === 'update' || loading}
                      />
                    </label>
                  </div>
                  <div className="drawer-edit-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleSaveEdits}
                      disabled={actionBusy === 'update' || loading}
                    >
                      {actionBusy === 'update' ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleResetEdits}
                      disabled={actionBusy === 'update' || loading}
                    >
                      Reset
                    </button>
                  </div>
                  <dl className="drawer-meta">
                    <div>
                      <dt>Formatted amount</dt>
                      <dd>{formattedAmount}</dd>
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
                      <dt>Provider</dt>
                      <dd>{detail.provider ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Provider payment ID</dt>
                      <dd>{detail.providerPaymentId ?? '—'}</dd>
                    </div>
                  </dl>
                </>
              ) : null}

              {activeSection === 'duplicates' ? (
                dedupeDiagnostics ? (
                  <>
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
                    <div className="duplicate-actions">
                      {dedupeDiagnostics.matchedDonorId &&
                      dedupeDiagnostics.matchedDonorId !== detail.donorId ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            if (dedupeDiagnostics.matchedDonorId) {
                              handleAssignDonor(dedupeDiagnostics.matchedDonorId);
                            }
                          }}
                          disabled={actionBusy === 'update' || loading}
                        >
                          Use donor {dedupeDiagnostics.matchedDonorId}
                        </button>
                      ) : (
                        <span className="small-text">
                          {detail.donorId
                            ? 'Current donor already matches the suggested supporter.'
                            : 'No direct match selected.'}
                        </span>
                      )}
                    </div>
                    {dedupeDiagnostics.candidateDonorIds &&
                    dedupeDiagnostics.candidateDonorIds.length > 0 ? (
                      <div className="duplicate-secondary-actions">
                        <p className="small-text" style={{ marginBottom: '0.5rem' }}>
                          Other potential matches:
                        </p>
                        <ul className="duplicate-list">
                          {dedupeDiagnostics.candidateDonorIds
                            .filter(
                              (candidateId) =>
                                candidateId &&
                                candidateId !== dedupeDiagnostics.matchedDonorId &&
                                candidateId !== detail.donorId,
                            )
                            .map((candidateId) => (
                              <li key={candidateId} className="duplicate-item">
                                <span>Donor {candidateId}</span>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => handleAssignDonor(candidateId)}
                                  disabled={actionBusy === 'update' || loading}
                                >
                                  Use this donor
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="small-text">No duplicate diagnostics available.</p>
                )
              ) : null}

              {activeSection === 'recurring' ? (
                <dl className="drawer-meta">
                  <div>
                    <dt>Recurring agreement</dt>
                    <dd>{detail.recurringAgreementId ? <code>{detail.recurringAgreementId}</code> : '—'}</dd>
                  </div>
                  <div>
                    <dt>Expected installment</dt>
                    <dd>{detail.expectedAt ? formatDate(detail.expectedAt) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Provider context</dt>
                    <dd>{detail.provider ?? '—'}</dd>
                  </div>
                </dl>
              ) : null}
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
                  <pre className="drawer-json">{safePrettyJson(detail.rawPayload)}</pre>
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
  matchType: 'email' | 'name' | 'partial';
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
