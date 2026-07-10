import datetime
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
    fake_link_record = uploader.LinkRecord(uuid="55340765-5e4f-4215-a416-05fe0b0a12f4", case_id="AIS-1234", itar=False, users_with_access=["testuser"], timestamp=datetime.datetime.now())
    monkeypatch.setattr(uploader, "find_link_entry", lambda *a, **k: fake_link_record)
    monkeypatch.setattr(uploader, "usFileStorageProvider", uploader.LocalStorageProvider(base_path=str(tmp_path / "us")))

    async def override_get_current_active_user():
        return uploader.User(username="testuser", disabled=False)

    app = FastAPI()
    app.include_router(uploader.router)
    app.dependency_overrides[uploader.getCurrentActiveUser] = override_get_current_active_user

    with TestClient(app) as client:
        payload = b"hello world"
        file_hash = hashlib.sha256(payload).hexdigest()
        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4",
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

    stored_file = Path(tmp_path) / "us"/ "AIS-1234" / "hello.txt"
    assert stored_file.exists()


