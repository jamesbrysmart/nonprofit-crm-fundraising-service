import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GiftStagingUpdatePayload,
  processGiftStaging,
  updateGiftStaging,
  updateGiftStagingStatus,
} from '../api';
import { useAppealOptions } from './useAppealOptions';
import { useGiftStagingDetail } from './useGiftStagingDetail';
import { GiftDrawerFocus } from '../components/gift-staging/types';
import { GIFT_INTENT_OPTIONS, GiftIntentOption, getGiftIntentLabel } from '../types/giftIntent';

export type EditFormState = {
  amountMajor: string;
  currencyCode: string;
  giftDate: string;
  donorFirstName: string;
  donorLastName: string;
  donorEmail: string;
  fundId: string;
  appealId: string;
  notes: string;
  giftIntent: string;
  opportunityId: string;
  inKindDescription: string;
  estimatedValue: string;
  isInKind: boolean;
};

export interface ParsedDedupeDiagnostics {
  matchType: 'email' | 'name' | 'partial';
  matchedDonorId?: string;
  matchedBy?: string;
  confidence?: number;
  candidateDonorIds?: string[];
}

const formatDedupeStatus = (status?: string): string => {
  switch (status) {
    case 'matched_existing':
      return 'Auto-matched to existing donor';
    case 'needs_review':
      return 'Needs reviewer attention';
    default:
      return status ?? '—';
  }
};

