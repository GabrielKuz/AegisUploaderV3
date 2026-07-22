import asyncio
from io import BytesIO
import os
import datetime
import traceback
import traceback
import psycopg
import sqlalchemy
from blake3 import blake3
from sqlalchemy.orm import Session
from Utils import IsUUID
from pathlib import Path
from typing import Annotated, Literal
import logging

from sqlalchemy import text, cast
from sqlalchemy.dialects.postgresql import JSONB
from modules.StorageProvider import StorageProvider, LocalStorageProvider
from modules import usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi import Query
from modules.uploadSchemas import StartUploadResponse, UploadChunkResponse, UploadStatusResponse, CompleteUploadResponse, UploadedFileInfo, MarkForDeletionResponse, ExtendExpirationResponse
from datetime import timezone
from modules import Session
from fastapi import Request
from pathvalidate import sanitize_filename, validate_filename
from modules.auth import User, requireRoles
from modules.models import StorageRegion, UploadChunk, UploadRecord, LinkRecord, UploadSession
from azure.communication.email.aio import EmailClient
from zoneinfo import ZoneInfo
import logging

logger = logging.getLogger(__name__)
router = APIRouter()



MAX_FILE_SIZE = 2.5 * 1024 * 1024 * 1024 * 1024  # nginx limits to 2.5 TiB to ensure we dont accept arbitary requests
def get_db(): # Avoid reusing the same session across requests, which can cause issues with concurrent transactions
    db = Session()

    try:
        logger.debug("Yielding database session")
        yield db # Use a generator to yield the session and ensure its closed after
    finally:
        db.close()
        logger.debug("Closed database session")

def hash_bytes(data: bytes) -> str: # Blake3 hash
    return blake3(data).hexdigest()

def validate_upload_link(link_entry: LinkRecord) -> None: # Checks if link is valid and throws HTTPException if not. Returns None if valid
    if link_entry is None:# Initial check to avoid AttributeError later
        raise HTTPException(status_code=404, detail="Link not found")
    
    now = datetime.datetime.now(timezone.utc)
    expiration = link_entry.expiration_date

    if expiration is None:
        raise HTTPException(status_code=500, detail="Link has no expiration date")

    if expiration.tzinfo is None: #The app only uses UTC, but if a naive timestamp ends up in the db, we add it
        expiration = expiration.replace(tzinfo=timezone.utc)

    if link_entry.expired: # Set by CRON data cleaner job
        raise HTTPException(status_code=410, detail="Upload link expired")

    if expiration <= now:# #If the general data cleaner hasnt run yet, check it manually
        raise HTTPException(status_code=410, detail="Upload link expired")


def compute_merkle_root(chunk_hashes: list[str]) -> str: # Using merkle tree to compute root hashes because its faster than hashing the whole file
    if not chunk_hashes:
        raise ValueError("No chunk hashes provided")

    current = [bytes.fromhex(h) for h in chunk_hashes] # Grab the bytes of all hashes

    while len(current) > 1: # Keep hashing pairs until only the root hash is left
        next_level = []

        for i in range(0, len(current), 2): # Build the next level of the tree by hashing pairs of hashes together
            left = current[i]

            if i + 1 < len(current): #Duplicate hashes to deal with odd numbers
                right = current[i + 1]
            else: 
                right = left 

            next_level.append(blake3(left + right).digest()) # Hash the left and right hashes together to form the parent hash

        current = next_level # Move up a level on the tree

    return current[0].hex() # Return the final root as a hex string

def validate_file_hash(contents: bytes, file_hash_clientside: str | None) -> str: #Check if the client side blake3 matches the server side
    if not file_hash_clientside: # Client must have provided the hash
        raise ValueError("X-File-Hash header is required")

    normalized_client_hash = file_hash_clientside.strip().lower() # Remove whitespace and make lowercase for comparison
    computed_hash = hash_bytes(contents) # Compute the server side hash of the file contents
    if normalized_client_hash != computed_hash: # Check equivalence of the client and server hashes
        logger.info(f"File hash mismatch: expected {normalized_client_hash}, got {computed_hash}")
        raise ValueError(f"File hash mismatch, expected client side hash - {normalized_client_hash}, but got {computed_hash}") 

    return computed_hash



