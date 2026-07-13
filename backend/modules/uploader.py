from io import BytesIO
import os
import datetime
import hashlib
import traceback
import traceback
import psycopg
import uuid
import re
import sqlalchemy

from sqlalchemy.orm import Session
from Utils import IsUUID
from pathlib import Path
from typing import Annotated, Literal

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON, text
from sqlalchemy import or_
from modules.StorageProvider import StorageProvider, AzureFileStorageProvider, LocalStorageProvider
from warnings import warn, deprecated
from modules import usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider, STORAGE_ROOT
from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from modules import Session
from fastapi import Request
from modules.auth import getCurrentActiveUser, User, requireRoles
from modules.models import Base, StorageRegion, UploadRecord, LinkRecord, UploadSession

router = APIRouter()
#session = Session()

def get_db():
    db = Session()

    try:
        yield db
    finally:
        db.close()

def hash_bytes(data: bytes) -> str: # Used to check file integrity
    """Return the SHA-256 hash for the provided bytes."""
    return hashlib.sha256(data).hexdigest()


def validate_file_hash(contents: bytes, file_hash_clientside: str | None) -> str: # Used to check file integrity
    """Validate that the client-side hash matches the payload and return the computed hash."""
    if not file_hash_clientside:
        raise ValueError("X-File-Hash header is required")

    normalized_client_hash = file_hash_clientside.strip().lower() # remove whitespace and make lowercase for comparison
    computed_hash = hash_bytes(contents)
    if normalized_client_hash != computed_hash:
        raise ValueError(f"File hash mismatch, expected client side hash - {normalized_client_hash}, but got {computed_hash}")

    return computed_hash

@deprecated("Replaced by create_tables.py at startup time")
def ensure_uploads_table(db_session):
    """Create the uploads table if it does not exist using the provided session's bind."""
    engine = db_session.get_bind()
    # Create only the uploads table if missing
    Base.metadata.create_all(bind=engine, tables=[UploadRecord.__table__])


def find_link_entry(link_uuid: str, db):
    try:
        return db.query(LinkRecord).filter(LinkRecord.uuid == link_uuid).first()
    except psycopg.errors.InvalidTextRepresentation as e:
        return None

# Set up all 3 azure regions
US_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING_US")
EU_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING_EU")
ITAR_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING_ITAR")

AZURE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER", "mycontainer")

if not US_CONNECTION_STRING:
    raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING_US is required")

if not EU_CONNECTION_STRING:
    raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING_EU is required")

if not ITAR_CONNECTION_STRING:
    raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING_ITAR is required")

# us_blob_service = BlobServiceClient.from_connection_string(US_CONNECTION_STRING)
# eu_blob_service = BlobServiceClient.from_connection_string(EU_CONNECTION_STRING)
# itar_blob_service = BlobServiceClient.from_connection_string(ITAR_CONNECTION_STRING)

# itar_container = itar_blob_service.get_container_client(AZURE_CONTAINER_NAME)
# us_container = us_blob_service.get_container_client(AZURE_CONTAINER_NAME)
# eu_container = eu_blob_service.get_container_client(AZURE_CONTAINER_NAME)

# for container in (us_container, eu_container, itar_container): # Create all 3 containers
#     try:
#         container.create_container() 
#     except ResourceExistsError:
#         pass

