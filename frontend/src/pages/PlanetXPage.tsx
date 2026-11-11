import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Orbit, AlertTriangle, BookOpen, Star } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { planetxService } from '../services';

// Known TNOs for fallback visualization
const FALLBACK_TNOS = [
  { name: 'Sedna', semi_major_axis_au: 506, eccentricity: 0.845, inclination_deg: 11.9, perihelion_au: 76.2, aphelion_au: 936, longitude_perihelion_deg: 311.5, is_clustered: true },
  { name: '2012 VP113', semi_major_axis_au: 261, eccentricity: 0.694, inclination_deg: 24.1, perihelion_au: 80.5, aphelion_au: 441, longitude_perihelion_deg: 293.8, is_clustered: true },
  { name: 'Leleakuhonua', semi_major_axis_au: 1085, eccentricity: 0.94, inclination_deg: 11.7, perihelion_au: 65, aphelion_au: 2105, longitude_perihelion_deg: 118, is_clustered: true },
  { name: 'Eris', semi_major_axis_au: 67.7, eccentricity: 0.44, inclination_deg: 44.0, perihelion_au: 37.9, aphelion_au: 97.5, longitude_perihelion_deg: 151.4, is_clustered: false },
  { name: 'Makemake', semi_major_axis_au: 45.4, eccentricity: 0.16, inclination_deg: 28.9, perihelion_au: 38.1, aphelion_au: 52.8, longitude_perihelion_deg: 297, is_clustered: false },
  { name: 'Haumea', semi_major_axis_au: 43.1, eccentricity: 0.19, inclination_deg: 28.2, perihelion_au: 34.9, aphelion_au: 51.4, longitude_perihelion_deg: 240.6, is_clustered: false },
  { name: 'Gonggong', semi_major_axis_au: 67.4, eccentricity: 0.50, inclination_deg: 30.6, perihelion_au: 33.6, aphelion_au: 101.2, longitude_perihelion_deg: 336.8, is_clustered: false },
  { name: '2015 TG387', semi_major_axis_au: 1094, eccentricity: 0.94, inclination_deg: 11.7, perihelion_au: 65, aphelion_au: 2123, longitude_perihelion_deg: 118, is_clustered: true },
];

const PREDICTIONS = [
  { parameter: 'Mass', value: '5–10', unit: 'M⊕', uncertainty: '±5', source: 'Batygin & Brown (2016, 2021)' },
  { parameter: 'Semi-major axis', value: '400–800', unit: 'AU', uncertainty: 'Wide range', source: 'Batygin & Brown (2021)' },
  { parameter: 'Eccentricity', value: '0.2–0.5', unit: '', uncertainty: '±0.1', source: 'Batygin & Brown (2016)' },
  { parameter: 'Inclination', value: '15–25', unit: '°', uncertainty: '±5°', source: 'Batygin & Brown (2016)' },
  { parameter: 'Orbital period', value: '10,000–20,000', unit: 'years', uncertainty: 'Order of magnitude', source: 'Estimated' },
  { parameter: 'Current distance', value: '~500–600', unit: 'AU', uncertainty: 'Very uncertain', source: 'Estimated' },
  { parameter: 'Predicted magnitude', value: '>24', unit: 'mag', uncertainty: '±2', source: 'Estimated' },
];

const EVIDENCE = [
  { key: 'orbitalClustering', type: 'orbital', strength: 'strong', year: 2016 },
  { key: 'perihelionDetachment', type: 'gravitational', strength: 'strong', year: 2014 },
  { key: 'solarObliquity', type: 'gravitational', strength: 'moderate', year: 2016 },
  { key: 'retrogradeOrbits', type: 'orbital', strength: 'moderate', year: 2016 },
  { key: 'kuiperCliff', type: 'observational', strength: 'suggestive', year: 2001 },
];

