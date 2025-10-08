import { useCallback, useEffect, useState } from 'react';
import { fetchGiftStagingById, GiftStagingDetailResponse } from '../api';

interface UseGiftStagingDetailResult {
  detail: GiftStagingDetailResponse['data']['giftStaging'] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useGiftStagingDetail(stagingId: string | null): UseGiftStagingDetailResult {
  const [detail, setDetail] = useState<GiftStagingDetailResponse['data']['giftStaging'] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!stagingId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchGiftStagingById(stagingId);
      setDetail(response.data?.giftStaging ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load staging record details.';
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [stagingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    detail,
    loading,
    error,
    reload: load,
  };
}
