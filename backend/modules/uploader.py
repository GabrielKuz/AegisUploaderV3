import os
import datetime
import hashlib
from pathlib import Path
from typing import Annotated

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy import or_

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from fastapi import APIRouter, File, UploadFile
from modules import Session
from modules.models import Base, UploadRecord, LinkRecord

router = APIRouter()
session = Session()


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

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER", "mycontainer")

if AZURE_CONNECTION_STRING is None:
    raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING is required for blob uploads")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
try:
    container_client.create_container()
except ResourceExistsError:
    pass

@router.post("/uploadfile/{link_uuid}")
async def create_upload_file(link_uuid: str,
    file: Annotated[UploadFile | None, File(description="A file read as UploadFile")] = None,
):
    if file is None:
        return {"message": "No upload file sent"}

    contents = await file.read()
    filehash = hashlib.sha256()
    filehash.update(contents)
    filename = Path(file.filename).name
    blob_name = filename
    blob_client = container_client.get_blob_client(blob_name)

    if blob_client.exists():
        path_obj = Path(filename)
        stem = path_obj.stem
        suffix = path_obj.suffix
        counter = 1
        while blob_client.exists():
            if suffix:
                blob_name = f"{stem}_{counter}{suffix}"
            else:
                blob_name = f"{stem}_{counter}"
            blob_client = container_client.get_blob_client(blob_name)
            counter += 1


    

    saved_file_hash = hashlib.sha256(contents).hexdigest()
    file_transfer_check = filehash.hexdigest() == saved_file_hash
    # ensure uploads table exists before persisting
    try:
        ensure_uploads_table(session)
    except Exception:
        # if table creation fails, continue with upload but don't block the file upload
        pass
    blob_client.upload_blob(contents, overwrite=False)

    # create a DB record for this upload, pulling info from LinkDB if available
    try:
        now = datetime.datetime.now()
        case_id = None
        users_with_access = []
        original_link = blob_client.url
        sas_retrieval_link = None
        itar_status = False

        # lookup LinkDB entry by provided UUID
        try:
            link_entry = session.query(LinkRecord).filter(LinkRecord.uuid == link_uuid).first()
        except Exception:
            link_entry = None

        if link_entry:
            case_id = link_entry.case_id
            # keep users_with_access as stored in LinkDB if present
            users_with_access = link_entry.users_with_access or []
            original_link = link_entry.link or original_link
            # attempt to interpret timestamp if possible
            try:
                if link_entry.timestamp:
                    try:
                        parsed_ts = datetime.datetime.fromisoformat(link_entry.timestamp)
                    except Exception:
                        parsed_ts = None
            except Exception:
                parsed_ts = None
            if parsed_ts:
                timestamp_val = parsed_ts
            else:
                timestamp_val = now
            # expired flag might indicate ITAR or restricted
            itar_status = bool(link_entry.expired)
        else:
            timestamp_val = now

        # Build a SAS retrieval link for the uploaded blob using the Azurite env settings.
        account_name = os.getenv("ACCOUNT_NAME")
        account_key = os.getenv("ACCOUNT_KEY")
        blob_endpoint = os.getenv("BLOB_ENDPOINT", "").rstrip("/")

        if account_name and account_key and blob_endpoint:
            try:
                sas_token = generate_blob_sas(
                    account_name=account_name,
                    account_key=account_key,
                    container_name=AZURE_CONTAINER_NAME,
                    blob_name=blob_name,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.datetime.utcnow() + datetime.timedelta(days=30),
                )
                sas_retrieval_link = f"{blob_endpoint}/{AZURE_CONTAINER_NAME}/{blob_name}?{sas_token}"
            except Exception:
                sas_retrieval_link = blob_client.url
        else:
            sas_retrieval_link = blob_client.url


        # only insert a DB record if LinkDB entry exists and has a UUID
        if not link_entry or not getattr(link_entry, 'uuid', None):
            # skip DB insert when there's no LinkDB entry/UUID
            inserted_uuid = None
        else:
            inserted_uuid = link_entry.uuid
            record = UploadRecord(
                uuid=inserted_uuid,
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
    except Exception:
        # swallow DB errors so upload still succeeds
        try:
            session.rollback()
        except Exception:
            pass

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "blob_name": blob_name,
        "blob_url": blob_client.url,
        "uuid": link_uuid,
        "file_transfer_check": file_transfer_check,
        "date_and_time": str(datetime.datetime.now()),
        "Sas_retrieval_link": sas_retrieval_link,
    }

