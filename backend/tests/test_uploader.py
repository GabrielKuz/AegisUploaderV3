import datetime
import os
import sys
from pathlib import Path

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from blake3 import blake3
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from modules import Session
from modules.models import UploadSession, UploadRecord, UploadChunk


TEST_LINK_UUID = "55340765-5e4f-4215-a416-05fe0b0a12f4"


def blake3_hash(data: bytes) -> str:
    return blake3(data).hexdigest()


@pytest.fixture(autouse=True)
def cleanup_upload_test_records():

    db = Session()

    try:
        db.query(UploadChunk).filter(
            UploadChunk.upload_id.in_(
                db.query(UploadSession.upload_id).filter(
                    UploadSession.link_uuid == TEST_LINK_UUID
                )
            )
        ).delete(
            synchronize_session=False
        )

        db.query(UploadSession).filter(
            UploadSession.link_uuid == TEST_LINK_UUID
        ).delete(
            synchronize_session=False
        )

        db.query(UploadRecord).filter(
            UploadRecord.link_uuid == TEST_LINK_UUID
        ).delete(
            synchronize_session=False
        )

        db.commit()

        yield

    finally:

        try:
            db.rollback()

            db.query(UploadChunk).filter(UploadChunk.upload_id.in_(db.query(UploadSession.upload_id).filter(
                        UploadSession.link_uuid == TEST_LINK_UUID
                    ))).delete(synchronize_session=False)

            db.query(UploadSession).filter(UploadSession.link_uuid == TEST_LINK_UUID).delete(synchronize_session=False)

            db.query(UploadRecord).filter(UploadRecord.link_uuid == TEST_LINK_UUID).delete(synchronize_session=False)

            db.commit()

        finally:
            db.close()

@pytest.fixture
def upload_test_setup(monkeypatch, tmp_path):

    os.environ.setdefault(
        "AZURE_STORAGE_CONNECTION_STRING_US",
        "fake"
    )

    os.environ.setdefault(
        "AZURE_STORAGE_CONNECTION_STRING_EU",
        "fake"
    )

    os.environ.setdefault(
        "AZURE_STORAGE_CONNECTION_STRING_ITAR",
        "fake"
    )

    sys.modules.pop("modules.uploader", None)

    from modules import uploader

    app = FastAPI()
    app.include_router(uploader.router)

    fake_link_record = uploader.LinkRecord(
        uuid=TEST_LINK_UUID,
        case_id="AIS-1234",
        itar=False,
        users_with_access=["testuser"],
        timestamp=datetime.datetime.now(datetime.timezone.utc),
        expiration_date=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=48),
        expired=False,
    )

    monkeypatch.setattr(
        uploader,
        "find_link_entry",
        lambda *args, **kwargs: fake_link_record,
    )

    storage = uploader.LocalStorageProvider(
        base_path=str(tmp_path / "us")
    )

    monkeypatch.setattr(
        uploader,
        "usFileStorageProvider",
        storage,
    )

    monkeypatch.setattr(
        uploader,
        "euFileStorageProvider",
        storage,
    )

    monkeypatch.setattr(
        uploader,
        "itarFileStorageProvider",
        storage,
    )

    return app, storage, tmp_path, uploader


def test_resumable_upload_flow(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello world"

    file_hash = blake3_hash(payload)

    with TestClient(app) as client:

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
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

        token = start_body["uploadToken"]

        chunk_hash = blake3_hash(payload)

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
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
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert response.status_code == 200

        complete_body = response.json()

        assert complete_body["filename"] == "hello.txt"
        assert complete_body["size"] == len(payload)
        assert complete_body["file_hash"] == file_hash
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
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Hash": blake3_hash(b"hello"),
                "X-File-Size": "5",
            },
        )

    assert response.status_code == 400
    assert "x-file-name" in response.json()["detail"].lower()


def test_upload_start_missing_hash(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    with TestClient(app) as client:

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
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
                "X-File-Hash": blake3_hash(b"hello"),
                "X-File-Size": "5",
            },
        )

    assert response.status_code == 400


