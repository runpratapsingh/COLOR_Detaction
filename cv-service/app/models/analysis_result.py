from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class AnalysisResult(Base):
    """Historical record of tester capture analysis, permanently linked to test version and standard."""

    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    chemical_test_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chemical_tests.id"), nullable=True)
    test_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    test_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    status: Mapped[str] = mapped_column(String(50), nullable=False)
    detected_color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    detected_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    matched_standard_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    matched_standard_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    lab_l: Mapped[float | None] = mapped_column(Float, nullable=True)
    lab_a: Mapped[float | None] = mapped_column(Float, nullable=True)
    lab_b: Mapped[float | None] = mapped_column(Float, nullable=True)

    delta_e: Mapped[float | None] = mapped_column(Float, nullable=True)
    second_best_delta_e: Mapped[float | None] = mapped_column(Float, nullable=True)

    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)

    rejection_reasons: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON formatted string
    device_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    chemical_test: Mapped["ChemicalTest | None"] = relationship("ChemicalTest")
