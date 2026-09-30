import uuid
from typing import Dict, List, Optional
import numpy as np
from app.services.color_converter import ColorConverter


class StandardSampleItem:
    """Represents an individual reference sample image & measurement."""

    def __init__(
        self,
        id: str,
        image_path: Optional[str] = None,
        image_base64: Optional[str] = None,
        rgb_r: int = 0,
        rgb_g: int = 0,
        rgb_b: int = 0,
        hex_code: str = "#000000",
        hsv_h: float = 0.0,
        hsv_s: float = 0.0,
        hsv_v: float = 0.0,
        lab_l: float = 0.0,
        lab_a: float = 0.0,
        lab_b: float = 0.0,
        quality_overall: float = 100.0,
        valid_pixel_percentage: float = 100.0,
        # Background white point at capture time (for chromatic adaptation)
        bg_white_r: int = 200,
        bg_white_g: int = 200,
        bg_white_b: int = 200,
    ):
        self.id = id
        self.image_path = image_path
        self.image_base64 = image_base64
        self.rgb_r = rgb_r
        self.rgb_g = rgb_g
        self.rgb_b = rgb_b
        self.hex = hex_code if hex_code.startswith("#") else f"#{hex_code}"
        self.hsv_h = hsv_h
        self.hsv_s = hsv_s
        self.hsv_v = hsv_v
        self.lab_l = lab_l
        self.lab_a = lab_a
        self.lab_b = lab_b
        self.quality_overall = quality_overall
        self.valid_pixel_percentage = valid_pixel_percentage
        self.bg_white_r = bg_white_r
        self.bg_white_g = bg_white_g
        self.bg_white_b = bg_white_b

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "image_path": self.image_path or "",
            "image_base64": self.image_base64 or "",
            "rgb": {"r": self.rgb_r, "g": self.rgb_g, "b": self.rgb_b},
            "hex": self.hex,
            "hsv": {"h": round(self.hsv_h, 1), "s": round(self.hsv_s, 1), "v": round(self.hsv_v, 1)},
            "lab": {"l": round(self.lab_l, 2), "a": round(self.lab_a, 2), "b": round(self.lab_b, 2)},
            "bg_white": {"r": self.bg_white_r, "g": self.bg_white_g, "b": self.bg_white_b},
            "quality": {
                "overall": round(self.quality_overall, 1),
                "valid_pixel_percentage": round(self.valid_pixel_percentage, 1),
            },
        }


