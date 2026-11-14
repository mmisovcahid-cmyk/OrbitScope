import { az } from './az';
import type { Content } from './types';

/**
 * The presentation is delivered in Azerbaijani (requested for the talk). All copy lives in content/az/*;
 * to add another language implement `Content` in content/<lang>/ and select it here.
 */
export const content: Content = az;
export type { Content };
