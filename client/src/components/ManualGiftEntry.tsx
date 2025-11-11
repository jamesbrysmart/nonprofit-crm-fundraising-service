import { useManualGiftEntryController } from '../hooks/useManualGiftEntryController';
import { GIFT_INTENT_OPTIONS } from '../types/giftIntent';
import { GiftBasicsCard } from './manual-entry/GiftBasicsCard';
import { DonorContactCard } from './manual-entry/DonorContactCard';
import { DonorSearchModal } from './manual-entry/DonorSearchModal';
import { DonorSelectionPanel } from './manual-entry/DonorSelectionPanel';
import { OpportunityCompanyCard } from './manual-entry/OpportunityCompanyCard';
import { RecurringAssociationsCard } from './manual-entry/RecurringAssociationsCard';
import { ManualGiftStatus } from './manual-entry/ManualGiftStatus';
import { RecurringAgreementSelector } from './manual-entry/RecurringAgreementSelector';
import { DuplicatePanel } from './manual-entry/DuplicatePanel';

export function ManualGiftEntry(): JSX.Element {
  const {
    formState,
    status,
    appealOptions,
    appealsLoading,
    appealLoadError,
    showDuplicates,
    duplicateLookupError,
    classifiedDuplicates,
    selectedDuplicateId,
    selectedDonor,
    potentialDuplicateMessage,
    isSubmitDisabled,
    isRecurring,
    recurringSearch,
    selectedRecurringId,
    filteredRecurringOptions,
    hasAnyRecurringAgreements,
    opportunitySearchTerm,
    opportunityOptions,
    opportunityLoading,
    opportunityLookupError,
    selectedOpportunity,
    companySearchTerm,
    companyResults,
    companyLookupBusy,
    companyLookupError,
    isSearchModalOpen,
    searchTerm,
    searchResults,
    searchLoading,
    searchError,
    giftLink,
    handleChange,
    handleInKindToggle,
    handleSubmit,
    handleSelectDonor,
    handleClearSelectedDonor,
    handleUseExistingContact,
    handleCreateWithNewContact,
    openSearchModal,
    closeSearchModal,
    setSearchTerm,
    handleSearchSubmit,
    setOpportunitySearchTerm,
    handleSelectOpportunity,
    handleClearOpportunity,
    setCompanySearchTerm,
    handleCompanyLookup,
    handleSelectCompany,
    handleClearCompany,
    handleToggleRecurring,
    setRecurringSearch,
    handleSelectRecurring,
  } = useManualGiftEntryController();

  const donorSelection = (
    <DonorSelectionPanel
      selectedDonor={selectedDonor}
      onChangeDonor={() => {
        handleClearSelectedDonor();
        openSearchModal();
      }}
      onClearSelectedDonor={handleClearSelectedDonor}
      duplicateLookupError={duplicateLookupError}
      showDuplicates={showDuplicates}
      classifiedDuplicates={classifiedDuplicates}
      selectedDuplicateId={selectedDuplicateId}
      onSelectDuplicate={(id) => handleSelectDonor(id, { closeModal: false })}
      onOpenSearch={openSearchModal}
      potentialDuplicateMessage={potentialDuplicateMessage}
      disableActions={status.state === 'submitting'}
    />
  );

  return (
    <div className="f-space-y-6">
      <form onSubmit={handleSubmit} className="f-space-y-6">
        <fieldset
          disabled={status.state === 'submitting'}
          className="f-space-y-6 f-border-0 f-p-0 f-m-0"
        >
          <GiftBasicsCard>
            <div className="f-field">
              <label htmlFor="amountValue" className="f-field-label">
                Amount
              </label>
              <div className="f-flex f-flex-col sm:f-flex-row f-gap-3">
                <input
                  id="amountValue"
                  name="amountValue"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  value={formState.amountValue}
                  onChange={handleChange}
                  className="f-input sm:f-flex-1"
                />
                <select
                  id="currencyCode"
                  name="currencyCode"
                  value={formState.currencyCode}
                  onChange={handleChange}
                  className="f-input sm:f-w-28"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="f-field">
              <label htmlFor="giftDate" className="f-field-label">
                Gift date
              </label>
              <input
                id="giftDate"
                name="giftDate"
                type="date"
                required
                value={formState.giftDate}
                onChange={handleChange}
                className="f-input"
              />
            </div>

            <div className="f-field">
              <label htmlFor="appealId" className="f-field-label">
                Appeal (optional)
              </label>
              <select
                id="appealId"
                name="appealId"
                value={formState.appealId}
                onChange={handleChange}
                disabled={appealsLoading && appealOptions.length === 0}
                className="f-input"
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
              ) : appealLoadError ? (
                <span className="f-help-text f-text-danger">{appealLoadError}</span>
              ) : null}
            </div>

            <p className="f-text-sm f-font-semibold f-text-ink f-mt-4 f-mb-0">Gift context</p>

            <div className="f-field">
              <label htmlFor="giftIntent" className="f-field-label">
                Gift intent
              </label>
              <select
                id="giftIntent"
                name="giftIntent"
                value={formState.giftIntent}
                onChange={handleChange}
                className="f-input"
              >
                {GIFT_INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="f-help-text">
                Intent tags help surface the right workflows and keep reporting tidy.
              </p>
            </div>

            <OpportunityCompanyCard
              giftIntent={formState.giftIntent}
              companyId={formState.companyId}
              companyName={formState.companyName}
              companySearchTerm={companySearchTerm}
              companyLookupBusy={companyLookupBusy}
              companyLookupError={companyLookupError}
              companyResults={companyResults}
              onCompanySearchTermChange={setCompanySearchTerm}
              onCompanyLookup={handleCompanyLookup}
              onSelectCompany={handleSelectCompany}
              onClearCompany={handleClearCompany}
              opportunitySearchTerm={opportunitySearchTerm}
              onOpportunitySearchTermChange={setOpportunitySearchTerm}
              opportunityLoading={opportunityLoading}
              opportunityLookupError={opportunityLookupError}
              opportunityOptions={opportunityOptions}
              onSelectOpportunity={handleSelectOpportunity}
              onClearOpportunity={handleClearOpportunity}
              selectedOpportunity={selectedOpportunity}
              disabled={status.state === 'submitting'}
              formState={{
                isInKind: formState.isInKind,
                inKindDescription: formState.inKindDescription,
                estimatedValue: formState.estimatedValue,
              }}
              onToggleInKind={handleInKindToggle}
              onFieldChange={handleChange}
            />

            <div className="f-field">
              <label htmlFor="giftName" className="f-field-label">
                Gift name (optional)
              </label>
              <input
                id="giftName"
                name="giftName"
                type="text"
                placeholder="Spring Appeal Donation"
                value={formState.giftName}
                onChange={handleChange}
                className="f-input"
              />
            </div>
          </GiftBasicsCard>

          <DonorContactCard>
            <div className="f-field">
              <label htmlFor="contactFirstName" className="f-field-label">
                First name
              </label>
              <input
                id="contactFirstName"
                name="contactFirstName"
                type="text"
                autoComplete="given-name"
                required
                value={formState.contactFirstName}
                onChange={handleChange}
                className="f-input"
              />
            </div>

            <div className="f-field">
              <label htmlFor="contactLastName" className="f-field-label">
                Last name
              </label>
              <input
                id="contactLastName"
                name="contactLastName"
                type="text"
                autoComplete="family-name"
                required
                value={formState.contactLastName}
                onChange={handleChange}
                className="f-input"
              />
            </div>

            <div className="f-field">
              <label htmlFor="contactEmail" className="f-field-label">
                Email (optional)
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                autoComplete="email"
                value={formState.contactEmail}
                onChange={handleChange}
                className="f-input"
              />
            </div>

            {donorSelection}
          </DonorContactCard>
          <RecurringAssociationsCard>
            <RecurringAgreementSelector
              isRecurring={isRecurring}
              onToggleRecurring={handleToggleRecurring}
              recurringSearch={recurringSearch}
              onRecurringSearchChange={setRecurringSearch}
              filteredRecurringOptions={filteredRecurringOptions}
              hasAnyAgreements={hasAnyRecurringAgreements}
              selectedRecurringId={selectedRecurringId}
              onSelectRecurring={handleSelectRecurring}
            />
          </RecurringAssociationsCard>
        </fieldset>

        <ManualGiftStatus
          status={
            status.state === 'success'
              ? { state: 'success', message: `Gift committed in Twenty (gift id ${status.giftId}).`, link: giftLink }
              : status.state === 'error'
              ? { state: 'error', message: status.message }
              : { state: status.state }
          }
          isSubmitDisabled={isSubmitDisabled}
          showDuplicates={showDuplicates}
        />
      </form>

      {showDuplicates && classifiedDuplicates.length > 0 ? (
        <DuplicatePanel
          classifiedDuplicates={classifiedDuplicates}
          selectedDuplicateId={selectedDuplicateId}
          onSelectDuplicate={(id) => handleSelectDonor(id, { closeModal: false })}
          onCreateWithNewContact={handleCreateWithNewContact}
          onUseExistingContact={handleUseExistingContact}
          onOpenSearch={openSearchModal}
          disableActions={status.state === 'submitting'}
        />
      ) : null}

      <DonorSearchModal
        isOpen={isSearchModalOpen}
        onClose={closeSearchModal}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={handleSearchSubmit}
        searchLoading={searchLoading}
        searchError={searchError}
        searchResults={searchResults}
        onSelectDonor={handleSelectDonor}
        formState={{
          contactFirstName: formState.contactFirstName,
          contactLastName: formState.contactLastName,
          contactEmail: formState.contactEmail,
        }}
      />
    </div>
  );
}
