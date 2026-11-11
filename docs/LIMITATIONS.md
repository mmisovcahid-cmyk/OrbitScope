# OrbitScope — Known Limitations & Future Development

## Known Limitations

### Data Availability

1. **SPHEREx Public Data:** The availability of SPHEREx observation images suitable for multi-epoch comparison depends on the mission's data release schedule. OrbitScope provides a demo mode with clearly labeled simulated data when real observations are not accessible.

2. **Temporal Coverage:** Moving object detection requires at least two observations of the same sky region at different times. Not all regions may have sufficient multi-epoch coverage in early data releases.

3. **Image Resolution:** SPHEREx's angular resolution (~6.2 arcsec) is optimized for its spectral survey mission. Fine-resolution astrometry comparable to optical surveys is not expected.

### Detection Pipeline

4. **False Positive Rate:** Image artifacts, cosmic rays, and imperfect alignment can produce false detections. The current filtering pipeline reduces but cannot eliminate all false positives.

5. **Slow-Moving Objects:** Very distant objects (e.g., hypothetical Planet Nine) move extremely slowly across the sky. Detecting such objects requires long time baselines and sub-arcsecond precision that may exceed SPHEREx capabilities alone.

6. **PSF Variations:** Point Spread Function variations across the detector and between epochs can produce subtraction residuals that mimic real sources.

### Machine Learning

7. **Unsupervised Only:** Without labeled training data from real detections, the ML module operates in unsupervised mode (Isolation Forest). Results should be treated as candidate ranking, not classification.

8. **Feature Engineering:** The current feature set is designed for general moving object detection. Specialized features for specific object types (e.g., comets, TNOs) could improve detection.

### Infrastructure

9. **Single-User Application:** The current implementation is designed for local single-user deployment. Multi-user support would require authentication and session management.

10. **No Persistent Database:** The current version uses in-memory storage and caching. A persistent database would be needed for production deployment.

## Future Development Recommendations

### Short-Term (Next Release)

- [ ] Integrate additional SPHEREx data products as they become available
- [ ] Add persistent SQLite database for candidate storage
- [ ] Implement proper FITS image viewer in the frontend
- [ ] Add export functionality for analysis reports (PDF, CSV)
- [ ] Improve coordinate input with common-name resolution (e.g., "Orion Nebula")
- [ ] Add unit tests for all pipeline stages

### Medium-Term

- [ ] Multi-band analysis using SPHEREx's spectral channels
- [ ] Proper motion estimation with least-squares fitting
- [ ] Integration with additional catalogs (MPC, Gaia, 2MASS)
- [ ] Supervised ML classification when labeled data becomes available
- [ ] Real-time notification system for interesting candidates
- [ ] Collaborative features (share analyses, annotations)

### Long-Term

- [ ] GPU-accelerated image processing for large surveys
- [ ] Deep learning-based source detection
- [ ] Automated orbit determination for confirmed moving objects
- [ ] Integration with telescope observation scheduling
- [ ] Cloud deployment for team access
- [ ] Mobile-optimized interface

## Contributing

Contributions are welcome. When contributing scientific processing code:
- Document the method and reference publication
- Include test cases with known expected results
- Clearly label any simulated test data
- Preserve data provenance throughout the pipeline
