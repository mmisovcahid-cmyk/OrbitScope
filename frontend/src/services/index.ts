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
  getEphemeris: (target: string) =>
    api.get('/api/v1/catalog/ephemeris', { params: { target, locale: locale() } }),
  getNearby: (ra: number, dec: number, radius = 60) =>
    api.get('/api/v1/catalog/nearby', { params: { ra, dec, radius_arcsec: radius, locale: locale() } }),
};

export const planetxService = {
  getEvidence: () => api.get('/api/v1/planetx/evidence', { params: { locale: locale() } }),
  getTNOs: () => api.get('/api/v1/planetx/tnos', { params: { locale: locale() } }),
  getRegions: () => api.get('/api/v1/planetx/regions', { params: { locale: locale() } }),
};

// Real SPHEREx data. The first request for a field downloads cutouts from IRSA (can take 1-2 min).
export const spherexService = {
  targets: () => api.get('/api/v1/spherex/targets'),
  resolve: (q: string) => api.get('/api/v1/spherex/resolve', { params: { q, locale: locale() } }),
  coverage: (ra: number, dec: number) =>
    api.get('/api/v1/spherex/coverage', { params: { ra, dec, locale: locale() }, timeout: 240000 }),
  blink: (params: Record<string, string | number>, signal?: AbortSignal) =>
    api.get('/api/v1/spherex/blink', { params: { ...params, locale: locale() }, timeout: 300000, signal }),
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
