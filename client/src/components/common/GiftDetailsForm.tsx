import type { ChangeEvent } from 'react';

export type GiftDetailsFormValues = {
  amount: string;
  currency: string;
  date: string;
  fundId?: string;
  appealId?: string;
  opportunityId?: string;
  giftIntent?: string;
  notes?: string;
  isInKind?: boolean;
  inKindDescription?: string;
  estimatedValue?: string;
};

export type GiftDetailsFormProps = {
  values: GiftDetailsFormValues;
  onChange: (field: keyof GiftDetailsFormValues, value: string | boolean) => void;
  appealOptions?: Array<{ id: string; name?: string | null }>;
  appealsLoading?: boolean;
  appealsError?: string | null;
  intentOptions?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  showFund?: boolean;
  showOpportunity?: boolean;
  showIntent?: boolean;
  showNotes?: boolean;
  showInKind?: boolean;
};

export function GiftDetailsForm({
  values,
  onChange,
  appealOptions = [],
  appealsLoading,
  appealsError,
  intentOptions = [],
  disabled = false,
  showFund = false,
  showOpportunity = false,
  showIntent = false,
  showNotes = false,
  showInKind = false,
}: GiftDetailsFormProps): JSX.Element {
  const handleString =
    (field: keyof GiftDetailsFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange(field, event.target.value);
    };

  const handleCheckbox =
    (field: keyof GiftDetailsFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(field, event.target.checked);
    };

  return (
    <div className="f-space-y-4">
      <div className="f-field">
        <label className="f-field-label">Amount</label>
        <div className="f-flex f-flex-col sm:f-flex-row f-gap-3">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className="f-input sm:f-flex-1"
            value={values.amount}
            onChange={handleString('amount')}
            disabled={disabled}
          />
          <input
            type="text"
            className="f-input sm:f-w-24"
            maxLength={3}
            value={values.currency}
            onChange={handleString('currency')}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="f-field">
        <label className="f-field-label">Date received</label>
        <input
          type="date"
          className="f-input"
          value={values.date}
          onChange={handleString('date')}
          disabled={disabled}
        />
      </div>

      {showFund ? (
        <div className="f-field">
          <label className="f-field-label">Fund (optional)</label>
          <input
            type="text"
            className="f-input"
            value={values.fundId ?? ''}
            onChange={handleString('fundId')}
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="f-field">
        <label className="f-field-label">Appeal (optional)</label>
        <select
          className="f-input"
          value={values.appealId ?? ''}
          onChange={handleString('appealId')}
          disabled={disabled || (appealsLoading && appealOptions.length === 0)}
        >
          <option value="">No appeal</option>
          {appealOptions.map((appeal) => (
            <option key={appeal.id} value={appeal.id}>
              {appeal.name ?? 'Untitled appeal'}
            </option>
          ))}
        </select>
        {appealsLoading ? (
          <span className="f-help-text f-text-slate-500">Loading appeals…</span>
        ) : appealsError ? (
          <span className="f-help-text f-text-danger">{appealsError}</span>
        ) : null}
      </div>

      {showOpportunity ? (
        <div className="f-field">
          <label className="f-field-label">Opportunity (optional)</label>
          <input
            type="text"
            className="f-input"
            value={values.opportunityId ?? ''}
            onChange={handleString('opportunityId')}
            disabled={disabled}
            placeholder="Enter opportunity id"
          />
        </div>
      ) : null}

      {showIntent ? (
        <div className="f-field">
          <label className="f-field-label">Gift intent</label>
          <select
            className="f-input"
            value={values.giftIntent ?? ''}
            onChange={handleString('giftIntent')}
            disabled={disabled}
          >
            {intentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showNotes ? (
        <div className="f-field">
          <label className="f-field-label">Notes</label>
          <textarea
            rows={3}
            className="f-input"
            value={values.notes ?? ''}
            onChange={handleString('notes')}
            disabled={disabled}
          />
        </div>
      ) : null}

      {showInKind ? (
        <>
          <div className="f-field f-flex f-items-center f-gap-2">
            <input
              type="checkbox"
              id="inKindToggle"
              checked={Boolean(values.isInKind)}
              onChange={handleCheckbox('isInKind')}
              disabled={disabled}
            />
            <label htmlFor="inKindToggle" className="f-field-label f-m-0">
              Includes in-kind component
            </label>
          </div>
          {values.isInKind ? (
            <>
              <div className="f-field">
                <label className="f-field-label">In-kind description</label>
                <textarea
                  rows={3}
                  className="f-input"
                  value={values.inKindDescription ?? ''}
                  onChange={handleString('inKindDescription')}
                  disabled={disabled}
                />
              </div>
              <div className="f-field">
                <label className="f-field-label">Estimated value</label>
                <input
                  type="number"
                  step="0.01"
                  className="f-input"
                  value={values.estimatedValue ?? ''}
                  onChange={handleString('estimatedValue')}
                  disabled={disabled}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
