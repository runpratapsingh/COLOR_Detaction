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

export interface DetectedColor {
  name?: string;
  hex?: string;
  match_percentage?: number;
  rgb: RGBColor;
  hsv: HSVColor;
  lab: LabColor;
}

export interface TargetColorEntry {
  id?: string;
  name: string;
  hex: string;
}

export interface TargetColorMatch {
  name: string;
  hex: string;
  delta_e_2000: number;
  match_percentage: number;
  target_lab?: LabColor;
  target_rgb?: RGBColor;
}

export interface ClassificationResult {
  level: string | null;
  hex?: string | null;
  delta_e_2000: number | null;
  match_percentage?: number;
  second_best_delta_e: number | null;
  confidence: number;
  target_matches?: TargetColorMatch[];
  best_target_match?: TargetColorMatch | null;
}

export interface QualityBreakdown {
  overall: number;
  blur: number;
  exposure: number;
  reflection: number;
  roi_uniformity: number;
  valid_pixel_percentage: number;
}

export interface QualityValidationFlags {
  is_blurry: boolean;
  is_reflection_excessive: boolean;
  is_underexposed: boolean;
  is_overexposed: boolean;
  is_non_uniform: boolean;
  is_insufficient_pixels: boolean;
}

export interface ObjectDetectionInfo {
  is_bottle: boolean;
  primary_object: string;
  confidence: number;
  detected_objects?: Array<{
    label: string;
    confidence: number;
    bbox?: number[];
  }>;
}

export interface DebugArtifacts {
  annotated_image_path?: string;
  annotated_image_b64?: string;
  roi_details?: {
    bottle_bbox: [number, number, number, number];
    liquid_bbox: [number, number, number, number];
  };
}

export interface RejectionDetail {
  reason: string;
  title: string;
  description: string;
  how_to_fix: string;
}

export interface CaptureValidationInfo {
  is_valid: boolean;
  checks: {
    orientation?: { is_portrait: boolean; width: number; height: number };
    bottle_detected?: boolean;
    framing?: {
      area_fraction: number;
      is_too_small: boolean;
      is_too_large: boolean;
      is_clipped: boolean;
      clipped_edges: string[];
      is_ok: boolean;
    };
    exposure?: { is_underexposed: boolean; is_overexposed: boolean; score: number };
    blur?: { is_blurry: boolean; score: number };
    reflection?: { is_excessive: boolean; score: number };
    background?: {
      median_lab_a: number;
      median_lab_b: number;
      is_colored: boolean;
      dominant_cast: string;
    };
    flash?: { flash_fired: boolean | null };
  };
}

export interface AnalysisResponse {
  analysis_id: string;
  status: 'SUCCESS' | 'RETAKE_IMAGE' | 'AMBIGUOUS_RESULT' | 'INVALID_INCUBATION_TIME' | 'CALIBRATION_REQUIRED' | 'INVALID_IMAGE' | 'ERROR';
  test?: {
    code: string;
  };
  rejection_title?: string;
  rejection_message?: string;
  rejection_details?: RejectionDetail[];
  capture_validation?: CaptureValidationInfo;
  capture_rejection_details?: RejectionDetail[];
  detected_color?: DetectedColor;
  classification?: ClassificationResult;
  quality: QualityBreakdown;
  quality_validation?: QualityValidationFlags;
  object_detection?: ObjectDetectionInfo;
  validation_messages?: string[];
  reasons?: string[];
  warnings?: string[];
  recommendations?: string[];
  debug_artifacts?: DebugArtifacts;
}

export interface AnalyzeParams {
  imageUri: string;
  testCode?: string;
  incubationSeconds?: number;
  whiteBalanceMethod?: string;
  targetColors?: TargetColorEntry[];
  debug?: boolean;
}
