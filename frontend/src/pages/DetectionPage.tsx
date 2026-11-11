import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Radar, Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import CoordinateDisplay from '../components/common/CoordinateDisplay';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SimulatedNotice from '../components/common/SimulatedNotice';
import { skyService, detectionService } from '../services';

const PIPELINE_STAGES = [
  'preprocessing', 'alignment', 'source_detection', 'subtraction',
  'association', 'crossmatch', 'classification', 'ml_scoring'
];

export default function DetectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [ra, setRa] = useState(params.get('ra') || '83.82');
  const [dec, setDec] = useState(params.get('dec') || '-5.39');
  const [radius, setRadius] = useState('1.5');
  const [observations, setObservations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(-1);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRegion = useCallback(async () => {
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const res = await skyService.getObservations(parseFloat(ra), parseFloat(dec), parseFloat(radius));
      const d = res.data?.data ?? res.data ?? [];
      setObservations(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [ra, dec, radius]);

  useEffect(() => {
    if (params.get('ra')) searchRegion();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const runPipeline = useCallback(async () => {
    if (selected.length < 2) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setCurrentStage(0);

    // Simulate stage progression
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setCurrentStage(i);
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      const res = await detectionService.run(selected);
      setResult(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
      setCurrentStage(-1);
    }
  }, [selected]);

  const candidates = result?.candidates ?? [];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radar className="w-6 h-6 text-blue-400" /> {t('detection.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('detection.subtitle')}</p>
      </div>

      <SimulatedNotice />

      {/* Region Selector */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">{t('detection.regionSelector.title')}</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] text-gray-500">{t('detection.regionSelector.ra')}</label>
            <input type="number" value={ra} onChange={(e) => setRa(e.target.value)} min={0} max={360} step={0.01}
              className="block w-28 mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-blue-500/50 focus:outline-none" />
            <span className="text-[10px] text-gray-600">{t('detection.regionSelector.raHelp')}</span>
          </div>
          <div>
            <label className="text-[11px] text-gray-500">{t('detection.regionSelector.dec')}</label>
            <input type="number" value={dec} onChange={(e) => setDec(e.target.value)} min={-90} max={90} step={0.01}
              className="block w-28 mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-blue-500/50 focus:outline-none" />
            <span className="text-[10px] text-gray-600">{t('detection.regionSelector.decHelp')}</span>
          </div>
          <div>
            <label className="text-[11px] text-gray-500">{t('detection.regionSelector.radius')}</label>
            <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} min={0.1} max={10} step={0.1}
              className="block w-24 mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-blue-500/50 focus:outline-none" />
          </div>
          <button onClick={searchRegion} disabled={searching}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white disabled:opacity-50 transition-colors">
            {searching ? t('common.loading') : t('detection.regionSelector.search')}
          </button>
        </div>
      </div>

      {/* Available Observations */}
      {observations.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            {t('detection.observations.title')} ({observations.length})
          </h2>
          <p className="text-[11px] text-gray-500 mb-3">{t('detection.observations.select')}</p>
          <div className="space-y-2">
            {observations.map((obs: any) => (
              <button
                key={obs.id}
                onClick={() => toggleSelect(obs.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                  selected.includes(obs.id)
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-white/5 bg-white/[0.01] text-gray-400 hover:bg-white/[0.03]'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  selected.includes(obs.id) ? 'border-blue-400 bg-blue-500' : 'border-gray-600'
                }`}>
                  {selected.includes(obs.id) && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="font-mono text-xs">{obs.id}</span>
                  <span className="text-xs text-gray-500">{t('detection.observations.epoch')}: {obs.timestamp ?? obs.epoch ?? '—'}</span>
                  <span className="text-xs text-gray-500">{t('detection.observations.band')}: {obs.band ?? 'NIR'}</span>
                  {obs.is_simulated && <span className="text-[10px] text-amber-500/60">[SIMULATED]</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Run Pipeline Button */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={runPipeline}
              disabled={selected.length < 2 || running}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? t('detection.pipeline.running') : t('detection.pipeline.run')}
            </button>
            {selected.length < 2 && (
              <span className="text-xs text-gray-500">{t('detection.pipeline.selectTwo')}</span>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Progress */}
      {running && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <h2 className="text-sm font-medium text-blue-300 mb-3">{t('detection.pipeline.title')}</h2>
          <div className="space-y-2">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-3 text-xs">
                {i < currentStage ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : i === currentStage ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
                )}
                <span className={i <= currentStage ? 'text-gray-300' : 'text-gray-600'}>{stage.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">{t('detection.results.title')}</h2>
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> {t('detection.pipeline.complete')}
            </span>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <p className="text-lg font-bold text-blue-400">{candidates.length}</p>
              <p className="text-[10px] text-gray-500">{t('detection.results.candidates')}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-lg font-bold text-emerald-400">{candidates.filter((c: any) => c.status === 'known_object').length}</p>
              <p className="text-[10px] text-gray-500">{t('detection.results.known')}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-lg font-bold text-amber-400">{candidates.filter((c: any) => c.status === 'probable_artifact').length}</p>
              <p className="text-[10px] text-gray-500">{t('detection.results.artifacts')}</p>
            </div>
          </div>

          {/* Candidates Table */}
          {candidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-white/5">
                    <th className="text-left pb-2 pr-3">ID</th>
                    <th className="text-left pb-2 pr-3">{t('common.status')}</th>
                    <th className="text-left pb-2 pr-3">{t('common.coordinates')}</th>
                    <th className="text-left pb-2 pr-3">{t('analysis.measurements.displacement')}</th>
                    <th className="text-left pb-2 pr-3">SNR</th>
                    <th className="text-left pb-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 font-mono text-blue-400">{c.id}</td>
                      <td className="py-2 pr-3"><StatusBadge status={c.status} size="sm" /></td>
                      <td className="py-2 pr-3"><CoordinateDisplay ra={c.ra} dec={c.dec} /></td>
                      <td className="py-2 pr-3 font-mono">{(c.displacement_arcsec ?? 0).toFixed(2)}"</td>
                      <td className="py-2 pr-3 font-mono">{(c.snr ?? c.snr_epoch1 ?? 0).toFixed(1)}</td>
                      <td className="py-2">
                        <button onClick={() => navigate(`/analysis/${c.id}`)} className="text-blue-400 hover:text-blue-300">
                          {t('detection.results.viewDetails')} →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600 text-center py-4">{t('detection.results.noResults')}</p>
          )}

          {result.is_simulated && (
            <p className="text-[10px] text-amber-500/60 mt-3">⚠ {t('about.dataSources.note')}</p>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