const STRENGTH_COLORS: Record<string, string> = {
  strong: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  moderate: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  suggestive: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  uncertain: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

export default function PlanetXPage() {
  const { t } = useTranslation();
  const [tnos, setTnos] = useState(FALLBACK_TNOS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await planetxService.getTNOs();
        const d = res.data?.data ?? res.data;
        if (Array.isArray(d) && d.length > 0) setTnos(d);
      } catch { /* use fallback */ }
    })();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Orbit className="w-7 h-7 text-violet-400" /> {t('planetx.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('planetx.subtitle')}</p>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-300/80">{t('planetx.disclaimer')}</p>
      </div>

      {/* Overview */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white mb-2">{t('planetx.overview.title')}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{t('planetx.overview.description')}</p>
      </div>

      {/* Evidence Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">{t('planetx.evidence.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EVIDENCE.map((ev) => (
            <div key={ev.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">{t(`planetx.evidence.${ev.key}.title`)}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STRENGTH_COLORS[ev.strength]}`}>
                  {ev.strength}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{t(`planetx.evidence.${ev.key}.description`)}</p>
              <div className="flex gap-3 mt-3 text-[10px] text-gray-600">
                <span>Type: {ev.type}</span>
                <span>Year: {ev.year}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TNO Orbital Distribution */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white mb-1">{t('planetx.tno.title')}</h2>
        <p className="text-xs text-gray-500 mb-4">{t('planetx.tno.subtitle')}</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="semi_major_axis_au" name="Semi-major axis" unit=" AU" type="number"
                stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }}
                label={{ value: 'Semi-major axis (AU)', position: 'bottom', offset: 15, fontSize: 11, fill: '#6b7280' }} />
              <YAxis dataKey="perihelion_au" name="Perihelion" unit=" AU" type="number"
                stroke="#4b5563" tick={{ fontSize: 10, fill: '#6b7280' }}
                label={{ value: 'Perihelion (AU)', angle: -90, position: 'left', offset: 5, fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(val: any, name: string) => [`${val} AU`, name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
              />
              <Scatter name="Clustered TNOs" data={tnos.filter((t) => t.is_clustered)} fill="#8b5cf6" />
              <Scatter name="Other TNOs" data={tnos.filter((t) => !t.is_clustered)} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 justify-center mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Clustered (P9 evidence)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Other TNOs</span>
        </div>
      </div>

      {/* Predicted Parameters */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white mb-3">{t('planetx.predictions.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/5">
                <th className="text-left pb-2">{t('planetx.predictions.parameter')}</th>
                <th className="text-left pb-2">{t('planetx.predictions.value')}</th>
                <th className="text-left pb-2">{t('planetx.predictions.uncertainty')}</th>
                <th className="text-left pb-2">{t('planetx.predictions.source')}</th>
              </tr>
            </thead>
            <tbody>
              {PREDICTIONS.map((p, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-2 text-gray-300">{p.parameter}</td>
                  <td className="py-2 font-mono text-blue-300">{p.value} {p.unit}</td>
                  <td className="py-2 text-gray-500">{p.uncertainty}</td>
                  <td className="py-2 text-gray-500">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* References */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> {t('planetx.references.title')}
        </h2>
        <ul className="space-y-2 text-xs text-gray-400">
          <li>Batygin, K. & Brown, M. E. (2016). "Evidence for a Distant Giant Planet in the Solar System." <i>AJ</i>, 151, 22. <a href="https://doi.org/10.3847/0004-6256/151/2/22" target="_blank" rel="noopener" className="text-blue-400 hover:underline">DOI</a></li>
          <li>Brown, M. E. & Batygin, K. (2021). "The Orbit of Planet Nine." <i>AJ</i>, 162, 219. <a href="https://doi.org/10.3847/1538-3881/ac2056" target="_blank" rel="noopener" className="text-blue-400 hover:underline">DOI</a></li>
          <li>Trujillo, C. A. & Sheppard, S. S. (2014). "A Sedna-like body with a perihelion of 80 AU." <i>Nature</i>, 507, 471. <a href="https://doi.org/10.1038/nature13156" target="_blank" rel="noopener" className="text-blue-400 hover:underline">DOI</a></li>
          <li>Batygin et al. (2019). "The planet nine hypothesis." <i>Physics Reports</i>, 805, 1–53. <a href="https://doi.org/10.1016/j.physrep.2019.01.009" target="_blank" rel="noopener" className="text-blue-400 hover:underline">DOI</a></li>
        </ul>
      </div>
    </div>
  );
}
