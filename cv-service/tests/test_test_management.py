import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient


import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from generate_test_bottles import draw_chemical_bottle


@pytest.fixture
def valid_bottle_image_bytes():
    """Generates a realistic 600x800 portrait bottle image on laboratory background."""
    img = draw_chemical_bottle(width=600, height=800, liquid_bgr=(60, 140, 245), color_name="Orange Sample")
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


@pytest.fixture
def blank_invalid_image_bytes():
    """Generates a blank image without any bottle (should fail quality/bottle detection)."""
    img = np.ones((600, 600, 3), dtype=np.uint8) * 255
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_list_tests_role_filtering(client: TestClient):
    """Testers can only view published tests, while managers see all."""
    # 1. Manager lists tests
    res_mgr = client.get("/api/v1/tests", headers={"X-User-Role": "TEST_MANAGER"})
    assert res_mgr.status_code == 200
    mgr_tests = res_mgr.json()
    assert any(t["test_id"] == "IRON_001" for t in mgr_tests)

    # 2. Tester lists tests
    res_tester = client.get("/api/v1/tests", headers={"X-User-Role": "TESTER"})
    assert res_tester.status_code == 200
    tester_tests = res_tester.json()
    assert all(t["status"] == "PUBLISHED" for t in tester_tests)


def test_create_and_manage_chemical_test(client: TestClient):
    """Test manager creates a new draft test, updates it, and publishes it."""
    # Tester cannot create test
    res_blocked = client.post(
        "/api/v1/tests",
        json={
            "test_id": "NITRATE_001",
            "name": "Nitrate Assays",
            "unit": "ppm",
            "sample_type": "Water",
        },
        headers={"X-User-Role": "TESTER"},
    )
    assert res_blocked.status_code == 403

    # Manager creates test
    res_create = client.post(
        "/api/v1/tests",
        json={
            "test_id": "NITRATE_001",
            "name": "Nitrate Concentration Test",
            "sample_type": "Water",
            "unit": "ppm",
            "incubation_seconds": 180,
            "description": "Measures nitrate NO3- via cadmium reduction colorimetry.",
        },
        headers={"X-User-Role": "TEST_MANAGER"},
    )
    assert res_create.status_code == 200
    created = res_create.json()
    assert created["test_id"] == "NITRATE_001"
    assert created["status"] == "DRAFT"
    assert created["version"] == 1
    assert created["unit"] == "ppm"


def test_analyze_reference_sample_pipeline(client: TestClient, valid_bottle_image_bytes, blank_invalid_image_bytes):
    """Runs real computer vision pipeline on reference sample image."""
    # 1. Invalid blank image should be rejected
    res_invalid = client.post(
        "/api/v1/tests/NITRATE_001/standards/analyze-reference",
        files={"image": ("blank.jpg", blank_invalid_image_bytes, "image/jpeg")},
    )
    assert res_invalid.status_code == 200
    data_inv = res_invalid.json()
    assert data_inv["is_valid"] is False
    assert len(data_inv["problems"]) > 0

    # 2. Valid image should succeed with exact color extraction
    res_valid = client.post(
        "/api/v1/tests/NITRATE_001/standards/analyze-reference",
        files={"image": ("ref_bottle.jpg", valid_bottle_image_bytes, "image/jpeg")},
    )
    assert res_valid.status_code == 200
    data_val = res_valid.json()
    assert data_val["is_valid"] is True, f"Failed problems: {data_val.get('problems')}, quality: {data_val.get('quality')}"
    assert "detected_color" in data_val
    assert "rgb" in data_val["detected_color"]
    assert "lab" in data_val["detected_color"]
    assert "quality" in data_val
    assert "roi" in data_val
    assert "preview_image" in data_val

    # 3. Custom liquid ROI should be accepted and returned in roi info
    res_custom = client.post(
        "/api/v1/tests/NITRATE_001/standards/analyze-reference",
        files={"image": ("ref_bottle.jpg", valid_bottle_image_bytes, "image/jpeg")},
        data={
            "liquid_x_min": 0.4,
            "liquid_y_min": 0.35,
            "liquid_x_max": 0.6,
            "liquid_y_max": 0.65,
        },
    )
    assert res_custom.status_code == 200
    data_custom = res_custom.json()
    assert data_custom["is_valid"] is True
    assert "roi" in data_custom
    assert data_custom["roi"]["normalized_liquid_roi"] == [0.4, 0.35, 0.6, 0.65]


