import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.base import get_db
from app.repositories.reference_repository import ReferenceRepository
from app.repositories.test_repository import TestRepository
from app.services.analysis_service import AnalysisService
from app.services.color_converter import ColorConverter
from app.services.in_memory_store import in_memory_store

router = APIRouter(prefix="/references", tags=["Calibration"])


@router.post("/calibrate")
async def calibrate_reference_sample(
    test_code: str = Form(...),
    level: str = Form(...),
    color_name: str = Form(...),
    device_model: str | None = Form(None),
    images: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not images:
        raise HTTPException(status_code=400, detail="At least one image file is required for calibration.")

    analyzer = AnalysisService(db=db)
    valid_labs = []

    for img in images:
        content = await img.read()
        res = analyzer.analyze(image_bytes=content, debug=False)

        if res["quality"]["overall"] >= 40.0 and res["detected_color"]:
            lab = res["detected_color"]["lab"]
            valid_labs.append((lab["l"], lab["a"], lab["b"], res["quality"]["overall"]))

    if not valid_labs:
        raise HTTPException(
            status_code=400,
            detail="All uploaded calibration images were rejected due to poor quality.",
        )

    labs_arr = np.array([(item[0], item[1], item[2]) for item in valid_labs])
    avg_l = float(np.median(labs_arr[:, 0]))
    avg_a = float(np.median(labs_arr[:, 1]))
    avg_b = float(np.median(labs_arr[:, 2]))

    rgb_r, rgb_g, rgb_b = ColorConverter.lab_to_rgb(avg_l, avg_a, avg_b)

    # Save to in-memory store
    mem_ref = in_memory_store.add_or_update_reference(
        test_code=test_code,
        level=level,
        color_name=color_name,
        lab_l=round(avg_l, 2),
        lab_a=round(avg_a, 2),
        lab_b=round(avg_b, 2),
        rgb_r=rgb_r,
        rgb_g=rgb_g,
        rgb_b=rgb_b,
        sample_count=len(valid_labs),
    )

    # Optional DB save
    if db:
        try:
            test_repo = TestRepository(db)
            chemical_test = test_repo.get_by_code(test_code)
            if not chemical_test:
                chemical_test = test_repo.create(code=test_code, name=f"Test {test_code}")

            ref_repo = ReferenceRepository(db)
            ref_repo.create_or_update(
                chemical_test_id=chemical_test.id,
                level=level,
                color_name=color_name,
                lab_l=round(avg_l, 2),
                lab_a=round(avg_a, 2),
                lab_b=round(avg_b, 2),
                rgb_r=rgb_r,
                rgb_g=rgb_g,
                rgb_b=rgb_b,
                sample_count=len(valid_labs),
            )
        except Exception:
            pass

    return {
        "status": "SUCCESS",
        "reference_id": mem_ref.id,
        "level": level,
        "color_name": color_name,
        "lab": {"l": round(avg_l, 2), "a": round(avg_a, 2), "b": round(avg_b, 2)},
        "rgb": {"r": rgb_r, "g": rgb_g, "b": rgb_b},
        "samples_aggregated": len(valid_labs),
    }
