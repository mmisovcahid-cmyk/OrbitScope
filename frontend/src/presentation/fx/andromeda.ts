import { clamp, gauss, mulberry32 } from '../lib/rng';

/**
 * Procedural, Andromeda-inspired galaxy: a warm bulge, a bright blue star-forming ring, dusty spiral
 * arms, two small companions and a field of foreground stars. It is an EDUCATIONAL ILLUSTRATION
 * drawn on a canvas, never a photograph and never an OrbitScope/SPHEREx observation.
 * It is rendered once, turned into a JPEG object URL and shared by the hero and the finale.
 */
export interface AndromedaOptions { width: number; height: number; density: number; }

export function renderAndromeda({ width: W, height: H, density }: AndromedaOptions): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return c;
  const rnd = mulberry32(31337);

  // night sky
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#02030f');
  bg.addColorStop(0.5, '#05072a');
  bg.addColorStop(1, '#02030c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const cx = W * 0.6, cy = H * 0.47;
  const R = W * 0.62;          // galaxy radius
  const tilt = -0.58;          // rotation of the long axis on the sky (radians)
  const flat = 0.27;           // apparent flattening (the disk is seen almost edge-on)
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const plane = (x: number, y: number): [number, number] => {
    const yy = y * flat;
    return [cx + x * cos - yy * sin, cy + x * sin + yy * cos];
  };

  g.globalCompositeOperation = 'lighter';

  // soft halos
  const halo = (rx: number, ry: number, inner: string, alpha: number, ox = 0, oy = 0) => {
    g.save();
    g.translate(cx + ox, cy + oy);
    g.rotate(tilt);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, inner.replace('ALPHA', String(alpha)));
    gr.addColorStop(0.45, inner.replace('ALPHA', String(alpha * 0.32)));
    gr.addColorStop(1, inner.replace('ALPHA', '0'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  halo(R * 1.05, R * flat * 1.15, 'rgba(120,130,255,ALPHA)', 0.22);
  halo(R * 0.55, R * flat * 0.62, 'rgba(160,150,255,ALPHA)', 0.3);
  halo(R * 0.2, R * 0.2 * 0.62, 'rgba(255,214,150,ALPHA)', 0.85);
  halo(R * 0.07, R * 0.07 * 0.8, 'rgba(255,240,215,ALPHA)', 0.95);

  const dot = (x: number, y: number, r: number, color: string, a: number) => {
    g.fillStyle = color;
    g.globalAlpha = a;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // bulge + disk
  const nDisk = Math.round(26000 * density);
  for (let i = 0; i < nDisk; i++) {
    const u = rnd();
    const r = -Math.log(1 - u * 0.985) * R * 0.2;   // exponential disk
    if (r > R) continue;
    const th = rnd() * Math.PI * 2;
    const [x, y] = plane(r * Math.cos(th), r * Math.sin(th));
    const warm = clamp(1 - r / (R * 0.28), 0, 1);
    const col = warm > 0.55 ? '#ffe2b3' : warm > 0.2 ? '#f1e3ff' : '#aebdff';
    dot(x, y, rnd() * 0.9 + 0.35, col, 0.05 + rnd() * 0.16);
  }

  // spiral arms (logarithmic spirals, two main arms)
  const nArm = Math.round(30000 * density);
  for (let i = 0; i < nArm; i++) {
    const arm = i % 2;
    const r = (0.1 + rnd() * 0.92) * R;
    const th = 3.4 * Math.log(r / (R * 0.06)) + arm * Math.PI + gauss(rnd) * 0.2;
    const [x, y] = plane(r * Math.cos(th) + gauss(rnd) * R * 0.012, r * Math.sin(th) + gauss(rnd) * R * 0.012);
    const k = r / R;
    const col = k < 0.35 ? '#e6dcff' : k < 0.7 ? '#9fb8ff' : '#a98cff';
    dot(x, y, rnd() * 1.1 + 0.3, col, 0.04 + rnd() * 0.15);
  }

  // the bright star-forming ring (a famous feature of this galaxy)
  const nRing = Math.round(14000 * density);
  for (let i = 0; i < nRing; i++) {
    const th = rnd() * Math.PI * 2;
    const r = R * (0.5 + gauss(rnd) * 0.026);
    const [x, y] = plane(r * Math.cos(th), r * Math.sin(th));
    const hue = rnd() < 0.5 ? '#8fc4ff' : '#c6a2ff';
    dot(x, y, rnd() * 1.3 + 0.35, hue, 0.08 + rnd() * 0.22);
  }
  const nRing2 = Math.round(6000 * density);
  for (let i = 0; i < nRing2; i++) {
    const th = rnd() * Math.PI * 2;
    const r = R * (0.82 + gauss(rnd) * 0.04);
    const [x, y] = plane(r * Math.cos(th), r * Math.sin(th));
    dot(x, y, rnd() * 1 + 0.3, '#8ea6ff', 0.04 + rnd() * 0.1);
  }

  // dust lanes: thin dark spirals just inside the arms
  g.globalCompositeOperation = 'source-over';
  const nDust = Math.round(9000 * density);
  for (let i = 0; i < nDust; i++) {
    const arm = i % 2;
    const r = (0.12 + rnd() * 0.85) * R;
    const th = 3.4 * Math.log(r / (R * 0.06)) + arm * Math.PI + 0.38 + gauss(rnd) * 0.07;
    const [x, y] = plane(r * Math.cos(th), r * Math.sin(th));
    dot(x, y, rnd() * 3.4 + 0.8, '#06030f', 0.045 + rnd() * 0.06);
  }
  g.globalCompositeOperation = 'lighter';

  // two small companion galaxies
  const companion = (x: number, y: number, rx: number, ry: number, rot: number, color: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, color.replace('ALPHA', '0.9'));
    gr.addColorStop(0.35, color.replace('ALPHA', '0.3'));
    gr.addColorStop(1, color.replace('ALPHA', '0'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const c1 = plane(-R * 0.34, R * 0.62);
  companion(c1[0], c1[1], R * 0.05, R * 0.05, 0, 'rgba(255,230,190,ALPHA)');
  const c2 = plane(R * 0.78, -R * 1.45);
  companion(c2[0], c2[1], R * 0.1, R * 0.045, -0.5, 'rgba(220,215,255,ALPHA)');

  // foreground stars with a few diffraction spikes
  g.globalAlpha = 1;
  const nStars = Math.round(1400 * density);
  for (let i = 0; i < nStars; i++) {
    const x = rnd() * W, y = rnd() * H;
    const b = Math.pow(rnd(), 5);
    const r = 0.45 + b * 1.9;
    const tint = rnd();
    g.fillStyle = tint < 0.15 ? '#ffd9a8' : tint < 0.35 ? '#b8caff' : '#ffffff';
    g.globalAlpha = 0.3 + b * 0.7;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (b > 0.55) {
      g.globalAlpha = 0.25 + b * 0.35;
      g.strokeStyle = '#dfe6ff';
      g.lineWidth = 0.7;
      const L = 8 + b * 26;
      g.beginPath();
      g.moveTo(x - L, y); g.lineTo(x + L, y);
      g.moveTo(x, y - L); g.lineTo(x, y + L);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // vignette
  const vg = g.createRadialGradient(W * 0.55, H * 0.5, Math.min(W, H) * 0.25, W * 0.55, H * 0.5, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(2,3,15,0)');
  vg.addColorStop(1, 'rgba(2,3,15,0.7)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return c;
}

let cached: Promise<string> | null = null;
let cachedKey = '';

/** One shared JPEG object URL for hero + finale; rendered lazily after first paint. */
export function getAndromedaUrl(lite: boolean): Promise<string> {
  const key = lite ? 'lite' : 'full';
  if (cached && cachedKey === key) return cached;
  cachedKey = key;
  cached = new Promise<string>((resolve, reject) => {
    const run = () => {
      try {
        const canvas = renderAndromeda(lite ? { width: 1280, height: 800, density: 0.5 } : { width: 2048, height: 1280, density: 1 });
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          resolve(URL.createObjectURL(blob));
        }, 'image/jpeg', lite ? 0.8 : 0.88);
      } catch (e) { reject(e); }
    };
    window.setTimeout(run, 60);
  });
  return cached;
}
