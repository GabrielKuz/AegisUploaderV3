import fastapi
import uuid

from fastapi import APIRouter, Depends, HTTPException
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated
from pydantic import Field, BaseModel
from typing import Annotated

router = APIRouter()

@router.post("/requestfordeletion/{link_uuid}") #Requests from client side to delete data. Only sends email 
def request_For_Data_Deletion(link_uuid: str):
    #TODO: send email once on azure via ACS
    raise HTTPException(
            status_code=200,
            detail=("This user wants to send an email to ask for data deletion for ",link_uuid,"."),
        )
