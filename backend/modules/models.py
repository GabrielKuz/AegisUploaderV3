import AppConstants
import enum
import secrets
import sqlalchemy
import uuid

from datetime import datetime, timezone, timedelta
from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON, Table, UniqueConstraint, ForeignKey, select, update
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship

Base = declarative_base()

#=======================================================================================================
# Upload models and classes
#=======================================================================================================

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
    expected_hash = Column(Text, nullable=False)
    hash_algorithm = Column(String(32), nullable=False, default="blake3")
    received_ranges = Column(MutableList.as_mutable(JSON), nullable=False,default=lambda: [])# inclusive start, exclusive end, list of lists [[start1, end1], [start2, end2], ...]
    received_size = Column(BigInteger, nullable=False, default=0)
    chunk_size = Column(BigInteger, nullable=False) # so if we change size we can still continue old sessions
    completed = Column(Boolean, nullable=False, default=False)
    created = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    last_activity = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    itar_status = Column(Boolean, default=False, nullable=False)
    storage_region = Column(sqlalchemy.Enum(StorageRegion), nullable=False)

class UploadChunk(Base):
    __tablename__ = "upload_chunks"
    __table_args__ = (
        UniqueConstraint("upload_id", "offset",name="uq_upload_chunk_offset"),
        {"schema": "LinkDB"}
    )
    id = Column(UUID(as_uuid=False), primary_key=True,default=lambda: str(uuid.uuid4()) )
    upload_id = Column( UUID(as_uuid=False), ForeignKey("LinkDB.upload_sessions.upload_id"),nullable=False, index=True)
    offset = Column(BigInteger, nullable=False)
    size = Column(Integer,nullable=False)
    chunk_index = Column(Integer, nullable=False)
    hash = Column( String(64), nullable=False)
    algorithm = Column(String(32),nullable=False,default="blake3")
    uploaded = Column(Boolean,nullable=False, default=True)

class UploadRecord(Base): # "LinkDB".uploads table
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    link_uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("LinkDB.links.uuid"), nullable=False, index=True)
    case_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[object | None] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    itar_status: Mapped[bool | None] = mapped_column(Boolean, default=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON, nullable=True)
    parent: Mapped["LinkRecord"] = relationship(back_populates="child", primaryjoin="UploadRecord.link_uuid == LinkRecord.uuid",)
    upload_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(Text, nullable=True)
    blob_name = Column(Text, nullable=True) # Azure
    content_type = Column(Text, nullable=True) # MIME
    file_hash = Column(Text, nullable=True) # server side hash
    date_uploaded = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    combined_file_size = Column(BigInteger)
    max_days_in_storage = Column(Integer, default=30)
    original_link = Column(Text, nullable=True)
    sas_retrieval_link = Column(Text, nullable=True)
    storage_region = Column(sqlalchemy.Enum(StorageRegion), nullable=True) # US, EU, ITAR
    upload_complete = Column(Boolean, default=False)
    for_deletion = Column(Boolean, default=False, nullable=False)  # flag to mark the record for deletion

#=======================================================================================================
# Link record model
#=======================================================================================================

class LinkRecord(Base): # "LinkDB".links table
    __tablename__ = "links"
    __table_args__ = {"schema": "LinkDB"}
    uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str | None] = mapped_column(String)
    timestamp: Mapped[object | None] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    itar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON)
    child: Mapped[list["UploadRecord"]] = relationship(back_populates="parent")
    link = Column(String)
    creator = Column(String) # From entra token
    expiration_date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc) + AppConstants.LINK_EXPIRATION_TIME)# 48 hours from creation
    expired = Column(Boolean)
    customer = Column(String, nullable=True) # Company
    status = Column(String, nullable=True) # Status from Hubspot



#=======================================================================================================
# Table update from other function
#=======================================================================================================

def update_other_from_self(home, target, session, target_field_name, home_field_name) -> None:
    if not hasattr(home, home_field_name):
        raise AttributeError(f"{type(home).__name__} has no attribute '{home_field_name}'")
    if not hasattr(target, target_field_name):
        raise AttributeError(f"{type(target).__name__} has no attribute '{target_field_name}'")

    value = getattr(home, home_field_name)
    setattr(target, target_field_name, value)
    if session is not None:
        session.add(target)
        session.flush()

def update_similar_between_LinkDB_and_UploadDB(session):
    linksimilar = ["uuid","case_id","timestamp","itar","users_with_access"]
    uploadsimilar = ["link_uuid","case_id","timestamp","itar_status","users_with_access"]

    uploads = session.scalars(select(UploadRecord)).all()
    for upload in uploads:
        #Next three lines are used so that the function can be passed into other files with no issue as link my not be defined before hand
        link = session.scalar(select(LinkRecord).where(LinkRecord.uuid == upload.link_uuid))
        if link is None:
            continue

        for link_field, upload_field in zip(linksimilar, uploadsimilar):
            update_other_from_self(link, upload, session, upload_field, link_field)

    session.commit()
