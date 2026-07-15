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
from blake3 import blake3
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
from fastapi.responses import JSONResponse
from fastapi import Query
from modules.uploadSchemas import  StartUploadHeaders,StartUploadResponse, UploadChunkHeaders, UploadChunkResponse, UploadStatusResponse, CompleteUploadResponse, UploadedFileInfo, MarkForDeletionResponse, ExtendExpirationResponse
from datetime import timezone, timedelta
from modules import Session
from fastapi import Request
from pathvalidate import sanitize_filename, validate_filename
from modules.auth import getCurrentActiveUser, User, requireRoles
from modules.models import Base, StorageRegion, UploadChunk, UploadRecord, LinkRecord, UploadSession

router = APIRouter()
#session = Session()
MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024 * 1024  # 3 TiB (nginx limits to 2.5 TiB)
def get_db():
    db = Session()

    try:
        yield db
    finally:
        db.close()

def hash_bytes(data: bytes) -> str:
    return blake3(data).hexdigest()

def validate_upload_link(link_entry: LinkRecord):
    now = datetime.datetime.now(timezone.utc)
    expiration = link_entry.expiration_date

    if expiration is None:
        raise HTTPException(status_code=500, detail="Link has no expiration date")

    if expiration.tzinfo is None:
        expiration = expiration.replace(tzinfo=timezone.utc)

    if expiration <= now:
        raise HTTPException(status_code=410, detail="Upload link expired")

    if link_entry.expired:
        raise HTTPException(status_code=410, detail="Upload link expired")

def compute_merkle_root(chunk_hashes: list[str]) -> str:
    if not chunk_hashes:
        raise ValueError("No chunk hashes provided")

    current = [bytes.fromhex(h) for h in chunk_hashes]

    while len(current) > 1:
        next_level = []

        for i in range(0, len(current), 2):
            left = current[i]

            if i + 1 < len(current):
                right = current[i + 1]
            else:
                right = left

            next_level.append(blake3(left + right).digest())

        current = next_level

    return current[0].hex()

def validate_file_hash(contents: bytes, file_hash_clientside: str | None) -> str: # Used to check file integrity
    if not file_hash_clientside:
        raise ValueError("X-File-Hash header is required")

    normalized_client_hash = file_hash_clientside.strip().lower() # remove whitespace and make lowercase for comparison
    computed_hash = hash_bytes(contents)
    if normalized_client_hash != computed_hash:
        raise ValueError(f"File hash mismatch, expected client side hash - {normalized_client_hash}, but got {computed_hash}")

    return computed_hash



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

@router.post("/uploadfile/{link_uuid}/start", response_model=StartUploadResponse)
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

    if file_size is None or file_size <= 0:
        raise HTTPException(status_code=400, detail="X-File-Size header required")

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the maximum allowed size")

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


    filename = sanitize_filename(filename)  # Sanitize the filename to prevent directory traversal and other issues
    path_filename = Path(filename).name # deal with dir traversal and get just the filename
    try:
        validate_filename(path_filename)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid filename after sanitization")
    blob_name = path_filename

    chunk_size = 32 * 1024 * 1024

    try:
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
            expected_hash=file_hash.strip().lower(),
            hash_algorithm="blake3",
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
        db.commit()

    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create upload session")

    try:
        await service_client.prepare_file(f"{link_entry.case_id}/{blob_name}", file_size)

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

@router.post("/uploadfile/{link_uuid}/{upload_token}", response_model=UploadChunkResponse)
async def upload_file_chunk(
    link_uuid: str,
    upload_token: str,
    request: Request,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)],
    chunk_offset: Annotated[int | None, Header(alias="X-Chunk-Offset")] = None,
    chunk_size: Annotated[int | None, Header(alias="X-Chunk-Size")] = None,
    chunk_hash: Annotated[str | None, Header(alias="X-Chunk-Hash")] = None,
):
    received_size = int(request.headers.get("Content-Length", 0))
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    if chunk_offset is None or chunk_offset < 0:
        raise HTTPException(status_code=400, detail="X-Chunk-Offset header required")

    if not chunk_hash:
        raise HTTPException(status_code=400, detail="X-Chunk-Hash header required")

    if chunk_size is None or chunk_size <= 0 or received_size != chunk_size or chunk_size > 32 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="X-Chunk-Size invalid or missing, must be > 0 and <= 32 MiB and match Content-Length")

    upload_session = (
        db.query(UploadSession).filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        ).first())

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if chunk_offset != 0 and chunk_offset % upload_session.chunk_size != 0 and chunk_offset + received_size != upload_session.expected_size: # Raise unless final chunk, which can be smaller than the chunk size
        raise HTTPException(status_code=400, detail="Chunk offset must align with upload chunk size")

    if upload_session.completed:
        raise HTTPException(status_code=400, detail="Upload already completed")

    if chunk_offset >= upload_session.expected_size:
        raise HTTPException(status_code=400, detail="Chunk offset outside file size")
    
    link_entry = find_link_entry(link_uuid, db)

    if link_entry is None:
        raise HTTPException(404, "Link not found")

    validate_upload_link(link_entry) # returns 410 if expired

    existing_chunk = db.query(UploadChunk).filter(
            UploadChunk.upload_id == upload_session.upload_id,
            UploadChunk.offset == chunk_offset,
        ).first()
    

    if existing_chunk:
        if existing_chunk.hash.lower() != chunk_hash.strip().lower():
            raise HTTPException(status_code=409, detail="Chunk offset already uploaded with different content")

        return UploadChunkResponse(
            received=existing_chunk.size,
            offset=existing_chunk.offset,
            hash=existing_chunk.hash,
            ranges=upload_session.received_ranges,
        )

    if chunk_offset + upload_session.chunk_size > upload_session.expected_size:
        if chunk_offset + received_size != upload_session.expected_size:
            raise HTTPException(status_code=400, detail="Invalid chunk size")

    if upload_session.itar_status:
        service_client = itarFileStorageProvider
    elif upload_session.storage_region == StorageRegion.EU:
        service_client = euFileStorageProvider
    else:
        service_client = usFileStorageProvider

    chunk_buffer = BytesIO()
    received_size = 0

    async for chunk in request.stream():
        chunk_buffer.write(chunk)
        received_size += len(chunk)
    
    chunk_bytes = chunk_buffer.getvalue()
    server_hash = hash_bytes(chunk_bytes)

    if server_hash.lower() != chunk_hash.strip().lower():
        raise HTTPException(status_code=400, detail=f"Chunk hash mismatch, expected {chunk_hash}, got {server_hash}")

    chunk_buffer.seek(0)

    async def buffered_stream():
        while True:
            chunk = chunk_buffer.read(32 * 1024 * 1024) # read 32 MiB chunks 

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
        chunk_index = chunk_offset // upload_session.chunk_size

        chunk_record = UploadChunk(
            upload_id=upload_session.upload_id,
            offset=chunk_offset,
            size=received_size,
            chunk_index=chunk_index,
            hash=server_hash,
            algorithm="blake3",
        )

        db.merge(chunk_record)

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
    return UploadChunkResponse(
        received=received_size,
        offset=chunk_offset,
        hash=server_hash,
        ranges=upload_session.received_ranges,
    )

