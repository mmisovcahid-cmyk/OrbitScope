/** Convert decimal degrees to HMS/DMS strings */
function toHMS(ra: number) {
  const h = ra / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${mm}m ${ss.toFixed(1)}s`;
}

function toDMS(dec: number) {
  const sign = dec >= 0 ? '+' : '-';
  const d = Math.abs(dec);
  const dd = Math.floor(d);
  const mm = Math.floor((d - dd) * 60);
  const ss = ((d - dd) * 60 - mm) * 60;
  return `${sign}${dd}° ${mm}' ${ss.toFixed(1)}"`;
}

export default function CoordinateDisplay({ ra, dec, className }: { ra: number; dec: number; className?: string }) {
  return (
    <span className={className ?? 'font-mono text-xs text-gray-300'}>
      {toHMS(ra)}, {toDMS(dec)}
      <span className="text-gray-500 ml-1">({ra.toFixed(4)}°, {dec.toFixed(4)}°)</span>
    </span>
  );
}
