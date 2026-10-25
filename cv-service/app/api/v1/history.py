import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.base import get_db
from app.repositories.result_repository import ResultRepository
from app.services.in_memory_store import in_memory_store

router = APIRouter(tags=["History"])


class HistoryItemResponse(BaseModel):
    id: str
    test_id: Optional[str] = None
    test_name: Optional[str] = None
    test_version: int = 1
    status: str
    detected_color: Optional[str] = None
    detected_level: Optional[str] = None
    matched_standard_id: Optional[str] = None
    matched_standard_value: Optional[float] = None
    lab_l: Optional[float] = None
    lab_a: Optional[float] = None
    lab_b: Optional[float] = None
    delta_e: Optional[float] = None
    match_percentage: Optional[float] = None
    confidence: float = 0.0
    quality_score: float = 0.0
    rejection_reasons: List[str] = []
    device_model: Optional[str] = None
    created_at: str


@router.get("/history", response_model=List[HistoryItemResponse])
@router.get("/tests/history", response_model=List[HistoryItemResponse])
def get_test_history(
    test_id: Optional[str] = Query(None, description="Filter by test code or test ID"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Retrieve history of all performed chemical tests with comprehensive measurement details."""
    repo = ResultRepository(db)
    records = repo.get_history(limit=limit, test_id=test_id)
    out = []
    for r in records:
        reasons = []
        if r.rejection_reasons:
            try:
                parsed = json.loads(r.rejection_reasons)
                if isinstance(parsed, list):
                    reasons = [str(x) for x in parsed]
                else:
                    reasons = [str(parsed)]
            except Exception:
                reasons = [r.rejection_reasons]

        match_pct = None
        if r.delta_e is not None:
            match_pct = max(0.0, round((1.0 - min(25.0, r.delta_e) / 25.0) * 100.0, 1))

        test_name = None
        if r.chemical_test and hasattr(r.chemical_test, "name"):
            test_name = r.chemical_test.name
        elif r.test_id:
            test_obj = in_memory_store.get_test(r.test_id)
            test_name = test_obj.name if test_obj and hasattr(test_obj, "name") else r.test_id

        out.append(
            HistoryItemResponse(
                id=r.id,
                test_id=r.test_id,
                test_name=test_name,
                test_version=r.test_version,
                status=r.status,
                detected_color=r.detected_color,
                detected_level=r.detected_level,
                matched_standard_id=r.matched_standard_id,
                matched_standard_value=r.matched_standard_value,
                lab_l=r.lab_l,
                lab_a=r.lab_a,
                lab_b=r.lab_b,
                delta_e=r.delta_e,
                match_percentage=match_pct,
                confidence=r.confidence,
                quality_score=r.quality_score,
                rejection_reasons=reasons,
                device_model=r.device_model,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
        )
    return out


@router.delete("/history/{result_id}")
def delete_test_history_item(result_id: str, db: Session = Depends(get_db)):
    """Delete a single history entry by ID."""
    repo = ResultRepository(db)
    success = repo.delete_result(result_id)
    if not success:
        raise HTTPException(status_code=404, detail="History record not found")
    return {"message": "Record deleted", "id": result_id}
