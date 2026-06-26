from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine, select, update
from typing import Dict
from modules.auth import User
from modules.models import LinkRecord
import os
from modules import Session, engine

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is required")

class LinkRequest(BaseModel):
    case_id: str = Field(..., description="ID of the case associated with the link")
    itar: bool = Field(..., description="Indicates if the link is ITAR compliant")


link_data: Dict[str, LinkRequest] = {}

url = f"http://{os.getenv('BACKEND_URL')}/backend/links/"


def generate_links(link_request: LinkRequest, current_user: User):
    """
    Generates link and UUID and assigns them to the provided case ID and ITAR status. 
    Stores the link in the database.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

    uuid_str = str(uuid.uuid4())

    store_link(link_request, uuid_str, current_user)

    return {
        "link": url + uuid_str,
        "uuid": uuid_str
    }


def store_link(link_request: LinkRequest,uuid_str: str, current_user: User):
    """
    Stores the generated link and UUID in the database with associated case ID, 
    ITAR status, creator, timestamp, users with access, expiration date, and expiration status.
    """
    print("STORE_LINK CALLED", uuid_str)

    with Session() as session:
        record = LinkRecord(
            uuid=uuid_str,
            link=url + uuid_str,
            case_id=link_request.case_id,
            itar=link_request.itar,
            creator=current_user.username,
            timestamp=datetime.now(),
            users_with_access=[current_user.username],
            expired=False
        )

        # print("TABLE:", LinkRecord.__table__)
        # print("SCHEMA:", LinkRecord.__table__.schema)
        # print("FULLNAME:", LinkRecord.__table__.fullname)

        session.add(record)
        session.commit()


def expire_old_links(expiry_days: int = 2):
    """
    Checks if the current timestamp is past a link's expiration date.
    Expires links that are older than the specified number of days (default is 2 days).
    """
    cutoff = datetime.now() - timedelta(days=expiry_days)

    with Session() as session:
        stmt = select(LinkRecord).where(
            (LinkRecord.expired == False) |
            (LinkRecord.expired.is_(None))
        )

        records = session.scalars(stmt).all()

        for record in records:
            if not record.timestamp:
                continue

            try:
                ts_dt = record.timestamp
            except Exception:
                continue

            if ts_dt <= cutoff:
                record.expired = True
            else:
                record.expired = False

        session.commit()

def extend_link_expiration(uuid_str: str, current_user: User, extension: int):
    """
    Extends expiration date by specified number of days for a specific link
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

    with Session() as session:
        stmt = select(LinkRecord).where(LinkRecord.uuid == uuid_str)
        record = session.scalar(stmt)

        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link not found"
            )

        if record.creator != current_user.username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to extend this link"
            )
        
        if extension <= 0 or not isinstance(extension, int):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Extension must be a positive integer"
            )

        expire_old_links(expiry_days=extension)
        session.commit()

def get_all_links(current_user: User):
    """
    Retrieves all links from the database and returns them as a list of dictionaries.
    """
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    with Session() as session:
        stmt = select(LinkRecord)
        records = session.scalars(stmt).all()
        result = []
        for r in records:
            result.append({
                "uuid": r.uuid,
                "link": r.link,
                "case_id": r.case_id,
                "itar": r.itar,
                "creator": r.creator,
                "timestamp": r.timestamp.isoformat() if r.timestamp is not None else None,
                "users_with_access": r.users_with_access,
                "expired": r.expired,
            })

        return result