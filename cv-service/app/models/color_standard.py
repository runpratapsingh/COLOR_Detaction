from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class ColorStandard(Base):
    """Production-grade structured color standard model for chemical tests."""

    __tablename__ = "color_standards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    standard_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    chemical_test_id: Mapped[str] = mapped_column(String(36), ForeignKey("chemical_tests.id"), nullable=False)
    test_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    test_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Scientific Concentration & Unit
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="mg/L", nullable=False)
    level: Mapped[str] = mapped_column(String(50), nullable=False)
    color_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Reference Color Values (Aggregate / Representative)
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

    # Quality & Analysis Metrics
    quality_overall: Mapped[float] = mapped_column(Float, default=100.0)
    valid_pixel_percentage: Mapped[float] = mapped_column(Float, default=100.0)
    reference_image: Mapped[str | None] = mapped_column(Text, nullable=True)

    tolerance_delta_e: Mapped[float] = mapped_column(Float, default=3.0)
    sample_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chemical_test: Mapped["ChemicalTest"] = relationship("ChemicalTest", back_populates="color_standards")
    reference_samples: Mapped[List["StandardReferenceSample"]] = relationship(
        "StandardReferenceSample", back_populates="color_standard", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "standard_id": self.standard_id,
            "test_id": self.test_id,
            "test_version": self.test_version,
            "value": self.value,
            "unit": self.unit,
            "level": self.level,
            "color_name": self.color_name,
            "description": self.description or "",
            "reference_color": {
                "hex": self.hex_code if self.hex_code.startswith("#") else f"#{self.hex_code}",
                "rgb": {"r": self.rgb_r, "g": self.rgb_g, "b": self.rgb_b},
                "hsv": {"h": round(self.hsv_h, 1), "s": round(self.hsv_s, 1), "v": round(self.hsv_v, 1)},
                "lab": {"l": round(self.lab_l, 2), "a": round(self.lab_a, 2), "b": round(self.lab_b, 2)},
            },
            "quality": {
                "overall": round(self.quality_overall, 1),
                "valid_pixel_percentage": round(self.valid_pixel_percentage, 1),
            },
            "reference_image": self.reference_image or "",
            "tolerance_delta_e": self.tolerance_delta_e,
            "sample_count": self.sample_count,
            "status": self.status,
        }
