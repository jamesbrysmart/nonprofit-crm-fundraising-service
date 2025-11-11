import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  processGiftStaging,
  updateGiftStaging,
  updateGiftStagingStatus,
  type GiftStagingUpdatePayload,
} from '../../api';
import { useAppealOptions } from '../../hooks/useAppealOptions';
import { useGiftStagingDetail } from '../../hooks/useGiftStagingDetail';
import { DrawerHeader } from './DrawerHeader';
import { DrawerStatusSummary } from './DrawerStatusSummary';
import { DrawerStatusDetails } from './DrawerStatusDetails';
import { DrawerReviewSection } from './DrawerReviewSection';

export type GiftIntentOption = 'standard' | 'grant' | 'legacy' | 'corporateInKind';

const INTENT_LABELS: Record<GiftIntentOption, string> = {
  standard: 'Standard',
  grant: 'Grant',
  legacy: 'Legacy',
  corporateInKind: 'Corporate',
};

function getIntentLabel(intent?: string | null): string | undefined {
  if (!intent) {
    return undefined;
  }
  return INTENT_LABELS[intent as GiftIntentOption] ?? intent;
}

export type GiftDrawerFocus = 'overview' | 'duplicates' | 'recurring';

interface GiftStagingDrawerProps {
  stagingId: string | null;
  focus?: GiftDrawerFocus;
  onClose: () => void;
  onRefreshList: () => void;
}

export type EditFormState = {
  amountMajor: string;
  currency: string;
  dateReceived: string;
  fundId: string;
  appealId: string;
  trackingCodeId: string;
  giftBatchId: string;
  notes: string;
  giftIntent: string;
  opportunityId: string;
  inKindDescription: string;
  estimatedValue: string;
  isInKind: boolean;
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
    giftIntent: 'standard',
    opportunityId: '',
    inKindDescription: '',
    estimatedValue: '',
    isInKind: false,
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
  const dedupeStatusLabel = detail ? formatDedupeStatus(detail.dedupeStatus) : '';
  const intentLabel = detail ? getIntentLabel(detail.giftIntent) : undefined;
  const intentOptions = (Object.entries(INTENT_LABELS) as Array<[GiftIntentOption, string]>).map(
    ([value, label]) => ({ value, label }),
  );

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
      giftIntent: detail.giftIntent ?? 'standard',
      opportunityId: detail.opportunityId ?? '',
      inKindDescription: detail.inKindDescription ?? '',
      estimatedValue:
        typeof detail.estimatedValue === 'number'
          ? detail.estimatedValue.toString()
          : '',
      isInKind: Boolean(detail.isInKind),
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
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = event.target.value;
        setEditForm((prev) => ({
          ...prev,
          [field]: value,
        }));
      },
    [],
  );

  const handleInKindEditToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setEditForm((prev) => ({
      ...prev,
      isInKind: checked,
    }));
  }, []);

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

    const intentValue = editForm.giftIntent.trim();
    if (intentValue.length > 0 && intentValue !== 'standard') {
      payload.giftIntent = intentValue;
    } else if (detail.giftIntent && detail.giftIntent !== 'standard') {
      payload.giftIntent = null;
    }

    const opportunityValue = editForm.opportunityId.trim();
    if (opportunityValue.length > 0) {
      payload.opportunityId = opportunityValue;
    } else if (detail.opportunityId) {
      payload.opportunityId = null;
    }

    const inKindDescription = editForm.inKindDescription.trim();
    if (inKindDescription.length > 0) {
      payload.inKindDescription = inKindDescription;
    } else if (detail.inKindDescription) {
      payload.inKindDescription = null;
    }

    const estimatedValueInput = editForm.estimatedValue.trim();
    if (estimatedValueInput.length > 0) {
      const parsedValue = Number.parseFloat(estimatedValueInput);
      if (Number.isNaN(parsedValue)) {
        setActionError('Estimated value must be numeric.');
        return;
      }
      payload.estimatedValue = parsedValue;
    } else if (typeof detail.estimatedValue === 'number') {
      payload.estimatedValue = null;
    }

    if (editForm.isInKind !== Boolean(detail.isInKind)) {
      payload.isInKind = editForm.isInKind;
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
        <DrawerHeader
          stagingId={stagingId}
          loading={loading}
          actionBusy={actionBusy}
          onClose={onClose}
          onMarkReady={handleMarkReady}
          onProcess={handleProcessNow}
        />

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
            <DrawerStatusSummary
              detail={detail}
              actionError={actionError}
              actionNotice={actionNotice}
            />
            <DrawerStatusDetails
              detail={detail}
              dedupeStatusLabel={dedupeStatusLabel}
              intentLabel={intentLabel}
            />

            <DrawerReviewSection
              detail={detail}
              editForm={editForm}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onFieldChange={handleEditFieldChange}
              onInKindToggle={handleInKindEditToggle}
              appealsLoading={appealsLoading}
              appealError={appealError}
              appealOptions={appealOptions}
              appealListId={appealListId}
              actionBusy={actionBusy}
              loading={loading}
              onSaveEdits={handleSaveEdits}
              onResetEdits={handleResetEdits}
              dedupeDiagnostics={dedupeDiagnostics}
              onAssignDonor={handleAssignDonor}
              intentOptions={intentOptions}
            />

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

export interface ParsedDedupeDiagnostics {
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
