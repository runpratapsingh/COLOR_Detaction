import json
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ImageValidationError
from app.models.base import get_db
from app.schemas.analysis import AnalysisResponseSchema
from app.services.analysis_service import AnalysisService

router = APIRouter(tags=["Analysis"])


@router.post("/color/analyze")
@router.post("/color-tests/analyze")
@router.post("/analyze")
async def analyze_liquid_color(
    image: UploadFile = File(...),
    test_code: str | None = Form(None),
    incubation_seconds: int | None = Form(None),
    device_model: str | None = Form(None),
    white_balance_method: str = Form(settings.DEFAULT_WHITE_BALANCE_METHOD),
    target_colors: str | None = Form(None),
    guide_x_min: float | None = Form(None),
    guide_y_min: float | None = Form(None),
    guide_x_max: float | None = Form(None),
    guide_y_max: float | None = Form(None),
    liquid_x_min: float | None = Form(None),
    liquid_y_min: float | None = Form(None),
    liquid_x_max: float | None = Form(None),
    liquid_y_max: float | None = Form(None),
    debug: bool = Form(False),
    db: Session = Depends(get_db),
):
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

        target_colors_list = None
        if target_colors:
            try:
                parsed = json.loads(target_colors)
                if isinstance(parsed, list):
                    target_colors_list = parsed
            except Exception:
                pass

        analyzer = AnalysisService(db=db)
        result = analyzer.analyze(
            image_bytes=content,
            test_code=test_code,
            incubation_seconds=incubation_seconds,
            device_model=device_model,
            white_balance_method=white_balance_method,
            bottle_guide=bottle_guide,
            custom_liquid_roi=custom_liquid_roi,
            target_colors=target_colors_list,
            debug=debug,
        )
        return result
    except ImageValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Pipeline error: {str(e)}")


@router.post("/analyze/multi")
@router.post("/color/analyze/multi")
async def analyze_liquid_color_multi(
    image_1: UploadFile = File(...),
    image_2: UploadFile | None = File(None),
    image_3: UploadFile | None = File(None),
    test_code: str | None = Form(None),
    incubation_seconds: int | None = Form(None),
    device_model: str | None = Form(None),
    white_balance_method: str = Form(settings.DEFAULT_WHITE_BALANCE_METHOD),
    target_colors: str | None = Form(None),
    guide_x_min: float | None = Form(None),
    guide_y_min: float | None = Form(None),
    guide_x_max: float | None = Form(None),
    guide_y_max: float | None = Form(None),
    db: Session = Depends(get_db),
):
    """Multi-shot analysis: send 2-3 photos of the same bottle for averaged, stable results.

    Accepts image_1 (required), image_2, image_3 (both optional).
    Each image is processed independently. Passing shots are averaged in Lab space
    before reference matching — this eliminates camera noise, glare flicker, and
    auto-exposure drift that causes single-shot inconsistency in the field.
    """
    try:
        images: list[bytes] = []
        for upload in [image_1, image_2, image_3]:
            if upload is None:
                continue
            content = await upload.read()
            if content:
                images.append(content)

        if not images:
            raise HTTPException(status_code=400, detail="At least one image must be provided.")

        bottle_guide = None
        if guide_x_min is not None and guide_y_min is not None and guide_x_max is not None and guide_y_max is not None:
            bottle_guide = (guide_x_min, guide_y_min, guide_x_max, guide_y_max)

        target_colors_list = None
        if target_colors:
            try:
                parsed = json.loads(target_colors)
                if isinstance(parsed, list):
                    target_colors_list = parsed
            except Exception:
                pass

        analyzer = AnalysisService(db=db)
        result = analyzer.analyze_multi(
            images_bytes=images,
            test_code=test_code,
            incubation_seconds=incubation_seconds,
            device_model=device_model,
            white_balance_method=white_balance_method,
            bottle_guide=bottle_guide,
            target_colors=target_colors_list,
        )
        return result
    except ImageValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Multi-shot pipeline error: {str(e)}")

