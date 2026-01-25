import type { ChangeEvent } from 'react';
import { GiftStagingDetailResponse } from '../../api';
import { EditFormState, ParsedDedupeDiagnostics } from '../../hooks/useGiftStagingDrawerController';
import { GiftIntentOption } from '../../types/giftIntent';
import { GiftDetailsForm } from '../common/GiftDetailsForm';
import { DonorDisplay } from '../../types/donor';
import { DonorSelectionPanel, ClassifiedDuplicate as DisplayDuplicate } from '../manual-entry/DonorSelectionPanel';

type GiftStagingRecord = NonNullable<GiftStagingDetailResponse['data']['giftStaging']>;

interface DrawerReviewSectionProps {
  detail: GiftStagingRecord;
  editForm: EditFormState;
  onFieldChange(field: keyof EditFormState): (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onInKindToggle(event: ChangeEvent<HTMLInputElement>): void;
  appealsLoading: boolean;
  appealError: string | null;
  appealOptions: Array<{ id: string; name?: string | null }>;
  actionBusy: 'mark-ready' | 'process' | 'update' | null;
  loading: boolean;
  onSaveEdits(): void;
  onResetEdits(): void;
  dedupeDiagnostics: ParsedDedupeDiagnostics | null;
  onAssignDonor(donorId: string): void;
  intentOptions: Array<{ value: GiftIntentOption; label: string }>;
  onAcknowledgeDuplicate?(): void;
  donorPanel?: {
    selectedDonor?: DonorDisplay;
    classifiedDuplicates: DisplayDuplicate[];
    selectedDuplicateId: string | null;
    onSelectDuplicate(id: string): void;
    onOpenSearch?(): void;
    onChangeDonor?(): void;
    potentialDuplicateMessage?: string | null;
    duplicateLookupError?: string | null;
    disableActions?: boolean;
  };
}

export function DrawerReviewSection({
  detail,
  editForm,
  onFieldChange,
  onInKindToggle,
  appealsLoading,
  appealError,
  appealOptions,
  actionBusy,
  loading,
  onSaveEdits,
  onResetEdits,
  dedupeDiagnostics,
  onAssignDonor,
  intentOptions,
  onAcknowledgeDuplicate,
  donorPanel,
}: DrawerReviewSectionProps): JSX.Element {
  const handleDetailsChange = (
    field: string,
    value: string | boolean,
  ): void => {
    if (field === 'isInKind') {
      const synthetic = {
        target: { checked: Boolean(value) },
      } as unknown as ChangeEvent<HTMLInputElement>;
      onInKindToggle(synthetic);
      return;
    }
    const mappedField =
      field === 'amount'
        ? 'amountMajor'
        : field === 'currency'
          ? 'currencyCode'
          : field === 'date'
            ? 'giftDate'
            : field;
    const synthetic = {
      target: { value },
    } as unknown as ChangeEvent<HTMLInputElement>;
    onFieldChange(mappedField as keyof EditFormState)(synthetic);
  };

  return (
    <section className="drawer-section">
      <div className="drawer-section-header">
        <h4>Review & edit</h4>
      </div>

      {donorPanel ? (
        <div className="f-space-y-3">
          <DonorSelectionPanel
            selectedDonor={donorPanel.selectedDonor}
            onChangeDonor={donorPanel.onChangeDonor ?? (() => {})}
            onClearSelectedDonor={() => {
              // No clear donor pathway yet; noop.
            }}
            duplicateLookupError={donorPanel.duplicateLookupError ?? null}
            showDuplicates={donorPanel.classifiedDuplicates.length > 0}
            classifiedDuplicates={donorPanel.classifiedDuplicates}
            selectedDuplicateId={donorPanel.selectedDuplicateId}
            onSelectDuplicate={donorPanel.onSelectDuplicate}
            onOpenSearch={donorPanel.onOpenSearch ?? (() => {})}
            potentialDuplicateMessage={donorPanel.potentialDuplicateMessage ?? null}
            disableActions={donorPanel.disableActions ?? false}
          />
        </div>
      ) : null}

      <GiftDetailsForm
        values={{
          amount: editForm.amountMajor,
          currency: editForm.currencyCode,
          date: editForm.giftDate,
          fundId: editForm.fundId,
          appealId: editForm.appealId,
          opportunityId: editForm.opportunityId,
          giftIntent: editForm.giftIntent,
          notes: editForm.notes,
          isInKind: editForm.isInKind,
          inKindDescription: editForm.inKindDescription,
          estimatedValue: editForm.estimatedValue,
        }}
        onChange={(field, value) => handleDetailsChange(field as string, value)}
        appealOptions={appealOptions}
        appealsLoading={appealsLoading}
        appealsError={appealError}
        intentOptions={intentOptions}
        disabled={actionBusy === 'update' || loading}
        showFund
        showOpportunity
        showIntent
        showNotes
        showInKind
      />

      {detail.recurringAgreementId ? (
        <>
          <div className="drawer-section-header">
            <h4>Recurring</h4>
          </div>
          <dl className="drawer-meta">
            <div>
              <dt>Recurring agreement</dt>
              <dd>{detail.recurringAgreementId ? <code>{detail.recurringAgreementId}</code> : '—'}</dd>
            </div>
            <div>
              <dt>Expected installment</dt>
              <dd>{detail.expectedAt ?? '—'}</dd>
            </div>
            <div>
              <dt>Provider context</dt>
              <dd>{detail.provider ?? '—'}</dd>
            </div>
          </dl>
        </>
      ) : null}

      <div className="drawer-edit-actions">
        <button
          type="button"
          className="f-btn--secondary"
          onClick={onSaveEdits}
          disabled={actionBusy === 'update' || loading}
        >
          {actionBusy === 'update' ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="f-btn--ghost"
          onClick={onResetEdits}
          disabled={actionBusy === 'update' || loading}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
