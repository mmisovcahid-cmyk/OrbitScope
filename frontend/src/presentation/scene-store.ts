/**
 * Tiny external store: which scene is the most visible one right now.
 * Scenes report their intersection ratio; the nav, progress bar and tour read the winner.
 */
const ratios = new Map<number, number>();
const listeners = new Set<() => void>();
let active = 0;

export function reportRatio(index: number, ratio: number): void {
  ratios.set(index, ratio);
  let best = active;
  let bestRatio = ratios.get(active) ?? -1;
  ratios.forEach((r, i) => {
    if (r > bestRatio + 0.0001) { best = i; bestRatio = r; }
  });
  if (best !== active) {
    active = best;
    listeners.forEach((l) => l());
  }
}

export const subscribeActive = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export const getActive = (): number => active;
export function resetStore(): void { ratios.clear(); active = 0; listeners.forEach((l) => l()); }
