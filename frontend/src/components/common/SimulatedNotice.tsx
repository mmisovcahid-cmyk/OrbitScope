import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

/** Banner for pages that still run on the simulated demo pipeline. */
export default function SimulatedNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        {t('common.simulatedNotice')}{' '}
        <Link to="/" className="underline text-sky-300 hover:text-sky-200">{t('nav.blink')} →</Link>
      </span>
    </div>
  );
}
