from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.base import get_db
from app.repositories.reference_repository import ReferenceRepository
from app.repositories.test_repository import TestRepository
from app.services.in_memory_store import in_memory_store

router = APIRouter(prefix="/references", tags=["Reference Colors"])


@router.get("")
def get_references(
    test_code: str = Query("CHEM_001", description="Chemical test code"),
    db: Session = Depends(get_db),
):
    if db:
        try:
            test_repo = TestRepository(db)
            test = test_repo.get_by_code(test_code)
            if test:
                ref_repo = ReferenceRepository(db)
                db_refs = ref_repo.get_by_test_id(test.id)
                if db_refs:
                    return db_refs
        except Exception:
            pass

    # In-memory fallback (Never fails, no DB required)
    mem_refs = in_memory_store.get_references(test_code)
    return [
        {
            "id": r.id,
            "chemical_test_id": r.chemical_test_id,
            "level": r.level,
            "color_name": r.color_name,
            "lab_l": r.lab_l,
            "lab_a": r.lab_a,
            "lab_b": r.lab_b,
            "rgb_r": r.rgb_r,
            "rgb_g": r.rgb_g,
            "rgb_b": r.rgb_b,
            "sample_count": r.sample_count,
            "active": r.active,
        }
        for r in mem_refs
    ]
