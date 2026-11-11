// ============================================================
// OrbitScope Type Definitions
// Matches backend API schemas for SPHEREx monitoring platform
// ============================================================

// ---------- Enums ----------

export enum DetectionStatus {
  KNOWN_OBJECT = 'known_object',
  CANDIDATE = 'candidate',
  UNLIKELY_CANDIDATE = 'unlikely_candidate',
  PROBABLE_ARTIFACT = 'probable_artifact',
  NEEDS_REVIEW = 'needs_review',
}

export enum ObservationBand {
  BAND_1 = 'band_1',
  BAND_2 = 'band_2',
  BAND_3 = 'band_3',
  BAND_4 = 'band_4',
  BROADBAND = 'broadband',
}

// ---------- Core Models ----------

export interface SkyRegion {
  id: string;
  ra_center: number;
  dec_center: number;
  radius_arcmin: number;
  name?: string;
  galactic_lat?: number;
  galactic_lon?: number;
  ecliptic_lat?: number;
  ecliptic_lon?: number;
  observation_count: number;
  last_observed?: string;
}

export interface Observation {
  id: string;
  region_id: string;
  epoch: string;
  band: ObservationBand;
  exposure_time: number;
  limiting_magnitude: number;
  seeing_arcsec: number;
  pixel_scale: number;
  image_url?: string;
  thumbnail_url?: string;
  source_count: number;
  quality_flag: string;
  is_simulated: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DetectionCandidate {
  id: string;
  pipeline_run_id: string;
  status: DetectionStatus;
  ra: number;
  dec: number;
  ra_uncertainty: number;
  dec_uncertainty: number;
  displacement_arcsec: number;
  position_angle_deg: number;
  snr: number;
  flux_observation_1: number;
  flux_observation_2: number;
  flux_ratio: number;
  magnitude_estimate: number;
  epoch_1: string;
  epoch_2: string;
  time_interval_days: number;
  apparent_velocity_arcsec_per_day: number;
  cross_match_id?: string;
  cross_match_name?: string;
  cross_match_distance_arcsec?: number;
  classification_reason: string;
  confidence: number;
  is_simulated: boolean;
  created_at: string;
}

export interface CatalogObject {
  id: string;
  name: string;
  designation: string;
  object_type: string;
  ra: number;
  dec: number;
  semi_major_axis_au: number;
  eccentricity: number;
  inclination_deg: number;
  longitude_ascending_node_deg: number;
  argument_perihelion_deg: number;
  mean_anomaly_deg: number;
  epoch_jd: number;
  orbital_period_years: number;
  perihelion_distance_au: number;
  aphelion_distance_au: number;
  absolute_magnitude: number;
  diameter_km?: number;
  albedo?: number;
  is_neo: boolean;
  is_pha: boolean;
  last_observation?: string;
  data_source: string;
}

export interface PipelineResult {
  id: string;
  region_id: string;
  observation_1_id: string;
  observation_2_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  total_sources_1: number;
  total_sources_2: number;
  matched_sources: number;
  candidate_count: number;
  known_count: number;
  processing_time_seconds: number;
  stages: PipelineStage[];
  candidates: DetectionCandidate[];
  provenance: DataProvenance;
  error_message?: string;
}

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  message?: string;
  progress_percent: number;
}

export interface ComparisonResult {
  observation_1: Observation;
  observation_2: Observation;
  time_interval_days: number;
  alignment_offset_x: number;
  alignment_offset_y: number;
  difference_image_url?: string;
  detected_changes: DetectedChange[];
}

export interface DetectedChange {
  x: number;
  y: number;
  ra: number;
  dec: number;
  flux_change: number;
  significance: number;
  type: 'appearance' | 'disappearance' | 'motion' | 'brightening' | 'fading';
}

export interface PlanetXEvidence {
  id: string;
  title: string;
  category: string;
  description: string;
  supporting_data: string;
  confidence_level: string;
  references: PaperReference[];
  visualization_data?: Record<string, unknown>;
}

export interface PaperReference {
  authors: string;
  title: string;
  journal: string;
  year: number;
  doi?: string;
  arxiv_id?: string;
  url?: string;
}

export interface PlanetXPrediction {
  parameter: string;
  value: string;
  uncertainty: string;
  source: string;
}

export interface TNOData {
  name: string;
  semi_major_axis_au: number;
  eccentricity: number;
  inclination_deg: number;
  longitude_perihelion_deg: number;
  perihelion_distance_au: number;
  aphelion_distance_au: number;
  is_clustered: boolean;
}

export interface DataProvenance {
  source: string;
  pipeline_version: string;
  is_simulated: boolean;
  simulation_description?: string;
  processing_notes: string[];
  data_quality: 'high' | 'medium' | 'low';
  calibration_status: string;
}

// ---------- API Response Types ----------

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_observations: number;
  total_candidates: number;
  total_known_objects: number;
  total_regions: number;
  active_pipelines: number;
  data_sources: string[];
  last_updated: string;
}

// ---------- Request Types ----------

export interface RegionQuery {
  ra: number;
  dec: number;
  radius_arcmin: number;
}

export interface DetectionRequest {
  region_id: string;
  observation_1_id: string;
  observation_2_id: string;
  detection_threshold?: number;
  min_snr?: number;
  max_displacement_arcsec?: number;
}

export interface CatalogSearchParams {
  query?: string;
  object_type?: string;
  is_neo?: boolean;
  is_pha?: boolean;
  min_magnitude?: number;
  max_magnitude?: number;
  page?: number;
  page_size?: number;
}

// ---------- Component Props ----------

export interface StatusBadgeProps {
  status: DetectionStatus;
  size?: 'sm' | 'md' | 'lg';
}

export interface DataCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  loading?: boolean;
  className?: string;
}

export interface CoordinateDisplayProps {
  ra: number;
  dec: number;
  showDecimal?: boolean;
  className?: string;
}

export interface SkyMapProps {
  regions?: SkyRegion[];
  candidates?: DetectionCandidate[];
  catalogObjects?: CatalogObject[];
  onRegionClick?: (region: SkyRegion) => void;
  onCandidateClick?: (candidate: DetectionCandidate) => void;
  className?: string;
  width?: number;
  height?: number;
}

export interface ImageViewerProps {
  imageUrl?: string;
  title?: string;
  onZoomChange?: (zoom: number) => void;
  syncZoom?: number;
  syncPan?: { x: number; y: number };
  onPanChange?: (pan: { x: number; y: number }) => void;
  markers?: Array<{ x: number; y: number; label: string; color: string }>;
  className?: string;
}
