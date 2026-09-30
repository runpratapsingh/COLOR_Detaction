import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Chemical Liquid Color Detection System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./chemical_color.db"

    # Image Validation
    MIN_IMAGE_WIDTH: int = 400
    MIN_IMAGE_HEIGHT: int = 400
    MAX_FILE_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    # Quality Thresholds
    BLUR_THRESHOLD: float = 100.0  # Variance of Laplacian minimum
    MAX_UNDEREXPOSED_PERCENTAGE: float = 30.0  # % dark pixels < 15
    MAX_OVEREXPOSED_PERCENTAGE: float = 30.0  # % bright pixels > 240
    MAX_REFLECTION_PERCENTAGE: float = 30.0  # % specular highlight pixels
    MIN_VALID_PIXEL_PERCENTAGE: float = 30.0  # % valid pixels in liquid ROI
    MAX_ROI_COLOR_VARIATION_DELTA_E: float = 25.0  # max ΔE between top/center/bottom ROIs in ambient lighting
    MIN_QUALITY_SCORE: float = 50.0  # 0-100 threshold for SUCCESS vs RETAKE

    # Color Science & Matching
    MAX_ACCEPTABLE_DELTA_E: float = 25.0
    MIN_CLASS_SEPARATION_DELTA_E: float = 1.5  # min (2nd best ΔE - best ΔE) to avoid AMBIGUOUS_RESULT

    # ROI Guides (MODE A Default Normalized Coordinates: x_min, y_min, x_max, y_max)
    DEFAULT_BOTTLE_ROI: tuple[float, float, float, float] = (0.25, 0.15, 0.75, 0.85)
    DEFAULT_LIQUID_INNER_MARGIN: float = 0.10  # 10% inset from bottle edges to avoid refraction
    # Max fraction of the frame a detected bottle bbox may cover before it's distrusted for ROI
    # placement. On real cluttered backgrounds, Canny edge-closing frequently merges background
    # clutter into one large contour touching the frame border (observed: 60-73% of frame, always
    # starting at/near (0,0)) — a real handheld bottle at normal photo distance rarely covers that
    # much of a busy scene, so above this cap we fall back to the static default guide instead.
    MAX_TRUSTED_BOTTLE_BBOX_AREA_FRACTION: float = 0.85

    # Capture Validation Thresholds (outdoor field use)
    MAX_BACKGROUND_LAB_A: float = 18.0  # max |a*| for background to be considered neutral (was 12 — too strict for indoor lighting)
    MAX_BACKGROUND_LAB_B: float = 18.0  # max |b*| for background to be considered neutral (was 12 — warm fluorescent light hits ~14-16)
    # White-balance only corrects color CAST, not absolute brightness (see color_normalizer.py).
    # Bounding the white-paper background's L* to a consistent, well-lit band means every
    # accepted photo starts from roughly the same exposure level, which is what actually makes
    # repeat readings of the same liquid land close to each other.
    MIN_BACKGROUND_LAB_L: float = 55.0  # background too dim/shadowed for a consistent reading
    MAX_BACKGROUND_LAB_L: float = 99.0  # background blown out / clipped (well-lit white paper is ~92-97)
    MIN_BOTTLE_FRAME_FRACTION: float = 0.015  # min bottle bbox area / frame area (supports small vials)
    MAX_BOTTLE_FRAME_FRACTION: float = 0.90  # max bottle bbox area / frame area (supports close-ups)
    MIN_EDGE_MARGIN_FRACTION: float = 0.01  # min gap between bottle bbox edge and frame edge

    # White Balance
    DEFAULT_WHITE_BALANCE_METHOD: str = "REFERENCE_PATCH"
    # Optional ABSOLUTE brightness (0-255) to normalize the background patch to, instead of just
    # balancing R/G/B against each other. Left as None by default: the safe default only removes
    # color CAST (uses the patch's own mean as the target, gains bounded 0.70-1.40, matching the
    # original behavior). Setting this to a number (e.g. 200) additionally locks exposure across
    # shots, but pale/near-white liquids (high channel values) can clip and hue-shift under a
    # large gain — verified against your actual reference standards before enabling in production.
    WHITE_BALANCE_TARGET_GRAY_LEVEL: float | None = None
    WHITE_BALANCE_MIN_GAIN: float = 0.70
    WHITE_BALANCE_MAX_GAIN: float = 1.40

    # Storage paths
    DEBUG_ARTIFACTS_DIR: str = "./debug_artifacts"
    DATASETS_DIR: str = "./datasets"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
