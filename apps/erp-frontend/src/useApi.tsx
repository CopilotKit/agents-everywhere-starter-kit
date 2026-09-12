import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Bumped after any write (approval cards) so every visible page refetches.
const DataVersion = createContext<{ version: number; refresh: () => void }>({ version: 0, refresh: () => {} });

export function DataVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  return <DataVersion.Provider value={{ version, refresh }}>{children}</DataVersion.Provider>;
}

export const useRefreshData = () => useContext(DataVersion).refresh;

export interface ApiState<T> {
  data: T | null;
  error: string | null;
}

/**
 * Loads `load()` whenever `key` changes, after writes, and every `pollMs`.
 * Refetches keep the previous data on screen instead of flashing a loader.
 */
export function useApi<T>(load: () => Promise<T>, key: string, { pollMs }: { pollMs?: number } = {}): ApiState<T> {
  const { version } = useContext(DataVersion);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<ApiState<T> & { key: string }>({ data: null, error: null, key });

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => setTick((value) => value + 1), pollMs);
    return () => clearInterval(timer);
  }, [pollMs]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, key });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((previous) => ({
            data: previous.key === key ? previous.data : null,
            error: error instanceof Error ? error.message : "Request failed",
            key,
          }));
        }
      });
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; `key` identifies what it fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, tick]);

  return state.key === key ? state : { data: null, error: null };
}
