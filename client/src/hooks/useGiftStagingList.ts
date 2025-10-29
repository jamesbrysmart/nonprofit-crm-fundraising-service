import { useCallback, useEffect, useState } from 'react';
import { fetchGiftStagingList, GiftStagingListItem } from '../api';

interface UseGiftStagingListResult {
  items: GiftStagingListItem[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGiftStagingList(filters: { recurringAgreementId?: string } = {}): UseGiftStagingListResult {
  const [items, setItems] = useState<GiftStagingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRecurringAgreementId = filters.recurringAgreementId?.trim() || undefined;

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
    [activeRecurringAgreementId],
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
