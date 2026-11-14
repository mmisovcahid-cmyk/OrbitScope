# OrbitScope — `/presentation` (təqdimat)

A cinematic, scroll-based story of OrbitScope in **Azerbaijani**, set in **Lora**. It lives at `/presentation`, outside the shared `Layout` (like `/embed`); no other route or backend code depends on it.

Story: *from a distant galaxy to a portable Raspberry Pi 5 ground station.* 26 scenes, plus a timed tour of about 5 minutes (4–6 minutes with the speed selector).

## Using it

| What | How |
|---|---|
| Free scroll | Scroll, or use the dots on the right (desktop) |
| Timed tour | “Qısa turu başlat” (bottom bar). 21 scenes, 5:15 at 1×; speed 0.8× / 1× / 1.25× / 1.5×. Manual scrolling pauses it |
| Keyboard | `←` `→` (or PageUp/Down) previous/next scene, `Space` pause/resume (tour), `Esc` leave the tour, `Home` / `End`, `?` help |
| Deep link | `/presentation#blink`, `#wifi`, … (scene ids are in `src/presentation/scenes.ts`) |
| Exhibition / kiosk | `/presentation?kiosk=1&autoplay=1` (kiosk implies lighter animations and looping); `&loop=1` loops without kiosk |
| Lighter animations | `?lite=1`, the “Yüngül rejim” button, `?kiosk=1`, or `prefers-reduced-motion` (end state of every scene, no motion) |

“Deep-dive” scenes (14 Pi hardware, 18 install, 19 architecture, 21 educational animations, 22 technology) have `tour: 0` in `scenes.ts`: the tour skips them, scrolling does not.

## Structure

```
frontend/src/presentation/
  PresentationPage.tsx     route component (lazy, outside Layout)
  scenes.ts                the 26 scenes: id, tour seconds, lazy component
  scenes/                  hero.tsx + act1..act8.tsx (+ .css each); edu.tsx = 12 educational animations
  content/az/*.ts          ALL on-screen copy (typed; add content/en to localise)
  ui/ fx/ lib/             badges, reveal, chrome, Andromeda renderer, starfield, sky maths
frontend/public/presentation/data/*.json   real-data snapshots (see below)
backend/scripts/export_presentation_assets.py   regenerates those snapshots from a running backend
```

The presentation is Azerbaijani-only on purpose (the talk is in Azerbaijani). This deviates from the project rule “every UI string in `en.json` and `az.json`”; the copy is isolated in `content/az` with a `Content` type so an English file can be added without touching the scenes.

## Real data, labels and honesty

Every scene carries a badge: **Həyata keçirilib** (implemented), **Aparat imkanı** (hardware capability), **Təhsil məqsədli vizuallaşdırma** (educational), **Planlaşdırılır** (planned), **Layihə qeydlərinə görə** (per project notes), **Cihazda hələ sınanmayıb** (not yet run on a real Pi 5).

- **Real SPHEREx frames** (scene 5): `barnard-frames.json`, three survey-pass coadds of Barnard's Star (detector 3), exported from the OrbitScope backend (NASA/IPAC IRSA). The viewer builds blink / difference / motion-colour / stack modes in the browser.
- **ε Indi B spectrum** (scene 6): `epsindib-spectrum.json`, aperture photometry from the backend (95 usable exposures).
- **Extreme-TNO orbits and Rayleigh statistics** (scene 10): `planetx-orbits.json`, a saved answer of the live JPL SBDB query (59-object complete sample, 20-object literature sample).
- **Targets** (scene 9, 11): `targets.json`.

All files carry their export date. Regenerate with:

```bash
cd backend && python run.py                     # terminal 1
cd backend && python -m scripts.export_presentation_assets   # terminal 2
```

Illustrations (the procedural Andromeda backdrop, the Raspberry Pi board, QR codes, all animations) are labelled as such. The QR codes are non-functional design placeholders; no Wi-Fi password appears anywhere.

### Raspberry Pi facts

The Pi deployment files are **not in this repository**: they are in the sibling `OrbitScopePI` repository (`docker-compose.pi.yml`, `deploy/pi/*`, `docs/RASPBERRY_PI.md`, offline snapshots, Ground Node). Scenes 12–20 quote those files (SSID `OrbitScope`, NetworkManager profile `OrbitScope-AP`, helper command `orbitscope-net`, `10.42.0.1`, `MAX_CONCURRENT_JOBS=2`, 6 GB cache, `Storage=volatile`, …) and say so in their source lines. That repository's own docs state the scripts were **not yet run on a real Pi 5**; the presentation shows this. When the Pi has been tested, set the badge text in `content/az/common.ts`.

The Ground Node page `/ground` exists only in the OrbitScopePI build. The finale's third button probes `/api/v1/ground/status` once and links to `/ground` only if it answers; otherwise it scrolls to scene 20.

## Andromeda backdrop

`fx/andromeda.ts` draws a procedural, Andromeda-inspired galaxy (labelled “prosedur illüstrasiya — real foto deyil”). A real photograph can replace it: put the optimised files in `public/presentation/andromeda/` and fill `fx/andromeda-photo.ts` (credit text, responsive `srcset`). The credit is then shown on the hero and the finale.

## Performance and the Pi

- No animation library: CSS, SVG/SMIL and a few canvases that run only while their scene is on screen.
- Scenes are lazy chunks (hero eager); the page chunk is about 27 kB gzipped.
- Only new dependency: `@fontsource-variable/lora` (woff2 files, no native code, works offline, fine for ARM64). Latin + Latin-Extended subsets cover ə Ə ğ Ğ ş Ş ç Ç ö Ö ü Ü ı İ.
- Lite mode: no canvas particles, no parallax, no `backdrop-filter`, no blur, simple fades.
