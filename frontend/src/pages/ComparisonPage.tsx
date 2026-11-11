import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCompare, Eye, Layers, Zap } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SimulatedNotice from '../components/common/SimulatedNotice';
import { skyService, observationService } from '../services';

type Mode = 'side' | 'overlay' | 'blink' | 'difference';

export default function ComparisonPage() {
  const { t } = useTranslation();
  const [observations, setObservations] = useState<any[]>([]);
  const [sel1, setSel1] = useState('');
  const [sel2, setSel2] = useState('');
  const [mode, setMode] = useState<Mode>('side');
  const [opacity, setOpacity] = useState(0.5);
  const [blinkIdx, setBlinkIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ra, setRa] = useState('83.82');
  const [dec, setDec] = useState('-5.39');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRegion = useCallback(async (raDeg: number, decDeg: number) => {
    if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg) || raDeg < 0 || raDeg >= 360 || decDeg < -90 || decDeg > 90) {
      setLoadError(t('errors.invalidCoordinates', { defaultValue: 'Invalid coordinates' }));
      return;
    }
    setLoadError(null);
    setResult(null);
    try {
      const res = await skyService.getObservations(raDeg, decDeg, 1.5);
      const d = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(d) ? d : [];
      setObservations(list);
      if (list.length >= 2) { setSel1(list[0].id); setSel2(list[1].id); }
    } catch (e: any) {
      setLoadError(e?.message ?? 'Error');
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { loadRegion(83.82, -5.39); }, [loadRegion]);

  // Blink mode timer
  useEffect(() => {
    if (mode !== 'blink') return;
    const iv = setInterval(() => setBlinkIdx((p) => (p + 1) % 2), 1000);
    return () => clearInterval(iv);
  }, [mode]);

  const compare = useCallback(async () => {
    if (!sel1 || !sel2) return;
    setComparing(true);
    try {
      const res = await observationService.compare(sel1, sel2);
      setResult(res.data?.data ?? res.data);
    } catch { }
    setComparing(false);
  }, [sel1, sel2]);

  if (loading) return <LoadingSpinner text={t('common.loading')} />;

  const obs1 = observations.find((o: any) => o.id === sel1);
  const obs2 = observations.find((o: any) => o.id === sel2);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-blue-400" /> {t('comparison.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('comparison.subtitle')}</p>
      </div>

      <SimulatedNotice />

      {/* Controls */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="text-[11px] text-gray-500">{t('detection.regionSelector.ra')}</label>
            <input value={ra} onChange={(e) => setRa(e.target.value)} inputMode="decimal"
              className="block mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white w-32" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">{t('detection.regionSelector.dec')}</label>
            <input value={dec} onChange={(e) => setDec(e.target.value)} inputMode="decimal"
              className="block mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white w-32" />
          </div>
          <button onClick={() => loadRegion(parseFloat(ra), parseFloat(dec))}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white">
            {t('detection.regionSelector.search')}
          </button>
          {loadError && <span className="text-xs text-red-300">{loadError}</span>}
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[11px] text-gray-500">{t('comparison.controls.observation1')}</label>
            <select value={sel1} onChange={(e) => setSel1(e.target.value)}
              className="block mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white w-48">
              {observations.map((o: any) => <option key={o.id} value={o.id}>{o.id} — {o.band ?? 'NIR'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500">{t('comparison.controls.observation2')}</label>
            <select value={sel2} onChange={(e) => setSel2(e.target.value)}
              className="block mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white w-48">
              {observations.map((o: any) => <option key={o.id} value={o.id}>{o.id} — {o.band ?? 'NIR'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500">{t('comparison.controls.mode')}</label>
            <div className="flex mt-1 rounded-lg overflow-hidden border border-white/10">
              {(['side', 'overlay', 'blink', 'difference'] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-xs ${mode === m ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {t(`comparison.controls.${m === 'side' ? 'sideBySide' : m}`)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={compare} disabled={comparing || !sel1 || !sel2}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white disabled:opacity-50">
            {comparing ? t('common.loading') : t('common.search')}
          </button>
        </div>
        {mode === 'overlay' && (
          <div className="mt-3">
            <label className="text-[11px] text-gray-500">{t('comparison.controls.opacity')}: {(opacity * 100).toFixed(0)}%</label>
            <input type="range" min={0} max={1} step={0.01} value={opacity} onChange={(e) => setOpacity(+e.target.value)}
              className="w-48 ml-2 accent-blue-500" />
          </div>
        )}
      </div>

      {/* Comparison View */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        {result ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-300">{t('comparison.info.timeInterval')}: {(result.time_interval_days ?? 0).toFixed(1)} {t('analysis.measurements.days')}</h2>
              <span className="text-xs text-gray-500">{t('comparison.info.changes')}: {result.num_differences ?? result.detected_changes?.length ?? 0}</span>
            </div>
            <div className={`grid ${mode === 'side' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {mode === 'side' && (
                <>
                  <ImagePanel label={t('comparison.info.epoch1')} data={result.obs1_image_base64} obs={obs1} />
                  <ImagePanel label={t('comparison.info.epoch2')} data={result.obs2_image_base64} obs={obs2} />
                </>
              )}
              {mode === 'overlay' && (
                <div className="relative aspect-video rounded-lg bg-black overflow-hidden">
                  <ImagePanel label="" data={result.obs1_image_base64} />
                  <div className="absolute inset-0" style={{ opacity }}>
                    <ImagePanel label="" data={result.obs2_image_base64} />
                  </div>
                </div>
              )}
              {mode === 'blink' && (
                <ImagePanel
                  label={blinkIdx === 0 ? t('comparison.info.epoch1') : t('comparison.info.epoch2')}
                  data={blinkIdx === 0 ? result.obs1_image_base64 : result.obs2_image_base64}
                />
              )}
              {mode === 'difference' && (
                <ImagePanel label={t('comparison.controls.difference')} data={result.difference_image_base64} />
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600 text-center py-8">{t('comparison.selectObservations')}</p>
        )}
      </div>
    </div>
  );
}

function ImagePanel({ label, data, obs }: { label: string; data?: string | null; obs?: any }) {
  return (
    <div>
      {label && <p className="text-xs text-gray-400 mb-1">{label} {obs?.timestamp ? `— ${obs.timestamp}` : ''}</p>}
      <div className="aspect-video rounded-lg bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
        {data ? (
          <img src={`data:image/png;base64,${data}`} alt={label} className="w-full h-full object-contain" />
        ) : (
          <div className="text-gray-600 text-xs flex flex-col items-center gap-2">
            <Layers className="w-8 h-8 opacity-20" />
            <span>{label || 'No image data'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
