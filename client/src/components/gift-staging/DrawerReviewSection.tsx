import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { GiftStagingDetailResponse } from '../../api';
import { EditFormState } from '../../hooks/useGiftStagingDrawerController';
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
  onAssignDonor(donorId: string): void;
  intentOptions: Array<{ value: GiftIntentOption; label: string }>;
  donorMatchLabel: string;
  donorPanelExpanded: boolean;
  onToggleDonorPanel(): void;
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
  onAssignDonor,
  intentOptions,
  donorMatchLabel,
  donorPanelExpanded,
  onToggleDonorPanel,
  donorPanel,
}: DrawerReviewSectionProps): JSX.Element {
  const [showDonorFields, setShowDonorFields] = useState(false);
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

  const donorName = `${editForm.donorFirstName} ${editForm.donorLastName}`.trim();
  const donorEmail = editForm.donorEmail.trim();

  return (
    <section className="drawer-section">
      <div className="drawer-section-header">
        <h4>Review & edit</h4>
      </div>

      <div className="f-space-y-3">
        <div className="f-flex f-items-center f-justify-between f-gap-3">
          <div className="f-flex f-items-center f-gap-2">
            <span className="f-text-sm f-font-semibold f-text-ink">Donor</span>
            <span className="f-badge f-bg-slate-100 f-text-slate-700">
              {donorMatchLabel}
            </span>
          </div>
          <button
            type="button"
            className="f-btn--ghost"
            onClick={onToggleDonorPanel}
            disabled={loading || actionBusy === 'update'}
          >
            {donorPanelExpanded ? 'Hide donor match' : 'Review donor match'}
          </button>
        </div>

        <div className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-p-4 f-space-y-3">
          <div className="f-flex f-justify-between f-items-start f-gap-3">
            <div>
              <p className="f-text-xs f-uppercase f-tracking-[0.08em] f-text-slate-500 f-m-0">
                Staged donor details
              </p>
              <p className="f-text-sm f-font-semibold f-text-ink f-m-0">
                {donorName.length > 0 ? donorName : '—'}
              </p>
              <p className="f-text-sm f-text-slate-600 f-m-0">
                {donorEmail.length > 0 ? donorEmail : 'No email captured'}
              </p>
            </div>
            <button
              type="button"
              className="f-btn--ghost"
              onClick={() => setShowDonorFields((prev) => !prev)}
              disabled={loading || actionBusy === 'update'}
            >
              {showDonorFields ? 'Hide edits' : 'Edit details'}
            </button>
          </div>
          <p className="f-help-text f-m-0">
            No donor linked yet. Confirm a match or search the directory before processing.
          </p>
          {showDonorFields ? (
            <div className="f-space-y-3">
              <div className="f-field">
                <label className="f-field-label">First name</label>
                <input
                  type="text"
                  className="f-input"
                  value={editForm.donorFirstName}
                  onChange={onFieldChange('donorFirstName')}
                  disabled={loading || actionBusy === 'update'}
                />
              </div>
              <div className="f-field">
                <label className="f-field-label">Last name</label>
                <input
                  type="text"
                  className="f-input"
                  value={editForm.donorLastName}
                  onChange={onFieldChange('donorLastName')}
                  disabled={loading || actionBusy === 'update'}
                />
              </div>
              <div className="f-field">
                <label className="f-field-label">Email (optional)</label>
                <input
                  type="email"
                  className="f-input"
                  value={editForm.donorEmail}
                  onChange={onFieldChange('donorEmail')}
                  disabled={loading || actionBusy === 'update'}
                />
              </div>
            </div>
          ) : null}
        </div>

        {donorPanel && donorPanelExpanded ? (
          <DonorSelectionPanel
            selectedDonor={donorPanel.selectedDonor}
            onChangeDonor={donorPanel.onChangeDonor ?? (() => {})}
            onClearSelectedDonor={() => {
              // No clear donor pathway yet; noop.
            }}
            duplicateLookupError={donorPanel.duplicateLookupError ?? null}
            showDuplicates={false}
            classifiedDuplicates={donorPanel.classifiedDuplicates}
            selectedDuplicateId={donorPanel.selectedDuplicateId}
            onSelectDuplicate={donorPanel.onSelectDuplicate}
            onOpenSearch={donorPanel.onOpenSearch ?? (() => {})}
            potentialDuplicateMessage={donorPanel.potentialDuplicateMessage ?? null}
            disableActions={donorPanel.disableActions ?? false}
            showEmptyState={false}
          />
        ) : (
          <div className="f-rounded-lg f-border f-border-slate-200 f-bg-slate-50 f-p-3 f-text-sm f-text-slate-700">
            {detail.donorId ? (
              <span>
                Linked donor: <code>{detail.donorId}</code>
              </span>
            ) : (
              <span>No donor linked yet.</span>
            )}
          </div>
        )}
      </div>

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
        showFund={false}
        showOpportunity={false}
        showIntent={false}
        showNotes={false}
        showInKind={false}
      />

      <details className="f-rounded-lg f-border f-border-slate-200 f-bg-white f-p-4">
        <summary className="f-text-sm f-font-semibold f-text-ink f-cursor-pointer">
          More details
        </summary>
        <div className="f-mt-4 f-space-y-4">
          <div className="f-field">
            <label className="f-field-label">Fund (optional)</label>
            <input
              type="text"
              className="f-input"
              value={editForm.fundId ?? ''}
              onChange={onFieldChange('fundId')}
              disabled={actionBusy === 'update' || loading}
            />
          </div>
          <div className="f-field">
            <label className="f-field-label">Opportunity (optional)</label>
            <input
              type="text"
              className="f-input"
              value={editForm.opportunityId ?? ''}
              onChange={onFieldChange('opportunityId')}
              disabled={actionBusy === 'update' || loading}
            />
          </div>
          <div className="f-field">
            <label className="f-field-label">Gift intent</label>
            <select
              className="f-input"
              value={editForm.giftIntent ?? ''}
              onChange={onFieldChange('giftIntent')}
              disabled={actionBusy === 'update' || loading}
            >
              {intentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="f-field">
            <label className="f-field-label">Notes</label>
            <textarea
              rows={3}
              className="f-input"
              value={editForm.notes ?? ''}
              onChange={onFieldChange('notes')}
              disabled={actionBusy === 'update' || loading}
            />
          </div>
          <div className="f-field f-flex f-items-center f-gap-2">
            <input
              type="checkbox"
              id="inKindToggleDrawer"
              checked={Boolean(editForm.isInKind)}
              onChange={onInKindToggle}
              disabled={actionBusy === 'update' || loading}
            />
            <label htmlFor="inKindToggleDrawer" className="f-field-label f-m-0">
              Includes in-kind component
            </label>
          </div>
          {editForm.isInKind ? (
            <>
              <div className="f-field">
                <label className="f-field-label">In-kind description</label>
                <textarea
                  rows={3}
                  className="f-input"
                  value={editForm.inKindDescription ?? ''}
                  onChange={onFieldChange('inKindDescription')}
                  disabled={actionBusy === 'update' || loading}
                />
              </div>
              <div className="f-field">
                <label className="f-field-label">Estimated value</label>
                <input
                  type="number"
                  step="0.01"
                  className="f-input"
                  value={editForm.estimatedValue ?? ''}
                  onChange={onFieldChange('estimatedValue')}
                  disabled={actionBusy === 'update' || loading}
                />
              </div>
            </>
          ) : null}

          {detail.recurringAgreementId ? (
            <>
              <div className="drawer-section-header">
                <h4>Recurring</h4>
              </div>
              <dl className="drawer-meta">
                <div>
                  <dt>Recurring agreement</dt>
                  <dd>
                    {detail.recurringAgreementId ? (
                      <code>{detail.recurringAgreementId}</code>
                    ) : (
                      '—'
                    )}
                  </dd>
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
        </div>
      </details>
    </section>
  );
}
