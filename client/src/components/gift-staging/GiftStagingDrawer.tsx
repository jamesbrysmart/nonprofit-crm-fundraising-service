import { useState } from 'react';
import { DrawerHeader } from './DrawerHeader';
import { DrawerStatusSummary } from './DrawerStatusSummary';
import { DrawerStatusDetails } from './DrawerStatusDetails';
import { DrawerReviewSection } from './DrawerReviewSection';
import { GiftDrawerFocus } from './types';
import { useGiftStagingDrawerController } from '../../hooks/useGiftStagingDrawerController';

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
    appealListId,
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
    activeSection,
    setActiveSection,
    dedupeStatusLabel,
    dedupeDiagnostics,
    intentLabel,
    intentOptions,
  } = useGiftStagingDrawerController(stagingId, focus, onRefreshList);

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
              onFieldChange={handleFieldChange}
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
