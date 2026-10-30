import json
from sqlalchemy.orm import Session
from app.models.analysis_result import AnalysisResult


class ResultRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_result(
        self,
        status: str,
        chemical_test_id: str | None = None,
        test_id: str | None = None,
        test_version: int = 1,
        detected_color: str | None = None,
        detected_level: str | None = None,
        matched_standard_id: str | None = None,
        matched_standard_value: float | None = None,
        lab_l: float | None = None,
        lab_a: float | None = None,
        lab_b: float | None = None,
        delta_e: float | None = None,
        second_best_delta_e: float | None = None,
        confidence: float = 0.0,
        quality_score: float = 0.0,
        rejection_reasons: list[str] | None = None,
        device_model: str | None = None,
    ) -> AnalysisResult:
        rejection_json = json.dumps(rejection_reasons) if rejection_reasons else None
        res = AnalysisResult(
            chemical_test_id=chemical_test_id,
            test_id=test_id,
            test_version=test_version,
            status=status,
            detected_color=detected_color,
            detected_level=detected_level,
            matched_standard_id=matched_standard_id,
            matched_standard_value=matched_standard_value,
            lab_l=lab_l,
            lab_a=lab_a,
            lab_b=lab_b,
            delta_e=delta_e,
            second_best_delta_e=second_best_delta_e,
            confidence=confidence,
            quality_score=quality_score,
            rejection_reasons=rejection_json,
            device_model=device_model,
        )
        self.db.add(res)
        self.db.commit()
        self.db.refresh(res)
        return res

    def get_history(self, limit: int = 20, offset: int = 0, test_id: str | None = None) -> list[AnalysisResult]:
        query = self.db.query(AnalysisResult).order_by(
            AnalysisResult.created_at.desc(),
            AnalysisResult.id.desc(),
        )
        if test_id:
            query = query.filter(
                (AnalysisResult.test_id == test_id) | (AnalysisResult.chemical_test_id == test_id)
            )
        return query.offset(offset).limit(limit).all()

    def get_history_count(self, test_id: str | None = None) -> int:
        query = self.db.query(AnalysisResult)
        if test_id:
            query = query.filter(
                (AnalysisResult.test_id == test_id) | (AnalysisResult.chemical_test_id == test_id)
            )
        return query.count()

    def get_by_id(self, result_id: str) -> AnalysisResult | None:
        return self.db.query(AnalysisResult).filter(AnalysisResult.id == result_id).first()

    def delete_result(self, result_id: str) -> bool:
        res = self.db.query(AnalysisResult).filter(AnalysisResult.id == result_id).first()
        if res:
            self.db.delete(res)
            self.db.commit()
            return True
        return False

    def delete_all_results(self, test_id: str | None = None) -> int:
        query = self.db.query(AnalysisResult)
        if test_id:
            query = query.filter(
                (AnalysisResult.test_id == test_id) | (AnalysisResult.chemical_test_id == test_id)
            )
        count = query.delete(synchronize_session=False)
        self.db.commit()
        return count
