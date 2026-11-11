import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Database, Globe, Compass } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';
import { catalogService } from '../services';

export default function CatalogPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('Ceres');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectData, setObjectData] = useState<any>(null);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getObject(query.trim());
      const data = res.data?.data ?? res.data;
      if (data) {
        setObjectData(data);
      } else {
        setError(t('catalog.results.noResults'));
        setObjectData(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || t('catalog.results.noResults'));
      setObjectData(null);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  const selectPredefined = (name: string) => {
    setQuery(name);
    setTimeout(() => {
      catalogService.getObject(name).then(res => {
        setObjectData(res.data?.data ?? res.data);
      }).catch(err => {
        setError(err?.message || 'Error fetching');
      });
    }, 50);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-400" />
          {t('catalog.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('catalog.subtitle')}</p>
      </div>

      {/* Search Input Box */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('catalog.search.placeholder')}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('catalog.search.search')}
          </button>
        </form>

        {/* Quick select pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <span className="text-xs text-gray-500">Məşhur cisimlər:</span>
          {['1 Ceres', '4 Vesta', '433 Eros', '99942 Apophis', '101955 Bennu', 'Sedna'].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => selectPredefined(name)}
              className="text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-blue-400 border border-white/5 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner text={t('common.loading')} />}
      {error && <ErrorDisplay message={error} />}

      {/* Object Details View */}
      {objectData && !loading && (
        <div className="space-y-6">
          {/* Main Title Card */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-wide">{objectData.name || objectData.designation}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {objectData.object_type || objectData.orbit_class || 'Asteroid'}
                </span>
                {objectData.orbit_class && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {objectData.orbit_class}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Təyinat: <span className="font-mono text-gray-300">{objectData.designation}</span> • Mənbə: <span className="text-blue-400">{objectData.data_source || 'JPL SBDB API'}</span>
              </p>
            </div>

            {objectData.discovery_date && (
              <div className="text-left md:text-right text-xs text-gray-400">
                <div>Kəşf Tarixi: <span className="text-gray-200">{objectData.discovery_date}</span></div>
                {objectData.discoverer && <div>Kəşf edən: <span className="text-gray-200">{objectData.discoverer}</span></div>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orbital Elements */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                {t('catalog.detail.orbital')}
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.semiMajorAxis')} (a)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.semi_major_axis_au ?? '—'} {t('catalog.detail.au')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.eccentricity')} (e)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.eccentricity ?? '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.inclination')} (i)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.inclination_deg ?? '—'}{t('catalog.detail.degrees')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.perihelion')} (q)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.perihelion_dist_au ?? objectData.orbital_elements?.perihelion_distance_au ?? '—'} {t('catalog.detail.au')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.aphelion')} (Q)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.aphelion_dist_au ?? objectData.orbital_elements?.aphelion_distance_au ?? '—'} {t('catalog.detail.au')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.orbitalPeriod')}</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.orbital_period_years ?? '—'} {t('catalog.detail.years')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-gray-400">{t('catalog.detail.lonAscNode')} (Ω)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.longitude_asc_node_deg ?? '—'}{t('catalog.detail.degrees')}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400">{t('catalog.detail.argPerihelion')} (ω)</span>
                  <span className="font-mono text-white">{objectData.orbital_elements?.argument_perihelion_deg ?? '—'}{t('catalog.detail.degrees')}</span>
                </div>
              </div>
            </div>

            {/* Physical Parameters & Hazards */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  {t('catalog.detail.physical')}
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">{t('catalog.detail.diameter')}</span>
                    <span className="font-mono text-white">
                      {objectData.physical_params?.diameter_km ?? '—'} {t('catalog.detail.km')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">{t('catalog.detail.absoluteMag')} (H)</span>
                    <span className="font-mono text-white">{objectData.physical_params?.abs_magnitude ?? '—'} mag</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">{t('catalog.detail.albedo')}</span>
                    <span className="font-mono text-white">{objectData.physical_params?.albedo ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Fırlanma Dövrü</span>
                    <span className="font-mono text-white">
                      {objectData.physical_params?.rotation_period_hours ? `${objectData.physical_params.rotation_period_hours} saat` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400">Spektral Sinif</span>
                    <span className="font-mono text-white">{objectData.physical_params?.spectral_type || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Close Approach / Hazard Status */}
              <div className="pt-4 border-t border-white/5">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Təhlükəsizlik və Yaxınlaşmalar</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-gray-400 block mb-1">{t('catalog.detail.isNEO')}</span>
                    <span className={`font-semibold ${objectData.orbit_class?.includes('NEO') || objectData.object_type === 'neo' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {objectData.orbit_class?.includes('NEO') || objectData.object_type === 'neo' ? t('catalog.detail.yes') : t('catalog.detail.no')}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-gray-400 block mb-1">{t('catalog.detail.isPHA')}</span>
                    <span className="font-semibold text-emerald-400">
                      {t('catalog.detail.no')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Close Approaches Table if available */}
          {objectData.close_approaches && objectData.close_approaches.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Yerə Yaxınlaşma Məlumatları (JPL Close-Approach Data)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="text-left pb-2">Tarix</th>
                      <th className="text-left pb-2">Cisim</th>
                      <th className="text-left pb-2">Məsafə (AV)</th>
                      <th className="text-left pb-2">Nisbi Sürət (km/s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objectData.close_approaches.slice(0, 5).map((ca: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/[0.03]">
                        <td className="py-2 font-mono text-gray-300">{ca.date}</td>
                        <td className="py-2 text-gray-400">{ca.body || 'Earth'}</td>
                        <td className="py-2 font-mono text-blue-400">{typeof ca.distance_au === 'number' ? ca.distance_au.toFixed(4) : ca.distance_au}</td>
                        <td className="py-2 font-mono text-gray-400">{ca.velocity_km_s ? Number(ca.velocity_km_s).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!objectData && !loading && !error && (
        <div className="text-center py-16 text-gray-500 text-sm">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-20 text-blue-400" />
          <p>{t('catalog.detail.selectObject')}</p>
        </div>
      )}
    </div>
  );
}
