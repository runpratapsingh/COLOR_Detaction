import numpy as np
from skimage import color


class DeltaEService:
    """Calculates CIEDE2000 color difference (ΔE 2000) between CIE Lab color pairs."""

    @staticmethod
    def delta_e_2000(
        lab1: tuple[float, float, float] | list[float] | np.ndarray,
        lab2: tuple[float, float, float] | list[float] | np.ndarray,
        kl: float = 1.0,
        kc: float = 1.0,
        kh: float = 1.0,
    ) -> float:
        """
        Calculates CIEDE2000 distance between two CIE Lab points.
        lab1, lab2: (L*, a*, b*) tuples with L* in [0,100], a*,b* in [-128,127].
        """
        lab1_arr = np.array([[[lab1[0], lab1[1], lab1[2]]]], dtype=np.float64)
        lab2_arr = np.array([[[lab2[0], lab2[1], lab2[2]]]], dtype=np.float64)

        de = color.deltaE_ciede2000(lab1_arr, lab2_arr, kL=kl, kC=kc, kH=kh)
        return float(round(de[0][0], 2))
