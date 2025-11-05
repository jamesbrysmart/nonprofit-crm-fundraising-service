import { useCallback, useEffect, useState } from 'react';
import { fetchGiftStagingList, GiftStagingListItem } from '../api';

interface UseGiftStagingListResult {
  items: GiftStagingListItem[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface GiftStagingListFetchOptions {
  recurringAgreementId?: string;
  statuses?: string[];
  intakeSources?: string[];
  search?: string;
}

export function useGiftStagingList(filters: GiftStagingListFetchOptions = {}): UseGiftStagingListResult {
  const [items, setItems] = useState<GiftStagingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRecurringAgreementId = filters.recurringAgreementId?.trim() || undefined;
  const statusesKey = Array.isArray(filters.statuses) ? filters.statuses.join('|') : '';
  const intakeSourcesKey = Array.isArray(filters.intakeSources) ? filters.intakeSources.join('|') : '';
  const searchKey = typeof filters.search === 'string' ? filters.search.trim() : '';

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetchGiftStagingList({
          limit: 50,
          sort: 'updatedAt:desc',
          recurringAgreementId: activeRecurringAgreementId,
          statuses: filters.statuses,
          intakeSources: filters.intakeSources,
          search: filters.search,
        });
        setItems(response.data ?? []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load gift staging records.';
        setError(message);
        setItems([]);
      } finally {
        if (mode === 'refresh') {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [activeRecurringAgreementId, statusesKey, intakeSourcesKey, searchKey],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return {
    items,
    loading,
    isRefreshing,
    error,
    refresh,
  };
}
