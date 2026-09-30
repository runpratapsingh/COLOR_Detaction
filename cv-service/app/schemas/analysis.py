from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RGBColor(BaseModel):
    r: int = Field(..., ge=0, le=255)
    g: int = Field(..., ge=0, le=255)
    b: int = Field(..., ge=0, le=255)


class HSVColor(BaseModel):
    h: float = Field(..., ge=0.0, le=360.0)
    s: float = Field(..., ge=0.0, le=100.0)
    v: float = Field(..., ge=0.0, le=100.0)


class LabColor(BaseModel):
    L: float = Field(..., ge=0.0, le=100.0, alias="l")
    a: float = Field(...)
    b: float = Field(...)

    model_config = ConfigDict(populate_by_name=True)


class DetectedColorSchema(BaseModel):
    name: Optional[str] = None
    hex: Optional[str] = None
    rgb: RGBColor
    hsv: HSVColor
    lab: LabColor
    mean_rgb: Optional[RGBColor] = None
    std_rgb: Optional[RGBColor] = None
    match_percentage: Optional[float] = None


class StandardDistanceEntry(BaseModel):
    id: str
    name: str
    concentration: float
    unit: str
    level: str
    hex: Optional[str] = None
    delta_e_00: float
    match_percentage: Optional[float] = None


class ClassificationSchema(BaseModel):
    matched_standard: Optional[StandardDistanceEntry] = None
    delta_e_00: Optional[float] = None
    second_best_delta_e: Optional[float] = None
    delta_e_separation: Optional[float] = None
    match_quality: str = "GOOD"  # STRONG, GOOD, AMBIGUOUS, POOR
    standard_distances: List[StandardDistanceEntry] = []
    estimated_concentration: Optional[float] = None
    interpolated_concentration: Optional[float] = None
    range_status: Optional[str] = "IN_RANGE"
    range_label: Optional[str] = "Within calibrated range"
    closest_standard_value: Optional[float] = None
    closest_standard_unit: Optional[str] = None
    # Backward compatibility aliases
    level: Optional[str] = None
    delta_e_2000: Optional[float] = None
    confidence: float = 85.0


class QualityBreakdownSchema(BaseModel):
    overall: float
    blur: float
    exposure: float
    reflection: float
    roi_uniformity: float
    valid_pixel_percentage: float


class RejectionDetailSchema(BaseModel):
    reason: str
    title: str
    description: str
    how_to_fix: str


class ObjectDetectionSchema(BaseModel):
    is_bottle: bool
    primary_object: str
    confidence: float
    detected_objects: List[dict] = []


class AnalysisResponseSchema(BaseModel):
    analysis_id: str
    status: str  # SUCCESS, RETAKE_IMAGE, AMBIGUOUS_RESULT, ERROR
    test_id: Optional[str] = None
    test: Optional[dict] = None
    detected_color: Optional[DetectedColorSchema] = None
    classification: Optional[ClassificationSchema] = None
    quality: QualityBreakdownSchema
    object_detection: Optional[ObjectDetectionSchema] = None
    rejection_title: Optional[str] = None
    rejection_message: Optional[str] = None
    rejection_details: List[RejectionDetailSchema] = []
    reasons: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    debug_artifacts: Optional[dict] = None
