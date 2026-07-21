from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select, update
from typing import Dict
from modules.HubSpotIntegration import get_caseITARstatus, caseIDExists, get_caseCompany, get_caseStatus
from modules.auth import User
from modules.models import LinkRecord, UploadRecord, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
import os
import AppConstants
from warnings import warn, deprecated
from modules import Session, engine
from Utils import IsCaseID

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is required")

class LinkRequest(BaseModel): # structure of a link request from the client
    case_id: str = Field(..., description="ID of the case associated with the link")


link_data: Dict[str, LinkRequest] = {} # mapping uuid to case info

url = f"https://{os.getenv('FRONTEND_URL') or 'localhost'}/uploads/" # base url to be concatenated with the uuid


def generate_links(link_request: LinkRequest, current_user: User):
    """
    Creates a new link with a unique UUID and stores it in the database.
    """
    if not current_user or current_user.disabled: # Check user authentication
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    if not IsCaseID(link_request.case_id):
        raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Case-ID: Bad Request"
            )
    if not caseIDExists(link_request.case_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case-ID not found")
        
    uuid_str = str(uuid.uuid4()) # New uuidv4 on every link. We assume no collissions due to large space and link expiration

    store_link(link_request, uuid_str, current_user) # add to db

    if not url or not uuid_str:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link or UUID not found")

    return {
        "link": url + uuid_str,
        "uuid": uuid_str
    }


def store_link(link_request: LinkRequest, uuid_str: str, current_user: User):
    """
    Stores generated link in the SQL database with metadata.
    """
    with Session() as session: # Open db session
        record = LinkRecord( # Create new link record for "LinkDB".links table
            uuid=uuid_str,
            link=url + uuid_str,
            case_id=link_request.case_id,
            itar=get_caseITARstatus(link_request.case_id),
            creator=current_user.username,
            timestamp=datetime.now(timezone.utc),
            expiration_date=datetime.now(timezone.utc) + AppConstants.LINK_EXPIRATION_TIME, # Always expires after the default expiration time
            users_with_access=[current_user.username], # TODO: Change to inclide the admin list
            expired=False,
            customer=get_caseCompany(link_request.case_id) or "Unknown",
            status=get_caseStatus(link_request.case_id) or "Unknown"
        )

        # print("TABLE:", LinkRecord.__table__) 
        # print("SCHEMA:", LinkRecord.__table__.schema)
        # print("FULLNAME:", LinkRecord.__table__.fullname)

        session.add(record) # add new reccord to session
        session.commit() # commit session to db so it persists
        update_similar_between_LinkDB_and_UploadDB(session)

def _serialize_link_record(record: LinkRecord):
    """
    Organizes link data into a dictionary format for API response.
    """
    expiration_date = None
    if record.timestamp is not None:
        expiration_date = (record.timestamp + AppConstants.LINK_EXPIRATION_TIME)

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
        "status": record.status
    }


@deprecated("This endpoint shouldnt exist and will be removed in a future pr. Use /uploads/{upload_uuid}/extend")
def extend_link_expiration(uuid_str: str, current_user: User, extension: int):
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

def get_link(uuid_str: str): # get a link record from the db by uuid
    """
    Retrieves a link record from the database by its UUID.
    """
    with Session() as session:
        stmt = select(LinkRecord).where(LinkRecord.uuid == uuid_str) # Select the matching record
        record = session.scalar(stmt)# Get the first matching record (Should at most be one)
        if not record: # Not found
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

        return { # TODO: add in authorization check and also remove some of the more sensitive data getting returned
            "uuid": record.uuid,
            "link": record.link,
            "case_id": record.case_id,
            "itar": record.itar,
            "creator": record.creator,
            "timestamp": record.timestamp,
            "expiration_date": record.expiration_date,
            "users_with_access": record.users_with_access,
            "expired": record.expired,
            "customer": record.customer,
            "status": record.status
        }

def get_all_links(current_user: User): 
    """
    Gets all link records by UUID from the database.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    if current_user.role is "User":
        with Session() as session:
            stmt = select(LinkRecord).where(LinkRecord.creator == current_user.username)
            records = session.scalars(stmt).all()
            return [_serialize_link_record(r) for r in records]
    elif current_user.role is "Admin": # Admin can see all links
        with Session() as session:
            stmt = select(LinkRecord)
            records = session.scalars(stmt).all()
            return [_serialize_link_record(r) for r in records]
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have permission to access this resource"
        )
    
def get_all_files_for_link(uuid_str: str, current_user: User):
    """
    Gets all file names and data from a specific link UUID.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    if not uuid_str:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link UUID not found"
        )
    with Session() as session:
        stmt1 = select(LinkRecord).where(LinkRecord.uuid == uuid_str)
        link_record = session.scalar(stmt1)
        if link_record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link not found"
            )
        if link_record.expired:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Associated link is expired"
            )
        stmt2 = select(UploadRecord).where(UploadRecord.link_uuid == uuid_str)
        records = session.scalars(stmt2).all()
        result = []
        for r in records:
            if (r.timestamp - datetime.datetime.now(timezone.utc)).days >= r.max_days_in_storage:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Associated data is expired"
                )
            result.append({
                "upload_id": r.upload_id,
                "filename": r.original_filename,
                "file_name": r.original_filename,
                "size": r.combined_file_size,
                "blob_name": r.blob_name,
                "content_type": r.content_type,
                "date_uploaded": r.date_uploaded
            })
        return result
    