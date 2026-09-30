import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.color_converter import ColorConverter
from app.services.delta_e import DeltaEService
from app.services.in_memory_store import in_memory_store
from app.services.reference_matcher import ReferenceMatcher


@pytest.fixture
def client():
    return TestClient(app)


def test_color_converter_cielab_d65_values():
    """Verify standard sRGB to CIE L*a*b* conversion matches CIE D65 2° expectations."""
    # Pure White (255, 255, 255) -> L* ≈ 100, a* ≈ 0, b* ≈ 0
    white_rgb = np.uint8([[[255, 255, 255]]])
    lab_white = ColorConverter.rgb_to_lab(white_rgb)[0][0]
    assert pytest.approx(lab_white[0], abs=1.0) == 100.0
    assert pytest.approx(lab_white[1], abs=1.0) == 0.0
    assert pytest.approx(lab_white[2], abs=1.0) == 0.0

    # Pure Black (0, 0, 0) -> L* ≈ 0, a* ≈ 0, b* ≈ 0
    black_rgb = np.uint8([[[0, 0, 0]]])
    lab_black = ColorConverter.rgb_to_lab(black_rgb)[0][0]
    assert pytest.approx(lab_black[0], abs=1.0) == 0.0

    # Strong Orange (237, 138, 58) -> L* ~64.8, a* ~31.9, b* ~56.4
    orange_rgb = np.uint8([[[237, 138, 58]]])
    lab_orange = ColorConverter.rgb_to_lab(orange_rgb)[0][0]
    assert 60.0 <= lab_orange[0] <= 70.0
    assert 25.0 <= lab_orange[1] <= 40.0
    assert 50.0 <= lab_orange[2] <= 65.0


def test_delta_e_ciede2000_known_pairs():
    """Verify CIEDE2000 delta E calculations."""
    # Identical colors must have ΔE = 0.0
    lab1 = (65.0, 32.0, 56.0)
    assert DeltaEService.delta_e_2000(lab1, lab1) == 0.0

    # Perceptible subtle difference
    lab2 = (66.0, 33.0, 57.0)
    de = DeltaEService.delta_e_2000(lab1, lab2)
    assert 0.5 <= de <= 2.5


def test_reference_matcher_strong_match():
    """Verify reference matcher accurately selects closest standard with STRONG match quality."""
    matcher = ReferenceMatcher(min_separation=1.5, max_acceptable_delta=25.0)
    standards = in_memory_store.get_standards_for_test("IRON_001")

    # Sample color identical to Iron 2 mg/L (#D9573F -> Lab ~52.8, 49.3, 41.7)
    target_std = next(s for s in standards if s.id == "IRON_2")
    sample_lab = (target_std.lab_l, target_std.lab_a, target_std.lab_b)

    res = matcher.match_standards(sample_lab, standards)
    assert res["matched_standard"]["id"] == "IRON_2"
    assert res["delta_e_00"] == 0.0
    assert res["match_quality"] == "STRONG"
    assert res["is_ambiguous"] is False
    assert len(res["standard_distances"]) == 5


def test_reference_matcher_ambiguous_result():
    """Verify ambiguous flag when sample falls between two close standards."""
    matcher = ReferenceMatcher(min_separation=2.0)
    standards = [
        {"id": "STD_A", "name": "Standard A", "concentration": 1.0, "unit": "mg/L", "reference_color": {"lab": {"l": 50.0, "a": 20.0, "b": 30.0}}},
        {"id": "STD_B", "name": "Standard B", "concentration": 2.0, "unit": "mg/L", "reference_color": {"lab": {"l": 50.5, "a": 20.5, "b": 30.5}}},
    ]
    # Sample point right between them
    sample_lab = (50.25, 20.25, 30.25)
    res = matcher.match_standards(sample_lab, standards)
    assert res["is_ambiguous"] is True
    assert res["match_quality"] == "AMBIGUOUS"