@router.post("/uploadfile/{link_uuid}/start")
async def start_upload(
    link_uuid: str,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)],
    filename: Annotated[str | None, Header(alias="X-File-Name")] = None,
    file_hash: Annotated[str | None, Header(alias="X-File-Hash")] = None,
    file_size: Annotated[int | None, Header(alias="X-File-Size")] = None,
    userLocation: Literal["US", "EU"] = Header(default="US", alias="X-User-Location"),
    
):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    if not filename:
        raise HTTPException(status_code=400, detail="X-File-Name header required")

    if not file_hash:
        raise HTTPException(status_code=400, detail="X-File-Hash header required")

    if file_size is None or file_size < 0:
        raise HTTPException(status_code=400, detail="X-File-Size header required")

    try:
        link_entry = find_link_entry(link_uuid, db)
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=404, detail="Unable to find link entry. Please check the link UUID and try again.")

    if link_entry is None:
        raise HTTPException(status_code=404, detail="Link not found")

    if link_entry.expired:
        raise HTTPException(status_code=410, detail="This link has expired and is no longer available for uploads")

    itar_status = bool(link_entry.itar) if link_entry else False

    if itar_status:
        service_client = itarFileStorageProvider
        storage_region = StorageRegion.ITAR
    elif userLocation == "EU":
        service_client = euFileStorageProvider
        storage_region = StorageRegion.EU
    else:
        service_client = usFileStorageProvider
        storage_region = StorageRegion.US

    path_filename = Path(filename).name # deal with dir traversal and get just the filename
    blob_name = path_filename

    chunk_size = 32 * 1024 * 1024

    try:
        with db.begin():

            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": str(link_entry.uuid)}
            )

            path_obj = Path(blob_name)
            stem = path_obj.stem
            suffix = path_obj.suffix
            counter = 1

            while True:
                exists_in_storage = service_client.exists(f"{link_entry.case_id}/{blob_name}")

                exists_in_db = (
                    db.query(UploadSession).filter(
                        UploadSession.link_uuid == link_entry.uuid,
                        UploadSession.blob_name == blob_name,
                    ).first() is not None
                )

                if not exists_in_storage and not exists_in_db:
                    break

                if suffix:
                    blob_name = f"{stem}_{counter}{suffix}"
                else:
                    blob_name = f"{stem}_{counter}"

                counter += 1

            upload_session = UploadSession(
                link_uuid=link_entry.uuid,
                case_id=link_entry.case_id,
                blob_name=blob_name,
                original_filename=filename,
                content_type=None,
                expected_size=file_size,
                expected_sha256=file_hash.strip().lower(),
                received_ranges=[],
                received_size=0,
                chunk_size=chunk_size,
                completed=False,
                itar_status=itar_status,
                storage_region=storage_region,
            )

            db.add(upload_session)

            db.flush()

            upload_token = upload_session.upload_token

    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Failed to create upload session"
        )

    try:
        service_client.prepare_file(f"{link_entry.case_id}/{blob_name}", file_size)

    except Exception:
        try:
            db.delete(upload_session)
            db.commit()
        except Exception:
            traceback.print_exc()

        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to prepare storage")
    
    return {
        "uploadToken": upload_token,
        "chunkSize": chunk_size,
    }

