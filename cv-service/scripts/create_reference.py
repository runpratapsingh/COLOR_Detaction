import argparse
import os
import sys

# Ensure cv-service root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.base import SessionLocal, Base, engine
from app.repositories.test_repository import TestRepository
from app.repositories.reference_repository import ReferenceRepository
from app.services.analysis_service import AnalysisService
from app.services.color_converter import ColorConverter


def create_reference_cli():
    parser = argparse.ArgumentParser(description="Seed/Calibrate chemical reference colors.")
    parser.add_argument("--test-code", required=True, help="Chemical test code (e.g. CHEM_001)")
    parser.add_argument("--test-name", default="Default Chemical Test", help="Chemical test name")
    parser.add_argument("--level", required=True, help="Level designation (e.g. LEVEL_1, LEVEL_2)")
    parser.add_argument("--color-name", required=True, help="Color name (e.g. LIGHT_PINK, TEAL)")
    parser.add_argument("--images", nargs="+", required=True, help="Paths to sample images for calibration")

    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        test_repo = TestRepository(db)
        test = test_repo.get_by_code(args.test_code)
        if not test:
            test = test_repo.create(code=args.test_code, name=args.test_name)
            print(f"Created new chemical test: {args.test_code}")

        analyzer = AnalysisService(db=db)
        labs = []

        for img_path in args.images:
            if not os.path.exists(img_path):
                print(f"Warning: Image file not found: {img_path}")
                continue

            with open(img_path, "rb") as f:
                content = f.read()

            res = analyzer.analyze(image_bytes=content, debug=False)
            if res["quality"]["overall"] >= 40.0 and res.get("detected_color"):
                lab = res["detected_color"]["lab"]
                labs.append((lab["l"], lab["a"], lab["b"], res["quality"]["overall"]))
                print(f"  Processed {os.path.basename(img_path)} -> Lab({lab['l']}, {lab['a']}, {lab['b']}) Quality={res['quality']['overall']}")
            else:
                print(f"  Rejected {os.path.basename(img_path)}: quality score too low ({res['quality']['overall']})")

        if not labs:
            print("Error: No valid sample images were processed.")
            sys.exit(1)

        import numpy as np
        labs_arr = np.array([(item[0], item[1], item[2]) for item in labs])
        avg_l = float(np.median(labs_arr[:, 0]))
        avg_a = float(np.median(labs_arr[:, 1]))
        avg_b = float(np.median(labs_arr[:, 2]))

        rgb_r, rgb_g, rgb_b = ColorConverter.lab_to_rgb(avg_l, avg_a, avg_b)

        ref_repo = ReferenceRepository(db)
        ref = ref_repo.create_or_update(
            chemical_test_id=test.id,
            level=args.level,
            color_name=args.color_name,
            lab_l=round(avg_l, 2),
            lab_a=round(avg_a, 2),
            lab_b=round(avg_b, 2),
            rgb_r=rgb_r,
            rgb_g=rgb_g,
            rgb_b=rgb_b,
            sample_count=len(labs),
        )

        print("\n--- Calibration Successful ---")
        print(f"Test Code: {args.test_code}")
        print(f"Level: {ref.level}")
        print(f"Color Name: {ref.color_name}")
        print(f"CIE Lab: L*={ref.lab_l}, a*={ref.lab_a}, b*={ref.lab_b}")
        print(f"sRGB: ({ref.rgb_r}, {ref.rgb_g}, {ref.rgb_b})")
        print(f"Aggregated Samples: {ref.sample_count}")

    finally:
        db.close()


if __name__ == "__main__":
    create_reference_cli()
