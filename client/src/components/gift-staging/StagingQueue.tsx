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
import { StagingQueueTable } from './StagingQueueTable';
import { mapQueueRows, HIGH_VALUE_THRESHOLD } from './stagingQueueUtils';

const COLUMN_OPTIONS = [
  { key: 'stagingId', label: 'Staging ID', required: true },
  { key: 'donor', label: 'Donor' },
  { key: 'amount', label: 'Amount' },
  { key: 'updated', label: 'Updated' },
  { key: 'eligibility', label: 'Eligibility / needs' },
  { key: 'source', label: 'Source' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'actions', label: 'Actions', required: true },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMN_OPTIONS.map((column) => column.key);
const COLUMN_STORAGE_KEY = 'fundraising-gift-staging-columns';

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Updated (newest)' },
  { value: 'updatedAt:asc', label: 'Updated (oldest)' },
  { value: 'giftDate:desc', label: 'Gift date (newest)' },
  { value: 'giftDate:asc', label: 'Gift date (oldest)' },
  { value: 'amount.amountMicros:desc', label: 'Amount (high → low)' },
  { value: 'amount.amountMicros:asc', label: 'Amount (low → high)' },
];

export function StagingQueue(): JSX.Element {
  const [activeFilters, setActiveFilters] = useState<GiftStagingListFetchOptions>({
    sort: 'updatedAt:desc',
  });
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
  const [searchValue, setSearchValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

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


  const toggleDuplicatesFilter = useCallback(() => {
    setShowDuplicatesOnly((prev) => {
      const next = !prev;
      if (next) {
        applyFilter({
          statuses: ['needs_review', 'pending'],
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
    if (activeFilters.search) {
      clearFilterKey('search');
    }
    if (activeFilters.sort) {
      clearFilterKey('sort');
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
    setSearchValue('');
  };

  const derivedRows = useMemo(() => mapQueueRows(items), [items]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(COLUMN_STORAGE_KEY) : null;
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return;
      }
      const validKeys = parsed.filter(
        (key) => typeof key === 'string' && COLUMN_OPTIONS.some((option) => option.key === key),
      );
      const requiredKeys = COLUMN_OPTIONS.filter((option) => option.required).map((option) => option.key);
      const merged = Array.from(new Set([...validKeys, ...requiredKeys]));
      if (merged.length > 0) {
        setVisibleColumns(merged);
      }
    } catch {
      // ignore invalid stored state
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchValue.trim();
      if (trimmed.length > 0) {
        applyFilter({ search: trimmed });
      } else {
        clearFilterKey('search');
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchValue, applyFilter, clearFilterKey]);

  const sortValue = activeFilters.sort ?? 'updatedAt:desc';

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

  const toggleColumn = useCallback((key: string) => {
    const column = COLUMN_OPTIONS.find((option) => option.key === key);
    if (!column || column.required) {
      return;
    }
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        return prev.filter((value) => value !== key);
      }
      return [...prev, key];
    });
  }, []);

  const statusSummary = useMemo(() => {
    let needsAttention = 0;
    let eligibleNow = 0;
    let processFailed = 0;
    let processed = 0;
    derivedRows.forEach((row) => {
      const label = row.statusMeta.label;
      if (label === 'Process failed') {
        processFailed += 1;
      } else if (label === 'Processed') {
        processed += 1;
      } else if (row.eligibilityMeta.label === 'Needs attention') {
        needsAttention += 1;
      } else if (row.eligibilityMeta.label === 'Eligible now') {
        eligibleNow += 1;
      }
    });
    return {
      total: derivedRows.length,
      needsAttention,
      eligibleNow,
      processFailed,
      processed,
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

  const batchDiagnosticsSummary = useMemo(() => {
    if (!activeBatchId) {
      return null;
    }
    const batchRows = derivedRows.filter((row) => row.giftBatchId === activeBatchId);
    if (batchRows.length === 0) {
      return null;
    }

    const tally = (values: string[]) => {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    };

    const blockers = tally(
      batchRows.flatMap((row) => row.blockerLabels ?? []),
    );
    const warnings = tally(
      batchRows.flatMap((row) => row.warningLabels ?? []),
    );
    const lowIdentityCount = batchRows.filter((row) => row.isLowIdentityConfidence).length;

    return {
      blockers: blockers.slice(0, 3),
      warnings: warnings.slice(0, 3),
      lowIdentityCount,
      total: batchRows.length,
    };
  }, [derivedRows, activeBatchId]);

  const markReady = useCallback(
    async (stagingId: string) => {
      setProcessingIds((prev) => ({ ...prev, [stagingId]: 'mark-ready' }));
      setActionError(null);
      try {
        await updateGiftStagingStatus(stagingId, {
          processingStatus: 'ready_for_process',
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
        if (response.status !== 'processed') {
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
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          sortValue={sortValue}
          sortOptions={SORT_OPTIONS}
          onSortChange={(value) => applyFilter({ sort: value })}
          columnOptions={COLUMN_OPTIONS}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          intakeSummary={intakeSummary}
          batchSummary={batchSummary}
          batchDiagnosticsSummary={batchDiagnosticsSummary}
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
          showDuplicatesOnly={showDuplicatesOnly}
          highValueOnly={highValueOnly}
          onToggleDuplicates={toggleDuplicatesFilter}
          onToggleHighValue={toggleHighValueFilter}
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
        visibleColumns={visibleColumns}
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
