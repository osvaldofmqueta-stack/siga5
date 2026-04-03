import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@siga_offline_queue';

export interface QueuedOperation {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  timestamp: number;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      msg.includes('aborted') ||
      msg.includes('etimedout') ||
      msg.includes('econnrefused')
    );
  }
  return false;
}

export async function getQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function enqueueOperation(
  op: Omit<QueuedOperation, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const queue = await getQueue();
    const item: QueuedOperation = {
      ...op,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };
    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[OfflineQueue] Failed to enqueue operation', e);
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  try {
    const queue = await getQueue();
    const filtered = queue.filter((op) => op.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[OfflineQueue] Failed to remove from queue', e);
  }
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function processQueue(
  executor: (method: string, path: string, body?: unknown) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      await executor(op.method, op.path, op.body);
      await removeFromQueue(op.id);
      success++;
    } catch (e) {
      if (isNetworkError(e)) {
        failed++;
        break;
      }
      await removeFromQueue(op.id);
      console.warn(`[OfflineQueue] Skipping failed op ${op.method} ${op.path}:`, e);
      failed++;
    }
  }

  return { success, failed };
}
