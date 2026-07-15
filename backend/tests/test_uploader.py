import datetime
import hashlib
import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from modules import Session
from modules.models import UploadSession, UploadRecord
from modules.auth import User

@pytest.fixture(autouse=True)
def cleanup_upload_test_records():
    db = Session()

    test_link_uuid = "55340765-5e4f-4215-a416-05fe0b0a12f4"

    try:
        db.query(UploadSession).filter(UploadSession.link_uuid == test_link_uuid).delete(synchronize_session=False)

        db.query(UploadRecord).filter(UploadRecord.link_uuid == test_link_uuid).delete(synchronize_session=False)

        db.commit()

        yield

    finally:
        db.query(UploadSession).filter(UploadSession.link_uuid == test_link_uuid).delete(synchronize_session=False)

        db.query(UploadRecord).filter(UploadRecord.link_uuid == test_link_uuid).delete(synchronize_session=False)

        db.commit()
        db.close()

@pytest.fixture
def upload_test_setup(monkeypatch, tmp_path):
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_US", "fake")
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_EU", "fake")
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_ITAR", "fake")

    sys.modules.pop("modules.uploader", None)

    from modules import uploader

    app = FastAPI()
    app.include_router(uploader.router)

    fake_link_record = uploader.LinkRecord(
        uuid="55340765-5e4f-4215-a416-05fe0b0a12f4",
        case_id="AIS-1234",
        itar=False,
        users_with_access=["testuser"],
        timestamp=datetime.datetime.now(),
        expired=False,
    )

    monkeypatch.setattr(
        uploader,
        "find_link_entry",
        lambda *a, **k: fake_link_record,
    )

    storage = uploader.LocalStorageProvider(
        base_path=str(tmp_path / "us")
    )

    monkeypatch.setattr(
        uploader,
        "usFileStorageProvider",
        storage
    )

    monkeypatch.setattr(
        uploader,
        "euFileStorageProvider",
        storage
    )

    monkeypatch.setattr(
        uploader,
        "itarFileStorageProvider",
        storage
    )

    return app, storage, tmp_path, uploader

def test_resumable_upload_flow(monkeypatch, tmp_path):
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_US", "fake")
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_EU", "fake")
    os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING_ITAR", "fake")

    sys.modules.pop("modules.uploader", None)

    from modules import uploader

    app = FastAPI()
    app.include_router(uploader.router)

    fake_link_record = uploader.LinkRecord(
        uuid="55340765-5e4f-4215-a416-05fe0b0a12f4",
        case_id="AIS-1234",
        itar=False,
        users_with_access=["testuser"],
        timestamp=datetime.datetime.now(),
        expired=False,
    )

    monkeypatch.setattr(
        uploader,
        "find_link_entry",
        lambda *a, **k: fake_link_record,
    )

    storage = uploader.LocalStorageProvider(
        base_path=str(tmp_path / "us")
    )

    monkeypatch.setattr(
        uploader,
        "usFileStorageProvider",
        storage
    )

    monkeypatch.setattr(
        uploader,
        "euFileStorageProvider",
        storage
    )

    monkeypatch.setattr(
        uploader,
        "itarFileStorageProvider",
        storage
    )

    with TestClient(app) as client:

        payload = b"hello world"

        file_hash = hashlib.sha256(payload).hexdigest()

  
        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": file_hash,
                "X-File-Size": str(len(payload)),
                "X-User-Location": "US",
            },
        )

        assert response.status_code == 200

        start_body = response.json()

        assert "uploadToken" in start_body
        assert start_body["chunkSize"] == 32 * 1024 * 1024

        upload_token = start_body["uploadToken"]


        

        chunk_hash = hashlib.sha256(payload).hexdigest()

        response = client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{upload_token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": chunk_hash,
            },
        )

        assert response.status_code == 200

        chunk_body = response.json()

        assert chunk_body["received"] == len(payload)
        assert chunk_body["offset"] == 0
        assert chunk_body["hash"] == chunk_hash
        assert chunk_body["ranges"] == [[0, len(payload)]]



        response = client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{upload_token}/complete"
        )

        assert response.status_code == 200

        complete_body = response.json()

        assert complete_body["filename"] == "hello.txt"
        assert complete_body["size"] == len(payload)
        assert complete_body["sha256"] == file_hash
        assert complete_body["completed"] is True


    stored_file = (
        Path(tmp_path)
        / "us"
        / "AIS-1234"
        / "hello.txt"
    )

    assert stored_file.exists()
    assert stored_file.read_bytes() == payload

def test_upload_start_missing_filename(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    with TestClient(app) as client:
        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Hash": hashlib.sha256(b"hello").hexdigest(),
                "X-File-Size": "5",
            },
        )

    assert response.status_code == 400
    assert "x-file-name" in response.json()["detail"].lower()


def test_upload_start_missing_hash(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    with TestClient(app) as client:
        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Size": "5",
            },
        )

    assert response.status_code == 400
    assert "hash" in response.json()["detail"].lower()


def test_upload_invalid_uuid(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    with TestClient(app) as client:
        response = client.post(
            "/uploadfile/not-a-uuid/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(b"hello").hexdigest(),
                "X-File-Size": "5",
            },
        )

    assert response.status_code == 400


def test_chunk_hash_mismatch(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello world"

    with TestClient(app) as client:

        start = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": "wronghash",
            },
        )

    assert response.status_code == 400
    assert "hash mismatch" in response.json()["detail"].lower()


def test_status_after_start(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.get(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{token}/status"
        )

    body = response.json()

    assert response.status_code == 200
    assert body["receivedSize"] == 0
    assert body["completed"] is False


def test_complete_without_upload_fails(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{token}/complete"
        )

    assert response.status_code == 400
    assert "incomplete" in response.json()["detail"].lower()


def test_duplicate_chunk_does_not_duplicate_range(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        headers = {
            "X-Chunk-Offset": "0",
            "X-Chunk-Size": str(len(payload)),
            "X-Chunk-Hash": hashlib.sha256(payload).hexdigest(),
        }

        client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{token}",
            content=payload,
            headers=headers,
        )

        response = client.post(
            f"/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/{token}",
            content=payload,
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["ranges"] == [[0, len(payload)]]


def test_filename_collision_creates_new_name(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    storage.prepare_file("AIS-1234/hello.txt", 5)

    payload = b"hello"

    with TestClient(app) as client:

        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
            },
        )

    assert response.status_code == 200

    session = Session().query(UploadSession).filter(
        UploadSession.link_uuid == "55340765-5e4f-4215-a416-05fe0b0a12f4"
    ).first()

    assert session.blob_name != "hello.txt"


def test_upload_eu_region(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        response = client.post(
            "/uploadfile/55340765-5e4f-4215-a416-05fe0b0a12f4/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": hashlib.sha256(payload).hexdigest(),
                "X-File-Size": str(len(payload)),
                "X-User-Location": "EU",
            },
        )

    assert response.status_code == 200

    session = Session().query(UploadSession).filter(
        UploadSession.link_uuid == "55340765-5e4f-4215-a416-05fe0b0a12f4"
    ).first()

    assert session.storage_region.value == "eu"