import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * The 26 scenes. `tour` = seconds in the timed tour (0 = deep-dive scene, skipped in the tour but
 * always reachable by scrolling). The tour seconds add up to about 5 minutes (the talk is 4-6 minutes).
 */
export interface SceneMeta {
  n: number;                    // 1-based number as in the brief
  id: string;                   // url hash
  tour: number;                 // seconds in the timed tour; 0 = deep-dive
  component: LazyExoticComponent<ComponentType> | null; // null = the hero, rendered eagerly by the page
}

const act = <T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T & string) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const A1 = () => import('./scenes/act1');
const A2 = () => import('./scenes/act2');
const A3 = () => import('./scenes/act3');
const A4 = () => import('./scenes/act4');
const A5 = () => import('./scenes/act5');
const A6 = () => import('./scenes/act6');
const A7 = () => import('./scenes/act7');
const A8 = () => import('./scenes/act8');

export const SCENES: SceneMeta[] = [
  { n: 1, id: 'giris', tour: 15, component: null },
  { n: 2, id: 'hereket-eden-kainat', tour: 12, component: act(A1, 'S02Moving') },
  { n: 3, id: 'spherex', tour: 15, component: act(A1, 'S03Spherex') },
  { n: 4, id: 'boru-xetti', tour: 15, component: act(A1, 'S04Pipeline') },
  { n: 5, id: 'blink', tour: 25, component: act(A2, 'S05Blink') },
  { n: 6, id: 'spektr', tour: 15, component: act(A2, 'S06Spectrum') },
  { n: 7, id: 'hereketli-obyektler', tour: 20, component: act(A3, 'S07Movers') },
  { n: 8, id: 'xususi-hereket', tour: 18, component: act(A3, 'S08ProperMotion') },
  { n: 9, id: 'sema-tedqiqatcisi', tour: 10, component: act(A3, 'S09SkyExplorer') },
  { n: 10, id: 'doqquzuncu-planet', tour: 25, component: act(A4, 'S10PlanetNine') },
  { n: 11, id: 'ekosistem', tour: 8, component: act(A4, 'S11Ecosystem') },
  { n: 12, id: 'masaustunden-pi', tour: 20, component: act(A5, 'S12DesktopToPi') },
  { n: 13, id: 'alti-rol', tour: 25, component: act(A5, 'S13SixRoles') },
  { n: 14, id: 'pi-aparat', tour: 0, component: act(A5, 'S14Hardware') },
  { n: 15, id: 'kenar-muhendisliyi', tour: 15, component: act(A6, 'S15Edge') },
  { n: 16, id: 'oflayn-kainat', tour: 15, component: act(A6, 'S16Offline') },
  { n: 17, id: 'wifi', tour: 12, component: act(A6, 'S17Wifi') },
  { n: 18, id: 'qurasdirma', tour: 0, component: act(A7, 'S18Install') },
  { n: 19, id: 'arxitektura', tour: 0, component: act(A7, 'S19Architecture') },
  { n: 20, id: 'yer-stansiyasi', tour: 8, component: act(A7, 'S20Ground') },
  { n: 21, id: 'tehsil-animasiyalari', tour: 0, component: act(A8, 'S21Educational') },
  { n: 22, id: 'texnologiya', tour: 0, component: act(A8, 'S22Technology') },
  { n: 23, id: 'yoxlama', tour: 10, component: act(A8, 'S23Validation') },
  { n: 24, id: 'durustluk', tour: 12, component: act(A8, 'S24Limitations') },
  { n: 25, id: 'gelecek', tour: 8, component: act(A8, 'S25Future') },
  { n: 26, id: 'final', tour: 12, component: act(A8, 'S26Finale') },
];

export const TOUR_SCENES = SCENES.filter((s) => s.tour > 0);
export const TOUR_SECONDS = TOUR_SCENES.reduce((sum, s) => sum + s.tour, 0);
