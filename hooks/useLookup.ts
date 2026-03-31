import { useState, useEffect, useMemo, useCallback } from 'react';

export interface LookupItem {
  id: number;
  categoria: string;
  valor: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

const cache: Record<string, LookupItem[]> = {};
const pending: Record<string, Promise<LookupItem[]>> = {};

async function fetchLookup(categoria: string): Promise<LookupItem[]> {
  if (pending[categoria]) return pending[categoria];
  const p = fetch(`/api/lookup/${categoria}`)
    .then(r => r.json())
    .then((data: unknown) => {
      if (Array.isArray(data) && data.length > 0) {
        cache[categoria] = data as LookupItem[];
        return data as LookupItem[];
      }
      return [] as LookupItem[];
    })
    .catch(() => [] as LookupItem[])
    .finally(() => { delete pending[categoria]; });
  pending[categoria] = p;
  return p;
}

export function useLookup(categoria: string, fallback: string[] = []) {
  const toItems = (vals: string[]): LookupItem[] =>
    vals.map((v, i) => ({ id: i, categoria, valor: v, label: v, ordem: i, ativo: true }));

  const [items, setItems] = useState<LookupItem[]>(
    cache[categoria] ?? (fallback.length > 0 ? toItems(fallback) : [])
  );
  const [isLoading, setIsLoading] = useState(!cache[categoria]);

  useEffect(() => {
    let cancelled = false;
    if (cache[categoria]) {
      setItems(cache[categoria]);
      setIsLoading(false);
      return;
    }
    fetchLookup(categoria).then(data => {
      if (!cancelled) {
        if (data.length > 0) {
          setItems(data);
        } else if (fallback.length > 0) {
          setItems(toItems(fallback));
        }
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [categoria]);

  const values = useMemo(() => items.map(i => i.valor), [items]);
  const labels = useMemo(() => items.map(i => i.label), [items]);
  const valueToLabel = useCallback(
    (val: string) => items.find(i => i.valor === val)?.label ?? val,
    [items]
  );

  return {
    items,
    isLoading,
    values,
    labels,
    valueToLabel,
  };
}

export function invalidateLookupCache(categoria?: string) {
  if (categoria) {
    delete cache[categoria];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
