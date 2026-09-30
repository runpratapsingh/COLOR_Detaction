from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.analyze import router as analyze_router
from app.api.v1.tests import router as tests_router
from app.api.v1.references import router as references_router
from app.api.v1.calibration import router as calibration_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(analyze_router)
api_v1_router.include_router(tests_router)
api_v1_router.include_router(references_router)
api_v1_router.include_router(calibration_router)
