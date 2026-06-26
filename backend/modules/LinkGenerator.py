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

url = f"{os.getenv('BACKEND_URL')}/backend/links/"


def generate_links(link_request: LinkRequest, current_user: User):
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


def store_link(link_request: LinkRequest, uuid_str: str, current_user: User):
    with Session() as session:
        record = LinkRecord(
            uuid=uuid_str,
            link=url + uuid_str,
            case_id=link_request.case_id,
            itar=link_request.itar,
            creator=current_user.username,
            timestamp=datetime.now(),
            expiration_date=datetime.now() + timedelta(days=2),
            users_with_access=[current_user.username],
            expired=False,
        )

        # print("TABLE:", LinkRecord.__table__)
        # print("SCHEMA:", LinkRecord.__table__.schema)
        # print("FULLNAME:", LinkRecord.__table__.fullname)

        session.add(record)
        session.commit()


def expire_old_links(expiry_days: int = 2) -> bool:
    record_expiry: bool = False

    with Session() as session:
        stmt = select(LinkRecord).where(
            (LinkRecord.expired == False) |
            (LinkRecord.expired.is_(None))
        )

        records = session.scalars(stmt).all()

        for record in records:
            if not record.timestamp:
                record.timestamp = datetime.now()  # Set to current time if timestamp is None
            if not record.expiration_date:
                record.expiration_date = record.timestamp + timedelta(days=expiry_days)  # Set expiration date based on timestamp

            # cutoff: datetime = (record.expiration_date - timedelta(days=record.timestamp.day))

            if record.expiration_date <= datetime.now():
                record.expired = True
                record_expiry = True
            else:
                record.expired = False

        session.commit()
        return record_expiry

def extend_link_expiration(uuid_str: str, current_user: User, extension: int):
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

        record.expiration_date += timedelta(days=extension)
        record.expired = False
        session.commit()

def get_link(uuid_str: str):
    with Session() as session:
        stmt = select(LinkRecord).where(LinkRecord.uuid == uuid_str)
        record = session.scalar(stmt)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")

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
        }

def get_all_links(current_user: User):
    if not current_user or current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    with Session() as session:
        stmt = select(LinkRecord).where(LinkRecord.creator == current_user.username)
        records = session.scalars(stmt).all()
        result = []
        for r in records:
            result.append({
                "uuid": r.uuid,
                "link": r.link,
                "case_id": r.case_id,
                "itar": r.itar,
                "creator": r.creator,
                "timestamp": r.timestamp,
                "expiration_date": r.expiration_date,
                "users_with_access": r.users_with_access,
                "expired": r.expired,
            })

        return result