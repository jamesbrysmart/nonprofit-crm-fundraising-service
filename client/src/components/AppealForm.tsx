import type { ChangeEvent, FormEvent } from 'react';

export type AppealFormState = {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  goalAmountValue: string;
  goalAmountCurrency: string;
  budgetAmountValue: string;
  budgetAmountCurrency: string;
  targetSolicitedCount: string;
  description: string;
};

export const createEmptyAppealForm = (): AppealFormState => ({
  name: '',
  type: '',
  startDate: '',
  endDate: '',
  goalAmountValue: '',
  goalAmountCurrency: 'GBP',
  budgetAmountValue: '',
  budgetAmountCurrency: 'GBP',
  targetSolicitedCount: '',
  description: '',
});

interface AppealFormProps {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  formState: AppealFormState;
  isSubmitting: boolean;
  error: string | null;
  onChange: (changes: Partial<AppealFormState>) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  idPrefix?: string;
}

export function AppealForm({
  title,
  submitLabel,
  pendingLabel,
  formState,
  isSubmitting,
  error,
  onChange,
  onCancel,
  onSubmit,
  idPrefix,
}: AppealFormProps): JSX.Element {
  const fieldPrefix = idPrefix ? `${idPrefix}-` : '';
  const handleFieldChange =
    (field: keyof AppealFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange({ [field]: event.target.value });
    };

  return (
    <div className="appeal-form-wrapper">
      <form className="appeal-form" onSubmit={onSubmit}>
        <div className="form-header">
          <h3>{title}</h3>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <div className="form-row">
          <label htmlFor={`${fieldPrefix}appeal-name`}>Name</label>
          <input
            id={`${fieldPrefix}appeal-name`}
            type="text"
            value={formState.name}
            onChange={handleFieldChange('name')}
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor={`${fieldPrefix}appeal-type`}>Type (optional)</label>
          <select
            id={`${fieldPrefix}appeal-type`}
            value={formState.type}
            onChange={handleFieldChange('type')}
          >
            <option value="">Select type</option>
            <option value="email">Email</option>
            <option value="mail">Mail</option>
            <option value="social">Social</option>
            <option value="event">Event</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div className="form-row-inline">
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-start`}>Start date</label>
            <input
              id={`${fieldPrefix}appeal-start`}
              type="date"
              value={formState.startDate}
              onChange={handleFieldChange('startDate')}
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-end`}>End date</label>
            <input
              id={`${fieldPrefix}appeal-end`}
              type="date"
              value={formState.endDate}
              onChange={handleFieldChange('endDate')}
            />
          </div>
        </div>

        <div className="form-row-inline">
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-goal`}>Goal amount</label>
            <input
              id={`${fieldPrefix}appeal-goal`}
              type="number"
              step="0.01"
              min="0"
              value={formState.goalAmountValue}
              onChange={handleFieldChange('goalAmountValue')}
              placeholder="e.g. 25000"
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-goal-currency`}>Currency</label>
            <input
              id={`${fieldPrefix}appeal-goal-currency`}
              type="text"
              value={formState.goalAmountCurrency}
              onChange={handleFieldChange('goalAmountCurrency')}
            />
          </div>
        </div>

        <div className="form-row-inline">
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-budget`}>Budget (optional)</label>
            <input
              id={`${fieldPrefix}appeal-budget`}
              type="number"
              step="0.01"
              min="0"
              value={formState.budgetAmountValue}
              onChange={handleFieldChange('budgetAmountValue')}
              placeholder="e.g. 4500"
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${fieldPrefix}appeal-budget-currency`}>Currency</label>
            <input
              id={`${fieldPrefix}appeal-budget-currency`}
              type="text"
              value={formState.budgetAmountCurrency}
              onChange={handleFieldChange('budgetAmountCurrency')}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor={`${fieldPrefix}appeal-target`}>
            Target solicited count (optional)
          </label>
          <input
            id={`${fieldPrefix}appeal-target`}
            type="number"
            min="0"
            value={formState.targetSolicitedCount}
            onChange={handleFieldChange('targetSolicitedCount')}
            placeholder="e.g. 5000"
          />
        </div>

        <div className="form-row">
          <label htmlFor={`${fieldPrefix}appeal-description`}>Description (optional)</label>
          <textarea
            id={`${fieldPrefix}appeal-description`}
            rows={3}
            value={formState.description}
            onChange={handleFieldChange('description')}
          />
        </div>

        {error ? <div className="form-alert form-alert-error">{error}</div> : null}

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
