import os
import pytest
from app.services.analysis_service import AnalysisService


def test_analysis_service_standalone(sample_synthetic_bottle_image):
    img_bytes, _ = sample_synthetic_bottle_image
    analyzer = AnalysisService(db=None)

    res = analyzer.analyze(image_bytes=img_bytes, debug=True)

    assert "analysis_id" in res
    assert "status" in res
    assert "quality" in res
    assert res["quality"]["overall"] > 0.0
    assert "detected_color" in res
    assert "rgb" in res["detected_color"]
    assert "lab" in res["detected_color"]
    assert "debug_artifacts" in res


def test_api_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "ok"


def test_api_analyze_endpoint(client, sample_synthetic_bottle_image):
    img_bytes, _ = sample_synthetic_bottle_image

    response = client.post(
        "/api/v1/color-tests/analyze",
        files={"image": ("test_bottle.jpg", img_bytes, "image/jpeg")},
        data={"debug": "true"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["SUCCESS", "RETAKE_IMAGE", "AMBIGUOUS_RESULT", "NO_MATCH_FOUND"]
    assert "quality" in data
    assert "detected_color" in data
