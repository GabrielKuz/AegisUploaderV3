from modules.auth import User
from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from modules import Session
from modules.models import UploadRecord, LinkRecord
"""
LinkDB schema

links = Table(
    "links",
    md,
    Column("uuid", String, primary_key=True),
    Column("link", String),
    Column("case_id", String),
    Column("creator", String),
    Column("timestamp", String),
    Column("users_with_access", list[str]),
    Column("expired", Boolean),
    schema="LinkDB"
)

#Both tables defined elswhere. Defintions for reference and not neccesarrily up to date. Both are commented out
class UploadRecord(Base): 
    __tablename__ = "uploads"
    uuid = Column(String(36), primary_key=True)
    date_uploaded = Column(DateTime, nullable=False)
    itar_status = Column(Boolean, default=False)
    combined_file_size = Column(Integer)
    timestamp = Column(DateTime)
    max_days_in_storage = Column(Integer, default=30)
    case_id = Column(String, nullable=True)
    original_link = Column(Text, nullable=True)
    sas_retrieval_link = Column(Text, nullable=True)
    upload_complete = Column(Boolean, default=False)
    users_with_access = Column(JSON, nullable=True)
 
class LinkRecord(Base):
    __tablename__ = "links"
    __table_args__ = {"schema": "LinkDB"}
    uuid = Column(String, primary_key=True)
    link = Column(String)
    case_id = Column(String)
    creator = Column(String)
    timestamp = Column(String)
    users_with_access = Column(JSON)
    expired = Column(Boolean)
 
"""


session = Session()


def downloadData(upload_id: str, currentUser: User) -> RedirectResponse:
    unauthenticated = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    unauthorized = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this resource",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not currentUser or currentUser.disabled:
        raise unauthenticated

    if not upload_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    upload = session.execute(
        text("""
            SELECT sas_retrieval_link, users_with_access
            FROM "LinkDB".uploads
            WHERE upload_id = :upload_id
        """),
        {"upload_id": upload_id},
    ).first()

    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    sasLink, accessList = upload

    if not accessList or currentUser.username not in accessList:
        raise unauthorized

    if not sasLink:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retrieval link not found",
        )

    return RedirectResponse(
        url=sasLink,
        status_code=status.HTTP_302_FOUND,
    )


def logAccess(upload_id: str, currentUser: User):
    print(f"User {currentUser.username} accessed upload {upload_id}")