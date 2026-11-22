import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from dependencies import SessionLocal as dependency_session_local
from main import app
from routers import auth, users

@pytest.fixture
def test_db():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
    )

    Base.metadata.create_all(bind=test_engine)

    original_auth_session = auth.SessionLocal
    original_users_session = users.SessionLocal
    original_dependency_session = dependency_session_local

    auth.SessionLocal = TestingSessionLocal
    users.SessionLocal = TestingSessionLocal

    import dependencies
    dependencies.SessionLocal = TestingSessionLocal

    try:
        yield TestingSessionLocal
    finally:
        auth.SessionLocal = original_auth_session
        users.SessionLocal = original_users_session
        dependencies.SessionLocal = original_dependency_session
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@pytest.fixture
def client(test_db):
    with TestClient(app) as test_client:
        yield test_client