class ColorStandardItem:
    def __init__(
        self,
        id: str,
        standard_id: str,
        test_id: str,
        test_version: int,
        value: float,
        unit: str,
        name: str,
        level: str,
        color_name: str,
        description: str,
        hex_code: str,
        rgb_r: int,
        rgb_g: int,
        rgb_b: int,
        lab_l: float,
        lab_a: float,
        lab_b: float,
        hsv_h: float = 0.0,
        hsv_s: float = 0.0,
        hsv_v: float = 0.0,
        quality_overall: float = 90.0,
        valid_pixel_percentage: float = 85.0,
        reference_image: Optional[str] = None,
        tolerance_delta_e: float = 3.0,
        status: str = "ACTIVE",
        samples: Optional[List[StandardSampleItem]] = None,
        # Background white point recorded when this standard was photographed
        bg_white_r: int = 200,
        bg_white_g: int = 200,
        bg_white_b: int = 200,
    ):
        self.id = id
        self.standard_id = standard_id
        self.test_id = test_id
        self.test_version = test_version
        self.value = float(value)
        self.concentration = float(value)  # backward compat
        self.unit = unit
        self.name = name
        self.level = level
        self.color_name = color_name
        self.description = description
        self.hex = hex_code if hex_code.startswith("#") else f"#{hex_code}"
        self.rgb_r = rgb_r
        self.rgb_g = rgb_g
        self.rgb_b = rgb_b
        self.lab_l = lab_l
        self.lab_a = lab_a
        self.lab_b = lab_b
        self.hsv_h = hsv_h
        self.hsv_s = hsv_s
        self.hsv_v = hsv_v
        self.quality_overall = quality_overall
        self.valid_pixel_percentage = valid_pixel_percentage
        self.reference_image = reference_image or ""
        self.tolerance_delta_e = tolerance_delta_e
        self.status = status
        self.samples: List[StandardSampleItem] = samples or []
        self.sample_count = len(self.samples) if self.samples else 1
        # Background white point (median R,G,B of the white paper background)
        # recorded at standard-capture time. Used for Bradford CAT at match time.
        self.bg_white_r = bg_white_r
        self.bg_white_g = bg_white_g
        self.bg_white_b = bg_white_b

    def add_reference_sample(self, sample: StandardSampleItem):
        """Adds a reference sample and recalculates aggregate representative CIELAB / RGB values."""
        self.samples.append(sample)
        self.sample_count = len(self.samples)

        # Aggregate median/mean L*a*b* across all reference samples
        labs = np.array([[s.lab_l, s.lab_a, s.lab_b] for s in self.samples])
        med_l = float(np.median(labs[:, 0]))
        med_a = float(np.median(labs[:, 1]))
        med_b = float(np.median(labs[:, 2]))

        self.lab_l = round(med_l, 2)
        self.lab_a = round(med_a, 2)
        self.lab_b = round(med_b, 2)

        # Convert back to sRGB & HSV
        r, g, b = ColorConverter.lab_to_rgb(self.lab_l, self.lab_a, self.lab_b)
        self.rgb_r = r
        self.rgb_g = g
        self.rgb_b = b
        self.hex = ColorConverter.rgb_to_hex(r, g, b)
        h_val, s_val, v_val = ColorConverter.rgb_to_hsv((r, g, b))
        self.hsv_h = h_val
        self.hsv_s = s_val
        self.hsv_v = v_val

        # Aggregate average quality
        self.quality_overall = round(float(np.mean([s.quality_overall for s in self.samples])), 1)
        self.valid_pixel_percentage = round(float(np.mean([s.valid_pixel_percentage for s in self.samples])), 1)
        if sample.image_base64:
            self.reference_image = sample.image_base64

        # Aggregate white point — median across all samples
        if any(hasattr(s, 'bg_white_r') for s in self.samples):
            self.bg_white_r = int(np.median([s.bg_white_r for s in self.samples if hasattr(s, 'bg_white_r')]))
            self.bg_white_g = int(np.median([s.bg_white_g for s in self.samples if hasattr(s, 'bg_white_g')]))
            self.bg_white_b = int(np.median([s.bg_white_b for s in self.samples if hasattr(s, 'bg_white_b')]))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "standard_id": self.standard_id,
            "test_id": self.test_id,
            "test_version": self.test_version,
            "value": self.value,
            "concentration": self.value,
            "unit": self.unit,
            "name": self.name,
            "level": self.level,
            "color_name": self.color_name,
            "description": self.description,
            "hex": self.hex,
            "color_hex": self.hex,
            "lab_l": self.lab_l,
            "lab_a": self.lab_a,
            "lab_b": self.lab_b,
            "reference_color": {
                "hex": self.hex,
                "rgb": {"r": self.rgb_r, "g": self.rgb_g, "b": self.rgb_b},
                "hsv": {"h": round(self.hsv_h, 1), "s": round(self.hsv_s, 1), "v": round(self.hsv_v, 1)},
                "lab": {"l": round(self.lab_l, 2), "a": round(self.lab_a, 2), "b": round(self.lab_b, 2)},
                "bg_white": {"r": getattr(self, 'bg_white_r', 200), "g": getattr(self, 'bg_white_g', 200), "b": getattr(self, 'bg_white_b', 200)},
            },
            "quality": {
                "overall": round(self.quality_overall, 1),
                "valid_pixel_percentage": round(self.valid_pixel_percentage, 1),
            },
            "reference_image": self.reference_image,
            "tolerance_delta_e": self.tolerance_delta_e,
            "sample_count": self.sample_count,
            "status": self.status,
            "samples": [s.to_dict() for s in self.samples],
        }


