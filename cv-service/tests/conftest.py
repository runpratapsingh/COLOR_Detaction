import os
import sys
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.models.base import Base, get_db


TEST_DATABASE_URL = "sqlite:///./test_chemical_color.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_chemical_color.db"):
        os.remove("./test_chemical_color.db")


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sample_synthetic_bottle_image():
    """Generates a synthetic 600x600 BGR image of a bottle with a light pink liquid."""
    img = np.ones((600, 600, 3), dtype=np.uint8) * 240  # Neutral gray background

    # Draw bottle outline (transparent bottle)
    # Liquid region in bottle: Pink (RGB: 220, 160, 180 -> BGR: 180, 160, 220)
    img[120:500, 180:420] = [180, 160, 220]

    # Convert to JPEG bytes
    _, buffer = cv2.imencode(".jpg", img)
    return buffer.tobytes(), img
