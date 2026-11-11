import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ErrorDisplay({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertTriangle className="w-8 h-8 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300">
          <RefreshCw className="w-3 h-3" /> {t('common.retry')}
        </button>
      )}
    </div>
  );
}
