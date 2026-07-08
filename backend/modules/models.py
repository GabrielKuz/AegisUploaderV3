from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON, Table, ForeignKey, select, update
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship



Base = declarative_base()


import uuid

class UploadRecord(Base): # "LinkDB".uploads table
    __tablename__ = "uploads"
    __table_args__ = {"schema": "LinkDB"}
    link_uuid: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("LinkDB.links.uuid"), nullable=False, index=True)
    case_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[object | None] = mapped_column(DateTime)
    itar_status: Mapped[bool | None] = mapped_column(Boolean, default=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON, nullable=True)

    parent: Mapped["LinkRecord"] = relationship(
        back_populates="child",
        primaryjoin="UploadRecord.link_uuid == LinkRecord.uuid",
    )
    upload_id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
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
    case_id: Mapped[str | None] = mapped_column(String)
    timestamp: Mapped[object | None] = mapped_column(DateTime)
    itar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    users_with_access: Mapped[object | None] = mapped_column(JSON)
    child: Mapped[list["UploadRecord"]] = relationship(back_populates="parent")
    link = Column(String)
    creator = Column(String) # From entra token
    expiration_date = Column(DateTime, nullable=False)# 48 hours from creation
    expired = Column(Boolean)


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