export function useGiftStagingDrawerController(
  stagingId: string | null,
  focus: GiftDrawerFocus,
  onRefreshList: () => void,
) {
  const [actionBusy, setActionBusy] = useState<'mark-ready' | 'process' | 'update' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    amountMajor: '',
    currencyCode: '',
    giftDate: '',
    donorFirstName: '',
    donorLastName: '',
    donorEmail: '',
    fundId: '',
    appealId: '',
    notes: '',
    giftIntent: 'standard',
    opportunityId: '',
    inKindDescription: '',
    estimatedValue: '',
    isInKind: false,
  });

  const {
    options: appealOptions,
    loading: appealsLoading,
    error: appealError,
  } = useAppealOptions();

  const appealListId = useMemo(
    () => (stagingId ? `drawer-appeal-options-${stagingId}` : 'drawer-appeal-options'),
    [stagingId],
  );

  const { detail, loading, error, reload } = useGiftStagingDetail(stagingId);
  const dedupeStatusLabel = detail ? formatDedupeStatus(detail.dedupeStatus) : '';
  const intentLabel = detail ? getGiftIntentLabel(detail.giftIntent) : undefined;
  const intentOptions = GIFT_INTENT_OPTIONS.map(({ value, label }) => ({
    value: value as GiftIntentOption,
    label,
  }));
  const dedupeDiagnostics = useMemo(
    () => extractDedupeDiagnostics(detail?.rawPayload),
    [detail?.rawPayload],
  );

  const initializeEditForm = useCallback(() => {
    if (!detail) {
      setEditForm({
        amountMajor: '',
        currencyCode: '',
        giftDate: '',
        donorFirstName: '',
        donorLastName: '',
        donorEmail: '',
        fundId: '',
        appealId: '',
        notes: '',
        giftIntent: 'standard',
        opportunityId: '',
        inKindDescription: '',
        estimatedValue: '',
        isInKind: false,
      });
      return;
    }

    const derivedAmount =
      typeof detail.amountMicros === 'number'
        ? (detail.amountMicros / 1_000_000).toFixed(2)
        : '';

    const derivedDate = detail.giftDate ? detail.giftDate.slice(0, 10) : '';

    setEditForm({
      amountMajor: derivedAmount,
      currencyCode: detail.currencyCode ?? '',
      giftDate: derivedDate,
      donorFirstName: detail.donorFirstName ?? '',
      donorLastName: detail.donorLastName ?? '',
      donorEmail: detail.donorEmail ?? '',
      fundId: detail.fundId ?? '',
      appealId: detail.appealId ?? '',
      notes: detail.notes ?? '',
      giftIntent: detail.giftIntent ?? 'standard',
      opportunityId: detail.opportunityId ?? '',
      inKindDescription: detail.inKindDescription ?? '',
      estimatedValue:
        typeof detail.estimatedValue === 'number' ? detail.estimatedValue.toString() : '',
      isInKind: Boolean(detail.isInKind),
    });
  }, [detail]);

  useEffect(() => {
    initializeEditForm();
  }, [initializeEditForm]);

  const handleFieldChange =
    (field: keyof EditFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setEditForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleInKindEditToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setEditForm((prev) => ({
      ...prev,
      isInKind: checked,
    }));
  };

  const handleResetEdits = () => {
    initializeEditForm();
    setActionError(null);
    setActionNotice(null);
  };

  const handleSaveEdits = async () => {
    if (!detail?.id) {
      return;
    }

    const payload: GiftStagingUpdatePayload = {};

    const amountValue = editForm.amountMajor.trim();
    if (amountValue.length > 0) {
      const parsed = Number.parseFloat(amountValue);
      if (Number.isNaN(parsed)) {
        setActionError('Amount must be a valid number.');
        return;
      }
      payload.amountMicros = Math.round(parsed * 1_000_000);
    }

    const currencyInput = editForm.currencyCode.trim();
    if (currencyInput.length > 0) {
      payload.currencyCode = currencyInput.toUpperCase();
    } else if (detail.currencyCode) {
      payload.currencyCode = null;
    }

    const dateValue = editForm.giftDate.trim();
    if (dateValue.length > 0) {
      payload.giftDate = dateValue;
    } else if (detail.giftDate) {
      payload.giftDate = null;
    }

    const donorFirstName = editForm.donorFirstName.trim();
    if (donorFirstName.length > 0) {
      payload.donorFirstName = donorFirstName;
    } else if (detail.donorFirstName) {
      payload.donorFirstName = null;
    }

    const donorLastName = editForm.donorLastName.trim();
    if (donorLastName.length > 0) {
      payload.donorLastName = donorLastName;
    } else if (detail.donorLastName) {
      payload.donorLastName = null;
    }

    const donorEmail = editForm.donorEmail.trim();
    if (donorEmail.length > 0) {
      payload.donorEmail = donorEmail;
    } else if (detail.donorEmail) {
      payload.donorEmail = null;
    }

    const fundValue = editForm.fundId.trim();
    if (fundValue.length > 0) {
      payload.fundId = fundValue;
    } else if (detail.fundId) {
      payload.fundId = null;
    }

    const appealValue = editForm.appealId.trim();
    if (appealValue.length > 0) {
      payload.appealId = appealValue;
    } else if (detail.appealId) {
      payload.appealId = null;
    }

    const notesValue = editForm.notes.trim();
    if (notesValue.length > 0) {
      payload.notes = notesValue;
    } else if (detail.notes) {
      payload.notes = null;
    }

    const intentValue = editForm.giftIntent.trim();
    if (intentValue.length > 0 && intentValue !== 'standard') {
      payload.giftIntent = intentValue;
    } else if (detail.giftIntent && detail.giftIntent !== 'standard') {
      payload.giftIntent = null;
    }

    const opportunityValue = editForm.opportunityId.trim();
    if (opportunityValue.length > 0) {
      payload.opportunityId = opportunityValue;
    } else if (detail.opportunityId) {
      payload.opportunityId = null;
    }

    const inKindDescription = editForm.inKindDescription.trim();
    if (inKindDescription.length > 0) {
      payload.inKindDescription = inKindDescription;
    } else if (detail.inKindDescription) {
      payload.inKindDescription = null;
    }

    const estimatedValueInput = editForm.estimatedValue.trim();
    if (estimatedValueInput.length > 0) {
      const parsedValue = Number.parseFloat(estimatedValueInput);
      if (Number.isNaN(parsedValue)) {
        setActionError('Estimated value must be numeric.');
        return;
      }
      payload.estimatedValue = parsedValue;
    } else if (typeof detail.estimatedValue === 'number') {
      payload.estimatedValue = null;
    }

    if (editForm.isInKind !== Boolean(detail.isInKind)) {
      payload.isInKind = editForm.isInKind;
    }

    if (Object.keys(payload).length === 0) {
      setActionNotice('No changes to save.');
      return;
    }

    setActionBusy('update');
    setActionError(null);
    setActionNotice(null);

    try {
      await updateGiftStaging(detail.id, payload);
      await reload();
      onRefreshList();
      setActionNotice('Gift staging details updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update gift staging.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleMarkReady = async () => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('mark-ready');
    setActionError(null);
    setActionNotice(null);
    try {
      await updateGiftStagingStatus(detail.id, {
        processingStatus: 'ready_for_process',
        validationStatus: detail.validationStatus === 'passed' ? detail.validationStatus : 'passed',
      });
      await reload();
      onRefreshList();
      setActionNotice('Staging record marked ready for processing.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark staging record ready.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleProcessNow = async () => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('process');
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await processGiftStaging(detail.id);
      if (response.status !== 'processed') {
        const description =
          response.status === 'deferred'
            ? `Processing deferred (${response.reason ?? 'not ready'})`
            : `Processing failed (${response.error ?? 'unknown issue'})`;
        setActionError(description);
      } else {
        await reload();
        onRefreshList();
        setActionNotice('Gift processed in Twenty.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to process staging record.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleAssignDonor = async (donorId: string) => {
    if (!detail?.id) {
      return;
    }
    setActionBusy('update');
    setActionError(null);
    setActionNotice(null);
    try {
      await updateGiftStaging(detail.id, {
        donorId,
        dedupeStatus: 'matched_existing',
      });
      await reload();
      onRefreshList();
      setActionNotice('Donor reassigned to existing supporter.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update donor.');
    } finally {
      setActionBusy(null);
    }
  };

  return {
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
    dedupeStatusLabel,
    dedupeDiagnostics,
    intentLabel,
    intentOptions,
  };
}

function extractDedupeDiagnostics(rawPayload?: string | null): ParsedDedupeDiagnostics | null {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    const diagnostics = parsed?.dedupeDiagnostics;
    if (!diagnostics || typeof diagnostics !== 'object') {
      return null;
    }

    const matchType =
      diagnostics.matchType === 'email'
        ? 'email'
        : diagnostics.matchType === 'name'
          ? 'name'
          : diagnostics.matchType === 'partial'
            ? 'partial'
            : undefined;

    if (!matchType) {
      return null;
    }

    const candidateIds = Array.isArray(diagnostics.candidateDonorIds)
      ? diagnostics.candidateDonorIds.filter((candidate: unknown) => typeof candidate === 'string')
      : undefined;

    return {
      matchType,
      matchedDonorId:
        typeof diagnostics.matchedDonorId === 'string' && diagnostics.matchedDonorId.length > 0
          ? diagnostics.matchedDonorId
          : undefined,
      matchedBy:
        typeof diagnostics.matchedBy === 'string' && diagnostics.matchedBy.length > 0
          ? diagnostics.matchedBy
          : undefined,
      confidence:
        typeof diagnostics.confidence === 'number'
          ? diagnostics.confidence
          : undefined,
      candidateDonorIds: candidateIds && candidateIds.length > 0 ? candidateIds : undefined,
    };
  } catch (error) {
    console.warn('Failed to parse dedupe diagnostics', error);
    return null;
  }
}
