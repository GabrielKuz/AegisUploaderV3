import hashlib
import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


class FakeSession:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, record):
        self.added.append(record)

    def commit(self):
        self.committed = True

    def query(self, model):
        return self

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None
    
    def rollback(self):
        pass


def test_verify_and_test_uploader_endpoint(monkeypatch, tmp_path):
    os.environ.setdefault("TENANT_ID", "tenant-id")
    os.environ.setdefault("CLIENT_ID", "client-id")
    os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

    sys.modules.pop("modules.uploader", None)

    from modules import uploader

    monkeypatch.setattr(uploader, "STORAGE_ROOT", Path(tmp_path))

    monkeypatch.setattr(uploader, "ensure_uploads_table", lambda *a, **k: None)
    monkeypatch.setattr(uploader, "session", FakeSession())

    async def override_get_current_active_user():
        return uploader.User(username="testuser", disabled=False)

    app = FastAPI()
    app.include_router(uploader.router)
    app.dependency_overrides[uploader.getCurrentActiveUser] = override_get_current_active_user

    with TestClient(app) as client:
        payload = b"hello world"
        file_hash = hashlib.sha256(payload).hexdigest()
        response = client.post(
            "/uploadfile/test-link",
            files={"file": ("hello.txt", payload, "text/plain")},
            headers={"X-File-Hash": file_hash},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "hello.txt"
    assert body["content_type"] == "text/plain"
    assert body["size"] == len(payload)
    assert body["server_hash"] == file_hash
    assert body["blob_hash"] == file_hash

    stored_file = Path(tmp_path) / "us" / "hello.txt"
    assert stored_file.exists()


