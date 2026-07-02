from modules.auth import User
from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from modules import Session
from modules.HubSpotIntegration import is_caseExpirable
from modules.models import UploadRecord, LinkRecord

session = Session()

# If user is authenticated and authorized, return a a redirect response to the sas link
def downloadData(upload_id: str, currentUser: User) -> RedirectResponse:
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

    caseID = session.execute("""SELECT case_id FROM "LinkDB".uploads WHERE upload_id = :upload_id""", {"upload_id": upload_id}).scalar()
    if caseID is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )
    if is_caseExpirable(caseID):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This upload has expired and is no longer available for download.",
        )

    if not currentUser or currentUser.disabled:
        raise unauthenticated

    if not upload_id: # Check if upload_id is provided
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    upload = session.execute(
        text("""
            SELECT sas_retrieval_link, users_with_access
            FROM "LinkDB".uploads
            WHERE upload_id = :upload_id
        """),
        {"upload_id": upload_id},
    ).first()

    if upload is None: # No upload matching id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )

    sasLink, accessList = upload

    if not accessList or currentUser.username not in accessList: #Not authorized
        raise unauthorized

    if not sasLink: # No sas link was generated
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retrieval link not found",
        )
    logAccess(upload_id, currentUser) # log for auditting purposes
    return RedirectResponse( # Return a redirect response for the browser to follow 
        url=sasLink,
        status_code=status.HTTP_302_FOUND,
    )


def logAccess(upload_id: str, currentUser: User): #TODO: replace once on azure
    print(f"User {currentUser.username} accessed upload {upload_id}")