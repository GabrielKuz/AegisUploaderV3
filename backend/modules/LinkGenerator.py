from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text, Table, Column, String, MetaData, select, update, Boolean, ARRAY, inspect
from sqlalchemy.orm import Session
from typing import Dict
import os

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL, echo=True)
inspector = inspect(engine)
md = MetaData()

links = Table(
    "links",
    md,
    Column("uuid", String, primary_key=True),
    Column("link", String),
    Column("case_id", String),
    Column("creator", String),
    Column("timestamp", String),
    Column("users_with_access", ARRAY(String)),
    Column("expired", Boolean, default=False)
)

def setup():
    if not inspector.has_table("links"):
        md.create_all(engine)
        return True
    return False

class LinkRequest(BaseModel):
    case_id: str = Field(..., description="ID of the case associated with the link")

class User(BaseModel):
    username: str = Field(..., description="The username of the user")
    disabled: bool | None = Field(None, description="Indicates if the user is disabled")

link_data: Dict[str, LinkRequest] = {}

url: str = "http://localhost:8000/backend/links/" # base url for link generation, can be changed to actual domain when deployed

def generate_links(link_request: LinkRequest, auth: bool):
    if not auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    if url is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Link generation failure")

    uuid_str = str(uuid.uuid4())
    return {"link": url + uuid_str, 
            "uuid": uuid_str}

def store_link(link_request: LinkRequest, uuid_str: str, current_user: User):
    setup()
    with Session(engine) as session:
        stmt = links.insert().values(
            uuid=uuid_str,
            link=url + uuid_str,
            case_id=link_request.case_id,
            creator=current_user.username,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            users_with_access=[current_user.username],
            expired=False
        )
        session.execute(stmt)
        session.commit()


def expire_old_links():
    cutoff = datetime.now() - timedelta(days=2)
    with Session(engine) as session:
        stmt = select(links.c.uuid, links.c.timestamp, links.c.expired).where(
            (links.c.expired == False) | (links.c.expired == None)
        )
        rows = session.execute(stmt).fetchall()
        for row in rows:
            uuid_val, ts, _ = row
            if not ts:
                continue
            try:
                ts_dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
            except Exception:
                continue
            if ts_dt <= cutoff:
                upd = update(links).where(links.c.uuid == uuid_val).values(expired=True)
                session.execute(upd)
        session.commit()

if __name__ == "__main__":
    print(setup())
