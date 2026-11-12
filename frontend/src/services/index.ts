import api from './api';
import i18n from '../i18n';

const locale = () => i18n.language || 'en';

export const skyService = {
  getRegions: () => api.get('/api/v1/sky/regions', { params: { locale: locale() } }),
  getObservations: (ra: number, dec: number, radius = 1) =>
    api.get('/api/v1/sky/observations', { params: { ra, dec, radius, locale: locale() } }),
  getObjects: (ra: number, dec: number, radius = 1) =>
    api.get('/api/v1/sky/objects', { params: { ra, dec, radius, locale: locale() } }),
};

export const observationService = {
  list: () => api.get('/api/v1/observations/', { params: { locale: locale() } }),
  get: (id: string) => api.get(`/api/v1/observations/${id}`, { params: { locale: locale() } }),
  getImage: (id: string) => api.get(`/api/v1/observations/${id}/image`, { params: { locale: locale() } }),
  compare: (obs1: string, obs2: string) =>
    api.post('/api/v1/observations/compare', { observation_id_1: obs1, observation_id_2: obs2, locale: locale() }),
};

export const detectionService = {
  run: (observationIds: string[]) =>
    api.post('/api/v1/detection/run', { observation_ids: observationIds, locale: locale() }),
  getCandidates: () => api.get('/api/v1/detection/candidates', { params: { locale: locale() } }),
  getCandidate: (id: string) => api.get(`/api/v1/detection/candidates/${id}`, { params: { locale: locale() } }),
  crossMatch: (id: string) =>
    api.post(`/api/v1/detection/crossmatch/${id}`, { locale: locale() }),
};

export const catalogService = {
  search: (query: string) =>
    api.get('/api/v1/catalog/search', { params: { query, locale: locale() } }),
  getObject: (designation: string) =>
    api.get(`/api/v1/catalog/object/${encodeURIComponent(designation)}`, { params: { locale: locale() } }),
  getEphemeris: (target: string, days = 7) =>
    api.get('/api/v1/catalog/ephemeris', { params: { target, days, locale: locale() }, timeout: 90000 }),
  getNearby: (ra: number, dec: number, radius = 60) =>
    api.get('/api/v1/catalog/nearby', { params: { ra, dec, radius_arcsec: radius, locale: locale() }, timeout: 120000 }),
  /** Known asteroids/comets in a field (radius in degrees) at a UTC time (JPL SB Ident, ~20 s). */
  getField: (ra: number, dec: number, radiusDeg: number, time?: string) =>
    api.get('/api/v1/catalog/nearby', { params: { ra, dec, radius: radiusDeg, time, locale: locale() }, timeout: 120000 }),
};

export const planetxService = {
  getEvidence: () => api.get('/api/v1/planetx/evidence', { params: { locale: locale() } }),
  getTNOs: () => api.get('/api/v1/planetx/tnos', { params: { locale: locale() } }),
  getRegions: () => api.get('/api/v1/planetx/regions', { params: { locale: locale() } }),
  getClustering: () => api.get('/api/v1/planetx/clustering', { params: { locale: locale() }, timeout: 120000 }),
};

// Real SPHEREx data. The first request for a field downloads cutouts from IRSA (can take 1-2 min).
export const spherexService = {
  targets: () => api.get('/api/v1/spherex/targets'),
  resolve: (q: string) => api.get('/api/v1/spherex/resolve', { params: { q, locale: locale() } }),
  coverage: (ra: number, dec: number) =>
    api.get('/api/v1/spherex/coverage', { params: { ra, dec, locale: locale() }, timeout: 240000 }),
  blink: (params: Record<string, string | number>, signal?: AbortSignal) =>
    api.get('/api/v1/spherex/blink', { params: { ...params, locale: locale() }, timeout: 300000, signal }),
  overlay: (ra: number, dec: number, fov: number, catalog: 'gaia' | 'catwise') =>
    api.get('/api/v1/spherex/overlay', { params: { ra, dec, fov, catalog, locale: locale() }, timeout: 120000 }),
  photometry: (params: Record<string, string | number>, signal?: AbortSignal) =>
    api.get('/api/v1/spherex/photometry', { params: { ...params, locale: locale() }, timeout: 600000, signal }),
  detect: (params: Record<string, string | number>, signal?: AbortSignal) =>
    api.get('/api/v1/spherex/detect', { params: { ...params, locale: locale() }, timeout: 600000, signal }),
  candidates: (status?: string) =>
    api.get('/api/v1/spherex/candidates', { params: { status: status || undefined, limit: 200 } }),
  candidate: (id: string) => api.get(`/api/v1/spherex/candidates/${encodeURIComponent(id)}`, { params: { locale: locale() } }),
  overview: () => api.get('/api/v1/spherex/overview', { timeout: 30000 }),
  review: (id: string, status: string, note?: string) =>
    api.patch(`/api/v1/spherex/candidates/${encodeURIComponent(id)}`, { status, note }, { params: { locale: locale() } }),
  exportUrl: (id: string) => `${api.defaults.baseURL}/api/v1/spherex/candidates/${encodeURIComponent(id)}/export`,
  gifUrl: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return `${api.defaults.baseURL}/api/v1/spherex/blink.gif?${qs}`;
  },
};

export const systemService = {
  health: () => api.get('/api/v1/system/health'),
  status: () => api.get('/api/v1/system/status'),
  dataSources: () => api.get('/api/v1/system/datasources'),
};
