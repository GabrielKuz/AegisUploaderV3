import os
import datetime
import hashlib
import traceback
import traceback
import uuid
from pathlib import Path
from typing import Annotated, Literal

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy import or_
from warnings import warn, deprecated

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from modules import Session
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
        raise ValueError("File hash mismatch")

    return computed_hash

@deprecated("Replaced by create_tables.py at startup time")
def ensure_uploads_table(db_session):
    """Create the uploads table if it does not exist using the provided session's bind."""
    engine = db_session.get_bind()
    # Create only the uploads table if missing
    Base.metadata.create_all(bind=engine, tables=[UploadRecord.__table__])


def find_link_entry(db_session, filename: str, url: str | None = None):
    """Attempt to find a LinkDB.links entry matching the given URL or filename."""
    q = db_session.query(LinkRecord)
    filters = []
    if url:
        filters.append(LinkRecord.link == url)
    if filename:
        filters.append(LinkRecord.link == filename)
        filters.append(LinkRecord.link.like(f"%{filename}%"))
    if not filters:
        return None
    return q.filter(or_(*filters)).first()

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

us_blob_service = BlobServiceClient.from_connection_string(US_CONNECTION_STRING)
eu_blob_service = BlobServiceClient.from_connection_string(EU_CONNECTION_STRING)
itar_blob_service = BlobServiceClient.from_connection_string(ITAR_CONNECTION_STRING)

itar_container = itar_blob_service.get_container_client(AZURE_CONTAINER_NAME)
us_container = us_blob_service.get_container_client(AZURE_CONTAINER_NAME)
eu_container = eu_blob_service.get_container_client(AZURE_CONTAINER_NAME)

for container in (us_container, eu_container, itar_container): # Create all 3 containers
    try:
        container.create_container() 
    except ResourceExistsError:
        pass

@router.post("/uploadfile/{link_uuid}")
async def create_upload_file(
    link_uuid: str,
    file: Annotated[UploadFile | None, File(description="A file read as UploadFile")] = None, # MIME multipart/form-data
    file_hash_clientside: Annotated[str | None, Header(alias="X-File-Hash")] = None, # SHA256 has as header
    userLocation: Annotated[Literal["US", "EU"], Header(alias="X-User-Location")] = "US" # For where data gets stored. ITAR supercedes this
):
    if file is None:
        return {"message": "No upload file sent"}

    contents = await file.read() # Can be very large, but we need to read it to compute the hash and upload to azure blob storage. Might split up into chunks later 

    try:
        server_hash = validate_file_hash(contents, file_hash_clientside)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc # Invalid file hash

    try: # attempt to find the link entry in the db to determine if it is ITAR 
        link_entry = session.query(LinkRecord).filter(LinkRecord.uuid == link_uuid).first() # This field is populated by hubspot
    except Exception as e:
        print("LINK LOOKUP ERROR:", e)
        raise

    itar_status = bool(link_entry.expired) if link_entry else False # assume false if not found

    if itar_status: # itar overrides user location, otherwise store closer to user
        blob_service_client = itar_blob_service
        container_client = itar_container
    elif userLocation == "EU":
        blob_service_client = eu_blob_service
        container_client = eu_container
    else:
        blob_service_client = us_blob_service
        container_client = us_container

    filename = Path(file.filename).name
    blob_name = filename
    blob_client = container_client.get_blob_client(blob_name)

    if blob_client.exists(): # Duplicate file name
        path_obj = Path(filename)
        stem = path_obj.stem
        suffix = path_obj.suffix
        counter = 1 # handle duplicate file names by appending _{counter} until a unique name is found
        while blob_client.exists():
            if suffix:
                blob_name = f"{stem}_{counter}{suffix}"
            else:
                blob_name = f"{stem}_{counter}"
            blob_client = container_client.get_blob_client(blob_name)
            counter += 1

    try:
        ensure_uploads_table(session)
    except Exception:
        pass
    blob_client.upload_blob(contents, overwrite=False) # Upload to db once it has a unique name

    persisted_contents = blob_client.download_blob().readall() 
    persisted_hash = hash_bytes(persisted_contents) # Check hash
    if persisted_hash != server_hash: # Return 500 if hashes dont match
        raise HTTPException(status_code=500,detail="Uploaded file hash does not match the persisted blob contents")

    try: # try to populate db with the record. If it fails we still return 200 to client since uplaod is succesful but db entry is missing so we log it for manual intervention
        now = datetime.datetime.now(tz=datetime.timezone.utc) # All timestamps in utc
        case_id = None
        users_with_access = []
        original_link = blob_client.url
        sas_retrieval_link = None

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
                if link_entry.timestamp: # datetime object
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

        try:
            account_name = blob_service_client.account_name
            account_key = blob_service_client.credential.account_key

            public_blob_endpoint = blob_service_client.primary_endpoint

            sas_token = generate_blob_sas( # create sas link to allow downloads in the future
                account_name=account_name,
                account_key=account_key,
                container_name=AZURE_CONTAINER_NAME,
                blob_name=blob_name,
                permission=BlobSasPermissions(read=True),# read only for download
                expiry=datetime.datetime.now(datetime.timezone.utc)
                + datetime.timedelta(days=30), # 30 days default expiration for sas link. Can be extended by admin
            )

            sas_retrieval_link = ( # build url via concatenation
                f"{public_blob_endpoint.rstrip('/')}/" # Handle trailing slash in endpoint if it exists
                f"{AZURE_CONTAINER_NAME}/"
                f"{blob_name}?{sas_token}"
            )

        except Exception as e:# On error rollback to avoid invalid state but log the error
            session.rollback() 
            traceback.print_exc()
            sas_retrieval_link = blob_client.url

        inserted_upload_id = None

        if link_entry and getattr(link_entry, "uuid", None):
            record = UploadRecord( # Create new upload record for "LinkDB".uploads table
                upload_id=str(uuid.uuid4()),
                link_uuid=link_entry.uuid,
                original_filename=file.filename,
                for_deletion=False,
                blob_name=blob_name,
                content_type=file.content_type,
                sha256=server_hash,
                date_uploaded=now,
                itar_status=itar_status,
                combined_file_size=len(contents),
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

    return { #Return a limited set of data to the client to avoid exposing sensitive information while allowing confirmation of the upload
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "uuid": link_uuid, # Not the upload_id since that would allow the client to attempt to download the file
        "file_transfer_check": server_hash == persisted_hash,
        "server_hash": server_hash, # Allow client to verify the hash of the uploaded file in addition to it being done server side
        "blob_hash": persisted_hash,
        "date_and_time": str(datetime.datetime.now(tz=datetime.timezone.utc)), # Time of completion 
    }


def get_uploads_for_link(link_uuid: str): # Get all uploads for a given link uuid from the db
    return session.query(UploadRecord).filter(UploadRecord.link_uuid == link_uuid).all()


@router.get("/links/{linkUUID}/files") # Get all files for a given link uuid from the db. Only returns files the user has access to
def listFiles(linkUUID: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
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

