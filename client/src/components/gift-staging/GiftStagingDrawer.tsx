import { useEffect, useMemo, useState } from 'react';
import { DrawerHeader } from './DrawerHeader';
import { DrawerReviewSection } from './DrawerReviewSection';
import { GiftDrawerFocus } from './types';
import { useGiftStagingDrawerController } from '../../hooks/useGiftStagingDrawerController';
import { useStagingDonorHydration } from '../../hooks/useStagingDonorHydration';
import { fallbackCompanyDisplay } from '../../utils/donorAdapters';
import { DonorDisplay } from '../../types/donor';
import { useDonorSearch } from '../../hooks/useDonorSearch';
import { DonorSearchModal } from '../manual-entry/DonorSearchModal';
import {
  getProcessingDiagnosticsDisplay,
  getTrustPostureLabel,
} from './processingDiagnosticsUtils';

interface GiftStagingDrawerProps {
  stagingId: string | null;
  focus?: GiftDrawerFocus;
  onClose: () => void;
  onRefreshList: () => void;
}

export function GiftStagingDrawer({
  stagingId,
  focus = 'overview',
  onClose,
  onRefreshList,
}: GiftStagingDrawerProps): JSX.Element | null {
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [donorPanelExpanded, setDonorPanelExpanded] = useState(true);
  const {
    detail,
    loading,
    error,
    reload,
    appealOptions,
    appealsLoading,
    appealError,
    editForm,
    handleFieldChange,
    handleInKindEditToggle,
    handleResetEdits,
    handleSaveEdits,
    handleMarkReady,
    handleProcessNow,
    handleAssignDonor,
    actionBusy,
    actionError,
    actionNotice,
    dedupeStatusLabel,
    dedupeDiagnostics,
    intentOptions,
  } = useGiftStagingDrawerController(stagingId, focus, onRefreshList);

  const candidateIds = dedupeDiagnostics?.candidateDonorIds ?? [];
  const matchedId = dedupeDiagnostics?.matchedDonorId;
  const uniqueIds = Array.from(new Set([...candidateIds, matchedId].filter(Boolean) as string[]));
  const { candidates: hydratedCandidates } = useStagingDonorHydration(uniqueIds);
  const donorSearch = useDonorSearch();

  const classifiedDuplicates = hydratedCandidates.map((candidate) => ({
    match: candidate,
    tier: dedupeDiagnostics?.matchType === 'email' ? 'exact' : 'review',
  }));

  let selectedDonor: DonorDisplay | undefined;
  if (detail?.donorId) {
    selectedDonor = hydratedCandidates.find((c) => c.id === detail.donorId);
    if (!selectedDonor) {
      // Fallback display; best-effort.
      selectedDonor = fallbackCompanyDisplay(detail.donorId);
    }
  }

  const diagnostics = useMemo(
    () => getProcessingDiagnosticsDisplay(detail?.processingDiagnostics),
    [detail?.processingDiagnostics],
  );
  const trustLabel = getTrustPostureLabel(detail?.intakeSource);
  const donorMatchLabel = useMemo(() => {
    if (!detail) {
      return 'Donor status unknown';
    }
    if (!detail.donorId) {
      return 'Donor missing';
    }
    if (detail.dedupeStatus === 'needs_review') {
      return 'Possible donor match';
    }
    if (dedupeDiagnostics?.matchType === 'email') {
      return 'Auto-matched donor';
    }
    if (dedupeDiagnostics) {
      return 'Donor matched';
    }
    return 'Donor confirmed';
  }, [detail, dedupeDiagnostics]);

  useEffect(() => {
    if (!detail) {
      return;
    }
    const shouldExpand =
      !detail.donorId || detail.dedupeStatus === 'needs_review';
    setDonorPanelExpanded(shouldExpand);
  }, [detail?.id, detail?.donorId, detail?.dedupeStatus]);

  if (!stagingId) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer drawer--wide">
        <DrawerHeader
          stagingId={stagingId}
          title="Review staging"
          onClose={onClose}
        />

        {loading ? (
          <div className="f-state-block">Loading record…</div>
        ) : error ? (
          <div className="f-alert f-alert--error" role="alert">
            {error}
            <div>
              <button
                type="button"
                className="f-btn--secondary"
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
          <div className="f-state-block">Record not found.</div>
        ) : (
          <>
            <section className="drawer-section status-summary">
              <div className="f-flex f-flex-wrap f-gap-2 f-items-center">
                <span
                  className={`f-badge ${
                    diagnostics.hasBlockers
                      ? 'f-bg-amber-100 f-text-amber-800'
                      : 'f-bg-emerald-100 f-text-emerald-800'
                  }`}
                >
                  {diagnostics.hasBlockers ? 'Needs attention' : 'Eligible now'}
                </span>
                {diagnostics.blockers.length > 0 ? (
                  <span className="f-text-sm f-text-slate-700">
                    {diagnostics.blockers[0]}
                    {diagnostics.blockers.length > 1
                      ? ` +${diagnostics.blockers.length - 1} more`
                      : ''}
                  </span>
                ) : null}
                {detail.giftBatchId ? (
                  <span className="f-badge f-bg-slate-200 f-text-ink">
                    Batch: <code>{detail.giftBatchId}</code>
                  </span>
                ) : null}
              </div>
              {actionError ? (
                <div className="f-alert f-alert--error f-mt-3" role="alert">
                  {actionError}
                </div>
              ) : null}
              {actionNotice ? (
                <div className="f-alert f-alert--info f-mt-2" role="status">
                  {actionNotice}
                </div>
              ) : null}
            </section>

            <DrawerReviewSection
              detail={detail}
              editForm={editForm}
              onFieldChange={handleFieldChange}
              onInKindToggle={handleInKindEditToggle}
              appealsLoading={appealsLoading}
              appealError={appealError}
              appealOptions={appealOptions}
              actionBusy={actionBusy}
              loading={loading}
              onAssignDonor={handleAssignDonor}
              intentOptions={intentOptions}
              donorMatchLabel={donorMatchLabel}
              donorPanelExpanded={donorPanelExpanded}
              onToggleDonorPanel={() => setDonorPanelExpanded((prev) => !prev)}
              donorPanel={{
                selectedDonor,
                classifiedDuplicates,
                selectedDuplicateId: detail.donorId ?? null,
                onSelectDuplicate: (id: string) => {
                  void handleAssignDonor(id);
                },
                onOpenSearch: donorSearch.open,
                onChangeDonor: donorSearch.open,
                potentialDuplicateMessage: dedupeDiagnostics
                  ? `Possible match (${dedupeDiagnostics.matchType ?? 'review'})`
                  : null,
                duplicateLookupError: null,
                disableActions: loading || actionBusy === 'update',
              }}
            />

            <details className="drawer-section">
              <summary className="drawer-section-header">
                <h4>Details & audit</h4>
              </summary>
              <div className="f-space-y-4">
                <dl className="drawer-meta drawer-meta--single">
                  <div>
                    <dt>Processing status</dt>
                    <dd>{detail.processingStatus ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Dedupe status</dt>
                    <dd>{dedupeStatusLabel}</dd>
                  </div>
                  <div>
                    <dt>Trust posture</dt>
                    <dd>
                      {trustLabel}
                      {detail.intakeSource ? ` (${detail.intakeSource})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Blockers</dt>
                    <dd>
                      {diagnostics.blockers.length > 0
                        ? diagnostics.blockers.join(', ')
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Warnings</dt>
                    <dd>
                      {diagnostics.warnings.length > 0
                        ? diagnostics.warnings.join(', ')
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Receipt status</dt>
                    <dd>
                      {detail.receiptStatus ?? '—'}
                      {detail.receiptPolicyApplied
                        ? ` (${detail.receiptPolicyApplied})`
                        : ''}
                    </dd>
                  </div>
                </dl>

                <section>
                  <div className="drawer-section-header">
                    <h4>Raw payload</h4>
                    <button
                      type="button"
                      className="f-btn--ghost"
                      onClick={() => setShowRawPayload((prev) => !prev)}
                    >
                      {showRawPayload ? 'Hide JSON' : 'Show JSON'}
                    </button>
                  </div>
                  {showRawPayload ? (
                    detail.rawPayload ? (
                      <pre className="drawer-json">{safePrettyJson(detail.rawPayload)}</pre>
                    ) : (
                      <div className="f-state-block">Raw payload not available.</div>
                    )
                  ) : (
                    <p className="f-help-text">
                      Raw staging JSON remains hidden. Toggle to show.
                    </p>
                  )}
                </section>
              </div>
            </details>

            <DonorSearchModal
              isOpen={donorSearch.isOpen}
              onClose={donorSearch.close}
              searchTerm={donorSearch.searchTerm}
              onSearchTermChange={donorSearch.setSearchTerm}
              onSearchSubmit={(event) =>
                donorSearch.search(event, {
                  firstName: detail.donorFirstName ?? undefined,
                  lastName: detail.donorLastName ?? undefined,
                  email: detail.donorEmail ?? undefined,
                })
              }
              searchLoading={donorSearch.loading}
              searchError={donorSearch.error}
              searchResults={donorSearch.results}
              onSelectDonor={(id) => {
                void handleAssignDonor(id);
                donorSearch.close();
              }}
              formState={{
                contactFirstName: detail.donorFirstName ?? '',
                contactLastName: detail.donorLastName ?? '',
                contactEmail: detail.donorEmail ?? '',
              }}
            />

            {detail.processingStatus === 'process_failed' ? (
              <section className="drawer-section">
                <div className="drawer-section-header">
                  <h4>Process failed</h4>
                  <button
                    type="button"
                    className="f-btn--secondary"
                    onClick={() => {
                      void handleProcessNow();
                    }}
                    disabled={actionBusy === 'process' || loading}
                  >
                    {actionBusy === 'process' ? 'Retrying…' : 'Retry processing'}
                  </button>
                </div>
                <p className="small-text f-m-0 f-text-danger">
                  {detail.errorDetail ?? 'Unknown error'}
                </p>
              </section>
            ) : null}
          </>
        )}

        <footer className="drawer-footer">
          <div className="drawer-footer-group">
            <button
              type="button"
              className="f-btn--ghost"
              onClick={handleResetEdits}
              disabled={actionBusy === 'update' || loading}
            >
              Reset
            </button>
            <button
              type="button"
              className="f-btn--secondary"
              onClick={handleSaveEdits}
              disabled={actionBusy === 'update' || loading}
            >
              {actionBusy === 'update' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          <div className="drawer-footer-group">
            <button
              type="button"
              className="f-btn--ghost"
              onClick={handleMarkReady}
              disabled={actionBusy === 'mark-ready' || loading}
              title="Marks this gift as reviewed and ready to process"
            >
              {actionBusy === 'mark-ready' ? 'Marking…' : 'Ready to process'}
            </button>
            <button
              type="button"
              className="f-btn--primary"
              onClick={handleProcessNow}
              disabled={actionBusy === 'process' || loading}
              title="Processes this gift immediately"
            >
              {actionBusy === 'process' ? 'Processing…' : 'Process now'}
            </button>
          </div>
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
