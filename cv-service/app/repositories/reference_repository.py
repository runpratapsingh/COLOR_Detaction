from sqlalchemy.orm import Session
from app.models.reference_color import ReferenceColor
from app.models.calibration_sample import CalibrationSample


class ReferenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_test_id(self, chemical_test_id: str) -> list[ReferenceColor]:
        return self.db.query(ReferenceColor).filter(
            ReferenceColor.chemical_test_id == chemical_test_id,
            ReferenceColor.active.is_(True),
        ).all()

    def get_by_test_and_level(self, chemical_test_id: str, level: str) -> ReferenceColor | None:
        return self.db.query(ReferenceColor).filter(
            ReferenceColor.chemical_test_id == chemical_test_id,
            ReferenceColor.level == level,
            ReferenceColor.active.is_(True),
        ).first()

    def create_or_update(
        self,
        chemical_test_id: str,
        level: str,
        color_name: str,
        lab_l: float,
        lab_a: float,
        lab_b: float,
        rgb_r: int,
        rgb_g: int,
        rgb_b: int,
        sample_count: int = 1,
    ) -> ReferenceColor:
        existing = self.get_by_test_and_level(chemical_test_id, level)
        if existing:
            existing.color_name = color_name
            existing.lab_l = lab_l
            existing.lab_a = lab_a
            existing.lab_b = lab_b
            existing.rgb_r = rgb_r
            existing.rgb_g = rgb_g
            existing.rgb_b = rgb_b
            existing.sample_count = sample_count
            self.db.commit()
            self.db.refresh(existing)
            return existing

        ref = ReferenceColor(
            chemical_test_id=chemical_test_id,
            level=level,
            color_name=color_name,
            lab_l=lab_l,
            lab_a=lab_a,
            lab_b=lab_b,
            rgb_r=rgb_r,
            rgb_g=rgb_g,
            rgb_b=rgb_b,
            sample_count=sample_count,
        )
        self.db.add(ref)
        self.db.commit()
        self.db.refresh(ref)
        return ref

    def add_calibration_sample(
        self,
        reference_color_id: str,
        lab_l: float,
        lab_a: float,
        lab_b: float,
        quality_score: float = 100.0,
        image_path: str | None = None,
        device_model: str | None = None,
    ) -> CalibrationSample:
        sample = CalibrationSample(
            reference_color_id=reference_color_id,
            lab_l=lab_l,
            lab_a=lab_a,
            lab_b=lab_b,
            quality_score=quality_score,
            image_path=image_path,
            device_model=device_model,
        )
        self.db.add(sample)
        self.db.commit()
        self.db.refresh(sample)
        return sample