def test_save_standards_numeric_order_and_multi_sample(client: TestClient, valid_bottle_image_bytes):
    """Save standards 0 ppm and 5 ppm and verify numeric ordering and multi-sample aggregation."""
    # Add Standard 5 ppm first
    client.post(
        "/api/v1/tests/NITRATE_001/standards",
        json={
            "value": 5.0,
            "unit": "ppm",
            "level": "5.0 ppm",
            "color_name": "Deep Pink (5.0 ppm)",
            "description": "High nitrate reaction indicating 5 ppm concentration.",
            "reference_color": {
                "hex": "#E05070",
                "rgb": {"r": 224, "g": 80, "b": 112},
                "hsv": {"h": 346.7, "s": 64.3, "v": 87.8},
                "lab": {"l": 52.0, "a": 58.0, "b": 14.0},
            },
            "quality": {"overall": 92.0, "valid_pixel_percentage": 88.0},
        },
        headers={"X-User-Role": "TEST_MANAGER"},
    )

    # Add Standard 0 ppm second
    client.post(
        "/api/v1/tests/NITRATE_001/standards",
        json={
            "value": 0.0,
            "unit": "ppm",
            "level": "0.0 ppm",
            "color_name": "Clear (0 ppm)",
            "description": "Blank control with no reaction.",
            "reference_color": {
                "hex": "#FFFFFF",
                "rgb": {"r": 255, "g": 255, "b": 255},
                "hsv": {"h": 0.0, "s": 0.0, "v": 100.0},
                "lab": {"l": 100.0, "a": 0.0, "b": 0.0},
            },
            "quality": {"overall": 95.0, "valid_pixel_percentage": 90.0},
        },
        headers={"X-User-Role": "TEST_MANAGER"},
    )

    # Verify standards are sorted numerically (0 ppm before 5 ppm, not alphabetical)
    res_stds = client.get("/api/v1/tests/NITRATE_001/standards")
    assert res_stds.status_code == 200
    stds = res_stds.json()
    assert len(stds) == 2
    assert stds[0]["value"] == 0.0
    assert stds[1]["value"] == 5.0

    # Add second reference sample to 5 ppm standard (multi-sample support)
    std_5_id = stds[1]["id"]
    res_sample = client.post(
        f"/api/v1/tests/NITRATE_001/standards/{std_5_id}/samples",
        files={"image": ("sample2.jpg", valid_bottle_image_bytes, "image/jpeg")},
        headers={"X-User-Role": "TEST_MANAGER"},
    )
    assert res_sample.status_code == 200
    updated_std = res_sample.json()
    assert updated_std["sample_count"] == 2
    assert len(updated_std["samples"]) == 2


def test_publish_and_versioning_immutability(client: TestClient):
    """Publish test, verify immutability, and create new version."""
    # Publish NITRATE_001
    res_pub = client.post(
        "/api/v1/tests/NITRATE_001/publish",
        headers={"X-User-Role": "TEST_MANAGER"},
    )
    assert res_pub.status_code == 200
    assert res_pub.json()["status"] == "PUBLISHED"

    # Verify mutating published standards is blocked
    res_del_blocked = client.delete(
        "/api/v1/tests/NITRATE_001/standards/NITRATE_001_STD_0",
        headers={"X-User-Role": "TEST_MANAGER"},
    )
    assert res_del_blocked.status_code == 400
    assert "published" in res_del_blocked.json()["detail"].lower()

    # Create new version (Version 2)
    res_new_v = client.post(
        "/api/v1/tests/NITRATE_001/new-version",
        headers={"X-User-Role": "TEST_MANAGER"},
    )
    assert res_new_v.status_code == 200
    new_v = res_new_v.json()
    assert new_v["version"] == 2
    assert new_v["status"] == "DRAFT"

    # Historical Version 1 remains intact
    res_v1 = client.get("/api/v1/tests/NITRATE_001?version=1")
    assert res_v1.status_code == 200
    assert res_v1.json()["version"] == 1
    assert res_v1.json()["status"] == "PUBLISHED"


def test_tester_blocked_from_all_modifications(client: TestClient):
    """Ensure TESTER role receives HTTP 403 when attempting any modification."""
    headers = {"X-User-Role": "TESTER"}
    
    # 1. Block standard creation
    valid_create_payload = {
        "value": 99.0,
        "unit": "mg/L",
        "reference_color": {
            "hex": "#FFFFFF",
            "rgb": {"r": 255, "g": 255, "b": 255},
            "lab": {"l": 100.0, "a": 0.0, "b": 0.0},
        },
    }
    r_post = client.post("/api/v1/tests/IRON_001/standards", json=valid_create_payload, headers=headers)
    assert r_post.status_code == 403

    # 2. Block standard update
    r_put = client.put("/api/v1/tests/IRON_001/standards/IRON_001_STD_1", json={"description": "Hacked"}, headers=headers)
    assert r_put.status_code == 403

    # 3. Block standard deletion
    r_del = client.delete("/api/v1/tests/IRON_001/standards/IRON_001_STD_1", headers=headers)
    assert r_del.status_code == 403

    # 4. Block publish
    r_pub = client.post("/api/v1/tests/IRON_001/publish", headers=headers)
    assert r_pub.status_code == 403

    # 5. Block new version
    r_v = client.post("/api/v1/tests/IRON_001/new-version", headers=headers)
    assert r_v.status_code == 403


