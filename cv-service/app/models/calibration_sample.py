from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class CalibrationSample(Base):
    __tablename__ = "calibration_samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    reference_color_id: Mapped[str] = mapped_column(String(36), ForeignKey("reference_colors.id"), nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    lab_l: Mapped[float] = mapped_column(Float, nullable=False)
    lab_a: Mapped[float] = mapped_column(Float, nullable=False)
    lab_b: Mapped[float] = mapped_column(Float, nullable=False)

    quality_score: Mapped[float] = mapped_column(Float, default=100.0)
    device_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lighting_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    reference_color: Mapped["ReferenceColor"] = relationship("ReferenceColor", back_populates="calibration_samples")
