from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UploadRecord(Base):
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
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
