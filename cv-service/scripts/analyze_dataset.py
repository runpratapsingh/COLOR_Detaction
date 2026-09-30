import argparse
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.base import SessionLocal, Base, engine
from app.services.analysis_service import AnalysisService


def analyze_dataset_cli():
    parser = argparse.ArgumentParser(description="Analyze image(s) using liquid color detection system.")
    parser.add_argument("--image", help="Single image file path to analyze")
    parser.add_argument("--dir", help="Directory containing images to analyze")
    parser.add_argument("--test-code", help="Chemical test code")
    parser.add_argument("--debug", action="store_true", help="Enable debug artifact generation")

    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        analyzer = AnalysisService(db=db)

        image_paths = []
        if args.image:
            image_paths.append(args.image)
        elif args.dir:
            for fname in sorted(os.listdir(args.dir)):
                if fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                    image_paths.append(os.path.join(args.dir, fname))
        else:
            print("Please provide --image or --dir")
            sys.exit(1)

        print(f"Analyzing {len(image_paths)} image(s)...\n")

        for img_path in image_paths:
            with open(img_path, "rb") as f:
                content = f.read()

            res = analyzer.analyze(
                image_bytes=content,
                test_code=args.test_code,
                debug=args.debug,
            )

            print(f"=== File: {os.path.basename(img_path)} ===")
            print(f"Status: {res['status']}")
            print(f"Quality Score: {res['quality']['overall']}")
            if res.get("detected_color"):
                color = res["detected_color"]
                print(f"Detected Color: {color['name']}")
                print(f"RGB: ({color['rgb']['r']}, {color['rgb']['g']}, {color['rgb']['b']})")
                print(f"CIE Lab: (L*={color['lab']['l']}, a*={color['lab']['a']}, b*={color['lab']['b']})")
            if res.get("classification") and res["classification"].get("level"):
                cls = res["classification"]
                print(f"Matched Level: {cls['level']} (ΔE 2000: {cls['delta_e_2000']}, Confidence: {cls['confidence']}%)")
            if res.get("reasons"):
                print(f"Rejection Reasons: {', '.join(res['reasons'])}")
            print("-" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    analyze_dataset_cli()
