import { useState, useEffect } from 'react';

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

  useEffect(() => {
    let cancelled = false;
    if (cache[categoria]) {
      setItems(cache[categoria]);
      return;
    }
    fetchLookup(categoria).then(data => {
      if (!cancelled) {
        if (data.length > 0) {
          setItems(data);
        } else if (fallback.length > 0) {
          setItems(toItems(fallback));
        }
      }
    });
    return () => { cancelled = true; };
  }, [categoria]);

  return {
    items,
    values: items.map(i => i.valor),
    labels: items.map(i => i.label),
    valueToLabel: (val: string) => items.find(i => i.valor === val)?.label ?? val,
  };
}

export function invalidateLookupCache(categoria?: string) {
  if (categoria) {
    delete cache[categoria];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}
