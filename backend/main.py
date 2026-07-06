from fastapi import FastAPI, Depends, HTTPException
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links, get_all_files_for_link
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links, get_link
from modules.auth import getCurrentActiveUser, getCurrentUser, User
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated
from modules.uploader import router as uploader_router, listFiles
from modules.deletionRequest import router as deletionRequest_router
from modules.downloadData import downloadData
from modules import Session, engine
from typing import Annotated
from warnings import deprecated
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from zoneinfo import ZoneInfo
from modules.DataCleaner import expireAndDeleteOldData
from sqlalchemy import text
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from modules.telemetry import setup_telemetry
from contextlib import asynccontextmanager
import logging

logging.basicConfig(level=logging.INFO) # setup logging server. TODO: change to file and add more logging

scheduler = AsyncIOScheduler(timezone=ZoneInfo("America/New_York"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        expireAndDeleteOldData,
        trigger="cron",
        hour=0,
        minute=0,
        id="daily_cleanup",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(title="Aegis Backend", root_path="/api", lifespan=lifespan)
app.include_router(uploader_router)
app.include_router(deletionRequest_router)
FastAPIInstrumentor.instrument_app(app)
setup_telemetry(app)  # init opentelemetry
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


@app.get("/")
def read_root():
    return {"status": "ok"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup():
    logging.info("Server started on http://localhost:8000")
    logging.info(f"Frontend accessible at http://{__import__('socket').gethostbyname(__import__('socket').gethostname())}.sslip.io")

def main(): # start the app when run directly and not through docker
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

@app.get("/links/{uuid}")
def getLinkInfo(uuid: str, currentUser: Annotated[User, Depends(getCurrentActiveUser)]):
    data = get_all_links(currentUser)
    for link in data:
        if link["uuid"] == uuid:
            return link
    raise HTTPException(status_code=404, detail="Link not found")

@app.get("/uploads/{upload_id}/download")
def download_upload(upload_id: str, currentUser: Annotated[User, Depends(getCurrentActiveUser)]):
    return downloadData(upload_id, currentUser)

if __name__ == "__main__": # Doesnt get run by docker
    main()

