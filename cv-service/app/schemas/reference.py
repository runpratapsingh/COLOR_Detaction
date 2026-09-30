from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ChemicalTestCreate(BaseModel):
    code: str = Field(..., json_schema_extra={"example": "CHEM_001"})
    name: str = Field(..., json_schema_extra={"example": "Water Hardness Test"})
    description: str | None = None
    incubation_seconds: int = Field(default=300, ge=0)
    incubation_tolerance: int = Field(default=15, ge=0)


class ChemicalTestSchema(ChemicalTestCreate):
    id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReferenceColorCreate(BaseModel):
    test_code: str
    level: str = Field(..., json_schema_extra={"example": "LEVEL_2"})
    color_name: str = Field(..., json_schema_extra={"example": "LIGHT_PINK"})
    lab_l: float
    lab_a: float
    lab_b: float
    rgb_r: int
    rgb_g: int
    rgb_b: int
    sample_count: int = 1


class ReferenceColorSchema(BaseModel):
    id: str
    chemical_test_id: str
    level: str
    color_name: str
    lab_l: float
    lab_a: float
    lab_b: float
    rgb_r: int
    rgb_g: int
    rgb_b: int
    sample_count: int
    active: bool

    model_config = ConfigDict(from_attributes=True)


class CalibrationRequest(BaseModel):
    test_code: str
    level: str
    color_name: str
    device_model: str | None = None


class CalibrationResponse(BaseModel):
    status: str
    reference_id: str
    level: str
    color_name: str
    lab: dict
    rgb: dict
    samples_aggregated: int
