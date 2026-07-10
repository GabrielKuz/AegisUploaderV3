from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


import uuid

class UploadRecord(Base): # "LinkDB".uploads table
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    upload_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    link_uuid = Column(UUID(as_uuid=False), nullable=False, index=True) 
    original_filename = Column(Text, nullable=True)
    blob_name = Column(Text, nullable=True) # Azure
    content_type = Column(Text, nullable=True) # MIME
    sha256 = Column(Text, nullable=True) # server side hash
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
    for_deletion = Column(Boolean, default=False, nullable=False)  # flag to mark the record for deletion


class LinkRecord(Base): # "LinkDB".links table
    __tablename__ = "links"
    __table_args__ = {"schema": "LinkDB"}
    uuid = Column(UUID(as_uuid=False), primary_key=True)
    link = Column(String) # full url to the link
    case_id = Column(String) # from hubspot
    creator = Column(String) # From entra token
    timestamp = Column(DateTime)
    expiration_date = Column(DateTime, nullable=False)# 48 hours from creation
    itar = Column(Boolean, default=False, nullable=False) # From hubspot
    users_with_access = Column(JSON)
    expired = Column(Boolean)
#TODO: Add a relation between the two tables