import type { ReactNode } from 'react';
import { content } from '../content';

export type BadgeKind = 'impl' | 'hw' | 'edu' | 'plan' | 'notes' | 'unver' | 'lit';

const KEY: Record<BadgeKind, keyof typeof content.common.badges> = {
  impl: 'impl', hw: 'hw', edu: 'edu', plan: 'plan', notes: 'notes', unver: 'unver', lit: 'lit',
};

/** Status label used on every scene: implemented / hardware capability / educational / planned / per notes. */
export default function Badge({ kind, children }: { kind: BadgeKind; children?: ReactNode }) {
  return <span className={`ps-badge ps-badge--${kind}`}>{children ?? content.common.badges[KEY[kind]]}</span>;
}
