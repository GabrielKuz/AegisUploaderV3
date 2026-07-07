from sqlalchemy import UUID, BigInteger, Column, String, Integer, DateTime, Boolean, Text, JSON, Table, ForeignKey
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
from sqlalchemy import update




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

    SHARED_FIELD_MAP = {
        "uuid": "link_uuid",
        "case_id": "case_id",
        "timestamp": "timestamp",
        "itar": "itar_status",
        "users_with_access": "users_with_access",
    }

    def propagate_shared_fields(self, session, field_names: list[str] | None = None) -> None:
        if field_names is None:
            field_names = list(self.SHARED_FIELD_MAP.keys())
        elif isinstance(field_names, str):
            field_names = [field_names]

        for parent_field in field_names:
            child_field = self.SHARED_FIELD_MAP.get(parent_field, parent_field)
            value = getattr(self, parent_field)
            session.execute(
                update(UploadRecord)
                .where(UploadRecord.link_uuid == self.uuid)
                .values(**{child_field: value})
            )

        session.commit()

    def update_and_propagate(self, session, **updates) -> None:
        for field_name, value in updates.items():
            setattr(self, field_name, value)

        session.add(self)
        self.propagate_shared_fields(session, field_names=list(updates.keys()))