/**
 * Optional real Andromeda photograph for the hero and the finale.
 *
 * `null` = no photo is installed: the pages show the procedural, clearly labelled illustration
 * (fx/andromeda.ts). Downloading a photo needs the owner's approval (file name, source, size,
 * licence). Once a photo is approved, put the optimised files in public/presentation/andromeda/ and
 * fill this object, e.g.:
 *
 *   export const ANDROMEDA_PHOTO: AndromedaPhoto | null = {
 *     src: { jpg: ['/presentation/andromeda/m31-1280.jpg 1280w', '/presentation/andromeda/m31-2560.jpg 2560w'],
 *            webp: [...], avif: [...] },
 *     credit: 'Image credit: NASA, ESA ... (licence ...)',
 *     alt: '...',
 *   };
 */
export interface AndromedaPhoto {
  src: { jpg: string[]; webp?: string[]; avif?: string[] };
  credit: string;
  alt: string;
}

export const ANDROMEDA_PHOTO: AndromedaPhoto | null = null;
