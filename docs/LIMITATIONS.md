# OrbitScope — Known Limitations and Future Work

## Scientific limitations

1. **Bright, saturated stars and astrometry.** Barnard's Star, RW Aurigae and R Draconis saturate the SPHEREx detectors in most bands.
   - They are shown in Blink, with the cores filled for display.
   - They are excluded from the proper-motion measurement, because a saturated centroid is not reliable.
   - Their photometry points are returned with `flagged: true`.
2. **Faint asteroids.** The single-exposure search reliably recovers objects to roughly V ≈ 15–16 in the near-infrared bands.
   - 626 Notburga (V = 13.5) is recovered.
   - Dworetsky (V ≈ 17.2) in the same field is not.
3. **Very slow movers (Planet Nine class).** Asteroid linking works within one ~7-minute visit plus joins inside one survey pass.
   - An object moving a few arcseconds per day is not linked.
   - Proper-motion search across passes only follows sources detected in every pass.
   - A distant planet would need a dedicated multi-pass "shift-and-stack" search.
4. **Pixel scale.** SPHEREx pixels are 6.2″. Astrometric precision comes from centroiding many photons (a noise floor of a few tenths of a pixel), not from resolution. Crowded fields blend sources.
5. **Wavelength-dependent appearance.** The wavelength of a source changes between exposures, because each exposure puts it on a different part of the LVF filter.
   - The detection noise model absorbs this.
   - Strongly variable spectra (e.g. emission-line objects) can still leave residuals.
6. **Planet Nine clustering test.** The Rayleigh test on 20 extreme TNOs ignores survey selection bias. A significant p-value is consistent with the hypothesis but is not evidence of the planet.

## Data and service limitations

- **SPHEREx coverage.** Coverage grows with each survey pass. Some fields have only one pass; a proper-motion search there returns no candidates, because it needs at least two epochs.
- **External services.** IRSA, JPL, ESA and CDS occasionally return 5xx or time out.
  - OrbitScope retries, shows an explanation and never substitutes invented data.
  - The five challenge targets resolve offline.
  - `scripts/prewarm.py` caches their images in advance.
- **First view of a new field** takes 30–90 s while cutouts download. Background jobs show progress and can be cancelled.

## Infrastructure limitations

- **Single process.** Jobs and rate-limit counters are in memory, which is correct for one backend process. Running several replicas would need Redis or similar.
- **No user accounts.** Candidate reviews are shared by everyone using the instance. A public deployment that accepts reviews from strangers would need authentication.
- **Minor Planet Center.** Candidates export as CSV, but reporting requires the team's own MPC observatory code and follow-up observations.

## Future work

- [ ] Shift-and-stack search across passes, for slow outer-Solar-System objects.
- [ ] Forced photometry for saturated stars, using the PSF wings.
- [ ] Aladin Lite panel with SPHEREx footprints next to the cutout viewer.
- [ ] Wavelength filter in Blink (choose a band range, e.g. 3–3.5 µm for CH₄).
- [ ] Automatic re-check of saved candidates when a new SPHEREx release appears.
- [ ] Frontend unit and end-to-end tests (Vitest / Playwright).
