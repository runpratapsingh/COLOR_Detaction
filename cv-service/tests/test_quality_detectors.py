import numpy as np
import cv2
from app.services.blur_detector import BlurDetector
from app.services.exposure_detector import ExposureDetector
from app.services.reflection_detector import ReflectionDetector


def test_blur_detector_sharp_vs_blurry():
    # Sharp image with high frequency edges
    sharp_img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.rectangle(sharp_img, (50, 50), (250, 250), (255, 255, 255), -1)

    # Blurry image created with heavy Gaussian blur
    blurry_img = cv2.GaussianBlur(sharp_img, (51, 51), 0)

    blur_det = BlurDetector(threshold=100.0)
    sharp_res = blur_det.analyze(sharp_img)
    blurry_res = blur_det.analyze(blurry_img)

    assert sharp_res["laplacian_variance"] > blurry_res["laplacian_variance"]
    assert blurry_res["is_blurry"] is True


def test_exposure_detector_overexposed_underexposed():
    underexposed_img = np.ones((200, 200, 3), dtype=np.uint8) * 5
    overexposed_img = np.ones((200, 200, 3), dtype=np.uint8) * 253

    exp_det = ExposureDetector()
    under_res = exp_det.analyze(underexposed_img)
    over_res = exp_det.analyze(overexposed_img)

    assert under_res["is_underexposed"] is True
    assert over_res["is_overexposed"] is True


def test_reflection_detector_specular_highlight():
    img = np.ones((200, 200, 3), dtype=np.uint8) * 100
    # Add specular white spot (high V, 0 S)
    img[80:120, 80:120] = [255, 255, 255]

    refl_det = ReflectionDetector()
    res = refl_det.analyze(img)

    assert res["reflection_percentage"] > 0.0
    assert res["reflection_mask"][100, 100] == 255


def test_object_detector():
    from app.services.object_detector import ObjectDetector
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    # Draw a tall bottle contour in center
    cv2.rectangle(img, (140, 60), (260, 340), (200, 200, 200), -1)

    detector = ObjectDetector()
    res = detector.detect(img)

    assert res.is_bottle is True
    assert res.primary_object == "bottle"
    assert res.confidence >= 0.45
