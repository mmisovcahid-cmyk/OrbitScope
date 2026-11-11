import clsx from 'clsx';
import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export default function DataCard({ icon, label, value, sub, className }: Props) {
  return (
    <div className={clsx('rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-start gap-3', className)}>
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-white">{value}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
