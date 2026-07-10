import os
import datetime
import hashlib
import traceback
import traceback
import psycopg
import uuid
import re
from Utils import IsUUID
from pathlib import Path
from typing import Annotated, Literal

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
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
from modules.models import Base, UploadRecord, LinkRecord

router = APIRouter()
session = Session()


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


def find_link_entry(link_uuid: str):
    try:
        return session.query(LinkRecord).filter(LinkRecord.uuid == link_uuid).first()
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

@router.post("/uploadfile/{link_uuid}")
async def create_upload_file(
    link_uuid: str,
    request: Request,
    file_hash_clientside: Annotated[str | None, Header(alias="X-File-Hash")] = None, # SHA256 has as header
    filename: Annotated[str | None, Header(alias="X-File-Name")] = None,
    userLocation: Annotated[Literal["US", "EU"], Header(alias="X-User-Location")] = "US" # For where data gets stored. ITAR supercedes this
):
    if not filename:
        nofile = HTTPException(400,detail={"message": "File or Filename not present"})
        raise nofile

    if not IsUUID(link_uuid):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
        return None

    if not file_hash_clientside:
        raise HTTPException(400, detail="X-File-Hash header is required")

    hasher = hashlib.sha256()
    file_size = 0

    async def hashed_stream():
        nonlocal file_size

        async for chunk in request.stream():
            print("chunk received:", len(chunk))
            hasher.update(chunk)
            file_size += len(chunk)
            yield chunk

    try:
        link_entry = find_link_entry(link_uuid)
    except Exception as e:
        print("LINK LOOKUP ERROR:", e)
        raise

    if link_entry is None:
        raise HTTPException(status_code=404, detail="Link not found")

    itar_status = bool(link_entry.itar) if link_entry else False

    if itar_status:
        serviceClient = itarFileStorageProvider
    elif userLocation == "EU":
        serviceClient = euFileStorageProvider
    else:
        serviceClient = usFileStorageProvider

    path_filename = Path(filename).name
    blob_name = path_filename

    if serviceClient.exists(link_entry.case_id + "/" + blob_name):
        path_obj = Path(filename)
        stem = path_obj.stem
        suffix = path_obj.suffix
        counter = 1

        while serviceClient.exists(link_entry.case_id + "/" + blob_name):
            if suffix:
                blob_name = f"{stem}_{counter}{suffix}"
            else:
                blob_name = f"{stem}_{counter}"
            counter += 1

    print(repr(link_entry.case_id))
    print(repr(blob_name))
    print(repr(f"{link_entry.case_id}/{blob_name}"))

    await serviceClient.upload_stream(
        hashed_stream(),
        link_entry.case_id + "/" + blob_name
    )

    server_hash = hasher.hexdigest()

    normalized_client_hash = file_hash_clientside.strip().lower()

    if normalized_client_hash != server_hash:
        raise HTTPException(
            status_code=400,
            detail=f"File hash mismatch, expected {normalized_client_hash}, got {server_hash}"
        )

    try:
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        case_id = None
        users_with_access = []
        original_link = ""
        sas_retrieval_link = ""

        if link_entry:
            if link_entry.expired:
                raise HTTPException(
                    status_code=410,
                    detail="This link has expired and is no longer available for uploads",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            case_id = link_entry.case_id
            users_with_access = link_entry.users_with_access or []
            original_link = link_entry.link or original_link

            try:
                if link_entry.timestamp:
                    try:
                        parsed_ts = link_entry.timestamp
                    except Exception:
                        parsed_ts = None
            except Exception:
                parsed_ts = None

            if parsed_ts:
                timestamp_val = parsed_ts
            else:
                timestamp_val = now
        else:
            timestamp_val = now
            
        inserted_upload_id = None

        if link_entry and getattr(link_entry, "uuid", None):
            record = UploadRecord(
                upload_id=str(uuid.uuid4()),
                link_uuid=link_entry.uuid,
                original_filename=filename,
                for_deletion=False,
                blob_name=blob_name,
                content_type=request.headers.get("content-type"),
                sha256=server_hash,
                date_uploaded=now,
                itar_status=itar_status,
                combined_file_size=file_size,
                timestamp=timestamp_val,
                max_days_in_storage=30,
                case_id=case_id,
                original_link=original_link,
                sas_retrieval_link=sas_retrieval_link,
                upload_complete=True,
                users_with_access=users_with_access,
            )

            session.add(record)
            session.commit()

            inserted_upload_id = record.upload_id

    except Exception as e:
        try:
            print("UPLOAD ERROR:" + str(e))
            traceback.print_exc()
            session.rollback()
        except Exception:
            pass

    return {
        "filename": filename,
        "content_type": request.headers.get("content-type"),
        "size": file_size,
        "uuid": link_uuid,
        "file_transfer_check": True,
        "server_hash": server_hash,
        "blob_hash": server_hash,
        "date_and_time": str(datetime.datetime.now(tz=datetime.timezone.utc)),
    }


def get_uploads_for_link(link_uuid: str): # Get all uploads for a given link uuid from the db
    return session.query(UploadRecord).filter(UploadRecord.link_uuid == link_uuid).all()

@router.post("/uploads/{upload_id}/mark_for_deletion")
def mark_for_deletion(upload_id: str, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))]):
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    upload_record: UploadRecord|None = session.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload_record.for_deletion = True
    session.commit()
    return {"message": f"Upload {upload_id} marked for deletion"}


@router.get("/links/{linkUUID}/files") # Get all files for a given link uuid from the db. Only returns files the user has access to
def listFiles(linkUUID: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  
    if not IsUUID(linkUUID):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
        return None
    uploads = get_uploads_for_link(linkUUID) # Get all uploads for the given link uuid
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
def extendFileExpiration(upload_id: str, additional_days: int, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))]):  # Only admin can extend expiration
    if type(additional_days) is not int:
        raise HTTPException(status_code=400, detail="Additional days must be an integer")
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    if additional_days <= 0:
        raise HTTPException(status_code=400, detail="Additional days must be a positive integer")
    if additional_days > 365:
        raise HTTPException(status_code=400, detail="Additional days cannot exceed 365")
    upload_record: UploadRecord|None = session.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload record not found")

    if upload_record.max_days_in_storage is None:
        upload_record.max_days_in_storage = 0

    upload_record.max_days_in_storage += additional_days
    session.commit()
    return {"message": f"File expiration extended by {additional_days} days", "newExpiration": upload_record.max_days_in_storage, "newExpirationDate": (upload_record.date_uploaded + datetime.timedelta(days=upload_record.max_days_in_storage)).isoformat() if upload_record.date_uploaded else None}