class ChemicalTestDefinition:
    def __init__(
        self,
        test_id: str,
        name: str,
        version: int = 1,
        status: str = "DRAFT",
        sample_type: str = "Water",
        unit: str = "mg/L",
        incubation_seconds: int = 300,
        incubation_tolerance_seconds: int = 60,
        description: str = "",
        sample_requirements: str = "",
        procedure: Optional[List[dict]] = None,
        reagents: Optional[List[dict]] = None,
        video_url: Optional[str] = None,
        notes: str = "",
        standards: Optional[List[ColorStandardItem]] = None,
    ):
        self.id = test_id
        self.test_id = test_id
        self.code = test_id
        self.version = version
        self.name = name
        self.status = status  # DRAFT, PUBLISHED, ARCHIVED
        self.sample_type = sample_type
        self.unit = unit
        self.incubation_seconds = incubation_seconds
        self.incubation_tolerance = incubation_tolerance_seconds
        self.incubation_tolerance_seconds = incubation_tolerance_seconds
        self.description = description
        self.sample_requirements = sample_requirements
        self.procedure = procedure or []
        self.reagents = reagents or []
        self.video_url = video_url or ""
        self.notes = notes
        self.standards = standards or []
        self.active = True

    def get_sorted_standards(self) -> List[ColorStandardItem]:
        """Always returns standards sorted by numeric concentration value."""
        return sorted(self.standards, key=lambda s: s.value)

    def to_summary_dict(self) -> dict:
        return {
            "id": self.test_id,
            "test_id": self.test_id,
            "code": self.test_id,
            "version": self.version,
            "name": self.name,
            "status": self.status,
            "sample_type": self.sample_type,
            "unit": self.unit,
            "incubation_seconds": self.incubation_seconds,
            "incubation_tolerance": self.incubation_tolerance,
            "description": self.description,
            "standards_count": len(self.standards),
            "active": self.active,
        }

    def to_detail_dict(self) -> dict:
        return {
            "id": self.test_id,
            "test_id": self.test_id,
            "code": self.test_id,
            "version": self.version,
            "name": self.name,
            "status": self.status,
            "sample_type": self.sample_type,
            "unit": self.unit,
            "incubation_seconds": self.incubation_seconds,
            "incubation_tolerance_seconds": self.incubation_tolerance_seconds,
            "description": self.description,
            "sample_requirements": self.sample_requirements,
            "procedure": self.procedure,
            "reagents": self.reagents,
            "video_url": self.video_url,
            "notes": self.notes,
            "standards": [s.to_dict() for s in self.get_sorted_standards()],
            "active": self.active,
        }


