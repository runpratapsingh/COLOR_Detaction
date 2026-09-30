import argparse
import csv
import os
import re
import sys
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.base import SessionLocal, Base, engine
from app.services.analysis_service import AnalysisService

LEVEL_PREFIX_RE = re.compile(r"^(LEVEL_[A-Za-z0-9]+)[_\-]", re.IGNORECASE)


def _load_labels_csv(path: str) -> dict[str, str]:
    """Loads a filename -> ground_truth_level mapping from a CSV with columns filename,level."""
    labels: dict[str, str] = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fname = (row.get("filename") or "").strip()
            level = (row.get("level") or "").strip()
            if fname and level:
                labels[fname] = level.upper()
    return labels


def _label_from_filename(fname: str) -> str | None:
    """Falls back to parsing a `LEVEL_X_...` prefix from the filename itself."""
    m = LEVEL_PREFIX_RE.match(fname)
    return m.group(1).upper() if m else None


def evaluate_accuracy_cli():
    parser = argparse.ArgumentParser(description="Evaluate accuracy on a labeled dataset.")
    parser.add_argument("--test-code", required=True, help="Chemical test code")
    parser.add_argument("--dir", default="../test-images", help="Directory containing images")
    parser.add_argument(
        "--labels",
        help="Optional CSV file with columns 'filename,level' mapping ground-truth labels. "
        "If omitted, ground truth is inferred from a 'LEVEL_X_' filename prefix when present.",
    )

    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    labels = _load_labels_csv(args.labels) if args.labels else {}

    try:
        analyzer = AnalysisService(db=db)
        image_paths = []
        if os.path.exists(args.dir):
            for fname in sorted(os.listdir(args.dir)):
                if fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                    image_paths.append(os.path.join(args.dir, fname))

        print(f"Running accuracy evaluation on {len(image_paths)} images in {args.dir}...\n")

        total = len(image_paths)
        accepted = 0
        rejected = 0
        ambiguous = 0
        delta_es_correct = []
        delta_es_incorrect = []
        confusion: dict[tuple[str, str | None], int] = {}
        labeled_total = 0
        labeled_correct = 0

        for p in image_paths:
            fname = os.path.basename(p)
            with open(p, "rb") as f:
                content = f.read()

            res = analyzer.analyze(image_bytes=content, test_code=args.test_code, debug=False)
            status = res["status"]

            true_level = labels.get(fname) or _label_from_filename(fname)
            predicted_level = None
            delta_e = None
            if res.get("classification"):
                predicted_level = res["classification"].get("level")
                delta_e = res["classification"].get("delta_e_2000")

            if status == "SUCCESS":
                accepted += 1
            elif status == "AMBIGUOUS_RESULT":
                ambiguous += 1
            else:
                rejected += 1

            result_tag = ""
            if true_level:
                labeled_total += 1
                predicted_norm = (predicted_level or "").upper()
                is_correct = predicted_norm == true_level
                if is_correct:
                    labeled_correct += 1
                    result_tag = "  [CORRECT]"
                    if delta_e is not None:
                        delta_es_correct.append(delta_e)
                else:
                    result_tag = f"  [WRONG: expected {true_level}, got {predicted_level or status}]"
                    if delta_e is not None:
                        delta_es_incorrect.append(delta_e)
                    confusion[(true_level, predicted_level)] = confusion.get((true_level, predicted_level), 0) + 1

            print(
                f"Image: {fname:<35} Status: {status:<18} "
                f"Quality: {res['quality']['overall']:<5.1f} Level: {str(predicted_level):<10}{result_tag}"
            )

        print("\n" + "=" * 50)
        print("EVALUATION SUMMARY REPORT")
        print("=" * 50)
        print(f"Total Samples Processed: {total}")
        print(f"Accepted (SUCCESS): {accepted} ({(accepted/total*100):.1f}%)")
        print(f"Rejected (RETAKE):   {rejected} ({(rejected/total*100):.1f}%)")
        print(f"Ambiguous:           {ambiguous} ({(ambiguous/total*100):.1f}%)")

        if labeled_total > 0:
            accuracy = labeled_correct / labeled_total * 100.0
            print("\n" + "-" * 50)
            print("GROUND-TRUTH CLASSIFICATION ACCURACY")
            print("-" * 50)
            print(f"Labeled Samples:      {labeled_total}")
            print(f"Correct Level Match:  {labeled_correct} ({accuracy:.1f}%)")
            if delta_es_correct:
                print(f"Mean ΔE 2000 (Correct):   {np.mean(delta_es_correct):.2f}")
            if delta_es_incorrect:
                print(f"Mean ΔE 2000 (Incorrect): {np.mean(delta_es_incorrect):.2f}")
            if confusion:
                print("\nConfusion pairs (true -> predicted): count")
                for (true_lvl, pred_lvl), count in sorted(confusion.items(), key=lambda x: -x[1]):
                    print(f"  {true_lvl} -> {pred_lvl or 'NONE'}: {count}")
        else:
            print(
                "\nNo ground-truth labels found (pass --labels a_csv_file.csv or name files "
                "like 'LEVEL_3_sample1.jpg') — classification accuracy was not computed, "
                "only status/quality distribution above."
            )

    finally:
        db.close()


if __name__ == "__main__":
    evaluate_accuracy_cli()
