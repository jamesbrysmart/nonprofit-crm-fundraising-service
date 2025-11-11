import type {
  ChangeEvent,
  DetailedHTMLProps,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { GiftStagingDetailResponse } from '../../api';
import { formatDate } from './stagingQueueUtils';
import {
  EditFormState,
  GiftDrawerFocus,
  ParsedDedupeDiagnostics,
  GiftIntentOption,
} from './GiftStagingDrawer';

type GiftStagingRecord = NonNullable<GiftStagingDetailResponse['data']['giftStaging']>;

interface DrawerReviewSectionProps {
  detail: GiftStagingRecord;
  editForm: EditFormState;
  activeSection: GiftDrawerFocus;
  onSectionChange(section: GiftDrawerFocus): void;
  onFieldChange(field: keyof EditFormState): (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onInKindToggle(event: ChangeEvent<HTMLInputElement>): void;
  appealsLoading: boolean;
  appealError: string | null;
  appealOptions: Array<{ id: string; name?: string | null }>;
  appealListId: string;
  actionBusy: 'mark-ready' | 'process' | 'update' | null;
  loading: boolean;
  onSaveEdits(): void;
  onResetEdits(): void;
  dedupeDiagnostics: ParsedDedupeDiagnostics | null;
  onAssignDonor(donorId: string): void;
  intentOptions: Array<{ value: GiftIntentOption; label: string }>;
}

export function DrawerReviewSection({
  detail,
  editForm,
  activeSection,
  onSectionChange,
  onFieldChange,
  onInKindToggle,
  appealsLoading,
  appealError,
  appealOptions,
  appealListId,
  actionBusy,
  loading,
  onSaveEdits,
  onResetEdits,
  dedupeDiagnostics,
  onAssignDonor,
  intentOptions,
}: DrawerReviewSectionProps): JSX.Element {
  return (
    <section className="drawer-section">
      <div className="drawer-section-header">
        <h4>Review</h4>
        <div className="drawer-section-tabs">
          <DrawerTab
            label="Overview"
            isActive={activeSection === 'overview'}
            onClick={() => onSectionChange('overview')}
          />
          <DrawerTab
            label="Duplicates"
            isActive={activeSection === 'duplicates'}
            onClick={() => onSectionChange('duplicates')}
          />
          <DrawerTab
            label="Recurring"
            isActive={activeSection === 'recurring'}
            onClick={() => onSectionChange('recurring')}
          />
        </div>
      </div>

      {activeSection === 'overview' ? (
        <>
          <div className="drawer-edit-grid">
            <LabeledInput
              label="Amount (major)"
              type="number"
              step="0.01"
              value={editForm.amountMajor}
              onChange={onFieldChange('amountMajor')}
              disabled={actionBusy === 'update' || loading}
            />
            <LabeledInput
              label="Currency"
              type="text"
              value={editForm.currency}
              onChange={onFieldChange('currency')}
              disabled={actionBusy === 'update' || loading}
              maxLength={3}
            />
            <LabeledInput
              label="Date received"
              type="date"
              value={editForm.dateReceived}
              onChange={onFieldChange('dateReceived')}
              disabled={actionBusy === 'update' || loading}
            />
            <LabeledInput
              label="Fund ID"
              type="text"
              value={editForm.fundId}
              onChange={onFieldChange('fundId')}
              disabled={actionBusy === 'update' || loading}
            />
            <LabeledInput
              label="Appeal"
              type="text"
              value={editForm.appealId}
              onChange={onFieldChange('appealId')}
              disabled={actionBusy === 'update' || loading}
              listId={appealListId}
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

            <LabeledInput
              label="Tracking code ID"
              type="text"
              value={editForm.trackingCodeId}
              onChange={onFieldChange('trackingCodeId')}
              disabled={actionBusy === 'update' || loading}
            />
            <label className="drawer-field">
              <span>Gift intent</span>
              <select
                value={editForm.giftIntent}
                onChange={onFieldChange('giftIntent')}
                disabled={actionBusy === 'update' || loading}
              >
                {intentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <LabeledInput
              label="Opportunity ID"
              type="text"
              value={editForm.opportunityId}
              onChange={onFieldChange('opportunityId')}
              disabled={actionBusy === 'update' || loading}
            />
            <LabeledInput
              label="Batch ID"
              type="text"
              value={editForm.giftBatchId}
              onChange={onFieldChange('giftBatchId')}
              disabled={actionBusy === 'update' || loading}
            />
            <LabeledTextarea
              label="Notes"
              value={editForm.notes}
              onChange={onFieldChange('notes')}
              disabled={actionBusy === 'update' || loading}
            />
            <label className="drawer-field drawer-field--checkbox">
              <input
                type="checkbox"
                checked={editForm.isInKind}
                onChange={onInKindToggle}
                disabled={actionBusy === 'update' || loading}
              />
              <span>Includes in-kind component</span>
            </label>
            {editForm.isInKind ? (
              <>
                <LabeledTextarea
                  label="In-kind description"
                  value={editForm.inKindDescription}
                  onChange={onFieldChange('inKindDescription')}
                  disabled={actionBusy === 'update' || loading}
                  rows={3}
                />
                <LabeledInput
                  label="Estimated value"
                  type="number"
                  step="0.01"
                  value={editForm.estimatedValue}
                  onChange={onFieldChange('estimatedValue')}
                  disabled={actionBusy === 'update' || loading}
                />
              </>
            ) : null}
          </div>
          <div className="drawer-edit-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onSaveEdits}
              disabled={actionBusy === 'update' || loading}
            >
              {actionBusy === 'update' ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={onResetEdits}
              disabled={actionBusy === 'update' || loading}
            >
              Reset
            </button>
          </div>
        </>
      ) : null}

      {activeSection === 'duplicates' ? (
        dedupeDiagnostics ? (
          <>
            <dl className="drawer-meta">
              <div>
                <dt>Match type</dt>
                <dd>{dedupeDiagnostics.matchType}</dd>
              </div>
              <div>
                <dt>Matched donor</dt>
                <dd>
                  {dedupeDiagnostics.matchedDonorId ? (
                    <code>{dedupeDiagnostics.matchedDonorId}</code>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>
                  {typeof dedupeDiagnostics.confidence === 'number'
                    ? `${Math.round(dedupeDiagnostics.confidence * 100)}%`
                    : '—'}
                </dd>
              </div>
            </dl>
            <div className="drawer-meta">
              <div>
                <dt>Current donor</dt>
                <dd>{detail.donorId ? <code>{detail.donorId}</code> : '—'}</dd>
              </div>
              {dedupeDiagnostics.matchedDonorId ? (
                <div>
                  <dt>Matched donor</dt>
                  <dd>{<code>{dedupeDiagnostics.matchedDonorId}</code>}</dd>
                </div>
              ) : null}
            </div>
            {dedupeDiagnostics.matchedDonorId ? (
              <div className="duplicate-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onAssignDonor(dedupeDiagnostics.matchedDonorId!)}
                  disabled={actionBusy === 'update' || loading}
                >
                  Assign matched donor
                </button>
              </div>
            ) : null}
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
                          onClick={() => onAssignDonor(candidateId)}
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
  );
}

function DrawerTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick(): void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`secondary-button ${isActive ? 'secondary-button--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LabeledInput({
  label,
  listId,
  ...props
}: {
  label: string;
  listId?: string;
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>): JSX.Element {
  return (
    <label className="drawer-field">
      <span>{label}</span>
      <input {...props} list={listId} />
    </label>
  );
}

function LabeledTextarea({
  label,
  rows = 3,
  ...props
}: {
  label: string;
  rows?: number;
} & DetailedHTMLProps<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>): JSX.Element {
  return (
    <label className="drawer-field drawer-field--textarea">
      <span>{label}</span>
      <textarea rows={rows} {...props} />
    </label>
  );
}