def find_link_entry(link_uuid: str, db): # Query the db to find the record matching the link UUID
    logger.debug(f"Finding link entry for UUID: {link_uuid}")
    try:
        return db.query(LinkRecord).filter(LinkRecord.uuid == link_uuid).first() # Returns only the first matching one (Their should be only one) or None 
    except psycopg.errors.InvalidTextRepresentation as e: # Catch invalid UUID with None instead of crashing
        logger.warning(f"Invalid UUID representation: {link_uuid}. Error: {e}")
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

@router.post("/uploadfile/{link_uuid}/start", response_model=StartUploadResponse) # Starts a new upload session for a given link UUID
async def start_upload(
    link_uuid: str,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)],
    filename: Annotated[str | None, Header(alias="X-File-Name")] = None,
    file_hash: Annotated[str | None, Header(alias="X-File-Hash")] = None,
    file_size: Annotated[int | None, Header(alias="X-File-Size")] = None,
    userLocation: Literal["US", "EU"] = Header(default="US", alias="X-User-Location"),
):
    #Check for required headers and validate inputs
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

    try: # Find if link exists
        link_entry = find_link_entry(link_uuid, db)
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=404, detail="Unable to find link entry. Please check the link UUID and try again.")

    if link_entry is None: # Not found
        raise HTTPException(status_code=404, detail="Link not found")

    if link_entry.expired: # Link entry will eventually be deleted (When the last file its associated with is deleted) and go back to 404, but this is nicer for users
        raise HTTPException(status_code=410, detail="This link has expired and is no longer available for uploads") # Dont create new tokens, but old tokens should finish
    
    
    if link_entry.expiration_date is None or link_entry.expiration_date <= datetime.datetime.now(datetime.timezone.utc): # If the link has expired, mark it as expired and return 410. This is a backup in case the cleanup job hasnt run yet
        link_entry.expired = True # mark the link as expired if the expiration date has passed in case the cleanup job hasnt run yet 
        raise HTTPException(status_code=410, detail="This link has expired and is no longer available for uploads")

    itar_status = bool(link_entry.itar) if link_entry else False # Grab ITAR status from the link entry (Link entry pulled it from HubSpot)

    logger.info(f"ITAR status for link {link_entry.uuid}: {itar_status}")

    #Select storage provider based on itar status and user lcoation
    if itar_status: 
        service_client = itarFileStorageProvider
        storage_region = StorageRegion.ITAR
    elif userLocation == "EU":
        service_client = euFileStorageProvider
        storage_region = StorageRegion.EU
    else: # US
        service_client = usFileStorageProvider
        storage_region = StorageRegion.US

    logger.debug(f"Starting upload for link {link_entry.uuid} with filename '{filename}', file size {file_size}, ITAR status {itar_status}, storage region {storage_region}")

    filename = sanitize_filename(filename)  # Sanitize the filename to prevent directory traversal and other issues
    path_filename = Path(filename).name # deal with dir traversal and get just the filename
    try:
        validate_filename(path_filename, min_len=1, max_len=255) # Validate the sanitized filename to ensure it meets the criteria for a valid filename
    except Exception:
        logger.warning(f"Invalid filename after sanitization: {path_filename}")
        raise HTTPException(status_code=400, detail="Invalid filename after sanitization, check for invalid characters or length issues")
    blob_name = path_filename

    try:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), # Lock the link uuid to prevent concurrent uploads from creating the same blob name. Released automatically on a commit or rollback
            {"key": str(link_entry.uuid)}
        )

        path_obj = Path(blob_name)
        stem = path_obj.stem
        suffix = path_obj.suffix
        counter = 1

        while True: # Check if blob name already exists under the case id and if it does append _{counter} to the end until its unique to prevent overwriting old files
            if counter > 256: # Protects against a potential infinite loop or malicious attempts to create collisions. Should never be hit
                raise HTTPException(status_code=400, detail="Unable to generate a unique filename after 256 attempts, please rename the file and try again")
            exists_in_storage = service_client.exists(f"{link_entry.case_id}/{blob_name}") # Check if file is stored

            exists_in_db = ( # Check for a db record with the name
                db.query(UploadSession).filter(
                    UploadSession.link_uuid == link_entry.uuid,
                    UploadSession.blob_name == blob_name,
                ).first() is not None 
            )

            if not exists_in_storage and not exists_in_db: # If unique, break and use the current name
                break

            if suffix:
                blob_name = f"{stem}_{counter}{suffix}" # Handle file extensions by appending the counter before the extension
            else:
                blob_name = f"{stem}_{counter}"

            counter += 1 # Increment the counter and try again if needed

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
            chunk_size=32 * 1024 * 1024,  # 32 MiB
            completed=False,
            itar_status=itar_status,
            storage_region=storage_region,
        )

        db.add(upload_session)

        db.flush() # Flush the session so it automatically generated the upload_token and uuid

        upload_token = upload_session.upload_token
        db.commit() 
        logger.info(f"Upload session created successfully for link {link_entry.uuid} with filename '{filename}'")

    except sqlalchemy.exc.IntegrityError: # Handle uniqueness constrant violations
        logger.warning(f"IntegrityError: A conflicting upload session already exists for link {link_entry.uuid} and blob name {blob_name}")
        db.rollback()
        raise HTTPException(status_code=409, detail="A conflicting upload session already exists.")

    except Exception: # General exception handling for unexpected errors during the upload session creation process
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create upload session")
    logger.info(f"Preparing storage for file {blob_name} with size {file_size}")

    try:
        await service_client.prepare_file(f"{link_entry.case_id}/{blob_name}", file_size) # Asynchronous call to allocate space for the file in the storage provider

    except Exception: # If file cant be prepared, delete the upload session to avoid orphaned records and raise an error
        try:
            logger.warning(f"Failed to prepare storage for file {blob_name}. Deleting upload session {upload_session.upload_id}")
            db.delete(upload_session)
            db.commit()
        except Exception:
            traceback.print_exc()

        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to prepare storage")
    
    return {
        "uploadToken": upload_token, # Token to identify session
        "chunkSize": 32 * 1024 * 1024,  # 32 MiB  # Tell client the chunk size to use for uploads, maybe set up negotiation later for different sizes
    }

