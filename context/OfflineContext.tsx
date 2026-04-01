import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { processQueue, getQueue, isNetworkError } from '@/lib/offlineQueue';
import { getApiUrl } from '@/lib/query-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SIGA_SYNC_EVENT = 'siga:online-sync';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  triggerSync: async () => {},
});

const TOKEN_KEY = '@sgaa_token';

async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function executeOperation(
  method: string,
  path: string,
  body?: unknown
): Promise<void> {
  const base = getApiUrl();
  const url = new URL(path, base).toString();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const wasOnline = useRef(isOnline);

  const refreshPendingCount = useCallback(async () => {
    const q = await getQueue();
    setPendingCount(q.length);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    const q = await getQueue();
    if (q.length === 0) {
      dispatchSyncEvent();
      return;
    }
    setIsSyncing(true);
    try {
      await processQueue(executeOperation);
      await refreshPendingCount();
      setLastSyncAt(new Date());
      dispatchSyncEvent();
    } catch (e) {
      if (!isNetworkError(e)) {
        console.warn('[OfflineContext] Sync error', e);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      triggerSync();
    }
    wasOnline.current = isOnline;
  }, [isOnline, triggerSync]);

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, isSyncing, lastSyncAt, triggerSync }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

function dispatchSyncEvent() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SIGA_SYNC_EVENT));
  }
}

export function useOffline() {
  return useContext(OfflineContext);
}
