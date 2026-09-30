class SystemBaseException(Exception):
    """Base exception for chemical color detection system."""
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ImageValidationError(SystemBaseException):
    """Raised when uploaded image fails format, dimension, or corruption checks."""
    pass


class TestNotFoundError(SystemBaseException):
    """Raised when chemical test code is not found in database."""
    pass


class CalibrationError(SystemBaseException):
    """Raised when reference calibration process fails."""
    pass


class AnalysisExecutionError(SystemBaseException):
    """Raised when an internal error occurs during computer vision pipeline execution."""
    pass
