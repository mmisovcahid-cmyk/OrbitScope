import { useTranslation } from 'react-i18next';
import { DetectionStatus } from '../../types';
import clsx from 'clsx';

const CFG: Record<string, { bg: string; text: string; key: string }> = {
  [DetectionStatus.KNOWN_OBJECT]: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', key: 'status.known_object' },
  [DetectionStatus.CANDIDATE]: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', key: 'status.candidate' },
  [DetectionStatus.UNLIKELY_CANDIDATE]: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', key: 'status.unlikely_candidate' },
  [DetectionStatus.PROBABLE_ARTIFACT]: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', key: 'status.probable_artifact' },
  [DetectionStatus.NEEDS_REVIEW]: { bg: 'bg-violet-500/15 border-violet-500/30', text: 'text-violet-400', key: 'status.needs_review' },
};

export default function StatusBadge({ status, size = 'md' }: { status: DetectionStatus | string; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation();
  const c = CFG[status] ?? CFG[DetectionStatus.NEEDS_REVIEW];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border font-medium', c.bg, c.text,
      size === 'sm' && 'text-[10px] px-2 py-0.5',
      size === 'md' && 'text-xs px-2.5 py-0.5',
      size === 'lg' && 'text-sm px-3 py-1'
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.text.replace('text-', 'bg-'))} />
      {t(c.key)}
    </span>
  );
}
