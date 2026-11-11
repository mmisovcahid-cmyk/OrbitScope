import { useState, useEffect, useCallback } from 'react';
import { AxiosResponse } from 'axios';

export function useApi<T>(fetcher: () => Promise<AxiosResponse<any>>, immediate = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      const d = res.data?.data ?? res.data;
      setData(d as T);
      return d;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) execute();
  }, []);

  return { data, loading, error, execute, setData };
}