@router.get("/uploadfile/{link_uuid}/{upload_token}/status", response_model=UploadStatusResponse)
def upload_status(
    link_uuid: str,
    upload_token: str,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]
):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    upload_session = (
        db.query(UploadSession)
        .filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        )
        .first()
    )

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    chunks = (
        db.query(UploadChunk).filter(
            UploadChunk.upload_id == upload_session.upload_id,
            UploadChunk.uploaded == True
        ).all()
    )

    ranges = sorted(
        [[chunk.offset, chunk.offset + chunk.size] for chunk in chunks],
        key=lambda r: r[0]
    )

    merged_ranges = []
    for start, end in ranges:
        if not merged_ranges:
            merged_ranges.append([start, end])
            continue

        last_start, last_end = merged_ranges[-1]
        if start <= last_end:  
            merged_ranges[-1][1] = max(last_end, end)
        else:
            merged_ranges.append([start, end])

    received_size = sum(end - start for start, end in merged_ranges)

    return UploadStatusResponse(
        receivedRanges=merged_ranges,
        receivedSize=received_size,
        expectedSize=upload_session.expected_size,
        chunkSize=upload_session.chunk_size,
        completed=upload_session.completed,
        chunksReceived=len(chunks),
    )

@router.post("/uploadfile/{link_uuid}/{upload_token}/complete", response_model=CompleteUploadResponse)
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

    chunks = db.query(UploadChunk).filter(UploadChunk.upload_id == upload_session.upload_id).order_by(UploadChunk.chunk_index).all()
    


    if len(chunks) == 0:
        raise HTTPException(status_code=400, detail="No chunk hashes found" )


    chunk_hashes = [chunk.hash for chunk in chunks] 
    
    server_hash = compute_merkle_root(chunk_hashes)

    if server_hash.lower() != upload_session.expected_hash.lower():
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
            file_hash=server_hash,
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
    
    return CompleteUploadResponse(
        filename=upload_session.original_filename,
        size=upload_session.expected_size,
        file_hash=server_hash,
        completed=True,
    )

def get_uploads_for_link(link_uuid: str, db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]): # Get all uploads for a given link uuid from the db
    return db.query(UploadRecord).filter(UploadRecord.link_uuid == link_uuid).all()

@router.post("/uploads/{upload_id}/mark_for_deletion", response_model=MarkForDeletionResponse)
def mark_for_deletion(upload_id: str, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    upload_record: UploadRecord|None = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload_record.for_deletion = True
    db.commit()
    return MarkForDeletionResponse(message=f"Upload {upload_id} marked for deletion")

@router.get("/links/{linkUUID}/files", response_model=list[UploadedFileInfo]) # Get all files for a given link uuid from the db. Only returns files the user has access to
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
        UploadedFileInfo(
            upload_id=upload.upload_id,
            filename=upload.original_filename,
            size=upload.combined_file_size,
            blob_name=upload.blob_name,
            content_type=upload.content_type,
            date_uploaded=upload.date_uploaded if upload.date_uploaded else None,
        )
        for upload in authorized_uploads]

@router.post("/uploads/{upload_id}/extend_expiration", response_model=ExtendExpirationResponse)
def extendFileExpiration(upload_id: str, additional_days: Annotated[int, Query(gt=0, le=365)], current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):  # Only admin can extend expiration
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
    return ExtendExpirationResponse(
        message=f"File expiration extended by {additional_days} days",
        newExpiration=upload_record.max_days_in_storage,
        newExpirationDate=(upload_record.date_uploaded + datetime.timedelta(days=upload_record.max_days_in_storage)).isoformat() if upload_record.date_uploaded else None
    )

