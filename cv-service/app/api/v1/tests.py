import base64
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ImageValidationError
from app.models.base import get_db
from app.models.user_role import UserRole
from app.schemas.test import (
    ChemicalTestCreateSchema,
    ChemicalTestDetailSchema,
    ChemicalTestSummarySchema,
    ChemicalTestUpdateSchema,
    ColorStandardCreateSchema,
    ColorStandardSchema,
    ColorStandardUpdateSchema,
)
from app.services.analysis_service import AnalysisService
from app.services.color_converter import ColorConverter
from app.services.in_memory_store import (
    ColorStandardItem,
    StandardSampleItem,
    in_memory_store,
)

router = APIRouter(prefix="/tests", tags=["Chemical Tests & Standards"])


def check_manager_role(role: Optional[str] = None):
    """Enforces authorization: only TEST_MANAGER or ADMIN can modify tests or standards."""
    if role and role.upper() == UserRole.TESTER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Field Testers cannot create or modify chemical tests and standards.",
        )


@router.get("", response_model=list[ChemicalTestSummarySchema])
def list_chemical_tests(
    status: Optional[str] = Query(None, description="Filter tests by status: DRAFT, PUBLISHED, ARCHIVED"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Returns catalog of registered chemical tests.

    Field testers only receive PUBLISHED tests. Test managers can see all tests or filter by status.
    """
    effective_role = x_user_role.upper() if x_user_role else None
    mem_tests = in_memory_store.get_all_tests(status=status, role=effective_role)
    return [t.to_summary_dict() for t in mem_tests]


@router.post("", response_model=ChemicalTestDetailSchema)
def create_chemical_test(
    test_in: ChemicalTestCreateSchema,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Creates a new chemical test in DRAFT status with Version 1."""
    check_manager_role(x_user_role)

    # Check if test ID already exists
    existing = in_memory_store.get_test(test_in.test_id)
    if existing and existing.test_id == test_in.test_id.upper().strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test ID '{test_in.test_id}' is already in use. Please specify a unique ID.",
        )

    procedure_list = [p.dict() for p in test_in.procedure] if test_in.procedure else []
    reagents_list = [r.dict() for r in test_in.reagents] if test_in.reagents else []

    test = in_memory_store.create_test(
        test_id=test_in.test_id,
        name=test_in.name,
        sample_type=test_in.sample_type,
        unit=test_in.unit,
        incubation_seconds=test_in.incubation_seconds,
        incubation_tolerance_seconds=test_in.incubation_tolerance_seconds,
        description=test_in.description or "",
        sample_requirements=test_in.sample_requirements or "",
        procedure=procedure_list,
        reagents=reagents_list,
        video_url=test_in.video_url or "",
        notes=test_in.notes or "",
    )
    return test.to_detail_dict()


@router.get("/{test_id}", response_model=ChemicalTestDetailSchema)
def get_chemical_test_detail(
    test_id: str,
    version: Optional[int] = Query(None, description="Optional historical version number"),
    db: Session = Depends(get_db),
):
    """Returns complete specification for a chemical test including procedure, reagents, and standards."""
    test = in_memory_store.get_test(test_id, version=version)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    return test.to_detail_dict()


@router.put("/{test_id}", response_model=ChemicalTestDetailSchema)
def update_chemical_test(
    test_id: str,
    test_in: ChemicalTestUpdateSchema,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Updates chemical test configuration (manager only)."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    updates = test_in.dict(exclude_unset=True)
    if "procedure" in updates and updates["procedure"] is not None:
        updates["procedure"] = [p.dict() if hasattr(p, "dict") else p for p in test_in.procedure]
    if "reagents" in updates and updates["reagents"] is not None:
        updates["reagents"] = [r.dict() if hasattr(r, "dict") else r for r in test_in.reagents]

    updated = in_memory_store.update_test(test_id, updates)
    return updated.to_detail_dict()


@router.post("/{test_id}/publish", response_model=ChemicalTestDetailSchema)
def publish_chemical_test(
    test_id: str,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Publishes a test making it visible and available to testers."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    if len(test.standards) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish test with zero color standards. Add at least one reference standard first.",
        )

    published = in_memory_store.publish_test(test_id)
    return published.to_detail_dict()


@router.post("/{test_id}/new-version", response_model=ChemicalTestDetailSchema)
def create_new_test_version(
    test_id: str,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Creates a new test version (e.g. Version 2) in DRAFT state while preserving the historical published version."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    new_v_test = in_memory_store.new_version_test(test_id)
    return new_v_test.to_detail_dict()


# ---------------------------------------------------------------------------
# COLOR STANDARDS & REFERENCE ANALYSIS ENDPOINTS
# ---------------------------------------------------------------------------


@router.get("/{test_id}/standards", response_model=list[ColorStandardSchema])
def list_test_standards(
    test_id: str,
    version: Optional[int] = Query(None, description="Optional historical test version"),
    db: Session = Depends(get_db),
):
    """Returns color standards defined for test_id, sorted by numeric concentration value."""
    test = in_memory_store.get_test(test_id, version=version)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    stds = in_memory_store.get_standards_for_test(test_id, version=version)
    return [s.to_dict() for s in stds]


class AnalyzeReferenceJsonRequest(BaseModel):
    image_base64: str
    device_model: Optional[str] = None
    white_balance_method: str = "NONE"
    bottle_guide: Optional[list[float]] = None
    liquid_roi: Optional[list[float]] = None


@router.post("/{test_id}/standards/analyze-reference")
async def analyze_reference_sample(
    test_id: str,
    image: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    device_model: Optional[str] = Form(None),
    white_balance_method: str = Form(settings.DEFAULT_WHITE_BALANCE_METHOD),
    guide_x_min: Optional[float] = Form(None),
    guide_y_min: Optional[float] = Form(None),
    guide_x_max: Optional[float] = Form(None),
    guide_y_max: Optional[float] = Form(None),
    liquid_x_min: Optional[float] = Form(None),
    liquid_y_min: Optional[float] = Form(None),
    liquid_x_max: Optional[float] = Form(None),
    liquid_y_max: Optional[float] = Form(None),
    db: Session = Depends(get_db),
):
    """Runs the REAL computer vision & color-analysis pipeline on a reference sample image.

    Validates bottle presence, liquid ROI, exposure, blur, glare, and extracts exact sRGB, HSV, and CIELAB color.
    Reuses the same production engine used during tester capture.
    """
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    content: bytes = b""
    if image is not None:
        content = await image.read()
    elif image_base64:
        clean_b64 = image_base64.strip()
        if "," in clean_b64:
            clean_b64 = clean_b64.split(",", 1)[1]
        try:
            content = base64.b64decode(clean_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 reference image: {e}")

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded reference image file or base64 is empty.")

    bottle_guide = None
    if all(v is not None for v in (guide_x_min, guide_y_min, guide_x_max, guide_y_max)):
        bottle_guide = (float(guide_x_min), float(guide_y_min), float(guide_x_max), float(guide_y_max))

    custom_liquid_roi = None
    if all(v is not None for v in (liquid_x_min, liquid_y_min, liquid_x_max, liquid_y_max)):
        custom_liquid_roi = (float(liquid_x_min), float(liquid_y_min), float(liquid_x_max), float(liquid_y_max))

    analyzer = AnalysisService(db=db)
    result = analyzer.analyze_reference_sample(
        image_bytes=content,
        device_model=device_model,
        white_balance_method=white_balance_method,
        bottle_guide=bottle_guide,
        custom_liquid_roi=custom_liquid_roi,
    )
    return result


@router.post("/{test_id}/standards/analyze-reference-json")
async def analyze_reference_sample_json(
    test_id: str,
    req: AnalyzeReferenceJsonRequest,
    db: Session = Depends(get_db),
):
    """JSON equivalent for analyze_reference_sample using base64 encoded image."""
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    clean_b64 = req.image_base64.strip()
    if "," in clean_b64:
        clean_b64 = clean_b64.split(",", 1)[1]
    try:
        content = base64.b64decode(clean_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 reference image: {e}")

    if not content:
        raise HTTPException(status_code=400, detail="Base64 reference image decoded to 0 bytes.")

    bottle_guide = tuple(req.bottle_guide) if req.bottle_guide and len(req.bottle_guide) == 4 else None
    custom_liquid_roi = tuple(req.liquid_roi) if req.liquid_roi and len(req.liquid_roi) == 4 else None

    analyzer = AnalysisService(db=db)
    result = analyzer.analyze_reference_sample(
        image_bytes=content,
        device_model=req.device_model,
        white_balance_method=req.white_balance_method,
        bottle_guide=bottle_guide,
        custom_liquid_roi=custom_liquid_roi,
    )
    return result


@router.post("/{test_id}/standards", response_model=ColorStandardSchema)
def create_color_standard(
    test_id: str,
    standard_in: ColorStandardCreateSchema,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Saves a newly analyzed reference color as an official standard for test_id."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    if test.status == "PUBLISHED":
        # When a manager adds new standards, test reverts to DRAFT so it can be managed and republished
        test.status = "DRAFT"

    std_idx = len(test.standards) + 1
    clean_unit = standard_in.unit or test.unit
    val = float(standard_in.value)
    standard_id = f"{test.test_id}_STD_{val:g}".replace(".", "_")
    level_str = standard_in.level or f"{val:g} {clean_unit}"
    color_name_str = standard_in.color_name or f"Standard ({level_str})"

    ref_color = standard_in.reference_color
    rgb_r = int(round(float(ref_color.rgb.get("r", 0))))
    rgb_g = int(round(float(ref_color.rgb.get("g", 0))))
    rgb_b = int(round(float(ref_color.rgb.get("b", 0))))
    hex_code = ref_color.hex or ColorConverter.rgb_to_hex(rgb_r, rgb_g, rgb_b)

    hsv_h = float(ref_color.hsv.get("h", 0.0)) if ref_color.hsv else 0.0
    hsv_s = float(ref_color.hsv.get("s", 0.0)) if ref_color.hsv else 0.0
    hsv_v = float(ref_color.hsv.get("v", 0.0)) if ref_color.hsv else 0.0

    lab_l = float(ref_color.lab.get("l", 0.0))
    lab_a = float(ref_color.lab.get("a", 0.0))
    lab_b = float(ref_color.lab.get("b", 0.0))

    q_overall = standard_in.quality.overall if standard_in.quality else 90.0
    q_valid_pix = standard_in.quality.valid_pixel_percentage if standard_in.quality else 85.0

    # Extract background white point if provided (for Bradford CAT at match time)
    bg_white_dict = ref_color.bg_white or {}
    bg_white_r_val = int(bg_white_dict.get("r", 200))
    bg_white_g_val = int(bg_white_dict.get("g", 200))
    bg_white_b_val = int(bg_white_dict.get("b", 200))

    # Initial reference sample
    sample_item = StandardSampleItem(
        id=str(uuid.uuid4()),
        image_base64=standard_in.reference_image or "",
        rgb_r=rgb_r,
        rgb_g=rgb_g,
        rgb_b=rgb_b,
        hex_code=hex_code,
        hsv_h=hsv_h,
        hsv_s=hsv_s,
        hsv_v=hsv_v,
        lab_l=lab_l,
        lab_a=lab_a,
        lab_b=lab_b,
        quality_overall=q_overall,
        valid_pixel_percentage=q_valid_pix,
        bg_white_r=bg_white_r_val,
        bg_white_g=bg_white_g_val,
        bg_white_b=bg_white_b_val,
    )

    standard_item = ColorStandardItem(
        id=standard_id,
        standard_id=standard_id,
        test_id=test.test_id,
        test_version=test.version,
        value=val,
        unit=clean_unit,
        name=f"{test.name} {level_str}",
        level=level_str,
        color_name=color_name_str,
        description=standard_in.description or "",
        hex_code=hex_code,
        rgb_r=rgb_r,
        rgb_g=rgb_g,
        rgb_b=rgb_b,
        lab_l=lab_l,
        lab_a=lab_a,
        lab_b=lab_b,
        hsv_h=hsv_h,
        hsv_s=hsv_s,
        hsv_v=hsv_v,
        quality_overall=q_overall,
        valid_pixel_percentage=q_valid_pix,
        reference_image=standard_in.reference_image or "",
        tolerance_delta_e=standard_in.tolerance_delta_e or 3.0,
        status="ACTIVE",
        samples=[sample_item],
        bg_white_r=bg_white_r_val,
        bg_white_g=bg_white_g_val,
        bg_white_b=bg_white_b_val,
    )

    saved = in_memory_store.add_standard(test_id, standard_item)
    return saved.to_dict()


@router.get("/{test_id}/standards/{standard_id}", response_model=ColorStandardSchema)
def get_color_standard(test_id: str, standard_id: str, db: Session = Depends(get_db)):
    """Returns single standard definition."""
    std = in_memory_store.get_standard(test_id, standard_id)
    if not std:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard '{standard_id}' not found for test '{test_id}'.",
        )
    return std.to_dict()


@router.put("/{test_id}/standards/{standard_id}", response_model=ColorStandardSchema)
def update_color_standard(
    test_id: str,
    standard_id: str,
    standard_in: ColorStandardUpdateSchema,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Updates standard metadata (description, tolerance, etc.)."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    if test.status == "PUBLISHED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit standards in a published test. Create a new test version instead.",
        )

    updates = standard_in.dict(exclude_unset=True)
    updated = in_memory_store.update_standard(test_id, standard_id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard '{standard_id}' not found.",
        )
    return updated.to_dict()


@router.delete("/{test_id}/standards/{standard_id}")
def delete_color_standard(
    test_id: str,
    standard_id: str,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Deletes a standard from a test."""
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    if test.status == "PUBLISHED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete standards in a published test. Create a new test version instead.",
        )

    success = in_memory_store.delete_standard(test_id, standard_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard '{standard_id}' not found.",
        )
    return {"status": "SUCCESS", "message": f"Standard '{standard_id}' deleted."}


@router.post("/{test_id}/standards/{standard_id}/samples", response_model=ColorStandardSchema)
async def add_reference_sample_to_standard(
    test_id: str,
    standard_id: str,
    image: UploadFile = File(...),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    """Analyzes and aggregates an additional reference photograph into an existing standard.

    Recalculates the representative median CIELAB and RGB color across all samples.
    """
    check_manager_role(x_user_role)
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )
    std = in_memory_store.get_standard(test_id, standard_id)
    if not std:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Standard '{standard_id}' not found.",
        )

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded reference image is empty.")

    analyzer = AnalysisService(db=db)
    res = analyzer.analyze_reference_sample(image_bytes=content)
    if not res.get("is_valid", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reference sample rejected: {', '.join(res.get('problems', []))}",
        )

    det_col = res["detected_color"]
    det_bw = det_col.get("bg_white") or {}
    sample = StandardSampleItem(
        id=str(uuid.uuid4()),
        image_base64=res.get("reference_image", ""),
        rgb_r=det_col["rgb"]["r"],
        rgb_g=det_col["rgb"]["g"],
        rgb_b=det_col["rgb"]["b"],
        hex_code=det_col["hex"],
        hsv_h=det_col["hsv"]["h"],
        hsv_s=det_col["hsv"]["s"],
        hsv_v=det_col["hsv"]["v"],
        lab_l=det_col["lab"]["l"],
        lab_a=det_col["lab"]["a"],
        lab_b=det_col["lab"]["b"],
        quality_overall=res["quality"]["overall"],
        valid_pixel_percentage=res["quality"]["valid_pixel_percentage"],
        # Preserve the illuminant white point for Bradford CAT
        bg_white_r=int(det_bw.get("r", 200)),
        bg_white_g=int(det_bw.get("g", 200)),
        bg_white_b=int(det_bw.get("b", 200)),
    )


    std.add_reference_sample(sample)
    return std.to_dict()


# ---------------------------------------------------------------------------
# TESTER ANALYSIS ENDPOINT
# ---------------------------------------------------------------------------


@router.post("/{test_id}/analyze")
async def analyze_test_image(
    test_id: str,
    image: UploadFile = File(...),
    incubation_seconds: Optional[int] = Form(None),
    device_model: Optional[str] = Form(None),
    white_balance_method: str = Form(settings.DEFAULT_WHITE_BALANCE_METHOD),
    guide_x_min: Optional[float] = Form(None),
    guide_y_min: Optional[float] = Form(None),
    guide_x_max: Optional[float] = Form(None),
    guide_y_max: Optional[float] = Form(None),
    liquid_x_min: Optional[float] = Form(None),
    liquid_y_min: Optional[float] = Form(None),
    liquid_x_max: Optional[float] = Form(None),
    liquid_y_max: Optional[float] = Form(None),
    debug: bool = Form(False),
    db: Session = Depends(get_db),
):
    """Analyzes a tester bottle image against the published color standards defined for test_id."""
    test = in_memory_store.get_test(test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chemical test '{test_id}' not found.",
        )

    try:
        content = await image.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        bottle_guide = None
        if guide_x_min is not None and guide_y_min is not None and guide_x_max is not None and guide_y_max is not None:
            bottle_guide = (guide_x_min, guide_y_min, guide_x_max, guide_y_max)

        custom_liquid_roi = None
        if liquid_x_min is not None and liquid_y_min is not None and liquid_x_max is not None and liquid_y_max is not None:
            custom_liquid_roi = (liquid_x_min, liquid_y_min, liquid_x_max, liquid_y_max)

        # Retrieve active standards for matching
        active_standards = [s.to_dict() for s in in_memory_store.get_standards_for_test(test.test_id)]

        analyzer = AnalysisService(db=db)
        result = analyzer.analyze(
            image_bytes=content,
            test_code=test.test_id,
            incubation_seconds=incubation_seconds,
            device_model=device_model,
            white_balance_method=white_balance_method,
            bottle_guide=bottle_guide,
            custom_liquid_roi=custom_liquid_roi,
            target_colors=active_standards,
            debug=debug,
        )
        return result
    except ImageValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline error: {str(e)}",
        )
