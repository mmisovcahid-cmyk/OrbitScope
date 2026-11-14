import { useEffect, useState } from 'react';
import { usePerf } from '../perf-context';
import { content } from '../content';
import { ANDROMEDA_PHOTO } from './andromeda-photo';
import { getAndromedaUrl } from './andromeda';

/** Andromeda backdrop for the hero and finale: the approved photograph if one is installed, otherwise the labelled procedural illustration. */
export default function AndromedaBackdrop({ variant }: { variant: 'hero' | 'finale' }) {
  const { lite } = usePerf();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (ANDROMEDA_PHOTO) return;
    let alive = true;
    getAndromedaUrl(lite).then((u) => { if (alive) setUrl(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [lite]);

  return (
    <div className={`ps-andro ps-andro--${variant}`} aria-hidden="true">
      <div className="ps-andro-zoom">
        {ANDROMEDA_PHOTO ? (
          <picture>
            {ANDROMEDA_PHOTO.src.avif && <source type="image/avif" srcSet={ANDROMEDA_PHOTO.src.avif.join(', ')} sizes="100vw" />}
            {ANDROMEDA_PHOTO.src.webp && <source type="image/webp" srcSet={ANDROMEDA_PHOTO.src.webp.join(', ')} sizes="100vw" />}
            <img className="ps-andro-img is-ready" src={ANDROMEDA_PHOTO.src.jpg[0].split(' ')[0]} srcSet={ANDROMEDA_PHOTO.src.jpg.join(', ')}
              sizes="100vw" alt={ANDROMEDA_PHOTO.alt} loading={variant === 'hero' ? 'eager' : 'lazy'} decoding="async" />
          </picture>
        ) : (
          url && <img className="ps-andro-img is-ready" src={url} alt="" decoding="async" />
        )}
      </div>
      <div className="ps-andro-shade" />
    </div>
  );
}

/** Credit line under the backdrop: honest about what the picture is. */
export function AndromedaCredit() {
  const c = content.andromeda;
  return (
    <p className="ps-andro-credit">
      {ANDROMEDA_PHOTO ? ANDROMEDA_PHOTO.credit : c.illustration}
      {' '}<span>{c.notObserved}</span>
    </p>
  );
}
