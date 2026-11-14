import { decodeFloat32 } from './useJson';

/** Shape of public/presentation/data/barnard-frames.json (written by backend/scripts/export_presentation_assets.py). */
export interface BarnardFile {
  source: string;
  exported_at: string;
  detector: number;
  units: string;
  grid: { width: number; height: number; pixscale_arcsec: number; fov_deg: number };
  stretch_hint: { vmin: number; vmax: number };
  target: { name: string; ra: number; dec: number; pmra: number; pmdec: number };
  frames: { date: string; date_start: string; date_end: string; n_frames: number; wavelength_um: [number, number]; target_px: [number, number]; data_b64: string }[];
}

export interface Frames {
  w: number;
  h: number;
  pix: number;
  data: Float32Array[];
  meta: BarnardFile['frames'];
  vmin: number;
  vmax: number;
}

export function decodeFrames(f: BarnardFile): Frames {
  return {
    w: f.grid.width, h: f.grid.height, pix: f.grid.pixscale_arcsec,
    data: f.frames.map((fr) => decodeFloat32(fr.data_b64)),
    meta: f.frames, vmin: f.stretch_hint.vmin, vmax: f.stretch_hint.vmax,
  };
}

export type Mode = 'blink' | 'diff' | 'motion' | 'stack';

const A = 8; // asinh softening
const asinhNorm = (v: number): number => Math.asinh(A * Math.min(1, Math.max(0, v))) / Math.asinh(A);

/** Paint one display image (w x h, north up) for the chosen mode. Row 0 of the data is the southern edge, so rows are flipped. */
export function paint(frames: Frames, mode: Mode, frame: number, target: ImageData): void {
  const { w, h, data, vmin, vmax } = frames;
  const span = vmax - vmin || 1;
  const last = data.length - 1;
  const px = target.data;
  const norm = (arr: Float32Array, i: number) => asinhNorm((arr[i] - vmin) / span);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const o = ((h - 1 - r) * w + c) * 4;
      let R = 0, G = 0, B = 0;
      if (mode === 'blink') {
        const v = norm(data[frame], i);
        R = v * 235; G = v * 238; B = v * 255;
      } else if (mode === 'stack') {
        let s = 0;
        for (const d of data) s += d[i];
        const v = asinhNorm((s / data.length - vmin) / span);
        R = v * 240; G = v * 236; B = v * 255;
      } else if (mode === 'motion') {
        const a = norm(data[0], i), b = norm(data[last], i);
        R = a * 255; B = b * 255; G = Math.min(a, b) * 255;
      } else {
        // difference of the newest and the oldest frame on top of a dim copy of the field
        const d = (data[last][i] - data[0][i]) / span * 6;
        const base = norm(data[0], i) * 0.28;
        const pos = Math.min(1, Math.max(0, d)), neg = Math.min(1, Math.max(0, -d));
        R = (base + neg * 0.95) * 255; G = (base + Math.min(pos, neg) * 0.4) * 255; B = (base + pos * 0.95) * 255;
      }
      px[o] = R; px[o + 1] = G; px[o + 2] = B; px[o + 3] = 255;
    }
  }
}

/** Real displacement of the Gaia-propagated target position between the first and last frame. */
export function displacement(frames: Frames): { px: number; arcsec: number; days: number } {
  const a = frames.meta[0], b = frames.meta[frames.meta.length - 1];
  const px = Math.hypot(b.target_px[0] - a.target_px[0], b.target_px[1] - a.target_px[1]);
  const days = (Date.parse(b.date) - Date.parse(a.date)) / 86400000;
  return { px, arcsec: px * frames.pix, days };
}
