import os
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg:///:memory:")
os.environ.setdefault("CLIENT_ID", "test-client-id")
os.environ.setdefault("TENANT_ID", "test-tenant")

from modules.auth import User, getCurrentActiveUser
from modules.deletionRequest import router as deletion_request_router


app = FastAPI()
app.include_router(deletion_request_router)


async def override_get_current_active_user() -> User:
    return User(username="testuser", disabled=False)


app.dependency_overrides[getCurrentActiveUser] = override_get_current_active_user


# def test_request_for_deletion_returns_200_and_echoes_uuid():
#     client = TestClient(app)
#     link_uuid = "4ac22a0a-d5e1-4ad5-a5be-051d10d5e27a"

    

#     response = client.post(f"/requestfordeletion/{link_uuid}")

#     assert response.status_code == 200
#     assert link_uuid in response.text
