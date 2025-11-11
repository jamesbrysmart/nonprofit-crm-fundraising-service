import { CompanyRecord, OpportunityRecord } from '../../api';

interface OpportunityCompanyCardProps {
  giftIntent: string;
  companyId: string;
  companyName: string;
  companySearchTerm: string;
  companyLookupBusy: boolean;
  companyLookupError: string | null;
  companyResults: CompanyRecord[];
  onCompanySearchTermChange(value: string): void;
  onCompanyLookup(): void;
  onSelectCompany(record: CompanyRecord): void;
  onClearCompany(): void;
  opportunitySearchTerm: string;
  onOpportunitySearchTermChange(value: string): void;
  opportunityLoading: boolean;
  opportunityLookupError: string | null;
  opportunityOptions: OpportunityRecord[];
  onSelectOpportunity(record: OpportunityRecord): void;
  onClearOpportunity(): void;
  selectedOpportunity: OpportunityRecord | null;
  disabled: boolean;
  formState: {
    isInKind: boolean;
    inKindDescription: string;
    estimatedValue: string;
  };
  onToggleInKind(event: React.ChangeEvent<HTMLInputElement>): void;
  onFieldChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void;
}

export function OpportunityCompanyCard({
  giftIntent,
  companyId,
  companyName,
  companySearchTerm,
  companyLookupBusy,
  companyLookupError,
  companyResults,
  onCompanySearchTermChange,
  onCompanyLookup,
  onSelectCompany,
  onClearCompany,
  opportunitySearchTerm,
  onOpportunitySearchTermChange,
  opportunityLoading,
  opportunityLookupError,
  opportunityOptions,
  onSelectOpportunity,
  onClearOpportunity,
  selectedOpportunity,
  disabled,
  formState,
  onToggleInKind,
  onFieldChange,
}: OpportunityCompanyCardProps): JSX.Element {
  return (
    <>
      {giftIntent === 'grant' ? (
        <div className="f-field">
          <label className="f-field-label">Organisation</label>
          {companyId ? (
            <div className="f-flex f-flex-col sm:f-flex-row sm:f-items-center f-gap-3 f-rounded-lg f-border f-border-slate-200 f-bg-slate-50 f-px-3 f-py-2">
              <p className="f-text-sm f-text-slate-600 f-m-0">
                Linked to <strong>{companyName || companyId}</strong>
              </p>
              <button
                type="button"
                className="f-btn--ghost"
                onClick={onClearCompany}
                disabled={disabled}
              >
                Clear organisation
              </button>
            </div>
          ) : (
            <>
              <div className="f-flex f-flex-col sm:f-flex-row f-gap-3">
                <input
                  type="text"
                  value={companySearchTerm}
                  onChange={(event) => onCompanySearchTermChange(event.target.value)}
                  placeholder="Search companies by name"
                  disabled={disabled}
                  className="f-input"
                />
                <button
                  type="button"
                  className="f-btn--secondary"
                  onClick={onCompanyLookup}
                  disabled={companyLookupBusy || disabled}
                >
                  {companyLookupBusy ? 'Searching…' : 'Search'}
                </button>
              </div>
              <p className="f-help-text">
                Link the organisation first, then choose the grant opportunity.
              </p>
            </>
          )}
          {companyLookupError ? (
            <div className="f-alert f-alert--warning" role="alert">
              {companyLookupError}
            </div>
          ) : null}
          {companyResults.length > 0 ? (
            <div className="f-flex f-flex-col f-gap-2">
              {companyResults.slice(0, 5).map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="f-btn--ghost f-justify-between"
                  onClick={() => onSelectCompany(company)}
                >
                  {company.name ?? company.id}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="f-field">
        <label htmlFor="opportunitySearch" className="f-field-label">
          Related opportunity
        </label>
        <input
          id="opportunitySearch"
          type="text"
          value={opportunitySearchTerm}
          onChange={(event) => onOpportunitySearchTermChange(event.target.value)}
          placeholder="Search open opportunities"
          disabled={disabled}
          className="f-input"
        />
        {selectedOpportunity ? (
          <p className="f-help-text f-flex f-flex-wrap f-items-center f-gap-2">
            Linked to{' '}
            <strong>{selectedOpportunity.name ?? selectedOpportunity.id}</strong>
            {selectedOpportunity.stage ? ` · ${selectedOpportunity.stage}` : ''}
            <button
              type="button"
              className="f-btn--ghost"
              onClick={onClearOpportunity}
              disabled={disabled}
            >
              Remove
            </button>
          </p>
        ) : (
          <p className="f-help-text">
            Linking keeps pledges, grants, and stewardship plans in sync.
          </p>
        )}
      </div>

      <div className="f-space-y-2">
        {opportunityLoading ? (
          <p className="f-help-text">Loading opportunity suggestions…</p>
        ) : opportunityLookupError ? (
          <div className="f-alert f-alert--warning" role="alert">
            {opportunityLookupError}
          </div>
        ) : opportunityOptions.length === 0 ? (
          <p className="f-help-text">No matching opportunities yet.</p>
        ) : (
          <div className="f-flex f-flex-col f-gap-2">
            {opportunityOptions.slice(0, 6).map((record) => (
              <div
                key={record.id}
                className="f-flex f-flex-col sm:f-flex-row sm:f-items-center f-justify-between f-gap-2 f-rounded-lg f-border f-border-slate-200 f-px-3 f-py-2"
              >
                <div>
                  <strong>{record.name ?? record.id}</strong>
                  <div className="f-help-text">
                    {record.stage ?? 'Stage unknown'}
                    {record.companyName ? ` · ${record.companyName}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className={selectedOpportunity?.id === record.id ? 'f-btn--secondary' : 'f-btn--ghost'}
                  onClick={() => onSelectOpportunity(record)}
                >
                  {selectedOpportunity?.id === record.id ? 'Linked' : 'Link'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(formState.isInKind || giftIntent === 'corporateInKind') ? (
        <div className="f-space-y-4">
          <label className="f-inline-flex f-items-center f-gap-2 f-text-sm f-font-medium f-text-slate-700">
            <input type="checkbox" checked={formState.isInKind} onChange={onToggleInKind} />
            Includes in-kind component
          </label>
          <p className="f-help-text">Add a description and estimated fair value.</p>
          {formState.isInKind ? (
            <div className="f-space-y-4">
              <div className="f-field">
                <label htmlFor="inKindDescription" className="f-field-label">
                  In-kind description
                </label>
                <textarea
                  id="inKindDescription"
                  name="inKindDescription"
                  rows={3}
                  value={formState.inKindDescription}
                  onChange={onFieldChange}
                  className="f-textarea"
                />
              </div>
              <div className="f-field">
                <label htmlFor="estimatedValue" className="f-field-label">
                  Estimated value
                </label>
                <input
                  id="estimatedValue"
                  name="estimatedValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.estimatedValue}
                  onChange={onFieldChange}
                  className="f-input"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
