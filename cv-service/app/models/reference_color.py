from datetime import datetime
from typing import List
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class ReferenceColor(Base):
    __tablename__ = "reference_colors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    chemical_test_id: Mapped[str] = mapped_column(String(36), ForeignKey("chemical_tests.id"), nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    color_name: Mapped[str] = mapped_column(String(50), nullable=False)

    lab_l: Mapped[float] = mapped_column(Float, nullable=False)
    lab_a: Mapped[float] = mapped_column(Float, nullable=False)
    lab_b: Mapped[float] = mapped_column(Float, nullable=False)

    rgb_r: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb_g: Mapped[int] = mapped_column(Integer, nullable=False)
    rgb_b: Mapped[int] = mapped_column(Integer, nullable=False)

    sample_count: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chemical_test: Mapped["ChemicalTest"] = relationship("ChemicalTest", back_populates="reference_colors")
    calibration_samples: Mapped[List["CalibrationSample"]] = relationship(
        "CalibrationSample", back_populates="reference_color", cascade="all, delete-orphan"
    )
