import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MapPin, Zap, Target, Clock, Database, GitBranch } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import CoordinateDisplay from '../components/common/CoordinateDisplay';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';
import { detectionService, catalogService } from '../services';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [crossMatch, setCrossMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await detectionService.getCandidate(id);
      const c = res.data?.data ?? res.data;
      setCandidate(c);
      // Try cross-match
      if (c?.ra && c?.dec) {
        try {
          const cmRes = await catalogService.getNearby(c.ra, c.dec);
          setCrossMatch(cmRes.data?.data ?? cmRes.data);
        } catch { /* ok */ }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text={t('common.loading')} />;
  if (error) return <ErrorDisplay message={error} onRetry={load} />;
  if (!candidate) return <ErrorDisplay message={t('analysis.notFound')} />;

  const c = candidate;

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Back button + Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 p-1.5 rounded-lg hover:bg-white/5 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white font-mono">{c.id}</h1>
            <StatusBadge status={c.status} size="lg" />
            {c.is_simulated && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">[SIMULATED]</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{t('analysis.subtitle')}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Measurements */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" /> {t('analysis.measurements.title')}
          </h2>
          <div className="space-y-3">
            <Metric label={t('common.coordinates')} value={<CoordinateDisplay ra={c.ra ?? 0} dec={c.dec ?? 0} />} />
            <Metric label={t('analysis.measurements.displacement')} value={`${(c.displacement_arcsec ?? 0).toFixed(3)} ${t('analysis.measurements.arcsec')}`} />
            <Metric label={t('analysis.measurements.positionAngle')} value={`${(c.position_angle_deg ?? 0).toFixed(1)}°`} />
            <Metric label={t('analysis.measurements.snr')} value={`${(c.snr ?? c.snr_epoch1 ?? 0).toFixed(2)} (Epoch 1), ${(c.snr_epoch2 ?? 0).toFixed(2)} (Epoch 2)`} />
            <Metric label={t('analysis.measurements.fluxRatio')} value={(c.flux_ratio ?? 1).toFixed(3)} />
            <Metric label={t('analysis.measurements.velocity')} value={`${(c.proper_motion_arcsec_per_day ?? c.apparent_velocity_arcsec_per_day ?? 0).toFixed(4)} ${t('analysis.measurements.arcsecPerDay')}`} />
            <Metric label={t('analysis.measurements.timeInterval')} value={`${(c.time_baseline_days ?? c.time_interval_days ?? 0).toFixed(1)} ${t('analysis.measurements.days')}`} />
            <Metric label={t('analysis.header.confidence')} value={
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(c.confidence ?? 0) * 100}%` }} />
                </div>
                <span>{((c.confidence ?? 0) * 100).toFixed(0)}%</span>
              </div>
            } />
          </div>
        </div>

        {/* Image Cutouts */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" /> {t('analysis.images.title')}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <ImageSlot label={t('analysis.images.observation1')} data={c.cutout_epoch1} />
            <ImageSlot label={t('analysis.images.observation2')} data={c.cutout_epoch2} />
            <ImageSlot label={t('analysis.images.difference')} data={c.cutout_diff} />
          </div>
        </div>

        {/* Classification */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-400" /> {t('analysis.classification.title')}
          </h2>
          <div className="space-y-3">
            <Metric label={t('analysis.classification.status')} value={<StatusBadge status={c.status} />} />
            <Metric label={t('analysis.classification.reason')} value={c.classification_reason ?? c.classification ?? '—'} />
            <Metric label={t('analysis.classification.confidence')} value={((c.confidence ?? 0) * 100).toFixed(0) + '%'} />
            {c.anomaly_score != null && (
              <Metric label="Anomaly Score" value={c.anomaly_score.toFixed(3)} />
            )}
          </div>
        </div>

        {/* Cross-Match Results */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" /> {t('analysis.crossMatch.title')}
          </h2>
          {c.catalog_match_name ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">✓ {t('analysis.crossMatch.matchFound')}</div>
              <Metric label={t('analysis.crossMatch.objectName')} value={c.catalog_match_name} />
              <Metric label={t('analysis.crossMatch.separation')} value={`${(c.catalog_match_distance_arcsec ?? 0).toFixed(2)}"`} />
            </div>
          ) : crossMatch && Array.isArray(crossMatch) && crossMatch.length > 0 ? (
            <div className="space-y-2">
              {crossMatch.slice(0, 5).map((obj: any, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                  <span className="text-emerald-400">{obj.name ?? obj.designation}</span>
                  <span className="text-gray-500 ml-2">{obj.type}</span>
                  {obj.note && <p className="text-[10px] text-gray-600 mt-1">{obj.note}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">{t('analysis.crossMatch.noMatch')}</p>
          )}
        </div>
      </div>

      {/* Provenance */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" /> {t('analysis.provenance.title')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Metric label={t('analysis.provenance.source')} value={c.data_source_type ?? 'simulated'} />
          <Metric label={t('analysis.provenance.pipeline')} value={c.pipeline_version ?? '1.0.0'} />
          <Metric label={t('analysis.provenance.simulated')} value={c.is_simulated ? t('analysis.provenance.yes') : t('analysis.provenance.no')} />
          <Metric label={t('analysis.header.detectedOn')} value={c.detected_at ? new Date(c.detected_at).toLocaleString() : '—'} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-gray-300 text-right">{typeof value === 'string' || typeof value === 'number' ? value : value}</span>
    </div>
  );
}

function ImageSlot({ label, data }: { label: string; data?: string | null }) {
  return (
    <div className="text-center">
      <div className="aspect-square rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center overflow-hidden mb-1">
        {data ? (
          <img src={`data:image/png;base64,${data}`} alt={label} className="w-full h-full object-contain" />
        ) : (
          <div className="text-[10px] text-gray-600 p-2">
            <Target className="w-6 h-6 mx-auto mb-1 opacity-20" />
            No image
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}