def test_chunk_hash_mismatch(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello world"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
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
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.get(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/status"
        )

    body = response.json()

    assert response.status_code == 200
    assert body["receivedSize"] == 0
    assert body["completed"] is False
    assert body["expectedSize"] == len(payload)


def test_complete_without_upload_fails(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

    assert response.status_code == 400
    assert "incomplete" in response.json()["detail"].lower()


def test_duplicate_chunk_does_not_duplicate_range(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        headers = {
            "X-Chunk-Offset": "0",
            "X-Chunk-Size": str(len(payload)),
            "X-Chunk-Hash": blake3_hash(payload),
        }

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers=headers,
        )

        assert first.status_code == 200

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers=headers,
        )

    assert second.status_code == 200
    assert second.json()["ranges"] == [[0, len(payload)]]

@pytest.mark.asyncio
async def test_filename_collision_creates_new_name(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    await storage.prepare_file(
        "AIS-1234/hello.txt",
        5,
    )

    payload = b"hello"

    with TestClient(app) as client:

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

    assert response.status_code == 200

    db = Session()

    try:
        session = db.query(UploadSession).filter(
            UploadSession.link_uuid == TEST_LINK_UUID
        ).first()

        assert session is not None
        assert session.blob_name != "hello.txt"

    finally:
        db.close()


def test_upload_eu_region(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
                "X-User-Location": "EU",
            },
        )

    assert response.status_code == 200

    db = Session()

    try:

        session = db.query(UploadSession).filter(
            UploadSession.link_uuid == TEST_LINK_UUID
        ).first()

        assert session is not None
        assert session.storage_region.value == "eu"

    finally:
        db.close()


def test_complete_rejects_wrong_merkle_hash(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": "incorrecthash",
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        upload = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": blake3_hash(payload),
            },
        )

        assert upload.status_code == 200

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

    assert response.status_code == 400
    assert "hash" in response.json()["detail"].lower()


def test_multi_chunk_merkle_completion(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    chunk_size = 32 * 1024 * 1024

    chunk_one = b"a" * chunk_size
    chunk_two = b"b" * 100

    expected_hash = uploader.compute_merkle_root(
        [
            blake3_hash(chunk_one),
            blake3_hash(chunk_two),
        ]
    )

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "large.bin",
                "X-File-Hash": expected_hash,
                "X-File-Size": str(len(chunk_one) + len(chunk_two)),
            },
        )

        assert start.status_code == 200

        token = start.json()["uploadToken"]

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_one,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(chunk_one)),
                "X-Chunk-Hash": blake3_hash(chunk_one),
            },
        )

        assert first.status_code == 200

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_two,
            headers={
                "X-Chunk-Offset": str(len(chunk_one)),
                "X-Chunk-Size": str(len(chunk_two)),
                "X-Chunk-Hash": blake3_hash(chunk_two),
            },
        )

        assert second.status_code == 200

        complete = client.post(f"/uploadfile/{TEST_LINK_UUID}/{token}/complete")

    assert complete.status_code == 200

    body = complete.json()

    assert body["completed"] is True
    assert body["file_hash"] == expected_hash
    assert body["size"] == len(chunk_one) + len(chunk_two)

def test_resume_upload_after_partial_completion(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    chunk_one = b"a" * (32 * 1024 * 1024)
    chunk_two = b"b" * 100

    expected_hash = uploader.compute_merkle_root(
        [
            blake3_hash(chunk_one),
            blake3_hash(chunk_two),
        ]
    )

    with TestClient(app) as client:
        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "resume.bin",
                "X-File-Hash": expected_hash,
                "X-File-Size": str(len(chunk_one) + len(chunk_two)),
            },
        )

        assert start.status_code == 200

        token = start.json()["uploadToken"]

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_one,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(chunk_one)),
                "X-Chunk-Hash": blake3_hash(chunk_one),
            },
        )

        assert first.status_code == 200

        status = client.get(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/status"
        )

        assert status.status_code == 200

        body = status.json()

        assert body["receivedRanges"] == [[0, len(chunk_one)]]
        assert body["receivedSize"] == len(chunk_one)

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_two,
            headers={
                "X-Chunk-Offset": str(len(chunk_one)),
                "X-Chunk-Size": str(len(chunk_two)),
                "X-Chunk-Hash": blake3_hash(chunk_two),
            },
        )

        assert second.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert complete.status_code == 200


