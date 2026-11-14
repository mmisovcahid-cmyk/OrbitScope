import type { az } from './az';

/** Turns the literal `as const` types of the Azerbaijani file into plain string types, so another language can implement `Content`. */
export type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type Content = Widen<typeof az>;
