import { useCallback, useState } from 'react';

export const useFormField = <T,>(initial: T) => {
  const [value, setValue] = useState<T>(initial);

  const onChange = useCallback(<U extends HTMLInputElement | HTMLTextAreaElement>(
    event: React.ChangeEvent<U>,
  ) => {
    setValue((event.target.value as unknown) as T);
  }, []);

  return { value, setValue, onChange };
};

export const useAsyncState = <T,>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  return {
    loading,
    setLoading,
    error,
    setError,
    result,
    setResult,
  };
};
