// NEOSSat (CSA, archived at CADC): types for /api/v1/neossat and links to external viewers.
import type { BlinkFrame, BlinkMember, BlinkResult } from './spherex';

export interface NeossatVisit {
  index: number; start: string; end: string; n_frames: number; targets: string[]; exptime_s: number;
}

export interface NeossatCoverage {
  total_frames: number; n_visits: number; date_min: string | null; date_max: string | null;
  visits: NeossatVisit[]; collection: string; bandpass_um: [number, number]; source: string;
}

export interface NeossatAstrometry { n_match: number; n_stars: number; rms_arcsec: number; scale_arcsec: number }

export interface NeossatMember extends BlinkMember {
  target: string; exptime_s: number; astrometry: NeossatAstrometry;
}

export interface NeossatFrame extends BlinkFrame { members: NeossatMember[] }

export interface NeossatRejected { obs_id: string; date: string; reason: string; n_stars?: number }

/** Same `grid` + `frames` shape as the SPHEREx blink, so BlinkViewer shows it unchanged. */
export interface NeossatResult {
  target: BlinkResult['target'];
  grid: BlinkResult['grid'];
  coverage: Omit<NeossatCoverage, 'source'>;
  mode: 'visits' | 'frames';
  visit_index: number | null;
  frames: NeossatFrame[];
  rejected: NeossatRejected[];
  stretch_hint: { vmin: number; vmax: number };
  units: string;
  unit_short: string;
  astrometry: string;
  source: string;
  is_simulated: boolean;
  elapsed_s: number;
}

/** WiseView (byw.tools): blink of unWISE/NEOWISE epochs at a position. It is served over http only. */
export function wiseviewUrl(ra: number, dec: number): string {
  return `http://byw.tools/wiseview#ra=${ra.toFixed(6)}&dec=${dec.toFixed(6)}&size=176&band=3&gaia=1`;
}

/** CADC observation search page for one NEOSSat frame. */
export function cadcObservationUrl(obsId: string): string {
  return `https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/search/?collection=NEOSSAT&observationID=${encodeURIComponent(obsId)}#resultTableTab`;
}
