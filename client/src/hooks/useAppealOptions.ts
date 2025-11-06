import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAppeals, type AppealRecord } from '../api';

interface UseAppealOptionsConfig {
  limit?: number;
  sort?: string;
  autoLoad?: boolean;
}

interface UseAppealOptionsResult {
  options: AppealRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const defaultConfig: UseAppealOptionsConfig = {
  limit: 100,
  sort: 'name:asc',
  autoLoad: true,
};

export const useAppealOptions = (
  config: UseAppealOptionsConfig = {},
): UseAppealOptionsResult => {
  const mergedConfig = { ...defaultConfig, ...config };
  const [options, setOptions] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const records = await fetchAppeals({
        limit: mergedConfig.limit,
        sort: mergedConfig.sort,
      });
      if (isMountedRef.current) {
        setOptions(records);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to load appeals.');
        setOptions([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [mergedConfig.limit, mergedConfig.sort]);

  useEffect(() => {
    if (!mergedConfig.autoLoad) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const records = await fetchAppeals({
          limit: mergedConfig.limit,
          sort: mergedConfig.sort,
        });
        if (!cancelled) {
          setOptions(records);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load appeals.');
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mergedConfig.autoLoad, mergedConfig.limit, mergedConfig.sort]);

  return {
    options,
    loading,
    error,
    refresh,
  };
};
