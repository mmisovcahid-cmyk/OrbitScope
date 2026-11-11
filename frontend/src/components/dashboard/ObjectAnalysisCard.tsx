import React from 'react';
import { Info, MapPin, Layers, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ObjectAnalysisCard({
  candidateId = '#0042',
  coordinates = '12h 34m / -08° 21\'',
  epochs = '2 Epochs',
  catalogMatch = 'Checking...',
  confidence = 78,
  description = 'A moving source has been detected between two observations. Further verification is required.'
}: {
  candidateId?: string;
  coordinates?: string;
  epochs?: string;
  catalogMatch?: string;
  confidence?: number;
  description?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 flex flex-col justify-between shadow-xl">
      {/* Top row */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              {t('analysis.title')}
            </h3>
          </div>

          {/* Status pill badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t('status.candidate')}
          </span>
        </div>

        {/* Large Candidate Name */}
        <h2 className="text-xl font-bold text-white tracking-wide mt-2">
          Candidate {candidateId}
        </h2>

        {/* Details Two-Column Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {/* Left Metadata list */}
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-400 block text-[10px]">Coordinates (RA / Dec)</span>
                <span className="font-mono text-gray-200">{coordinates}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-gray-300">
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-400 block text-[10px]">Observations</span>
                <span className="text-gray-200">{epochs}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-gray-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-400 block text-[10px]">Catalog Match</span>
                <span className="text-gray-200">{catalogMatch}</span>
              </div>
            </div>
          </div>

          {/* Right Description Text */}
          <div className="text-xs text-gray-400 leading-relaxed flex items-center">
            <p>{description}</p>
          </div>
        </div>
      </div>

      {/* Bottom Confidence Bar */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-gray-400">Confidence</span>
        
        {/* Progress bar with glowing orange gradient */}
        <div className="flex-1 max-w-xs h-2 rounded-full bg-white/5 overflow-hidden p-[1px]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
            style={{ width: `${confidence}%` }}
          />
        </div>

        <span className="text-xs font-semibold text-white font-mono">{confidence}%</span>
      </div>
    </div>
  );
}
