import io
from PIL import Image, ImageOps
import numpy as np
import cv2

from app.core.config import settings
from app.core.exceptions import ImageValidationError


class ImageLoader:
    """Loads, validates, and auto-corrects EXIF orientation for input images."""

    @staticmethod
    def load_from_bytes(image_bytes: bytes) -> tuple[np.ndarray, dict]:
        """
        Decodes image bytes, applies EXIF orientation transpose, and returns (bgr_array, metadata).
        """
        if not image_bytes:
            raise ImageValidationError("Empty image payload provided")

        if len(image_bytes) > settings.MAX_FILE_SIZE_BYTES:
            raise ImageValidationError(
                f"Image file size ({len(image_bytes)} bytes) exceeds max limit of {settings.MAX_FILE_SIZE_BYTES} bytes"
            )

        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            pil_img.verify()  # Check for corruption
            pil_img = Image.open(io.BytesIO(image_bytes))  # Reopen after verify()
            fmt = pil_img.format
        except Exception as e:
            raise ImageValidationError(f"Invalid or corrupted image format: {str(e)}")

        # Auto-correct EXIF orientation
        try:
            pil_img = ImageOps.exif_transpose(pil_img)
        except Exception:
            pass

        # Convert to RGB array, then BGR for OpenCV compatibility
        rgb_arr = np.array(pil_img.convert("RGB"))
        bgr_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)

        h, w = bgr_arr.shape[:2]

        if w < settings.MIN_IMAGE_WIDTH or h < settings.MIN_IMAGE_HEIGHT:
            raise ImageValidationError(
                f"Image dimensions ({w}x{h}) are lower than minimum required ({settings.MIN_IMAGE_WIDTH}x{settings.MIN_IMAGE_HEIGHT})"
            )

        metadata = {
            "format": fmt,
            "width": w,
            "height": h,
            "channels": bgr_arr.shape[2] if len(bgr_arr.shape) > 2 else 1,
            "size_bytes": len(image_bytes),
        }

        return bgr_arr, metadata

    @staticmethod
    def load_from_path(file_path: str) -> tuple[np.ndarray, dict]:
        """Loads image directly from local file path."""
        with open(file_path, "rb") as f:
            content = f.read()
        return ImageLoader.load_from_bytes(content)
