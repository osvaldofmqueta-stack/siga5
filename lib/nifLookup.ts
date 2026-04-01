export interface NifData {
  nif: string;
  nome: string;
  tipo: 'SINGULAR' | 'COLECTIVO';
  estado: string;
  regimeIva: string;
  residenciaFiscal: string;
}

export async function consultarNIF(nif: string): Promise<NifData | null> {
  const clean = nif.trim();
  if (!clean || clean.length < 9) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://angolaapi.onrender.com/api/v1/validate/nif/${encodeURIComponent(clean)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.nome) return null;
    return data as NifData;
  } catch {
    return null;
  }
}
