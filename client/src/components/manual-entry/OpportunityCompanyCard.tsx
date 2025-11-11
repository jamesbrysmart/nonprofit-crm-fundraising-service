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
  onToggleInKind(): void;
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
        <div className="form-row">
          <label>Organisation</label>
          {companyId ? (
            <div className="selected-company">
              <p className="small-text">
                Linked to <strong>{companyName || companyId}</strong>
              </p>
              <button type="button" className="secondary-button" onClick={onClearCompany} disabled={disabled}>
                Clear organisation
              </button>
            </div>
          ) : (
            <>
              <div className="form-row-inline">
                <input
                  type="text"
                  value={companySearchTerm}
                  onChange={(event) => onCompanySearchTermChange(event.target.value)}
                  placeholder="Search companies by name"
                  disabled={disabled}
                />
                <button type="button" className="secondary-button" onClick={onCompanyLookup} disabled={companyLookupBusy}>
                  {companyLookupBusy ? 'Searching…' : 'Search'}
                </button>
              </div>
              <p className="small-text">
                Link the organisation first, then choose the grant opportunity.
              </p>
            </>
          )}
          {companyLookupError ? (
            <div className="form-alert form-alert-warning" role="alert">
              {companyLookupError}
            </div>
          ) : null}
          {companyResults.length > 0 ? (
            <ul className="option-list">
              {companyResults.slice(0, 5).map((company) => (
                <li key={company.id}>
                  <button type="button" className="secondary-button" onClick={() => onSelectCompany(company)}>
                    {company.name ?? company.id}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="form-row">
        <label htmlFor="opportunitySearch">Related opportunity</label>
        <input
          id="opportunitySearch"
          type="text"
          value={opportunitySearchTerm}
          onChange={(event) => onOpportunitySearchTermChange(event.target.value)}
          placeholder="Search open opportunities"
          disabled={disabled}
        />
        {selectedOpportunity ? (
          <p className="small-text">
            Linked to{' '}
            <strong>{selectedOpportunity.name ?? selectedOpportunity.id}</strong>
            {selectedOpportunity.stage ? ` · ${selectedOpportunity.stage}` : ''}{' '}
            <button type="button" className="secondary-button" onClick={onClearOpportunity} disabled={disabled}>
              Remove
            </button>
          </p>
        ) : (
          <p className="small-text">
            Linking keeps pledges, grants, and stewardship plans in sync.
          </p>
        )}
      </div>

      <div className="opportunity-suggestions">
        {opportunityLoading ? (
          <p className="small-text">Loading opportunity suggestions…</p>
        ) : opportunityLookupError ? (
          <div className="form-alert form-alert-warning" role="alert">
            {opportunityLookupError}
          </div>
        ) : opportunityOptions.length === 0 ? (
          <p className="small-text">No matching opportunities yet.</p>
        ) : (
          <ul className="option-list">
            {opportunityOptions.slice(0, 6).map((record) => (
              <li key={record.id}>
                <div className="option-list-row">
                  <div>
                    <strong>{record.name ?? record.id}</strong>
                    <div className="small-text">
                      {record.stage ?? 'Stage unknown'}
                      {record.companyName ? ` · ${record.companyName}` : ''}
                    </div>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => onSelectOpportunity(record)}>
                    {selectedOpportunity?.id === record.id ? 'Linked' : 'Link'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(formState.isInKind || giftIntent === 'corporateInKind') ? (
        <>
          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={formState.isInKind} onChange={onToggleInKind} />
              Includes in-kind component
            </label>
            <p className="small-text">Add a description and estimated fair value.</p>
          </div>
          {formState.isInKind ? (
            <>
              <div className="form-row">
                <label htmlFor="inKindDescription">In-kind description</label>
                <textarea
                  id="inKindDescription"
                  name="inKindDescription"
                  rows={3}
                  value={formState.inKindDescription}
                  onChange={onFieldChange}
                />
              </div>
              <div className="form-row">
                <label htmlFor="estimatedValue">Estimated value</label>
                <input
                  id="estimatedValue"
                  name="estimatedValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.estimatedValue}
                  onChange={onFieldChange}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
