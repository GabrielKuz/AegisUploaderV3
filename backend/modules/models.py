from datetime import datetime, timezone
import enum

from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()


import uuid

import uuid
import secrets
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import UUID, BigInteger, Boolean, Column, DateTime, Integer, JSON, String, Text

class StorageRegion(enum.Enum):
    US = "us"
    EU = "eu"
    ITAR = "itar"
class UploadSession(Base):
    __tablename__ = "upload_sessions"
    __table_args__ = (
        UniqueConstraint("link_uuid", "blob_name", name="uq_upload_blob_name_per_link"),
        {"schema": "LinkDB"}
    )

    upload_id = Column(UUID(as_uuid=False), primary_key=True,default=lambda: str(uuid.uuid4())) # To become the upload_id in UploadRecord, not exposed to the client
    upload_token = Column(String(64), nullable=False, unique=True, index=True, default=lambda: secrets.token_urlsafe(32)) # avoid exposing upload id to client
    link_uuid = Column(UUID(as_uuid=False), nullable=False, index=True)
    case_id = Column(String, nullable=False)
    blob_name = Column(Text, nullable=False, )# deconflicted filename
    original_filename = Column(Text, nullable=False)
    content_type = Column(Text, nullable=True) # mime
    expected_size = Column(BigInteger, nullable=False)
    expected_sha256 = Column(Text, nullable=False)
    received_ranges = Column(MutableList.asMutable(JSON), nullable=False,default=lambda: [])# inclusive start, exclusive end, list of lists [[start1, end1], [start2, end2], ...]
    received_size = Column(BigInteger, nullable=False, default=0)
    chunk_size = Column(BigInteger, nullable=False) # so if we change size we can still continue old sessions
    completed = Column(Boolean, nullable=False, default=False)
    created = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    last_activity = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    itar_status = Column(Boolean, default=False, nullable=False)
    storage_region = Column(enum.Enum(StorageRegion), nullable=False)

class UploadRecord(Base): # "LinkDB".uploads table
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    upload_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    link_uuid = Column(UUID(as_uuid=False), nullable=False, index=True) 
    original_filename = Column(Text, nullable=True)
    blob_name = Column(Text, nullable=True) # Azure
    content_type = Column(Text, nullable=True) # MIME
    sha256 = Column(Text, nullable=True) # server side hash
    date_uploaded = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    itar_status = Column(Boolean, default=False)
    combined_file_size = Column(BigInteger)
    timestamp = Column(DateTime)
    max_days_in_storage = Column(Integer, default=30)
    case_id = Column(String, nullable=True)
    original_link = Column(Text, nullable=True)
    sas_retrieval_link = Column(Text, nullable=True)
    upload_complete = Column(Boolean, default=False)
    users_with_access = Column(JSON, nullable=True)
    for_deletion = Column(Boolean, default=False, nullable=False)  # flag to mark the record for deletion


class LinkRecord(Base): # "LinkDB".links table
    __tablename__ = "links"
    __table_args__ = {"schema": "LinkDB"}
    uuid = Column(UUID(as_uuid=False), primary_key=True)
    link = Column(String) # full url to the link
    case_id = Column(String) # from hubspot
    creator = Column(String) # From entra token
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expiration_date = Column(DateTime, nullable=False)# 48 hours from creation
    itar = Column(Boolean, default=False, nullable=False) # From hubspot
    users_with_access = Column(JSON)
    expired = Column(Boolean)
#TODO: Add a relation between the two tables