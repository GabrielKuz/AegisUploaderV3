import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from modules import Session, engine
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated, requireRole, requireRoles
from modules.DataCleaner import expireAndDeleteOldData
from modules.deletionRequest import router as deletionRequest_router
from modules.downloadData import downloadData
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links, get_link
from modules.telemetry import setup_telemetry, TelemetryMiddleware
from modules.uploader import router as uploader_router, listFiles
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from sqlalchemy import text
from typing import Annotated
from Utils import IsUUID
from warnings import deprecated
from zoneinfo import ZoneInfo
from modules.logging import setup_logging

logging.basicConfig(level=logging.INFO) # setup logging server. TODO: change to file and add more logging
testing = False
scheduler = AsyncIOScheduler(timezone=ZoneInfo("America/New_York"))
interval = testing 
from modules.refreshStatus import update_link_status_from_hubspot

@asynccontextmanager
async def lifespan(app: FastAPI):
    if interval:
        scheduler.add_job(
            expireAndDeleteOldData,
            trigger="interval",
            seconds=30,
            id="test_cleanup",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scheduler.add_job(
            update_link_status_from_hubspot,
            trigger="interval",
            seconds=30,
            id="test_link_status_refresh",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )   
    else:
        scheduler.add_job( # every 6 hours on the hour
            expireAndDeleteOldData,
            trigger="cron",
            hour="0,6,12,18",
            minute="0",
            id="daily_cleanup",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scheduler.add_job(
            update_link_status_from_hubspot,
            trigger="cron",
            hour="*", # every hour on the hour
            minute="0",
            id="link_status_refresh",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(title="Aegis Backend", root_path="/api", debug=False, docs_url=None, redoc_url=None,  lifespan=lifespan)
app.include_router(uploader_router)
app.include_router(deletionRequest_router)
setup_telemetry(app)  # init opentelemetry
app.add_middleware(TelemetryMiddleware)
@app.post("/links/create/")
def create_link(link_request: LinkRequest, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
    #authentication: bool = userAuthenticated(getCurrentUser())
    return generate_links(link_request, current_user)

@app.get("/links/")
def get_links(current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
    return get_all_links(current_user)

@app.get("/links/{uuid}")
def get_link_endpoint(uuid: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
    if not IsUUID(uuid):
        badUUID = HTTPException(400,detail={"message": "Invalid uuid"})
        raise badUUID
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
def download_link(uuid: str, currentUser: Annotated[User, Depends(requireRoles("User", "Admin"))]):  
    uploads = listFiles(uuid, currentUser)
    if len(uploads) == 1:
        return downloadData(uploads[0]["upload_id"], currentUser)
    if not uploads:
        raise HTTPException(status_code=404, detail="No uploads found for this link")
    return uploads

@app.get("/links/{uuid}")
def getLinkInfo(uuid: str, currentUser: Annotated[User, Depends(requireRoles("User", "Admin"))]):  
    data = get_all_links(currentUser)
    for link in data:
        if link["uuid"] == uuid:
            return link
    raise HTTPException(status_code=404, detail="Link not found")


if __name__ == "__main__": # Doesnt get run by docker
    setup_logging()
    main()