@router.post("/uploadfile/{link_uuid}/{upload_token}")
async def upload_file_chunk(
    link_uuid: str,
    upload_token: str,
    request: Request,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)],
    chunk_offset: Annotated[int | None, Header(alias="X-Chunk-Offset")] = None,
    chunk_size: Annotated[int | None, Header(alias="X-Chunk-Size")] = None,
    chunk_hash: Annotated[str | None, Header(alias="X-Chunk-Hash")] = None,
):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    if chunk_offset is None or chunk_offset < 0:
        raise HTTPException(status_code=400, detail="X-Chunk-Offset header required")

    if not chunk_hash:
        raise HTTPException(status_code=400, detail="X-Chunk-Hash header required")

    upload_session = (
        db.query(UploadSession).filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        ).first())

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    if upload_session.completed:
        raise HTTPException(status_code=400, detail="Upload already completed")

    if chunk_offset >= upload_session.expected_size:
        raise HTTPException(status_code=400, detail="Chunk offset outside file size")

    for start, end in upload_session.received_ranges or []:
        if chunk_offset >= start and chunk_offset + upload_session.chunk_size <= end:
            return {
                "received": upload_session.chunk_size,
                "offset": chunk_offset,
                "hash": chunk_hash,
                "ranges": upload_session.received_ranges,
            }

    if chunk_offset + upload_session.chunk_size > upload_session.expected_size:
        if chunk_offset + chunk_size != upload_session.expected_size:
            raise HTTPException(status_code=400, detail="Invalid chunk size")

    if upload_session.itar_status:
        service_client = itarFileStorageProvider
    elif upload_session.storage_region == StorageRegion.EU:
        service_client = euFileStorageProvider
    else:
        service_client = usFileStorageProvider

    hasher = hashlib.sha256()
    chunk_buffer = BytesIO()
    received_size = 0

    async for chunk in request.stream():
        hasher.update(chunk)
        chunk_buffer.write(chunk)
        received_size += len(chunk)

    server_hash = hasher.hexdigest()

    if server_hash.lower() != chunk_hash.strip().lower():
        raise HTTPException(status_code=400, detail=f"Chunk hash mismatch, expected {chunk_hash}, got {server_hash}")

    chunk_buffer.seek(0)

    async def buffered_stream():
        while True:
            chunk = chunk_buffer.read(1024 * 1024)

            if not chunk:
                break

            yield chunk

    if received_size > upload_session.chunk_size:
        raise HTTPException(status_code=400, detail="Chunk exceeds expected chunk size")

    try:
        await service_client.write_stream_range(
            buffered_stream(),
            f"{upload_session.case_id}/{upload_session.blob_name}",
            chunk_offset,
            received_size,
        )

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to write upload chunk")

    expected_end = chunk_offset + received_size

    if expected_end > upload_session.expected_size:
        raise HTTPException(status_code=400, detail="Chunk exceeds expected file size")

    try:
        upload_session = (
            db.query(UploadSession).filter(
                UploadSession.upload_token == upload_token,
                UploadSession.link_uuid == link_uuid
            ).with_for_update().populate_existing().first()
        )

        if upload_session is None:
            raise HTTPException(status_code=404, detail="Upload session not found")

        ranges = upload_session.received_ranges or []

        new_range = [chunk_offset, expected_end]

        ranges.append(new_range)

        ranges.sort(key=lambda x: x[0])

        merged_ranges = []

        for start, end in ranges:
            if not merged_ranges or start > merged_ranges[-1][1]:
                merged_ranges.append([start, end])
            else:
                merged_ranges[-1][1] = max(merged_ranges[-1][1], end)

        upload_session.received_ranges = merged_ranges
        upload_session.received_size = sum(
            end - start for start, end in merged_ranges
        )
        upload_session.last_activity = datetime.datetime.now(tz=datetime.timezone.utc)

        db.commit()

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update upload session")
    return {
        "received": received_size,
        "offset": chunk_offset,
        "hash": server_hash,
        "ranges": upload_session.received_ranges,
    }

@router.get("/uploadfile/{link_uuid}/{upload_token}/status")
def upload_status(link_uuid: str, upload_token: str, db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    upload_session = (
        db.query(UploadSession).filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        ).first())

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    return {
        "receivedRanges": upload_session.received_ranges or [],
        "receivedSize": upload_session.received_size,
        "expectedSize": upload_session.expected_size,
        "chunkSize": upload_session.chunk_size,
        "completed": upload_session.completed,
    }

