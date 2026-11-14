/** Sky geometry for the presentation: Hammer-Aitoff projection, ecliptic and galactic plane (same maths as the app's Sky Explorer). */
const D2R = Math.PI / 180;
const OBLIQUITY = 23.4392911 * D2R;

/** Hammer-Aitoff, RA increases to the left (sky seen from inside), centred on RA = 12h. Result in [-1, 1] x [-1, 1]. */
export function project(ra: number, dec: number): [number, number] {
  let l = (180 - ra) * D2R;
  if (l > Math.PI) l -= 2 * Math.PI;
  if (l < -Math.PI) l += 2 * Math.PI;
  const b = dec * D2R;
  const z = Math.sqrt(1 + Math.cos(b) * Math.cos(l / 2));
  const x = (2 * Math.SQRT2 * Math.cos(b) * Math.sin(l / 2)) / z;
  const y = (Math.SQRT2 * Math.sin(b)) / z;
  return [x / (2 * Math.SQRT2), y / Math.SQRT2];
}

export function eclipticToEq(lambdaDeg: number): [number, number] {
  const l = lambdaDeg * D2R;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  const ra = Math.atan2(Math.cos(OBLIQUITY) * Math.sin(l), Math.cos(l));
  return [((ra / D2R) + 360) % 360, dec / D2R];
}

/** Galactic longitude l (b = 0, the Milky Way plane) to equatorial J2000. */
export function galacticToEq(lDeg: number): [number, number] {
  const aNGP = 192.85948 * D2R, dNGP = 27.12825 * D2R, lNCP = 122.93192 * D2R;
  const l = lDeg * D2R;
  const sinD = Math.cos(dNGP) * Math.cos(lNCP - l);
  const dec = Math.asin(sinD);
  const ra = aNGP + Math.atan2(Math.sin(lNCP - l), -Math.sin(dNGP) * Math.cos(lNCP - l));
  return [((ra / D2R) % 360 + 360) % 360, dec / D2R];
}

/** SVG path through projected points, lifting the pen where the curve wraps around the map edge. */
export function projectedPath(pts: [number, number][], w: number, h: number, pad = 4): string {
  let d = '';
  let prev: [number, number] | null = null;
  for (const [ra, dec] of pts) {
    const [px, py] = project(ra, dec);
    const x = w / 2 + px * (w / 2 - pad);
    const y = h / 2 - py * (h / 2 - pad);
    d += prev === null || Math.abs(x - prev[0]) > w / 3 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    prev = [x, y];
  }
  return d;
}

export function toXY(ra: number, dec: number, w: number, h: number, pad = 4): [number, number] {
  const [px, py] = project(ra, dec);
  return [w / 2 + px * (w / 2 - pad), h / 2 - py * (h / 2 - pad)];
}