def test_chunks_can_upload_out_of_order(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    chunk_one = b"a" * (32 * 1024 * 1024)
    chunk_two = b"b" * 100

    expected_hash = uploader.compute_merkle_root(
        [
            blake3_hash(chunk_one),
            blake3_hash(chunk_two),
        ]
    )

    with TestClient(app) as client:
        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "out_of_order.bin",
                "X-File-Hash": expected_hash,
                "X-File-Size": str(len(chunk_one) + len(chunk_two)),
            },
        )

        token = start.json()["uploadToken"]

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_two,
            headers={
                "X-Chunk-Offset": str(len(chunk_one)),
                "X-Chunk-Size": str(len(chunk_two)),
                "X-Chunk-Hash": blake3_hash(chunk_two),
            },
        )

        assert second.status_code == 200

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_one,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(chunk_one)),
                "X-Chunk-Hash": blake3_hash(chunk_one),
            },
        )

        assert first.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert complete.status_code == 200

        body = complete.json()

        assert body["completed"] is True


def test_complete_rejects_missing_chunk(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    chunk_one = b"a" * (32 * 1024 * 1024)
    chunk_two = b"b" * 100

    expected_hash = uploader.compute_merkle_root(
        [
            blake3_hash(chunk_one),
            blake3_hash(chunk_two),
        ]
    )

    with TestClient(app) as client:
        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "missing_chunk.bin",
                "X-File-Hash": expected_hash,
                "X-File-Size": str(len(chunk_one) + len(chunk_two)),
            },
        )

        token = start.json()["uploadToken"]

        upload = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_two,
            headers={
                "X-Chunk-Offset": str(len(chunk_one)),
                "X-Chunk-Size": str(len(chunk_two)),
                "X-Chunk-Hash": blake3_hash(chunk_two),
            },
        )

        assert upload.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

    assert complete.status_code == 400
    assert "incomplete" in complete.json()["detail"].lower()


def test_duplicate_offset_with_different_hash_rejected(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload_one = b"hello"
    payload_two = b"world"

    with TestClient(app) as client:
        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "duplicate_offset.bin",
                "X-File-Hash": blake3_hash(payload_one),
                "X-File-Size": str(len(payload_one)),
            },
        )

        token = start.json()["uploadToken"]

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload_one,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload_one)),
                "X-Chunk-Hash": blake3_hash(payload_one),
            },
        )

        assert first.status_code == 200

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload_two,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload_two)),
                "X-Chunk-Hash": blake3_hash(payload_two),
            },
        )

    assert second.status_code == 409


def test_upload_after_completion_fails(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:
        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "completed.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        upload = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": blake3_hash(payload),
            },
        )

        assert upload.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert complete.status_code == 200

        retry = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": blake3_hash(payload),
            },
        )

    assert retry.status_code == 400
    assert "completed" in retry.json()["detail"].lower()


def test_upload_itar_region(upload_test_setup, monkeypatch):
    app, storage, tmp_path, uploader = upload_test_setup

    fake_link_record = uploader.LinkRecord(
        uuid=TEST_LINK_UUID,
        case_id="AIS-1234",
        itar=True,
        users_with_access=["testuser"],
        timestamp=datetime.datetime.now(),
        expiration_date=datetime.datetime.now() + datetime.timedelta(hours=48),
        expired=False,
    )

    monkeypatch.setattr(
        uploader,
        "find_link_entry",
        lambda *args, **kwargs: fake_link_record,
    )

    payload = b"itar data"

    with TestClient(app) as client:
        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "itar.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

    assert response.status_code == 200

    db = Session()

    try:
        session = db.query(UploadSession).filter(
            UploadSession.link_uuid == TEST_LINK_UUID
        ).first()

        assert session is not None
        assert session.itar_status is True
        assert session.storage_region.value == "itar"

    finally:
        db.close()