@router.post("/uploadfile/{link_uuid}/{upload_token}", response_model=UploadChunkResponse) # Even if link is expired, allow the upload to continue if it was started before expiration
async def upload_file_chunk(
    link_uuid: str,
    upload_token: str,
    request: Request,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)],
    chunk_offset: Annotated[int | None, Header(alias="X-Chunk-Offset")] = None,
    chunk_size: Annotated[int | None, Header(alias="X-Chunk-Size")] = None,
    chunk_hash: Annotated[str | None, Header(alias="X-Chunk-Hash")] = None,
):
    received_size = int(request.headers.get("Content-Length", 0)) # Content length is harder to spoof than the X-Chunk-Size header, so we use it to validate the chunk size
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    if chunk_offset is None or chunk_offset < 0: # Prevent invalid writes to the storage provider and ensure the offset is valid
        raise HTTPException(status_code=400, detail="X-Chunk-Offset header required")

    if not chunk_hash:
        raise HTTPException(status_code=400, detail="X-Chunk-Hash header required")

    if chunk_size is None or chunk_size <= 0 or received_size != chunk_size or chunk_size > 32 * 1024 * 1024: # Handle invalid chunk sizes, including the final chunk which can be smaller than the chunk size
        raise HTTPException(status_code=400, detail="X-Chunk-Size invalid or missing, must be > 0 and <= 32 MiB and match Content-Length")

    upload_session = ( # GRab the session using the token and link uuid
        db.query(UploadSession).filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        ).first())

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if chunk_offset != 0 and chunk_offset % upload_session.chunk_size != 0 and chunk_offset + received_size != upload_session.expected_size: # Raise unless final chunk, which can be smaller than the chunk size
        raise HTTPException(status_code=400, detail="Chunk offset must align with upload chunk size")

    if upload_session.completed: # Prevent reusing stale upload sessions
        raise HTTPException(status_code=400, detail="Upload already completed")

    if chunk_offset >= upload_session.expected_size: # Prevent invalid storage writes
        raise HTTPException(status_code=400, detail="Chunk offset outside file size")
    
    link_entry = find_link_entry(link_uuid, db) # Grab link db entry

    if link_entry is None:
        raise HTTPException(404, "Link not found")
    try:
        validate_upload_link(link_entry) # returns 410 if expired
    except HTTPException as e:
        if e.status_code == 410:
            pass # allow uploads to continue if they were started before the link expired, but catch invalid link errors and other exceptions
        else:
            raise

    existing_chunk = db.query(UploadChunk).filter( # Check if the chunk has already been uploaded to prevent duplicate uploads and ensure data integrity
            UploadChunk.upload_id == upload_session.upload_id,
            UploadChunk.offset == chunk_offset,
        ).first()
    

    if existing_chunk:
        if existing_chunk.hash.lower() != chunk_hash.strip().lower(): # If the chunk has already been uploaded but the hash is different, raise an error to prevent overwriting existing data with potentially corrupted data
            logger.info(f"Chunk offset {chunk_offset} already uploaded with different content for upload session {upload_session.upload_id}")
            raise HTTPException(status_code=409, detail="Chunk offset already uploaded with different content")

        return UploadChunkResponse(
            received=existing_chunk.size,
            offset=existing_chunk.offset,
            hash=existing_chunk.hash,
            ranges=upload_session.received_ranges,
        )

    if chunk_offset + upload_session.chunk_size > upload_session.expected_size: # Handle the final chunk, which can be smaller than the chunk size, but ensure it does not exceed the expected file size
        logger.info(f"Final chunk detected for upload session {upload_session.upload_id}")
        if chunk_offset + received_size != upload_session.expected_size: # 
            raise HTTPException(status_code=400, detail="Invalid chunk size")

    if upload_session.itar_status: # Select the appropriate storage provider based on the ITAR status and storage region of the upload session
        service_client = itarFileStorageProvider
    elif upload_session.storage_region == StorageRegion.EU:
        service_client = euFileStorageProvider
    else:
        service_client = usFileStorageProvider

    chunk_buffer = BytesIO() # Buffer to BytesIO so we can hash the chunk and stream it to the storage provider after veryfying it (To avoid having to remove bad data from storage if we streamed it through)
    received_size = 0

    async for chunk in request.stream(): # Write to the buffer and add up recieved size
        chunk_buffer.write(chunk)
        received_size += len(chunk)
    
    chunk_bytes = chunk_buffer.getvalue()
    server_hash = hash_bytes(chunk_bytes)

    if server_hash.lower() != chunk_hash.strip().lower(): # Check that hashes match
        raise HTTPException(status_code=400, detail=f"Chunk hash mismatch, expected {chunk_hash}, got {server_hash}")

    chunk_buffer.seek(0) # Reset the buffer to the beginning so it can read to the storage provider after hashing and validation

    async def buffered_stream():
        while True:
            chunk = chunk_buffer.read(32 * 1024 * 1024) # read 32 MiB chunks 

            if not chunk: # Stop when out of chunks
                break

            yield chunk

    if received_size > upload_session.chunk_size:
        raise HTTPException(status_code=400, detail="Chunk exceeds expected chunk size")

    try:
        await service_client.write_stream_range( # Begin streaming the range over to the storage provider, using the buffered stream to avoid loading the entire chunk into memory at once
            buffered_stream(),
            f"{upload_session.case_id}/{upload_session.blob_name}", # Path
            chunk_offset,
            received_size, # For the storage provider to know how much data to expect, and to validate the range
        )
        chunk_index = chunk_offset // upload_session.chunk_size # Get the index to store in the db and for the merkle tree to compute the root hash later

        chunk_record = UploadChunk(
            upload_id=upload_session.upload_id,
            offset=chunk_offset,
            size=received_size,
            chunk_index=chunk_index,
            hash=server_hash,
            algorithm="blake3",
        )

        db.merge(chunk_record) # Merge the chunk record into the session to handle both new and existing records, ensuring that the database reflects the latest state of the upload

    except Exception:
        logger.info(f"Failed to write upload chunk for upload session {upload_session.upload_id} at offset {chunk_offset}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to write upload chunk")

    expected_end = chunk_offset + received_size

    if expected_end > upload_session.expected_size:
        raise HTTPException(status_code=400, detail="Chunk exceeds expected file size")

    try:
        upload_session = ( # Lock the upload session to prevent concurrent updates to the received ranges and size
            db.query(UploadSession).filter(
                UploadSession.upload_token == upload_token,
                UploadSession.link_uuid == link_uuid
            ).with_for_update().populate_existing().first()
        )


        if upload_session is None:
            raise HTTPException(status_code=404, detail="Upload session not found")

        ranges = upload_session.received_ranges or [] # Collect existing ranges

        ranges.append([chunk_offset, expected_end]) # Add the new chunk

        ranges.sort(key=lambda x: x[0]) # Sort by their starting offset to prepare for merging overlapping ranges

        merged_ranges = []

        for start, end in ranges: # Merge overlapping ranges to limit DB JSON size
            if not merged_ranges or start > merged_ranges[-1][1]: # If they dont overlap append them as is
                merged_ranges.append([start, end])
            else: # If they overlap, merge them by extending the end of the last range to the max of the two overlapping ranges
                merged_ranges[-1][1] = max(merged_ranges[-1][1], end) 

        upload_session.received_ranges = merged_ranges # Update DB
        upload_session.received_size = sum( #Accumlate the total received size from the merged ranges 
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

@router.get("/uploadfile/{link_uuid}/{upload_token}/status", response_model=UploadStatusResponse) # Provides enough data for the client to resume an upload or verify the upload status, even if the link has expired
def upload_status(
    link_uuid: str,
    upload_token: str,
    db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]
):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid uuid")

    upload_session = ( # Grab the upload session
        db.query(UploadSession)
        .filter(
            UploadSession.upload_token == upload_token,
            UploadSession.link_uuid == link_uuid,
        )
        .first()
    )

    if upload_session is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    if upload_session.completed: # If its completed, the Chunks have been deleted so we just return the full range and size
        return UploadStatusResponse(
            receivedRanges=[[0, upload_session.expected_size]],
            receivedSize=upload_session.expected_size,
            expectedSize=upload_session.expected_size,
            chunkSize=upload_session.chunk_size,
            completed=True,
            chunksReceived=upload_session.received_size // upload_session.chunk_size + (1 if upload_session.received_size % upload_session.chunk_size > 0 else 0),
        )
    
    else: #Chunks are deleted on completion

        chunks = (
            db.query(UploadChunk).filter(
                UploadChunk.upload_id == upload_session.upload_id,
                UploadChunk.uploaded == True
            ).all()
        )

        ranges = sorted(
            [[chunk.offset, chunk.offset + chunk.size] for chunk in chunks], # Sort the ranges
            key=lambda r: r[0]
        )

        merged_ranges = [] # Merge overlapping ranges
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

        return UploadStatusResponse( # Let client know what has been received so far, so it can resume the upload if needed. We give them raw bytes as opposed to indexes so they can more easily send the missing data
            receivedRanges=merged_ranges,
            receivedSize=received_size,
            expectedSize=upload_session.expected_size,
            chunkSize=upload_session.chunk_size,
            completed=upload_session.completed,
            chunksReceived=len(chunks),
        )