def test_api_list_tests(client):
    """Test GET /api/v1/tests returns chemical tests catalog."""
    resp = client.get("/api/v1/tests")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    iron_test = next((t for t in data if t["test_id"] == "IRON_001"), None)
    assert iron_test is not None
    assert iron_test["name"] == "Iron Concentration Test"
    assert iron_test["unit"] == "mg/L"
    assert iron_test["standards_count"] == 5


def test_api_get_test_detail(client):
    """Test GET /api/v1/tests/IRON_001 returns full specifications."""
    resp = client.get("/api/v1/tests/IRON_001")
    assert resp.status_code == 200
    test = resp.json()
    assert test["test_id"] == "IRON_001"
    assert len(test["procedure"]) == 5
    assert len(test["reagents"]) >= 1
    assert len(test["standards"]) == 5
    assert test["standards"][0]["concentration"] == 0.0
    assert test["standards"][2]["concentration"] == 2.0


def test_api_test_specific_analyze_endpoint(client):
    """Test POST /api/v1/tests/IRON_001/analyze with synthetic valid bottle image."""
    h, w = 800, 600
    # Create realistic neutral background with vertical orange bottle
    img = np.full((h, w, 3), 245, dtype=np.uint8)  # White/light gray neutral background
    # Bottle body in center
    bx1, by1, bx2, by2 = 180, 120, 420, 680
    # Draw bottle outer outline
    cv2.rectangle(img, (bx1, by1), (bx2, by2), (200, 200, 200), -1)
    # Liquid region inside bottle: Strong reddish-orange (Iron 2 mg/L: R=217, G=87, B=63 -> BGR: 63, 87, 217)
    lx1, ly1, lx2, ly2 = bx1 + 30, by1 + 220, bx2 - 30, by2 - 80
    img[ly1:ly2, lx1:lx2] = (63, 87, 217)

    # Encode to PNG
    _, buf = cv2.imencode(".png", img)
    file_bytes = io.BytesIO(buf.tobytes())

    response = client.post(
        "/api/v1/tests/IRON_001/analyze",
        files={"image": ("test_bottle.png", file_bytes, "image/png")},
        data={"incubation_seconds": 300, "white_balance_method": "NONE"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["test_id"] == "IRON_001"
    assert "quality" in data
    assert "classification" in data


def test_weighted_core_color_extraction_stability():
    """Verify that ColorExtractor weights the central optical liquid core and rejects edge glare."""
    from app.services.color_extractor import ColorExtractor

    h, w = 400, 300
    img = np.full((h, w, 3), 245, dtype=np.uint8)

    # Core liquid column: Pure Iron reaction (BGR: 50, 80, 220 -> RGB: 220, 80, 50)
    lx1, ly1, lx2, ly2 = 80, 100, 220, 300
    img[ly1:ly2, lx1:lx2] = (50, 80, 220)

    # Add washed-out edge refraction pixels on outer 10 pixels of left/right
    img[ly1:ly2, lx1:lx1 + 12] = (150, 160, 230)
    img[ly1:ly2, lx2 - 12:lx2] = (150, 160, 230)

    # Add a specular glare penumbra strip (high brightness, low saturation: V=240, S=30)
    img[ly1 + 20:ly1 + 40, lx1 + 20:lx1 + 35] = (235, 235, 240)

    liquid_mask = np.zeros((h, w), dtype=np.uint8)
    liquid_mask[ly1:ly2, lx1:lx2] = 255

    extractor = ColorExtractor()
    extracted = extractor.extract(img, liquid_mask)

    # The weighted median RGB must match the core reaction color (R~220, G~80, B~50),
    # not corrupted by the faded edges or glare.
    assert extracted["valid_pixel_percentage"] > 70.0
    assert abs(extracted["rgb"]["r"] - 220) <= 5
    assert abs(extracted["rgb"]["g"] - 80) <= 5
    assert abs(extracted["rgb"]["b"] - 50) <= 5

