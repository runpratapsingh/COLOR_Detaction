import json
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, generate_uuid


class ChemicalTest(Base):
    __tablename__ = "chemical_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)  # DRAFT, PUBLISHED, ARCHIVED

    sample_type: Mapped[str] = mapped_column(String(50), default="Water")
    unit: Mapped[str] = mapped_column(String(20), default="mg/L")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    incubation_seconds: Mapped[int] = mapped_column(Integer, default=300)
    incubation_tolerance: Mapped[int] = mapped_column(Integer, default=15)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    reagents_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reference_colors: Mapped[List["ReferenceColor"]] = relationship(
        "ReferenceColor", back_populates="chemical_test", cascade="all, delete-orphan"
    )
    color_standards: Mapped[List["ColorStandard"]] = relationship(
        "ColorStandard", back_populates="chemical_test", cascade="all, delete-orphan"
    )

    def get_procedure(self) -> list:
        if self.procedure_json:
            try:
                return json.loads(self.procedure_json)
            except Exception:
                pass
        return []

    def get_reagents(self) -> list:
        if self.reagents_json:
            try:
                return json.loads(self.reagents_json)
            except Exception:
                pass
        return []

    def to_summary_dict(self) -> dict:
        standards_cnt = len(self.color_standards) if self.color_standards else len(self.reference_colors)
        return {
            "id": self.code,
            "test_id": self.code,
            "code": self.code,
            "version": self.version,
            "name": self.name,
            "status": self.status,
            "sample_type": self.sample_type,
            "unit": self.unit,
            "incubation_seconds": self.incubation_seconds,
            "incubation_tolerance": self.incubation_tolerance,
            "description": self.description or "",
            "standards_count": standards_cnt,
            "active": self.active,
        }

    def to_detail_dict(self) -> dict:
        sorted_stds = sorted(self.color_standards, key=lambda s: s.value) if self.color_standards else []
        return {
            "id": self.code,
            "test_id": self.code,
            "code": self.code,
            "version": self.version,
            "name": self.name,
            "status": self.status,
            "sample_type": self.sample_type,
            "unit": self.unit,
            "incubation_seconds": self.incubation_seconds,
            "incubation_tolerance_seconds": self.incubation_tolerance,
            "description": self.description or "",
            "sample_requirements": self.sample_requirements or "",
            "procedure": self.get_procedure(),
            "reagents": self.get_reagents(),
            "video_url": self.video_url or "",
            "notes": self.notes or "",
            "standards": [s.to_dict() for s in sorted_stds],
            "active": self.active,
        }
