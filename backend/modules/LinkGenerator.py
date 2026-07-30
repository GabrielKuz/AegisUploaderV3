import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

import AppConstants
from modules import Session
from modules.auth import User
from modules.HubSpotIntegration import caseIDExists, get_caseCompany, get_caseITARstatus, get_caseStatus
from modules.models import LinkRecord, UploadRecord, update_similar_between_LinkDB_and_UploadDB
from Utils import IsCaseID

logger = logging.getLogger(__name__)
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is required")


class LinkRequest(BaseModel):  # structure of a link request from the client
    case_id: str = Field(..., description="ID of the case associated with the link")
    storage_region: Literal["US", "EU"] = Field(..., description="Storage region for the link")  # Should be a string enum of the storage regions available in the StorageRegion class


link_data: dict[str, LinkRequest] = {}  # mapping uuid to case info

standard_url = f"https://{os.getenv('FRONTEND_URL') or 'localhost'}/uploads/"  # base url to be concatenated with the uuid
itar_url = f"https://{os.getenv('BACKEND_ITAR_SUBDOMAIN') or 'localhost'}/uploads/"  # base url to be concatenated with the uuid for ITAR links

def generate_links(link_request: LinkRequest, current_user: User):
    """
    Creates a new link with a unique UUID and stores it in the database.
    """
    logger.debug(f"Generating link for case ID: {link_request.case_id} by user: {current_user.username}")
    if not current_user or current_user.disabled:  # Check user authentication
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")

    if not IsCaseID(link_request.case_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Case-ID: Bad Request")
    if not caseIDExists(link_request.case_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case-ID not found")

    uuid_str = str(uuid.uuid4())  # New uuidv4 on every link. We assume no collissions due to large space and link expiration
    url = itar_url if get_caseITARstatus(link_request.case_id) else standard_url  # Use ITAR URL if case is ITAR, else standard URL

    store_link(link_request, url, uuid_str, current_user)  # add to db
    logger.info(f"Link generated successfully: {url + uuid_str} for case ID: {link_request.case_id}")

    if not url or not uuid_str:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link or UUID not found")

    return {"link": url + uuid_str, "uuid": uuid_str}



def store_link(link_request: LinkRequest, url: str, uuid_str: str, current_user: User):
    """
    Stores generated link in the SQL database with metadata.
    """
    with Session() as session:  # Open db session
        record = LinkRecord(  # Create new link record for "LinkDB".links table
            uuid=uuid_str,
            link=url + uuid_str,
            case_id=link_request.case_id,
            itar=get_caseITARstatus(link_request.case_id),
            creator=current_user.username,
            timestamp=datetime.now(UTC),
            expiration_date=datetime.now(UTC) + AppConstants.LINK_EXPIRATION_TIME,  # Always expires after the default expiration time
            users_with_access=[current_user.username],  # TODO: Change to inclide the admin list
            expired=False,
            customer=get_caseCompany(link_request.case_id) or "Unknown",
            status=get_caseStatus(link_request.case_id) or "Unknown",
            storage_region=link_request.storage_region,
        )

        session.add(record)  # add new reccord to session
        session.commit()  # commit session to db so it persists
        logger.debug(f"Stored link record in database: {record}")
        update_similar_between_LinkDB_and_UploadDB(session)


def _serialize_link_record(record: LinkRecord):
    """
    Organizes link data into a dictionary format for API response.
    """
    expiration_date = None
    if record.timestamp is not None:
        expiration_date = record.timestamp + AppConstants.LINK_EXPIRATION_TIME

    return {
        "uuid": record.uuid,
        "link": record.link,
        "case_id": record.case_id,
        "itar": record.itar,
        "creator": record.creator,
        "timestamp": record.timestamp,
        "users_with_access": record.users_with_access,
        "expired": record.expired,
        "expiration_date": expiration_date,
        "customer": record.customer,
        "storage_region": record.storage_region,
        "status": record.status,
    }


def get_link(
    uuid_str: str,
    current_user: User,
):
    """
    Admin users may retrieve any link.

    User-role accounts may retrieve only links
    they created or links where they are listed
    in users_with_access.
    """
    with Session() as session:
        stmt = select(LinkRecord).where(LinkRecord.uuid == uuid_str)
        record = session.scalar(stmt)

        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

        is_admin = "Admin" in current_user.roles

        users_with_access = record.users_with_access or []

        user_has_access = "User" in current_user.roles and (record.creator == current_user.username or current_user.username in users_with_access)

        if not is_admin and not user_has_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=("User does not have access to this upload link"))

        logger.debug("Retrieved link record for UUID %s", uuid_str)

        return {
            "uuid": record.uuid,
            "link": record.link,
            "case_id": record.case_id,
            "itar": record.itar,
            "creator": record.creator,
            "timestamp": record.timestamp,
            "expiration_date": record.expiration_date,
            "users_with_access": record.users_with_access,
            "expired": record.expired,
            "storage_region": record.storage_region,
            "customer": record.customer,
            "status": record.status,
        }


def get_all_links(
    current_user: User,
):
    """
    Admin users can retrieve all links.

    User-role accounts can retrieve links they
    created. Admin takes precedence when an
    account has both roles.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    if "Admin" in current_user.roles:
        logger.debug(
            "Admin user %s retrieving all link records",
            current_user.username,
        )

        with Session() as session:
            stmt = select(LinkRecord)
            records = session.scalars(
                stmt,
            ).all()

            return [_serialize_link_record(record) for record in records]

    if "User" in current_user.roles:
        logger.debug(
            "User %s retrieving their own link records",
            current_user.username,
        )

        with Session() as session:
            stmt = select(
                LinkRecord,
            ).where(
                LinkRecord.creator == current_user.username,
            )

            records = session.scalars(
                stmt,
            ).all()

            return [_serialize_link_record(record) for record in records]

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=("User does not have permission to access this resource"),
    )


def get_all_files_for_link(uuid_str: str, current_user: User):
    """
    Gets all file names and data from a specific link UUID.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    if not uuid_str:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link UUID not found")
    with Session() as session:
        stmt1 = select(LinkRecord).where(LinkRecord.uuid == uuid_str)
        link_record = session.scalar(stmt1)
        if link_record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
        if link_record.expired:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Associated link is expired")
        stmt2 = select(UploadRecord).where(UploadRecord.link_uuid == uuid_str)
        records = session.scalars(stmt2).all()
        result = []
        for r in records:
            if (r.timestamp - datetime.datetime.now(UTC)).days >= r.max_days_in_storage:
                raise HTTPException(status_code=status.HTTP_410_GONE, detail="Associated data is expired")
            result.append({"upload_id": r.upload_id, "filename": r.original_filename, "file_name": r.original_filename, "size": r.combined_file_size, "blob_name": r.blob_name, "content_type": r.content_type, "date_uploaded": r.date_uploaded})
            logger.info(f"Retrieved file record for link UUID {uuid_str}: {r.original_filename}, upload ID: {r.upload_id}")
        return result