@router.post("/uploadfile/{link_uuid}/{upload_token}/complete")
async def complete_upload(link_uuid: str, upload_token: str, db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    upload_session = db.query(UploadSession).filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        ).first()
    
    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    if upload_session.completed:
        raise HTTPException(status_code=400, detail="Upload already completed")

    if upload_session.received_size != upload_session.expected_size:
        raise HTTPException(
            status_code=400,
            detail="Upload is incomplete"
        )

    ranges = upload_session.received_ranges or []

    if len(ranges) != 1 or ranges[0][0] != 0 or ranges[0][1] != upload_session.expected_size:
        raise HTTPException(status_code=400, detail="Upload ranges are incomplete")

    if upload_session.itar_status:
        service_client = itarFileStorageProvider
    elif upload_session.storage_region == StorageRegion.EU:
        service_client = euFileStorageProvider
    else:
        service_client = usFileStorageProvider

    hasher = hashlib.sha256()

    try:
        file_stream = service_client.get_file_stream(f"{upload_session.case_id}/{upload_session.blob_name}")

        while True:
            chunk = file_stream.read(1024 * 1024)# read 1 mib chunks

            if not chunk:
                break

            hasher.update(chunk)

        file_stream.close()

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to verify uploaded file")

    server_hash = hasher.hexdigest()

    if server_hash.lower() != upload_session.expected_sha256.lower():
        raise HTTPException(status_code=400,detail="File hash mismatch")

    try:
        now = datetime.datetime.now(tz=datetime.timezone.utc)

        upload_session = db.query(UploadSession).filter(
                UploadSession.upload_token == upload_token,
                UploadSession.link_uuid == link_uuid,
            ).with_for_update().populate_existing().first()
        

        if upload_session is None:
            raise HTTPException(status_code=404,  detail="Upload session not found")

        link_entry = find_link_entry(link_uuid, db)

        if link_entry is None:
            raise HTTPException(status_code=404, detail="Link not found")

        record = UploadRecord(
            upload_id=upload_session.upload_id,
            link_uuid=upload_session.link_uuid,
            original_filename=upload_session.original_filename,
            for_deletion=False,
            blob_name=upload_session.blob_name,
            content_type=upload_session.content_type,
            sha256=server_hash,
            date_uploaded=now,
            itar_status=upload_session.itar_status,
            combined_file_size=upload_session.expected_size,
            timestamp=now,
            max_days_in_storage=30,
            case_id=upload_session.case_id,
            original_link=link_entry.link,
            sas_retrieval_link="",
            upload_complete=True,
            users_with_access=link_entry.users_with_access,
        )

        db.add(record)

        upload_session.completed = True
        upload_session.last_activity = now

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to complete upload")
    
    return {
        "filename": upload_session.original_filename,
        "size": upload_session.expected_size,
        "sha256": server_hash,
        "completed": True,
    }

def get_uploads_for_link(link_uuid: str, db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]): # Get all uploads for a given link uuid from the db
    return db.query(UploadRecord).filter(UploadRecord.link_uuid == link_uuid).all()

@router.post("/uploads/{upload_id}/mark_for_deletion")
def mark_for_deletion(upload_id: str, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    upload_record: UploadRecord|None = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload_record.for_deletion = True
    db.commit()
    return {"message": f"Upload {upload_id} marked for deletion"}

@router.get("/links/{linkUUID}/files") # Get all files for a given link uuid from the db. Only returns files the user has access to
def listFiles(linkUUID: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(linkUUID):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
        return None
    uploads = get_uploads_for_link(linkUUID, db) # Get all uploads for the given link uuid
    authorized_uploads = [ # Filter the uploads to only include what the user can access
        upload for upload in uploads
        if current_user.username in (upload.users_with_access or [])
    ]

    if uploads and not authorized_uploads: # If any one of the uploads is not authorized return forbidden
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access files for this link",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return [ # Return file information to allow for them to later query for the download link without exposing more sensitive information than needed
        {
            "upload_id": upload.upload_id,
            "filename": upload.original_filename,
            "size": upload.combined_file_size,
            "blob_name": upload.blob_name,
            "content_type": upload.content_type,
            "date_uploaded": upload.date_uploaded.isoformat() if upload.date_uploaded else None,
        }
        for upload in authorized_uploads]

@router.post("/uploads/{upload_id}/extend_expiration")
def extendFileExpiration(upload_id: str, additional_days: int, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):  # Only admin can extend expiration
    if type(additional_days) is not int:
        raise HTTPException(status_code=400, detail="Additional days must be an integer")
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    if additional_days <= 0:
        raise HTTPException(status_code=400, detail="Additional days must be a positive integer")
    if additional_days > 365:
        raise HTTPException(status_code=400, detail="Additional days cannot exceed 365")
    upload_record: UploadRecord|None = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload record not found")

    if upload_record.max_days_in_storage is None:
        upload_record.max_days_in_storage = 0

    upload_record.max_days_in_storage += additional_days
    db.commit()
    return {"message": f"File expiration extended by {additional_days} days", "newExpiration": upload_record.max_days_in_storage, "newExpirationDate": (upload_record.date_uploaded + datetime.timedelta(days=upload_record.max_days_in_storage)).isoformat() if upload_record.date_uploaded else None}

