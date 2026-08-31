import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# ── Single shared in-memory SQLite connection ─────────────────────────────────
#
# SQLite :memory: databases are per-connection: each new connection gets an
# empty database.  To share one in-memory DB across all sessions in a test run
# we must use a single connection and route all sessions through it.

TEST_DATABASE_URL = "sqlite:///:memory:"

# One engine, one connection for the whole session
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Reuse the same underlying connection for every session
_connection = test_engine.connect()

# Create all tables on that connection
Base.metadata.create_all(bind=_connection)

# Bind a sessionmaker to the shared connection
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=_connection,
)


def override_get_db():
    """FastAPI dependency override — yields a session on the shared connection."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    # Tables are already created at module import time (see above).
    # This fixture exists so other test modules can declare it as a dependency.
    yield


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
