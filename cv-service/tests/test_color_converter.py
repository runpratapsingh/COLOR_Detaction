import pytest
import numpy as np
from app.services.color_converter import ColorConverter
from app.services.delta_e import DeltaEService


def test_color_converter_rgb_lab_roundtrip():
    rgb_in = (220, 150, 170)
    lab = ColorConverter.rgb_to_lab(np.uint8([[[rgb_in[0], rgb_in[1], rgb_in[2]]]]))[0][0]

    # Verify CIE Lab ranges
    assert 0 <= lab[0] <= 100  # L*
    assert -128 <= lab[1] <= 127  # a*
    assert -128 <= lab[2] <= 127  # b*

    # Roundtrip conversion back to RGB
    rgb_out = ColorConverter.lab_to_rgb(lab[0], lab[1], lab[2])
    assert abs(rgb_in[0] - rgb_out[0]) <= 2
    assert abs(rgb_in[1] - rgb_out[1]) <= 2
    assert abs(rgb_in[2] - rgb_out[2]) <= 2


def test_delta_e_identical_colors():
    lab1 = (75.0, 15.0, 10.0)
    lab2 = (75.0, 15.0, 10.0)
    de = DeltaEService.delta_e_2000(lab1, lab2)
    assert de == 0.0


def test_delta_e_known_difference():
    lab1 = (50.0, 2.5, 0.0)
    lab2 = (73.0, 25.0, -10.0)
    de = DeltaEService.delta_e_2000(lab1, lab2)
    assert 15.0 <= de <= 30.0
