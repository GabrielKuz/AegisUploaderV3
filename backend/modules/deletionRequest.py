import fastapi
import uuid
from pydantic import Field, BaseModel
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated
router = APIRouter()

@router.post("/requestfordeletion/{link_uuid}")
def request_For_Data_Deletion(link_uuid: str,
                              current_user: Annotated[User, Depends(getCurrentActiveUser)]
                              ):
    raise HTTPException(
            status_code=200,
            detail=("This user wants to send an email to ask for data deletion for ",link_uuid,"."),
        )