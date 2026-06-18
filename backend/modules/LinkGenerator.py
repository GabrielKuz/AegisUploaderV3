from fastapi import FastAPI
from pydantic import BaseModel, Field
import uuid

class LinkRequest(BaseModel):
    users_with_access: list[str] = Field(..., description="List of users who should have access to the link")
    case_id: str = Field(..., description="ID of the case associated with the link")
    link: str = Field(..., description="The generated link")
    creator: str = Field(..., description="The user who created the link")
    timestamp: str = Field(..., description="The timestamp when the link was created")
    uuid: str = Field(str(uuid.uuid4()), description="A unique identifier for the link")

link_data: dict[str, LinkRequest] = {}

def generate_links(link_request: LinkRequest):
    return {"users_with_access": link_request.users_with_access, 
            "case_id": link_request.case_id, 
            "link": link_request.link + "/links/" + link_request.uuid, 
            "creator": link_request.creator, 
            "timestamp": link_request.timestamp}