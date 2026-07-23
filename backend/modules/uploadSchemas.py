from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, UUID4, ConfigDict

# POST /uploadfile/{link_uuid}/start
class StartUploadHeaders(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    filename: str = Field(alias="X-File-Name")
    file_hash: str = Field(alias="X-File-Hash")
    file_size: int = Field(alias="X-File-Size", gt=0)
    user_location: Literal["US", "EU"] = Field(
        default="US",
        alias="X-User-Location",
    )

class StartUploadResponse(BaseModel):
    uploadToken: str
    chunkSize: int


# POST /uploadfile/{link_uuid}/{upload_token}
class UploadChunkHeaders(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    chunk_offset: int = Field(alias="X-Chunk-Offset", ge=0)
    chunk_size: int = Field(alias="X-Chunk-Size", gt=0, le=4*1024*1024)
    chunk_hash: str = Field(alias="X-Chunk-Hash")

class UploadChunkResponse(BaseModel):
    received: int
    offset: int
    hash: str
    ranges: list[list[int]] | None = None


# GET /uploadfile/{link_uuid}/{upload_token}/status
class UploadStatusResponse(BaseModel):
    receivedRanges: list[list[int]] | None = None
    receivedSize: int
    expectedSize: int
    chunkSize: int
    completed: bool
    chunksReceived: int


# POST /uploadfile/{link_uuid}/{upload_token}/complete
class CompleteUploadResponse(BaseModel):
    filename: str
    size: int
    file_hash: str
    completed: bool



# GET /links/{linkUUID}/files
class UploadedFileInfo(BaseModel):
    upload_id: UUID4
    filename: str
    size: int
    blob_name: str
    expiration_date: datetime | None
    upload_complete: bool
    date_uploaded: datetime | None


# POST /uploads/{upload_id}/mark_for_deletion
class MarkForDeletionResponse(BaseModel):
    message: str

# POST /uploads/{upload_id}/extend_expiration
class ExtendExpirationResponse(BaseModel):
    message: str
    newExpiration: int
    newExpirationDate: datetime | None