def test_concurrent_filename_collision(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "report.pdf",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "report.pdf",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

    assert first.status_code == 200
    assert second.status_code == 200

    db = Session()

    try:
        sessions = db.query(UploadSession).filter(
            UploadSession.link_uuid == TEST_LINK_UUID
        ).all()

        filenames = [
            session.blob_name
            for session in sessions
        ]

        assert len(filenames) == 2
        assert len(set(filenames)) == 2

    finally:
        db.close()

def test_resume_upload_after_interruption(upload_test_setup):
    app, storage, tmp_path, uploader = upload_test_setup

    chunk_one = b"a" * (32 * 1024 * 1024)
    chunk_two = b"b" * 100

    full_hash = uploader.compute_merkle_root(
        [
            blake3_hash(chunk_one),
            blake3_hash(chunk_two),
        ]
    )

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "resume.bin",
                "X-File-Hash": full_hash,
                "X-File-Size": str(len(chunk_one) + len(chunk_two)),
            },
        )

        assert start.status_code == 200

        token = start.json()["uploadToken"]

        first = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_one,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(chunk_one)),
                "X-Chunk-Hash": blake3_hash(chunk_one),
            },
        )

        assert first.status_code == 200

        status = client.get(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/status"
        )

        assert status.status_code == 200

        body = status.json()

        assert body["receivedSize"] == len(chunk_one)
        assert body["completed"] is False

        # simulate interruption here

        second = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=chunk_two,
            headers={
                "X-Chunk-Offset": str(len(chunk_one)),
                "X-Chunk-Size": str(len(chunk_two)),
                "X-Chunk-Hash": blake3_hash(chunk_two),
            },
        )

        assert second.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert complete.status_code == 200


def test_upload_with_wrong_token_fails(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    with TestClient(app) as client:

        response = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/not-a-real-token",
            content=b"hello",
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Hash": blake3_hash(b"hello"),
            },
        )

    assert response.status_code in (400, 404)


def test_upload_token_cannot_be_used_with_other_link(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    fake_other_link = "55340765-5e4f-4215-a416-05fe0b0a12f5"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(b"hello"),
                "X-File-Size": "5",
            },
        )

        token = start.json()["uploadToken"]

        response = client.post(
            f"/uploadfile/{fake_other_link}/{token}",
            content=b"hello",
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": "5",
                "X-Chunk-Hash": blake3_hash(b"hello"),
            },
        )

    assert response.status_code in (400, 404)


def test_filename_path_traversal_is_sanitized(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "../../secret.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        assert start.status_code == 200

        token = start.json()["uploadToken"]

        upload = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": blake3_hash(payload),
            },
        )

        assert upload.status_code == 200

        complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert complete.status_code == 200

    db = Session()

    try:
        session = db.query(UploadSession).filter(
            UploadSession.upload_token == token
        ).first()

        assert session is not None

        assert "/" not in session.blob_name
        assert "\\" not in session.blob_name

    finally:
        db.close()


def test_complete_endpoint_cannot_be_called_twice(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "hello.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        upload = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}",
            content=payload,
            headers={
                "X-Chunk-Offset": "0",
                "X-Chunk-Size": str(len(payload)),
                "X-Chunk-Hash": blake3_hash(payload),
            },
        )

        assert upload.status_code == 200

        first_complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

        assert first_complete.status_code == 200

        second_complete = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/{token}/complete"
        )

    assert second_complete.status_code == 400
    assert "already completed" in second_complete.json()["detail"].lower()


def test_concurrent_duplicate_chunk_uploads_are_safe(upload_test_setup):

    app, storage, tmp_path, uploader = upload_test_setup

    payload = b"hello world"

    with TestClient(app) as client:

        start = client.post(
            f"/uploadfile/{TEST_LINK_UUID}/start",
            headers={
                "X-File-Name": "concurrent.txt",
                "X-File-Hash": blake3_hash(payload),
                "X-File-Size": str(len(payload)),
            },
        )

        token = start.json()["uploadToken"]

        barrier = threading.Barrier(2)

        def upload_chunk():

            with TestClient(app) as thread_client:

                barrier.wait()

                return thread_client.post(
                    f"/uploadfile/{TEST_LINK_UUID}/{token}",
                    content=payload,
                    headers={
                        "X-Chunk-Offset": "0",
                        "X-Chunk-Size": str(len(payload)),
                        "X-Chunk-Hash": blake3_hash(payload),
                    },
                )

        with ThreadPoolExecutor(max_workers=2) as executor:

            results = list(
                executor.map(
                    lambda _: upload_chunk(),
                    range(2),
                )
            )

    statuses = [
        response.status_code
        for response in results
    ]

    assert all(
        status in (200, 400, 409)
        for status in statuses
    )

    db = Session()

    try:
        upload = db.query(UploadSession).filter(
            UploadSession.upload_token == token
        ).first()
        chunks = db.query(UploadChunk).filter(
            UploadChunk.upload_id == upload.upload_id
        ).all()

        assert len(chunks) <= 1

    finally:
        db.close()