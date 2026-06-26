from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


import uuid

class UploadRecord(Base):
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    upload_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    link_uuid = Column(UUID(as_uuid=False), nullable=False, index=True)
    original_filename = Column(Text, nullable=True)
    blob_name = Column(Text, nullable=True)
    content_type = Column(Text, nullable=True)
    sha256 = Column(Text, nullable=True)
    date_uploaded = Column(DateTime, nullable=False)
    itar_status = Column(Boolean, default=False)
    combined_file_size = Column(BigInteger)
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
    uuid = Column(UUID(as_uuid=False), primary_key=True)
    link = Column(String)
    case_id = Column(String)
    creator = Column(String)
    timestamp = Column(DateTime)
    expiration_date = Column(DateTime)
    itar = Column(Boolean)
    users_with_access = Column(JSON)
    expired = Column(Boolean)
