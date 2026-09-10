import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError } from '../api/client.js';

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApiData<T>(fetcher: () => Promise<T>, deps: DependencyList): ApiDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then(result => { if (!cancelled) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, loading, error, reload };
}
