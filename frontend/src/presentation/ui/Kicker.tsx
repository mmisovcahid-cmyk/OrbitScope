import type { ReactNode } from 'react';
import Reveal from './Reveal';

/** Small upper-case label above a scene title. Keeps "SPHEREx" spelled with its lower-case x. */
export default function Kicker({ n, children, i = 0 }: { n: string; children: string; i?: number }): ReactNode {
  const parts = children.split(/(SPHEREx)/);
  return (
    <Reveal as="span" i={i} className="ps-kicker">
      <span className="ps-num">{n}</span>
      <span>{parts.map((p, k) => (p === 'SPHEREx' ? <span key={k} className="ps-brand">{p}</span> : p))}</span>
    </Reveal>
  );
}
