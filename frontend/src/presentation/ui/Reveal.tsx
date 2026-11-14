import { createElement, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
  i?: number;                         // stagger index
  as?: keyof JSX.IntrinsicElements;
  from?: 'up' | 'left' | 'right' | 'zoom';
  style?: CSSProperties;
  children?: ReactNode;
}

/** Staggered, scroll-triggered reveal. The scene host adds `is-in` when the scene first comes into view. */
export default function Reveal({ i = 0, as = 'div', className = '', from = 'up', style, children, ...rest }: Props) {
  const dir = from === 'left' ? 'from-left' : from === 'right' ? 'from-right' : from === 'zoom' ? 'zoom' : '';
  return createElement(
    as,
    { ...rest, className: `ps-reveal ${dir} ${className}`.trim(), style: { ['--i' as string]: i, ...style } },
    children,
  );
}