@router.post("/uploadfile/{link_uuid}/{upload_token}/complete", response_model=CompleteUploadResponse) # Client's final call to complete the upload, we verify it here. It is idempotent, so if the upload fials client can uplaod more data and call again
async def complete_upload(link_uuid: str, upload_token: str, db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    logger.debug(f"Completing upload for link {link_uuid} with token {upload_token}")
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
        raise HTTPException(status_code=400, detail="Upload is incomplete" )

    ranges = upload_session.received_ranges or []

    if len(ranges) != 1 or ranges[0][0] != 0 or ranges[0][1] != upload_session.expected_size: # Make sure all data has been recieved
        raise HTTPException(status_code=400, detail="Upload ranges are incomplete")

    if upload_session.itar_status:
        service_client = itarFileStorageProvider
    elif upload_session.storage_region == StorageRegion.EU:
        service_client = euFileStorageProvider
    else:
        service_client = usFileStorageProvider

    chunks = db.query(UploadChunk).filter(UploadChunk.upload_id == upload_session.upload_id).order_by(UploadChunk.chunk_index).all() # Grab all associated chunks
    
    if len(chunks) == 0:
        raise HTTPException(status_code=400, detail="No chunk hashes found" )

    chunk_hashes = [chunk.hash for chunk in chunks] 
    
    server_hash = compute_merkle_root(chunk_hashes) 

    if server_hash.lower() != upload_session.expected_hash.lower():# Verify the merkle root of the hashes matches what the client gave
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

        record = UploadRecord( # If everything checks out, we create a record of the upload in the UploadRecord table to keep track of it 
            upload_id=upload_session.upload_id,
            link_uuid=upload_session.link_uuid,
            original_filename=upload_session.original_filename,
            for_deletion=False,
            blob_name=upload_session.blob_name,
            content_type=upload_session.content_type,
            file_hash=server_hash,
            date_uploaded=now,
            storage_region=upload_session.storage_region,
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
        upload_session.received_ranges = [[0, upload_session.expected_size]]
        # delete the upload chunks after the upload is complete to save space in the database
        db.query(UploadChunk).filter(UploadChunk.upload_id == upload_session.upload_id).delete()

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        traceback.print_exc() # For debugging 
        logger.error(f"Failed to complete upload for link {link_uuid} with token {upload_token}: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to complete upload")
    async with asyncio.TaskGroup() as tg: # Send the email in a background task so we dont block the response to the client and use task group to ensure cleanup
        tg.create_task(sendCompletetionEmail(record))
    
    logger.info(f"Upload completed successfully for link {link_uuid} with token {upload_token}, file hash: {server_hash}")
    
    return CompleteUploadResponse( # Confirm to the client the uplaod is complete and provide our final hash for their verification
        filename=upload_session.original_filename,
        size=upload_session.expected_size,
        file_hash=server_hash,
        completed=True,
    )

@router.post("/uploads/{upload_id}/mark_for_deletion", response_model=MarkForDeletionResponse)
def mark_for_deletion(upload_id: str, current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    upload_record: UploadRecord|None = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload_record.for_deletion = True # Will be deleted on next CRON job run, until then it will be hidden from users
    db.commit()
    return MarkForDeletionResponse(message=f"Upload {upload_id} marked for deletion")

@router.get("/links/{linkUUID}/files", response_model=list[UploadedFileInfo]) # Get all files for a given link uuid from the db. Only returns files the user has access to
def listFiles(linkUUID: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):
    if not IsUUID(linkUUID):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    
    #If no uploads return 204, if any one of the uploads is not authorized return 403, otherwise return the list of uploads
    if not db.query(UploadRecord).filter(UploadRecord.link_uuid == linkUUID, UploadRecord.for_deletion.is_(False)).first(): # If no uploads for the link, return 204
        raise HTTPException(status_code=204, detail="No uploads found for this link")
    
    uploads = (
        db.query(UploadRecord)
        .filter(
            UploadRecord.link_uuid == linkUUID,
            UploadRecord.for_deletion.is_(False),
            cast(UploadRecord.users_with_access, JSONB).contains([current_user.username])
        ).all()
    )

    if not uploads: # If any one of the uploads is not authorized return forbidden
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to access files for this link",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.debug(f"User {current_user.username} accessed files for link {linkUUID}, found {len(uploads)} uploads")

    return [ # Return file information to allow for them to later query for the download link without exposing more sensitive information than needed
        UploadedFileInfo(
            upload_id=upload.upload_id,
            filename=upload.original_filename,
            size=upload.combined_file_size,
            blob_name=upload.blob_name,
            date_uploaded=upload.date_uploaded if upload.date_uploaded else None,
            expiration_date=(upload.date_uploaded + datetime.timedelta(days=upload.max_days_in_storage)).isoformat() if upload.date_uploaded and upload.max_days_in_storage else None,
            upload_complete=upload.upload_complete,
        )
        for upload in uploads
    ]

@router.post("/uploads/{upload_id}/extend_expiration", response_model=ExtendExpirationResponse) # Extend the expiration of a file upload by a specified number of additional days
def extendFileExpiration(upload_id: str, additional_days: Annotated[int, Query(gt=0, le=365)], current_user: Annotated[User, Depends(requireRoles("Admin", strict=True))], db: Annotated[sqlalchemy.orm.Session, Depends(get_db)]):  # Only admin can extend expiration
    if type(additional_days) is not int: 
        raise HTTPException(status_code=400, detail="Additional days must be an integer")
    if not IsUUID(upload_id):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
    if additional_days <= 0: # Validate that the additional days is a positive integer and does not exceed 365 (Arbitary limit to prevent abuse)
        raise HTTPException(status_code=400, detail="Additional days must be a positive integer")
    if additional_days > 365:
        raise HTTPException(status_code=400, detail="Additional days cannot exceed 365")
    upload_record: UploadRecord|None = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload record not found")

    if upload_record.max_days_in_storage is None:
        upload_record.max_days_in_storage = 0

    upload_record.max_days_in_storage += additional_days # Add to the existing expiration days, allowing for cumulative extensions.
    logger.info(f"Extended expiration for upload {upload_id} by {additional_days} days. New expiration: {upload_record.max_days_in_storage} days.")
    db.commit()
    return ExtendExpirationResponse(
        message=f"File expiration extended by {additional_days} days",
        newExpiration=upload_record.max_days_in_storage,
        newExpirationDate=(upload_record.date_uploaded + datetime.timedelta(days=upload_record.max_days_in_storage)).isoformat() if upload_record.date_uploaded else None
    )


ACS_CONNECTION_STRING = os.getenv("ACS_CONNECTION_STRING")

# Source - https://stackoverflow.com/a/1094933
# Posted by Sridhar Ratnakumar, modified by community. See post 'Timeline' for change history
# Retrieved 2026-07-21, License - CC BY-SA 4.0

def sizeof_fmt(num, suffix="B"):
    for unit in ("", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi"):
        if abs(num) < 1024.0:
            return f"{num:3.1f} {unit}{suffix}"
        num /= 1024.0
    return f"{num:.1f}Yi{suffix}"


async def sendCompletetionEmail(upload_record: UploadRecord):
    db = next(get_db())  # Get a new database session for this async function
    if os.getenv("TESTING") and os.getenv("TESTING").lower() == "true":
        return

    link_entry = find_link_entry(upload_record.link_uuid, db=db)
    viewURL = f"https://{os.getenv('FRONTEND_URL')}/support/view-uploads/{upload_record.link_uuid}"
    if not link_entry:
        logger.warning(f"Unable to send completion email. Link {upload_record.link_uuid} not found.")
        return
    try:
        async with EmailClient.from_connection_string(ACS_CONNECTION_STRING) as client:
            message = {
                "content": {
                    "subject": f"File Upload Complete - {upload_record.case_id}",
                    "plainText": f"""A file has been successfully uploaded through Uploader V3.

Case ID: {upload_record.case_id}
File Name: {upload_record.blob_name}
File Size: {sizeof_fmt(upload_record.combined_file_size)} 
Uploaded At: {upload_record.date_uploaded.astimezone(ZoneInfo("America/New_York")).strftime("%B %-d, %Y at %-I:%M:%S %p %Z")}

The uploaded file is now available for review at {viewURL}.
""",
                "html": f"""
                <html>
                    <body style="font-family: Arial, Helvetica, sans-serif; color: #333;">
                        <h2 style="color: #2e8b57;">File Upload Complete</h2>

                        <p>
                            A file has been successfully uploaded through <strong>Uploader V3</strong>.
                        </p>

                        <table style="border-collapse: collapse;">
                            <tr>
                                <td><strong>Case ID:</strong></td>
                                <td>{upload_record.case_id}</td>
                            </tr>
                            <tr>
                                <td><strong>File Name:</strong></td>
                                <td>{upload_record.blob_name}</td>
                            </tr>
                            <tr>
                                <td><strong>File Size:</strong></td>
                                <td>{sizeof_fmt(upload_record.combined_file_size)}</td>
                            </tr>
                            <tr>
                                <td><strong>Uploaded At:</strong></td>
                                <td>{upload_record.date_uploaded.astimezone(ZoneInfo("America/New_York")).strftime("%B %-d, %Y at %-I:%M:%S %p %Z")}</td>
                            </tr>
                        </table>
                        <table style="border-collapse: collapse;">
                            <tr>
                                <td><strong>View URL:</strong></td>
                                <td><a href="{viewURL}">{viewURL}</a></td>
                            </tr>
                        </table>

                        <hr>
                    </body>
                </html>
                """
            },
            "recipients": {
                "to": [
                    {
                        "address": link_entry.creator,
                        "displayName": link_entry.creator
                    }
                ],
                "cc": [ #All other users with access
                    {
                        "address": user,
                        "displayName": user
                    } for user in (link_entry.users_with_access or []) if user != link_entry.creator
                ]
            },
            "senderAddress": os.getenv("ACS_SENDER_ADDRESS", "DoNotReply@aiscorp.com")
        }

            try:
                response = await client.begin_send(message)
                await response.result()
                logger.info(f"Completion email sent successfully to {link_entry.creator}.")
            except Exception as e:
                logger.warning(f"Error occurred while sending completion email: {e}")
    except Exception as e:
        logger.warning(f"Error occurred while preparing to send completion email: {e}")