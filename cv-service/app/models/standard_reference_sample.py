from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class StandardReferenceSample(Base):
    """Stores individual reference sample photographs and measurements associated with a color standard."""

    __tablename__ = "standard_reference_samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    color_standard_id: Mapped[str] = mapped_column(String(36), ForeignKey("color_standards.id"), nullable=False)

    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_base64: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Individual color measurements
    rgb_r: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb_g: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb_b: Mapped[int] = mapped_column(Integer, nullable=False)
    hex_code: Mapped[str] = mapped_column(String(7), nullable=False)

    hsv_h: Mapped[float] = mapped_column(Float, default=0.0)
    hsv_s: Mapped[float] = mapped_column(Float, default=0.0)
    hsv_v: Mapped[float] = mapped_column(Float, default=0.0)

    lab_l: Mapped[float] = mapped_column(Float, nullable=False)
    lab_a: Mapped[float] = mapped_column(Float, nullable=False)
    lab_b: Mapped[float] = mapped_column(Float, nullable=False)

    # Individual quality scores
    quality_overall: Mapped[float] = mapped_column(Float, default=100.0)
    valid_pixel_percentage: Mapped[float] = mapped_column(Float, default=100.0)
    device_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    color_standard: Mapped["ColorStandard"] = relationship("ColorStandard", back_populates="reference_samples")