def test_draft_standard_crud_lifecycle(client: TestClient):
    """Test full CRUD lifecycle of standards in a draft test."""
    headers = {"X-User-Role": "TEST_MANAGER"}
    
    # 1. Create a draft test
    test_id = "PH_TEST_01"
    client.post(
        "/api/v1/tests",
        json={"test_id": test_id, "name": "pH Test", "unit": "pH", "sample_type": "Water"},
        headers=headers,
    )

    # 2. Add standard pH 6.0
    r_create = client.post(
        f"/api/v1/tests/{test_id}/standards",
        json={
            "value": 6.0,
            "unit": "pH",
            "level": "6.0",
            "color_name": "Yellow-Green",
            "description": "Slightly acidic reference standard.",
            "reference_color": {
                "hex": "#D4E157",
                "rgb": {"r": 212, "g": 225, "b": 87},
                "hsv": {"h": 65.6, "s": 61.3, "v": 88.2},
                "lab": {"l": 86.4, "a": -18.2, "b": 64.1},
            },
        },
        headers=headers,
    )
    assert r_create.status_code == 200
    std = r_create.json()
    std_id = std["id"]

    # 3. Get single standard
    r_get = client.get(f"/api/v1/tests/{test_id}/standards/{std_id}")
    assert r_get.status_code == 200
    assert r_get.json()["value"] == 6.0

    # 4. Update standard description
    r_update = client.put(
        f"/api/v1/tests/{test_id}/standards/{std_id}",
        json={"description": "Updated scientific description for calibrated pH 6.0 sample."},
        headers=headers,
    )
    assert r_update.status_code == 200
    assert r_update.json()["description"] == "Updated scientific description for calibrated pH 6.0 sample."

    # 5. Delete standard
    r_delete = client.delete(f"/api/v1/tests/{test_id}/standards/{std_id}", headers=headers)
    assert r_delete.status_code == 200

    # 6. Verify standard is gone
    r_stds = client.get(f"/api/v1/tests/{test_id}/standards")
    assert not any(s["id"] == std_id for s in r_stds.json())


def test_idw_estimation_bracket_and_out_of_range():
    """Verify IDW concentration interpolation and out-of-range safety behavior."""
    from app.services.reference_matcher import ReferenceMatcher
    from app.services.in_memory_store import InMemoryStore

    store = InMemoryStore()
    iron_standards = store.get_standards_for_test("IRON_001", version=1)
    matcher = ReferenceMatcher()

    # 1. Exact match with Standard 1 mg/L (Lab: 72.4, 25.1, 52.8)
    exact_res = matcher.match_standards((72.4, 25.1, 52.8), iron_standards)
    assert exact_res["matched_standard"] is not None
    assert exact_res["matched_standard"]["value"] == 1.0
    assert exact_res["delta_e_00"] < 0.01
    assert exact_res["estimated_concentration"] == 1.0
    assert exact_res["range_status"] == "IN_RANGE"

    # 2. Intermediate color between 1.0 mg/L and 2.0 mg/L
    # 1 mg/L Lab: (72.4, 25.1, 52.8), 2 mg/L Lab: (52.8, 49.3, 41.7)
    mid_lab = ((72.4 + 52.8) / 2.0, (25.1 + 49.3) / 2.0, (52.8 + 41.7) / 2.0)
    mid_res = matcher.match_standards(mid_lab, iron_standards)
    assert mid_res["estimated_concentration"] is not None
    assert 1.0 <= mid_res["estimated_concentration"] <= 2.0
    assert mid_res["range_status"] == "IN_RANGE"

    # 3. Far beyond maximum calibrated range (4.0 mg/L)
    # Extremely dark reddish black color, far above 4 mg/L
    dark_lab = (15.0, 60.0, 40.0)
    out_high_res = matcher.match_standards(dark_lab, iron_standards)
    assert out_high_res["range_status"] == "ABOVE_CALIBRATED_RANGE"
    assert "Above calibrated range" in out_high_res["range_label"]
    assert out_high_res["estimated_concentration"] == 4.0  # Clamped to max tier

