from sqlalchemy.orm import Session
from app.models.chemical_test import ChemicalTest


class TestRepository:
    __test__ = False  # Prevent pytest from attempting to collect this as a test class

    def __init__(self, db: Session):
        self.db = db

    def get_by_code(self, code: str) -> ChemicalTest | None:
        return self.db.query(ChemicalTest).filter(ChemicalTest.code == code, ChemicalTest.active.is_(True)).first()

    def get_all(self) -> list[ChemicalTest]:
        return self.db.query(ChemicalTest).filter(ChemicalTest.active.is_(True)).all()

    def create(self, code: str, name: str, description: str | None = None, incubation_seconds: int = 300, incubation_tolerance: int = 15) -> ChemicalTest:
        test = ChemicalTest(
            code=code,
            name=name,
            description=description,
            incubation_seconds=incubation_seconds,
            incubation_tolerance=incubation_tolerance,
        )
        self.db.add(test)
        self.db.commit()
        self.db.refresh(test)
        return test
