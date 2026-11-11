import React, { useState } from 'react';
import { Image as ImageIcon, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Synthetic realistic star field canvas renderer
function StarfieldCutout({
  shift = false,
  label,
  targetBox = true,
}: {
  shift?: boolean;
  label: string;
  targetBox?: boolean;
}) {
  return (
    <div className="relative flex-1 aspect-square rounded-xl overflow-hidden bg-[#040711] border border-white/10 group">
      {/* Background astronomical noisy starfield */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 70px 60px, #e2e8f0, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 120px 40px, #94a3b8, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 140px 110px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 45px 130px, #cbd5e1, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 90px 90px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 160px 150px, #cbd5e1, rgba(0,0,0,0)),
            radial-gradient(1.2px 1.2px at 30px 180px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 170px 20px, #e2e8f0, rgba(0,0,0,0)),
            radial-gradient(1.8px 1.8px at 110px 170px, #94a3b8, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 60px 10px, #ffffff, rgba(0,0,0,0))
          `,
          backgroundSize: '190px 190px',
        }}
      />

      {/* Target Reticle (Purple square) */}
      {targetBox && (
        <div
          className="absolute z-10 w-9 h-9 border-2 border-purple-500 rounded-sm shadow-[0_0_12px_rgba(168,85,247,0.6)] flex items-center justify-center transition-all duration-300"
          style={{
            top: shift ? '48%' : '44%',
            left: shift ? '54%' : '45%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Moving source bright dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
        </div>
      )}

      {/* Label at bottom */}
      <div className="absolute bottom-1.5 inset-x-0 text-center text-[10px] font-medium text-gray-400 tracking-wide bg-black/40 py-0.5">
        {label}
      </div>
    </div>
  );
}

export default function ImageComparisonCard() {
  const { t } = useTranslation();
  const [epochPair, setEpochPair] = useState('May 2025 vs Dec 2025');

  return (
    <div className="flex-1 rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide">
            {t('comparison.title')}
          </h3>
        </div>

        {/* Dropdown Epoch Picker */}
        <div className="relative inline-block">
          <button className="flex items-center gap-1.5 text-xs text-gray-300 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <span>{epochPair}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Cutouts Row */}
      <div className="flex items-center gap-2.5 mt-1">
        <StarfieldCutout label="May 2025" shift={false} />
        <StarfieldCutout label="Dec 2025" shift={true} />

        {/* Inset zoom cutout */}
        <div className="relative w-16 h-28 rounded-xl overflow-hidden bg-[#040711] border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center shrink-0">
          <div className="relative flex items-center justify-center">
            {/* Diffused glow source */}
            <div className="w-8 h-8 rounded-full bg-purple-400/20 blur-sm" />
            <div className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
          </div>
        </div>
      </div>
    </div>
  );
}
