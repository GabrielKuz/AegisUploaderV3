from fastapi import FastAPI, Depends, HTTPException
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links, extend_link_expiration, get_link
from modules.auth import getCurrentActiveUser, getCurrentUser, User
from modules.uploader import router as uploader_router, listFiles
from modules.downloadData import downloadData
from modules import Session, engine
from typing import Annotated
from warnings import deprecated
from sqlalchemy import text
from contextlib import asynccontextmanager

# @asynccontextmanager
# async def lifespan():
#     async with engine.connect() as conn:
#         await conn.execute(text("ALTER TABLE links ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP"))
#         await conn.commit()
#     yield

app = FastAPI(title="Aegis Backend", root_path="/api")
app.include_router(uploader_router)

@app.post("/links/create/")
def create_link(link_request: LinkRequest, current_user: Annotated[User, Depends(getCurrentActiveUser)]):  # TODO: Change to getCurrentActiveUser after testing
    #authentication: bool = userAuthenticated(getCurrentUser())
    return generate_links(link_request, current_user) #TODO: CHANGE IMMENDIATLY AFTER TESTING

@app.get("/links/")
def get_links(current_user: Annotated[User, Depends(getCurrentActiveUser)]):  # TODO: Change to getCurrentActiveUser after testing
    return get_all_links(current_user)

@app.get("/links/{uuid}")
def get_link_endpoint(uuid: str, current_user: Annotated[User, Depends(getCurrentActiveUser)]):  # TODO: Change to getCurrentActiveUser after testing
    return get_link(uuid)

@app.patch("/links/{uuid}/extend")
def extend_link_endpoint(uuid: str, extension: int, current_user: Annotated[User, Depends(getCurrentActiveUser)]):  # TODO: Change to getCurrentActiveUser after testing
    return extend_link_expiration(uuid, current_user, extension)

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

@app.get("/links/{uuid}/download")
@deprecated("use /uploads/{upload_id}/download instead. This assumes only one uploaded file per link")
def download_link(uuid: str, currentUser: Annotated[User, Depends(getCurrentActiveUser)]):
    uploads = listFiles(uuid, currentUser)
    if len(uploads) == 1:
        return downloadData(uploads[0]["upload_id"], currentUser)
    if not uploads:
        raise HTTPException(status_code=404, detail="No uploads found for this link")
    return uploads


@app.get("/uploads/{upload_id}/download")
def download_upload(upload_id: str, currentUser: Annotated[User, Depends(getCurrentActiveUser)]):
    return downloadData(upload_id, currentUser)

if __name__ == "__main__":
    main()
