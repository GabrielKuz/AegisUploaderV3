from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON, Table, ForeignKey
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship


Base = declarative_base()


import uuid

class UploadRecord(Base): # "LinkDB".uploads table
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    upload_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    link_uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("LinkDB.links.uuid"), nullable=False, index=True)
    case_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[object | None] = mapped_column(DateTime)
    itar_status: Mapped[bool | None] = mapped_column(Boolean, default=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON, nullable=True)
    link: Mapped["LinkRecord"] = relationship(back_populates="uploads")
    original_filename = Column(Text, nullable=True)
    blob_name = Column(Text, nullable=True) # Azure
    content_type = Column(Text, nullable=True) # MIME
    sha256 = Column(Text, nullable=True) # server side hash
    date_uploaded = Column(DateTime, nullable=False)
    combined_file_size = Column(BigInteger)
    max_days_in_storage = Column(Integer, default=30)
    original_link = Column(Text, nullable=True)
    sas_retrieval_link = Column(Text, nullable=True)
    upload_complete = Column(Boolean, default=False)
    for_deletion = Column(Boolean, default=False, nullable=False)


class LinkRecord(Base): # "LinkDB".links table
    __tablename__ = "links"
    __table_args__ = {"schema": "LinkDB"}
    uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    link: Mapped[str | None] = mapped_column(String)
    case_id: Mapped[str | None] = mapped_column(String)
    timestamp: Mapped[object | None] = mapped_column(DateTime)
    itar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON)
    uploads: Mapped[list["UploadRecord"]] = relationship(back_populates="link")
    creator = Column(String) # From entra token
    expiration_date = Column(DateTime, nullable=False)# 48 hours from creation
    expired = Column(Boolean)