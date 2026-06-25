import hashlib
import os
import sys
from types import SimpleNamespace

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


class FakeBlobClient:
    def __init__(self, blob_name):
        self.blob_name = blob_name
        self.url = f"http://localhost/{blob_name}"
        self.uploaded = None

    def exists(self):
        return False

    def upload_blob(self, contents, overwrite=False):
        self.uploaded = contents

    def download_blob(self):
        class FakeDownload:
            def __init__(self, data):
                self._data = data

            def readall(self):
                return self._data

        return FakeDownload(self.uploaded or b"")


class FakeContainerClient:
    def create_container(self):
        return None

    def get_blob_client(self, blob_name):
        return FakeBlobClient(blob_name)


class FakeBlobServiceClient:
    def __init__(self, *args, **kwargs):
        self.account_name = "devstoreaccount1"
        self.credential = SimpleNamespace(account_key="fake-key")

    def get_container_client(self, container_name):
        return FakeContainerClient()

    @classmethod
    def from_connection_string(cls, connection_string):
        return cls()


def test_verify_and_test_uploader_endpoint(monkeypatch):
    os.environ.setdefault("TENANT_ID", "tenant-id")
    os.environ.setdefault("CLIENT_ID", "client-id")
    os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING", "UseDevelopmentStorage=true")

    import azure.storage.blob as azure_blob_module

    monkeypatch.setattr(azure_blob_module, "BlobServiceClient", FakeBlobServiceClient)
    monkeypatch.setattr(azure_blob_module, "generate_blob_sas", lambda **kwargs: "sas-token")

    sys.modules.pop("modules.uploader", None)

    from modules import uploader

    monkeypatch.setattr(uploader, "ensure_uploads_table", lambda *args, **kwargs: None)
    monkeypatch.setattr(uploader, "session", FakeSession())
    monkeypatch.setattr(uploader, "blob_service_client", FakeBlobServiceClient())
    monkeypatch.setattr(uploader, "container_client", FakeContainerClient())

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


