export type UserRole = 'ADMIN' | 'TEST_MANAGER' | 'TESTER';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface HSVColor {
  h: number;
  s: number;
  v: number;
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface ProcedureStep {
  step_number: number;
  title: string;
  instruction: string;
  tip?: string;
}

export interface Reagent {
  name: string;
  amount: string;
}

export interface ReferenceColor {
  hex: string;
  rgb: RGBColor;
  hsv?: HSVColor;
  lab: LabColor;
}

export interface StandardReferenceSample {
  id: string;
  image_path?: string;
  image_base64?: string;
  rgb: RGBColor;
  hex: string;
  hsv: HSVColor;
  lab: LabColor;
  quality: {
    overall: number;
    valid_pixel_percentage: number;
  };
}

export interface ColorStandard {
  id: string;
  standard_id?: string;
  test_id?: string;
  test_version?: number;
  value: number;
  concentration?: number;
  unit: string;
  name: string;
  level: string;
  color_name: string;
  description?: string;
  reference_color: ReferenceColor;
  quality?: {
    overall: number;
    valid_pixel_percentage: number;
  };
  reference_image?: string;
  tolerance_delta_e?: number;
  sample_count?: number;
  status?: string;
  samples?: StandardReferenceSample[];
}

export interface ChemicalTestSummary {
  id?: string;
  test_id: string;
  code?: string;
  version: number;
  name: string;
  status: TestStatus;
  sample_type: string;
  unit: string;
  incubation_seconds: number;
  incubation_tolerance?: number;
  description?: string;
  standards_count: number;
  active: boolean;
}

export interface ChemicalTestDetail {
  id?: string;
  test_id: string;
  code?: string;
  version: number;
  name: string;
  status: TestStatus;
  sample_type: string;
  unit: string;
  incubation_seconds: number;
  incubation_tolerance_seconds: number;
  description?: string;
  sample_requirements?: string;
  procedure: ProcedureStep[];
  reagents: Reagent[];
  video_url?: string;
  notes?: string;
  standards: ColorStandard[];
  active: boolean;
}

export interface ReferenceAnalysisResult {
  is_valid: boolean;
  status: 'VALID' | 'REJECTED';
  problems: string[];
  message?: string;
  detected_color?: {
    rgb: RGBColor;
    hex: string;
    hsv: HSVColor;
    lab: LabColor;
  };
  quality: {
    overall: number;
    valid_pixel_percentage: number;
    blur?: number;
    exposure?: number;
    reflection?: number;
    roi_uniformity?: number;
  };
  reference_image?: string;
  preview_image?: string;
  roi?: {
    bottle_roi?: [number, number, number, number];
    liquid_roi?: [number, number, number, number];
    normalized_bottle_roi?: [number, number, number, number];
    normalized_liquid_roi?: [number, number, number, number];
  };
  warnings?: string[];
}

export interface StandardDistanceResult {
  id: string;
  name: string;
  concentration: number;
  unit: string;
  level: string;
  hex: string;
  delta_e_00: number;
  match_percentage: number;
}

export interface ClassificationResult {
  matched_standard?: StandardDistanceResult;
  estimated_concentration?: number;
  interpolated_concentration?: number;
  range_status?: 'IN_RANGE' | 'ABOVE_CALIBRATED_RANGE' | 'BELOW_CALIBRATED_RANGE' | 'OUT_OF_RANGE';
  range_label?: string;
  closest_standard_value?: number;
  closest_standard_unit?: string;
  delta_e_00?: number;
  second_best_delta_e?: number;
  delta_e_separation?: number;
  match_quality: 'STRONG' | 'GOOD' | 'FAIR' | 'AMBIGUOUS' | 'POOR';
  standard_distances: StandardDistanceResult[];
  level?: string;
  hex?: string;
  delta_e_2000?: number;
  match_percentage?: number;
  confidence: number;
}

export interface QualityBreakdown {
  overall: number;
  blur: number;
  exposure: number;
  reflection: number;
  roi_uniformity: number;
  valid_pixel_percentage: number;
}

export interface RejectionDetail {
  reason: string;
  title: string;
  description: string;
  how_to_fix: string;
}

export interface ObjectDetectionInfo {
  is_bottle: boolean;
  primary_object: string;
  confidence: number;
  detected_objects?: Array<{
    label: string;
    confidence: number;
  }>;
}

export interface JalqAnalysisResponse {
  analysis_id: string;
  status: 'SUCCESS' | 'RETAKE_IMAGE' | 'AMBIGUOUS_RESULT' | 'INVALID_INCUBATION_TIME' | 'CALIBRATION_REQUIRED' | 'NO_MATCH_FOUND' | 'ERROR';
  test_id?: string;
  test?: { code: string };
  detected_color?: {
    name?: string;
    hex?: string;
    rgb: RGBColor;
    hsv: HSVColor;
    lab: LabColor;
    match_percentage?: number;
  };
  classification?: ClassificationResult;
  quality: QualityBreakdown;
  object_detection?: ObjectDetectionInfo;
  roi?: {
    bottle_roi?: [number, number, number, number];
    liquid_roi?: [number, number, number, number];
    normalized_bottle_roi?: [number, number, number, number];
    normalized_liquid_roi?: [number, number, number, number];
  };
  preview_image?: string;
  rejection_title?: string;
  rejection_message?: string;
  rejection_details?: RejectionDetail[];
  capture_rejection_details?: RejectionDetail[];
  capture_validation?: {
    is_valid: boolean;
    checks: Record<string, any>;
  };
  reasons?: string[];
  warnings?: string[];
  recommendations?: string[];
}

export interface UserSession {
  technicianName: string;
  technicianId: string;
  facility: string;
  role: UserRole;
}

export type DemoScreen =
  | 'login'
  | 'test_list'
  | 'test_details'
  | 'incubation'
  | 'camera'
  | 'result'
  | 'test_manager_dashboard'
  | 'create_edit_test'
  | 'standard_management'
  | 'add_standard';
