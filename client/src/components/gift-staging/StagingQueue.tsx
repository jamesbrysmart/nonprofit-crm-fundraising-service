import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  GiftStagingListItem,
  processGiftStaging,
  updateGiftStagingStatus,
} from '../../api';
import { GiftStagingListFetchOptions, useGiftStagingList } from '../../hooks/useGiftStagingList';
import { GiftStagingDrawer } from './GiftStagingDrawer';
import { GiftDrawerFocus } from './types';
import { StagingQueueSummary } from './StagingQueueSummary';
import { StagingQueueFilters } from './StagingQueueFilters';
import { StagingQueueTable } from './StagingQueueTable';
import { mapQueueRows, HIGH_VALUE_THRESHOLD } from './stagingQueueUtils';

export function StagingQueue(): JSX.Element {
  const [recurringFilterInput, setRecurringFilterInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<GiftStagingListFetchOptions>({});
  const { items, loading, isRefreshing, error, refresh } = useGiftStagingList(activeFilters);
  const [selectedStagingId, setSelectedStagingId] = useState<string | null>(null);
  const [drawerFocus, setDrawerFocus] = useState<GiftDrawerFocus>('overview');
  const [processingIds, setProcessingIds] = useState<Record<string, 'mark-ready' | 'process'>>(
    {},
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [highValueOnly, setHighValueOnly] = useState(false);

  const openDrawer = useCallback((stagingId: string, focus: GiftDrawerFocus = 'overview') => {
    setSelectedStagingId(stagingId);
    setDrawerFocus(focus);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedStagingId(null);
  }, []);

  const applyFilter = useCallback(
    (updates: GiftStagingListFetchOptions) => {
      setActiveFilters((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    [],
  );

  const clearFilterKey = useCallback(
    (key: keyof GiftStagingListFetchOptions) => {
      setActiveFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const handleApplyRecurringFilter = useCallback(() => {
    const trimmed = recurringFilterInput.trim();
    if (trimmed.length > 0) {
      applyFilter({ recurringAgreementId: trimmed });
    } else {
      clearFilterKey('recurringAgreementId');
    }
  }, [recurringFilterInput, applyFilter, clearFilterKey]);

  const toggleDuplicatesFilter = useCallback(() => {
    setShowDuplicatesOnly((prev) => {
      const next = !prev;
      if (next) {
        applyFilter({
          statuses: ['dedupe_review', 'pending'],
        });
      } else {
        clearFilterKey('statuses');
      }
      return next;
    });
  }, [applyFilter, clearFilterKey]);

  const toggleHighValueFilter = useCallback(() => {
    setHighValueOnly((prev) => {
      const next = !prev;
      if (next) {
        applyFilter({
          minAmountMinor: HIGH_VALUE_THRESHOLD,
        });
      } else {
        clearFilterKey('minAmountMinor');
      }
      return next;
    });
  }, [applyFilter, clearFilterKey]);

  const activeIntakeSources = activeFilters.intakeSources ?? [];
  const hasActiveFilters =
    Boolean(activeBatchId) ||
    activeIntakeSources.length > 0 ||
    showDuplicatesOnly ||
    highValueOnly ||
    Boolean(activeFilters.recurringAgreementId) ||
    Boolean(activeFilters.search);

  const handleSelectIntakeSource = (source: string) => {
    if (activeIntakeSources.includes(source)) {
      clearFilterKey('intakeSources');
    } else {
      applyFilter({ intakeSources: [source] });
    }
  };

  const handleSelectBatch = (batchId: string) => {
    setActiveBatchId((current) => {
      const next = current === batchId ? null : batchId;
      if (next) {
        applyFilter({ giftBatchId: next });
      } else {
        clearFilterKey('giftBatchId');
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    if (activeFilters.intakeSources) {
      clearFilterKey('intakeSources');
    }
    if (activeFilters.recurringAgreementId) {
      clearFilterKey('recurringAgreementId');
    }
    if (activeFilters.search) {
      clearFilterKey('search');
    }
    if (typeof activeFilters.giftBatchId === 'string') {
      clearFilterKey('giftBatchId');
    }
    if (activeFilters.statuses) {
      clearFilterKey('statuses');
    }
    if (typeof activeFilters.minAmountMinor === 'number') {
      clearFilterKey('minAmountMinor');
    }
    setActiveBatchId(null);
    setShowDuplicatesOnly(false);
    setHighValueOnly(false);
  };

  const derivedRows = useMemo(() => mapQueueRows(items), [items]);

  const filteredRows = useMemo(() => {
    let rows = derivedRows;
    if (activeBatchId) {
      rows = rows.filter((row) => row.giftBatchId === activeBatchId);
    }
    if (showDuplicatesOnly) {
      rows = rows.filter(
        (row) =>
          row.dedupeStatusMeta.label !== 'Auto-matched' ||
          row.hasGiftDuplicate,
      );
    }
    if (highValueOnly) {
      rows = rows.filter((row) => row.isHighValue);
    }
    return rows;
  }, [derivedRows, activeBatchId, showDuplicatesOnly, highValueOnly]);

  useEffect(() => {
    if (activeBatchId && !derivedRows.some((row) => row.giftBatchId === activeBatchId)) {
      setActiveBatchId(null);
    }
  }, [derivedRows, activeBatchId]);

  const statusSummary = useMemo(() => {
    let needsReview = 0;
    let ready = 0;
    let commitFailed = 0;
    let committed = 0;
    derivedRows.forEach((row) => {
      const tone = row.statusMeta.tone;
      const label = row.statusMeta.label;
      if (label === 'Commit failed') {
        commitFailed += 1;
      } else if (label === 'Committed') {
        committed += 1;
      } else if (label === 'Ready to process') {
        ready += 1;
      } else if (tone === 'warning') {
        needsReview += 1;
      }
    });
    return {
      total: derivedRows.length,
      needsReview,
      ready,
      commitFailed,
      committed,
    };
  }, [derivedRows]);

  const intakeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    derivedRows.forEach((row) => {
      const key = row.intakeSource?.trim() && row.intakeSource.length > 0 ? row.intakeSource : 'Unknown source';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [derivedRows]);

  const batchSummary = useMemo(() => {
    const counts = new Map<string, number>();
    derivedRows.forEach((row) => {
      if (row.giftBatchId) {
        counts.set(row.giftBatchId, (counts.get(row.giftBatchId) ?? 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [derivedRows]);

  const markReady = useCallback(
    async (stagingId: string) => {
      setProcessingIds((prev) => ({ ...prev, [stagingId]: 'mark-ready' }));
      setActionError(null);
      try {
        await updateGiftStagingStatus(stagingId, {
          promotionStatus: 'ready_for_commit',
          validationStatus: 'passed',
        });
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to mark staging record ready.';
        setActionError(message);
      } finally {
        setProcessingIds((prev) => {
          const next = { ...prev };
          delete next[stagingId];
          return next;
        });
      }
    },
    [refresh],
  );

  const processNow = useCallback(
    async (stagingId: string) => {
      setProcessingIds((prev) => ({ ...prev, [stagingId]: 'process' }));
      setActionError(null);
      try {
        const response = await processGiftStaging(stagingId);
        if (response.status !== 'committed') {
          const summary =
            response.status === 'deferred'
              ? `Processing deferred (${response.reason ?? 'not ready'})`
              : `Processing failed (${response.error ?? 'unknown error'})`;
          setActionError(summary);
        }
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to process staging record.';
        setActionError(message);
      } finally {
        setProcessingIds((prev) => {
          const next = { ...prev };
          delete next[stagingId];
          return next;
        });
      }
    },
    [refresh],
  );

  const retryProcessing = useCallback(
    async (stagingId: string) => {
      await markReady(stagingId);
      await processNow(stagingId);
    },
    [markReady, processNow],
  );

  return (
    <>
      <section className="section-unstyled f-space-y-6">
        <StagingQueueSummary
          statusSummary={statusSummary}
          intakeSummary={intakeSummary}
          batchSummary={batchSummary}
          activeIntakeSources={activeIntakeSources}
          activeBatchId={activeBatchId}
          hasActiveFilters={hasActiveFilters}
          actionError={actionError}
          loading={loading}
          isRefreshing={isRefreshing}
          refresh={refresh}
          onClearFilters={handleClearFilters}
          onToggleIntakeSource={handleSelectIntakeSource}
          onSelectBatch={handleSelectBatch}
        />

      <StagingQueueFilters
        showDuplicatesOnly={showDuplicatesOnly}
        highValueOnly={highValueOnly}
        onToggleDuplicates={toggleDuplicatesFilter}
        onToggleHighValue={toggleHighValueFilter}
        recurringFilterInput={recurringFilterInput}
        onRecurringInputChange={setRecurringFilterInput}
        onApplyRecurring={handleApplyRecurringFilter}
        canClearRecurring={Boolean(activeFilters.recurringAgreementId)}
        onClearRecurring={() => {
          clearFilterKey('recurringAgreementId');
          setRecurringFilterInput('');
        }}
        applyDisabled={loading || recurringFilterInput.trim().length === 0}
      />

      <StagingQueueTable
        rows={filteredRows}
        loading={loading}
        error={error}
        onReview={(id) => openDrawer(id)}
        onMarkReady={(id) => {
          void markReady(id);
        }}
        onProcess={(id) => {
          void processNow(id);
        }}
        onRetry={(id) => {
          void retryProcessing(id);
        }}
        processingIds={processingIds}
      />
    </section>

      <GiftStagingDrawer
        stagingId={selectedStagingId}
        focus={drawerFocus}
        onClose={closeDrawer}
        onRefreshList={() => {
          void refresh();
        }}
      />
    </>
  );
}
