# Production-Grade Chemical Liquid Color Detection System

A production-oriented Python 3.11+ / FastAPI application that analyzes photographs of transparent or semi-transparent bottles containing chemically reacted liquid under uncontrolled lighting conditions and determines color classification using deterministic Computer Vision and CIE Lab / CIEDE2000 Color Science.

The system aggressively assesses image quality (blur, exposure, specular highlights/reflections, spatial color uniformity) and **prefers rejection (`RETAKE_IMAGE`) over returning an unreliable classification**.

---

## Technical Architecture & Pipeline

```text
IMAGE UPLOAD (JPEG / PNG / WEBP)
  │
  ▼
1. Image Loader & EXIF Orientation Auto-Correction
  │
  ▼
2. Image Validation (Dimensions, corruption, file size)
  │
  ▼
3. Image Quality Engine
     ├─ Blur Detector (Variance of Laplacian)
     ├─ Exposure Detector (Luminance histogram, shadow/highlight clipping)
     └─ Reflection Detector (Specular highlight mask via HSV & local contrast)
  │
  ▼
4. ROI Extraction Engine
     ├─ Bottle ROI (Normalized bounding guide)
     ├─ Safe Liquid ROI (Inner margin excluding cap, neck, bottom & refraction)
     └─ Multi-ROI Spatial Split (Center vs Bottom liquid column uniformity)
  │
  ▼
5. Pixel Filtering & Illumination Normalization
     ├─ Filter out specular reflections, clipped shadows/highlights
     └─ White Balance Strategy (Gray-World, Shades-of-Gray, None, Reference-Patch)
  │
  ▼
6. Robust Color Extraction
     ├─ RGB (mean, median, std)
     ├─ HSV (median H, S, V and spread)
     └─ CIE Lab (median L*, a*, b* standard D65/2° illuminant)
  │
  ▼
7. Reference Matching & Color Science
     ├─ Incubation time verification (required_incubation_seconds ± tolerance)
     ├─ CIEDE2000 ΔE calculation against database reference colors
     ├─ Best ΔE & Second-Best ΔE comparison (Class separation calculation)
     └─ Ambiguity check (Separation threshold)
  │
  ▼
8. Quality & Confidence Evaluation Engine
     ├─ Quality Score calculation (Blur, Exposure, Reflection, Uniformity)
     ├─ Rejection Engine (RETAKE_IMAGE if thresholds fail)
     └─ Confidence Engine (Heuristic/Calibrated confidence estimation)
  │
  ▼
9. Response & Debug Artifact Generation
     ├─ REST API Response JSON (SUCCESS, RETAKE_IMAGE, AMBIGUOUS_RESULT, etc.)
     └─ Diagnostic Visualizations & Debug Artifacts (when debug=true)
```

---

## Setup & Running

### 1. Local Virtual Environment

```bash
cd cv-service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start API Server

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API documentation available at `http://localhost:8000/docs`.

### 3. Docker Container

```bash
docker-compose up --build
```

---

## API Endpoints

### 1. Analyze Liquid Color

`POST /api/v1/color-tests/analyze` (or `POST /api/v1/analyze`)

**Form-Data Fields:**
- `image`: File (JPEG, PNG, WEBP)
- `test_code`: String (optional, e.g., `"CHEM_001"`)
- `incubation_seconds`: Integer (optional, e.g., `300`)
- `device_model`: String (optional)
- `white_balance_method`: String (`"NONE"`, `"GRAY_WORLD"`, `"SHADES_OF_GRAY"`, `"REFERENCE_PATCH"`)
- `debug`: Boolean (`true` / `false`)

**Example Success Response (`200 OK`):**

```json
{
  "analysis_id": "a6a35be6-42cf-4610-b62d-fa085b853d77",
  "status": "SUCCESS",
  "test": {
    "code": "CHEM_001"
  },
  "detected_color": {
    "name": "TEAL",
    "rgb": {
      "r": 31,
      "g": 166,
      "b": 160
    },
    "hsv": {
      "h": 178.0,
      "s": 81.2,
      "v": 65.1
    },
    "lab": {
      "L": 61.74,
      "a": -35.02,
      "b": -6.75
    }
  },
  "classification": {
    "level": "LEVEL_1",
    "delta_e_2000": 0.0,
    "second_best_delta_e": 28.5,
    "confidence": 92.0
  },
  "quality": {
    "overall": 80.1,
    "blur": 90.4,
    "exposure": 73.9,
    "reflection": 46.6,
    "roi_uniformity": 100.0,
    "valid_pixel_percentage": 78.65
  },
  "warnings": [],
  "recommendations": [
    "Use a plain white or neutral-gray background for consistent measurement."
  ]
}
```

**Example Rejection Response (`RETAKE_IMAGE`):**

```json
{
  "analysis_id": "93d5b8f8-732e-4e11-b2c1-8edb89dcb993",
  "status": "RETAKE_IMAGE",
  "confidence": 0.0,
  "quality": {
    "overall": 41.2,
    "blur": 45.0,
    "exposure": 30.0,
    "reflection": 20.0,
    "roi_uniformity": 60.0,
    "valid_pixel_percentage": 22.5
  },
  "reasons": [
    "EXCESSIVE_REFLECTION",
    "UNDEREXPOSED"
  ],
  "recommendations": [
    "Avoid direct overhead lighting or camera flash that causes specular glare on bottle.",
    "Increase room lighting or move bottle to a better-lit area."
  ]
}
```

---

## Database & CLI Utility Scripts

### Seed & Calibrate Reference Colors

```bash
python scripts/create_reference.py --test-code CHEM_001 --level LEVEL_1 --color-name TEAL --images ../test-images/bottle-chemical-teal.png
```

### Analyze Dataset Images

```bash
python scripts/analyze_dataset.py --dir ../test-images --test-code CHEM_001 --debug
```

### Run Accuracy Evaluation

```bash
python scripts/evaluate_accuracy.py --test-code CHEM_001 --dir ../test-images
```

### View Calibration Report

```bash
python scripts/calibration_report.py
```

---

## Running Test Suite

Run unit and integration tests:

```bash
pytest -v
```
