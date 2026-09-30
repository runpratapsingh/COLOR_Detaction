import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.base import SessionLocal, Base, engine
from app.repositories.reference_repository import ReferenceRepository
from app.repositories.test_repository import TestRepository


def calibration_report_cli():
    parser = argparse.ArgumentParser(description="Print report of reference colors in database.")
    parser.add_argument("--test-code", help="Optional test code to filter by")

    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        test_repo = TestRepository(db)
        tests = test_repo.get_all()

        print("\n" + "=" * 60)
        print("DATABASE CALIBRATION REPORT")
        print("=" * 60)

        if not tests:
            print("No chemical tests registered in database.")
            return

        ref_repo = ReferenceRepository(db)
        for t in tests:
            if args.test_code and t.code != args.test_code:
                continue

            print(f"\nChemical Test: {t.name} (Code: {t.code})")
            print(f"Incubation: {t.incubation_seconds}s ± {t.incubation_tolerance}s")
            print("-" * 55)

            refs = ref_repo.get_by_test_id(t.id)
            if not refs:
                print("  No reference colors calibrated yet.")
                continue

            print(f"  {'Level':<10} {'Color Name':<15} {'CIE L*a*b*':<20} {'sRGB':<15} {'Samples'}")
            for r in refs:
                lab_str = f"({r.lab_l:.1f}, {r.lab_a:.1f}, {r.lab_b:.1f})"
                rgb_str = f"({r.rgb_r}, {r.rgb_g}, {r.rgb_b})"
                print(f"  {r.level:<10} {r.color_name:<15} {lab_str:<20} {rgb_str:<15} {r.sample_count}")

    finally:
        db.close()


if __name__ == "__main__":
    calibration_report_cli()