class InMemoryStore:
    """In-memory store providing comprehensive test & color standard management with full CRUD, versioning, and publishing."""

    def __init__(self):
        self.tests: Dict[str, ChemicalTestDefinition] = {}
        self.historical_versions: Dict[str, Dict[int, ChemicalTestDefinition]] = {}
        self._seed_defaults()

    def _seed_defaults(self):
        iron_procedure = [
            {
                "step_number": 1,
                "title": "Add Water Sample",
                "instruction": "Fill the clean reaction bottle with 10 mL of water sample up to the marked fill line.",
                "tip": "Ensure sample is clear and free of large suspended particulates.",
            },
            {
                "step_number": 2,
                "title": "Add Reagent Powder Pillow",
                "instruction": "Tear open Reagent Pillow A (Iron Indicator) and add the entire contents into the bottle.",
                "tip": "Tap the packet gently to ensure all powder transfers.",
            },
            {
                "step_number": 3,
                "title": "Cap & Invert to Dissolve",
                "instruction": "Cap the bottle tightly and invert gently 10 times until the powder completely dissolves.",
                "tip": "Do not shake aggressively to avoid micro-bubbles in the liquid.",
            },
            {
                "step_number": 4,
                "title": "Incubate Reaction",
                "instruction": "Place the bottle on a flat surface away from direct sunlight for the reaction to develop.",
                "tip": "Reaction turns orange to reddish-pink in proportion to dissolved iron concentration.",
            },
            {
                "step_number": 5,
                "title": "Capture Reaction in JalQ",
                "instruction": "Position the bottle against a plain neutral background and frame within the camera guide.",
                "tip": "Ensure indirect ambient lighting; avoid camera flash.",
            },
        ]

        iron_reagents = [
            {"name": "Reagent Pillow A (Iron Indicator Powder)", "amount": "1 Pillow / 10 mL"},
            {"name": "Reaction Bottle (Clear 15 mL)", "amount": "1 Bottle"},
        ]

        # Seeded 5 standard reference values for Iron Test (0, 1, 2, 3, 4 mg/L)
        raw_standards = [
            ("IRON_0", "IRON_001_STD_00", 0.0, "0.0 mg/L", "Clear / Faint Yellow (0 mg/L)", "Baseline control sample with no iron present. Solution remains clear or faintly pale yellow.", "#FFF9E8", 255, 249, 232, 98.1, -1.2, 8.9),
            ("IRON_1", "IRON_001_STD_01", 1.0, "1.0 mg/L", "Orange (1.0 mg/L)", "Light orange reaction indicating approximately 1.0 mg/L iron concentration under defined assay conditions.", "#F5A45B", 245, 164, 91, 72.4, 25.1, 52.8),
            ("IRON_2", "IRON_001_STD_02", 2.0, "2.0 mg/L", "Reddish Orange (2.0 mg/L)", "Moderate reddish-orange reaction indicating approximately 2.0 mg/L dissolved iron.", "#D9573F", 217, 87, 63, 52.8, 49.3, 41.7),
            ("IRON_3", "IRON_001_STD_03", 3.0, "3.0 mg/L", "Red-Orange (3.0 mg/L)", "Intense red-orange reaction corresponding to 3.0 mg/L iron concentration.", "#C94345", 201, 67, 69, 45.3, 52.7, 31.4),
            ("IRON_4", "IRON_001_STD_04", 4.0, "4.0+ mg/L", "Deep Red (4.0+ mg/L)", "Deep crimson red reaction denoting high dissolved iron levels at or above 4.0 mg/L.", "#B83B3B", 184, 59, 59, 39.8, 51.1, 28.6),
        ]

        standards_list: List[ColorStandardItem] = []
        for legacy_id, std_code, val, lvl, c_name, desc, hex_str, r, g, b, l, a, b_val in raw_standards:
            h_val, s_val, v_val = ColorConverter.rgb_to_hsv((r, g, b))
            # Seed 1 initial reference sample for each standard
            sample_item = StandardSampleItem(
                id=str(uuid.uuid4()),
                rgb_r=r,
                rgb_g=g,
                rgb_b=b,
                hex_code=hex_str,
                hsv_h=h_val,
                hsv_s=s_val,
                hsv_v=v_val,
                lab_l=l,
                lab_a=a,
                lab_b=b_val,
                quality_overall=88.5,
                valid_pixel_percentage=84.0,
            )
            item = ColorStandardItem(
                id=legacy_id,
                standard_id=std_code,
                test_id="IRON_001",
                test_version=1,
                value=val,
                unit="mg/L",
                name=f"Iron {val:g} mg/L",
                level=lvl,
                color_name=c_name,
                description=desc,
                hex_code=hex_str,
                rgb_r=r,
                rgb_g=g,
                rgb_b=b,
                lab_l=l,
                lab_a=a,
                lab_b=b_val,
                hsv_h=h_val,
                hsv_s=s_val,
                hsv_v=v_val,
                quality_overall=88.5,
                valid_pixel_percentage=84.0,
                tolerance_delta_e=3.0,
                status="ACTIVE",
                samples=[sample_item],
            )
            standards_list.append(item)

        iron_test = ChemicalTestDefinition(
            test_id="IRON_001",
            name="Iron Concentration Test",
            version=1,
            status="DRAFT",
            sample_type="Water",
            unit="mg/L",
            incubation_seconds=300,
            incubation_tolerance_seconds=60,
            description="Determines dissolved iron (Fe²⁺/Fe³⁺) concentration in municipal or well water using bipyridine / phenanthroline colorimetry.",
            sample_requirements="10 mL fresh water sample collected in clean container, 15°C–30°C.",
            procedure=iron_procedure,
            reagents=iron_reagents,
            video_url="https://assets.mixkit.co/videos/preview/mixkit-chemical-reaction-in-a-lab-tube-40292-large.mp4",
            notes="Ensure standard reaction time of 5 minutes before camera capture.",
            standards=standards_list,
        )

        self.tests["IRON_001"] = iron_test
        self.tests["CHEM_001"] = iron_test
        self.historical_versions["IRON_001"] = {1: iron_test}

    def get_test(self, test_id: str, version: Optional[int] = None) -> Optional[ChemicalTestDefinition]:
        clean_id = (test_id or "").upper().strip()
        if version and clean_id in self.historical_versions and version in self.historical_versions[clean_id]:
            return self.historical_versions[clean_id][version]

        if clean_id in self.tests:
            return self.tests[clean_id]
        if "IRON" in clean_id or clean_id == "CHEM_001":
            return self.tests.get("IRON_001")
        return None

    def get_all_tests(self, status: Optional[str] = None, role: Optional[str] = None) -> List[ChemicalTestDefinition]:
        seen = set()
        unique_tests = []
        for t in self.tests.values():
            if t.test_id not in seen:
                seen.add(t.test_id)
                # Filter by tester role: field testers only view PUBLISHED tests
                if role == "TESTER" and t.status != "PUBLISHED":
                    continue
                if status and t.status.upper() != status.upper():
                    continue
                unique_tests.append(t)
        return unique_tests

    def create_test(
        self,
        test_id: str,
        name: str,
        sample_type: str = "Water",
        unit: str = "mg/L",
        incubation_seconds: int = 300,
        incubation_tolerance_seconds: int = 60,
        description: str = "",
        sample_requirements: str = "",
        procedure: Optional[List[dict]] = None,
        reagents: Optional[List[dict]] = None,
        video_url: Optional[str] = None,
        notes: str = "",
    ) -> ChemicalTestDefinition:
        clean_id = test_id.upper().strip()
        test = ChemicalTestDefinition(
            test_id=clean_id,
            name=name,
            version=1,
            status="DRAFT",
            sample_type=sample_type,
            unit=unit,
            incubation_seconds=incubation_seconds,
            incubation_tolerance_seconds=incubation_tolerance_seconds,
            description=description,
            sample_requirements=sample_requirements,
            procedure=procedure or [],
            reagents=reagents or [],
            video_url=video_url or "",
            notes=notes,
            standards=[],
        )
        self.tests[clean_id] = test
        self.historical_versions[clean_id] = {1: test}
        return test

    def update_test(self, test_id: str, updates: dict) -> Optional[ChemicalTestDefinition]:
        test = self.get_test(test_id)
        if not test:
            return None
        for key in ["name", "sample_type", "unit", "incubation_seconds", "incubation_tolerance_seconds",
                    "description", "sample_requirements", "procedure", "reagents", "video_url", "notes"]:
            if key in updates and updates[key] is not None:
                setattr(test, key, updates[key])
        return test

    def publish_test(self, test_id: str) -> Optional[ChemicalTestDefinition]:
        test = self.get_test(test_id)
        if not test:
            return None
        test.status = "PUBLISHED"
        if test.test_id not in self.historical_versions:
            self.historical_versions[test.test_id] = {}
        # Snapshot current version
        self.historical_versions[test.test_id][test.version] = test
        return test

    def new_version_test(self, test_id: str) -> Optional[ChemicalTestDefinition]:
        test = self.get_test(test_id)
        if not test:
            return None
        # Preserve historical version
        if test.test_id not in self.historical_versions:
            self.historical_versions[test.test_id] = {}
        self.historical_versions[test.test_id][test.version] = test

        # Clone to next version as DRAFT
        new_v = test.version + 1
        cloned_standards = []
        for s in test.standards:
            cloned_standards.append(
                ColorStandardItem(
                    id=f"{test.test_id}_V{new_v}_{s.id.split('_')[-1]}",
                    standard_id=f"{test.test_id}_V{new_v}_{s.id.split('_')[-1]}",
                    test_id=test.test_id,
                    test_version=new_v,
                    value=s.value,
                    unit=s.unit,
                    name=s.name,
                    level=s.level,
                    color_name=s.color_name,
                    description=s.description,
                    hex_code=s.hex,
                    rgb_r=s.rgb_r,
                    rgb_g=s.rgb_g,
                    rgb_b=s.rgb_b,
                    lab_l=s.lab_l,
                    lab_a=s.lab_a,
                    lab_b=s.lab_b,
                    hsv_h=s.hsv_h,
                    hsv_s=s.hsv_s,
                    hsv_v=s.hsv_v,
                    quality_overall=s.quality_overall,
                    valid_pixel_percentage=s.valid_pixel_percentage,
                    reference_image=s.reference_image,
                    tolerance_delta_e=s.tolerance_delta_e,
                    status=s.status,
                    samples=list(s.samples),
                )
            )

        new_test = ChemicalTestDefinition(
            test_id=test.test_id,
            name=test.name,
            version=new_v,
            status="DRAFT",
            sample_type=test.sample_type,
            unit=test.unit,
            incubation_seconds=test.incubation_seconds,
            incubation_tolerance_seconds=test.incubation_tolerance_seconds,
            description=test.description,
            sample_requirements=test.sample_requirements,
            procedure=list(test.procedure),
            reagents=list(test.reagents),
            video_url=test.video_url,
            notes=test.notes,
            standards=cloned_standards,
        )
        self.tests[test.test_id] = new_test
        self.historical_versions[test.test_id][new_v] = new_test
        return new_test

    def get_standards_for_test(self, test_id: str, version: Optional[int] = None) -> List[ColorStandardItem]:
        test = self.get_test(test_id, version=version)
        if test:
            return test.get_sorted_standards()
        return []

    def get_standard(self, test_id: str, standard_id: str) -> Optional[ColorStandardItem]:
        test = self.get_test(test_id)
        if not test:
            return None
        for s in test.standards:
            if s.id == standard_id or s.standard_id == standard_id:
                return s
        return None

    def add_standard(self, test_id: str, standard: ColorStandardItem) -> Optional[ColorStandardItem]:
        test = self.get_test(test_id)
        if not test:
            return None
        # Remove any existing standard with same id or value
        test.standards = [s for s in test.standards if s.id != standard.id and s.value != standard.value]
        test.standards.append(standard)
        return standard

    def update_standard(self, test_id: str, standard_id: str, updates: dict) -> Optional[ColorStandardItem]:
        std = self.get_standard(test_id, standard_id)
        if not std:
            return None
        if "value" in updates and updates["value"] is not None:
            std.value = float(updates["value"])
            std.concentration = std.value
        if "unit" in updates and updates["unit"]:
            std.unit = updates["unit"]
        if "name" in updates and updates["name"]:
            std.name = updates["name"]
        if "level" in updates and updates["level"]:
            std.level = updates["level"]
        if "description" in updates and updates["description"] is not None:
            std.description = updates["description"]
        if "tolerance_delta_e" in updates and updates["tolerance_delta_e"] is not None:
            std.tolerance_delta_e = float(updates["tolerance_delta_e"])
        return std

    def delete_standard(self, test_id: str, standard_id: str) -> bool:
        test = self.get_test(test_id)
        if not test:
            return False
        before = len(test.standards)
        test.standards = [s for s in test.standards if s.id != standard_id and s.standard_id != standard_id]
        return len(test.standards) < before

    # Backward compatibility helpers
    def get_references(self, test_code: str):
        stds = self.get_standards_for_test(test_code)
        # Adapt to ReferenceColor-like structure
        return [
            type("RefCompat", (), {
                "id": s.id,
                "chemical_test_id": s.test_id,
                "level": s.level,
                "color_name": s.color_name,
                "lab_l": s.lab_l,
                "lab_a": s.lab_a,
                "lab_b": s.lab_b,
                "rgb_r": s.rgb_r,
                "rgb_g": s.rgb_g,
                "rgb_b": s.rgb_b,
                "sample_count": s.sample_count,
                "active": s.status == "ACTIVE",
            })()
            for s in stds
        ]


in_memory_store = InMemoryStore()

# Backward compatibility aliases
InMemoryTest = ChemicalTestDefinition
InMemoryReference = ColorStandardItem
