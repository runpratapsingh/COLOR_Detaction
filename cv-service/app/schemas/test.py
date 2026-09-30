from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProcedureStepSchema(BaseModel):
    step_number: int
    title: str
    instruction: str
    tip: Optional[str] = None


class ReagentSchema(BaseModel):
    name: str
    amount: str


class ReferenceColorSchema(BaseModel):
    hex: str
    rgb: Dict[str, Any]
    hsv: Optional[Dict[str, Any]] = None
    lab: Dict[str, Any]
    # Background white point captured alongside this color reading.
    # Used for Bradford Chromatic Adaptation Transform (CAT) to enable
    # accurate cross-illuminant color matching.
    bg_white: Optional[Dict[str, Any]] = None


class StandardQualitySchema(BaseModel):
    overall: float
    valid_pixel_percentage: float


class StandardReferenceSampleSchema(BaseModel):
    id: str
    image_path: Optional[str] = ""
    image_base64: Optional[str] = ""
    rgb: Dict[str, Any]
    hex: str
    hsv: Dict[str, Any]
    lab: Dict[str, Any]
    bg_white: Optional[Dict[str, Any]] = None
    quality: Dict[str, Any]


class ColorStandardSchema(BaseModel):
    id: str
    standard_id: Optional[str] = None
    test_id: Optional[str] = None
    test_version: Optional[int] = 1
    value: float
    concentration: Optional[float] = None
    unit: str
    name: Optional[str] = None
    level: str
    color_name: str
    description: Optional[str] = ""
    reference_color: ReferenceColorSchema
    quality: Optional[StandardQualitySchema] = None
    reference_image: Optional[str] = ""
    tolerance_delta_e: Optional[float] = 3.0
    sample_count: Optional[int] = 1
    status: Optional[str] = "ACTIVE"
    samples: Optional[List[StandardReferenceSampleSchema]] = []


class ColorStandardCreateSchema(BaseModel):
    value: float
    unit: str = "mg/L"
    level: Optional[str] = None
    color_name: Optional[str] = None
    description: Optional[str] = ""
    reference_color: ReferenceColorSchema
    quality: Optional[StandardQualitySchema] = None
    reference_image: Optional[str] = None
    tolerance_delta_e: Optional[float] = 3.0


class ColorStandardUpdateSchema(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    level: Optional[str] = None
    color_name: Optional[str] = None
    description: Optional[str] = None
    tolerance_delta_e: Optional[float] = None


class ChemicalTestSummarySchema(BaseModel):
    id: str
    test_id: str
    code: Optional[str] = None
    version: int = 1
    name: str
    status: str = "DRAFT"
    sample_type: str = "Water"
    unit: str = "mg/L"
    incubation_seconds: int
    incubation_tolerance: Optional[int] = 15
    description: Optional[str] = None
    standards_count: int = 0
    active: bool = True


class ChemicalTestDetailSchema(BaseModel):
    id: str
    test_id: str
    code: Optional[str] = None
    version: int = 1
    name: str
    status: str = "DRAFT"
    sample_type: str = "Water"
    unit: str = "mg/L"
    incubation_seconds: int = 300
    incubation_tolerance_seconds: int = 60
    description: Optional[str] = None
    sample_requirements: Optional[str] = None
    procedure: List[ProcedureStepSchema] = []
    reagents: List[ReagentSchema] = []
    video_url: Optional[str] = None
    notes: Optional[str] = None
    standards: List[ColorStandardSchema] = []
    active: bool = True


class ChemicalTestCreateSchema(BaseModel):
    test_id: str
    name: str
    sample_type: str = "Water"
    unit: str = "mg/L"
    incubation_seconds: int = 300
    incubation_tolerance_seconds: int = 60
    description: Optional[str] = ""
    sample_requirements: Optional[str] = ""
    procedure: Optional[List[ProcedureStepSchema]] = []
    reagents: Optional[List[ReagentSchema]] = []
    video_url: Optional[str] = ""
    notes: Optional[str] = ""


class ChemicalTestUpdateSchema(BaseModel):
    name: Optional[str] = None
    sample_type: Optional[str] = None
    unit: Optional[str] = None
    incubation_seconds: Optional[int] = None
    incubation_tolerance_seconds: Optional[int] = None
    description: Optional[str] = None
    sample_requirements: Optional[str] = None
    procedure: Optional[List[ProcedureStepSchema]] = None
    reagents: Optional[List[ReagentSchema]] = None
    video_url: Optional[str] = None
    notes: Optional[str] = None
