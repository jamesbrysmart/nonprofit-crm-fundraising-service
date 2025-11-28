import { useState } from 'react';
import { DrawerHeader } from './DrawerHeader';
import { DrawerStatusDetails } from './DrawerStatusDetails';
import { DrawerReviewSection } from './DrawerReviewSection';
import { GiftDrawerFocus } from './types';
import { useGiftStagingDrawerController } from '../../hooks/useGiftStagingDrawerController';
import { useStagingDonorHydration } from '../../hooks/useStagingDonorHydration';
import { fallbackCompanyDisplay } from '../../utils/donorAdapters';
import { DonorDisplay } from '../../types/donor';
import { useDonorSearch } from '../../hooks/useDonorSearch';
import { DonorSearchModal } from '../manual-entry/DonorSearchModal';

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
    intentLabel,
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

  if (!stagingId) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <div className="drawer drawer--wide">
        <DrawerHeader
          stagingId={stagingId}
          loading={loading}
          actionBusy={actionBusy}
          actionError={actionError}
          title="Review staging"
          onClose={onClose}
          onMarkReady={handleMarkReady}
          onProcess={handleProcessNow}
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
                <span className="f-badge f-bg-slate-200 f-text-ink">
                  Donor: {detail.donorId ? <code>{detail.donorId}</code> : 'New donor'}
                </span>
                {detail.giftBatchId ? (
                  <span className="f-badge f-bg-slate-200 f-text-ink">
                    Batch: <code>{detail.giftBatchId}</code>
                  </span>
                ) : null}
                {detail.receiptStatus ? (
                  <span className="f-badge f-bg-slate-200 f-text-ink">
                    Receipt: {detail.receiptStatus}
                    {detail.receiptPolicyApplied ? ` (${detail.receiptPolicyApplied})` : ''}
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

            <DrawerStatusDetails
              detail={detail}
              dedupeStatusLabel={dedupeStatusLabel}
              intentLabel={intentLabel}
            />

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
              onSaveEdits={handleSaveEdits}
              onResetEdits={handleResetEdits}
              dedupeDiagnostics={dedupeDiagnostics}
              onAssignDonor={handleAssignDonor}
              intentOptions={intentOptions}
              onAcknowledgeDuplicate={() => {
                void handleMarkReady();
              }}
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

            {detail.promotionStatus === 'commit_failed' ? (
              <section className="drawer-section">
                <div className="drawer-section-header">
                  <h4>Commit failed</h4>
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

            <section className="drawer-section">
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
                <p className="f-help-text">Raw staging JSON remains hidden. Toggle to show.</p>
              )}
            </section>
          </>
        )}

        <footer className="drawer-footer">
          <button
            type="button"
            className="f-btn--secondary"
            onClick={() => {
              void reload();
            }}
            disabled={loading}
          >
            Reload record
          </button>
          <button
            type="button"
            className="f-btn--ghost"
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
