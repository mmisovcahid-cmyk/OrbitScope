import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

/** Loads a static JSON snapshot from public/presentation/data (real data exported from the backend, saved with its date). */
export function useJson<T>(url: string, enabled = true): { data: T | null; error: boolean } {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let p = cache.get(url) as Promise<T> | undefined;
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<T>;
      });
      cache.set(url, p);
    }
    p.then((d) => { if (alive) setState({ data: d, error: false }); })
      .catch(() => { cache.delete(url); if (alive) setState({ data: null, error: true }); });
    return () => { alive = false; };
  }, [url, enabled]);
  return state;
}

/** Decode a little-endian float32 array from base64 (used for the exported SPHEREx cutouts). */
export function decodeFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(buf);
  const out = new Float32Array(bin.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}
