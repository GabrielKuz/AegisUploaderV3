from modules.auth import User
from fastapi import HTTPException, status
from fastapi.responses import FileResponse
from pathlib import Path
from modules import Session
from modules.models import UploadRecord

session = Session()

# If user is authenticated and authorized, return file
def downloadData(upload_id: str, currentUser: User) -> FileResponse:
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

    if not currentUser or currentUser.disabled: #Check authentication
        raise unauthenticated

    if not upload_id: # Check if upload_id is provided
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    upload = session.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()

    if upload is None: # No upload matching id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    accessList = upload.users_with_access or []

    if not accessList or currentUser.username not in accessList: #Not authorized
        raise unauthorized

    file_path = upload.sas_retrieval_link or upload.original_link
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retrieval file not found",
        )
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retrieval file not found",
        )
    logAccess(upload_id, currentUser) # log for auditting purposes
    return FileResponse(path, filename=upload.original_filename or path.name, media_type=upload.content_type or "application/octet-stream")


def logAccess(upload_id: str, currentUser: User): #TODO: replace once on azure
    print(f"User {currentUser.username} accessed upload {upload_id}")