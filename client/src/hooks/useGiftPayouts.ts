import { useCallback, useEffect, useState } from 'react';
import { fetchGiftPayouts, GiftPayoutRecord } from '../api';

export interface GiftPayoutFilters {
  statuses?: string[];
  sourceSystems?: string[];
  search?: string;
}

interface UseGiftPayoutsResult {
  payouts: GiftPayoutRecord[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useGiftPayouts(filters: GiftPayoutFilters = {}): UseGiftPayoutsResult {
  const [payouts, setPayouts] = useState<GiftPayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const statusesKey = Array.isArray(filters.statuses) ? filters.statuses.join('|') : 'all';
  const sourcesKey = Array.isArray(filters.sourceSystems)
    ? filters.sourceSystems.join('|')
    : 'all';
  const searchKey = typeof filters.search === 'string' ? filters.search.trim() : '';

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetchGiftPayouts({
          limit: 50,
          sort: 'depositDate:desc',
          statuses: filters.statuses,
          sourceSystems: filters.sourceSystems,
          search: filters.search,
        });
        setPayouts(response.data ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load gift payouts.';
        setError(message);
        setPayouts([]);
      } finally {
        if (mode === 'refresh') {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [statusesKey, sourcesKey, searchKey],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return {
    payouts,
    loading,
    error,
    refreshing,
    refresh,
  };
}
