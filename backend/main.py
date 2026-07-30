import logging
from typing import Annotated
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException

from modules.auth import User, requireRoles
from modules.deletionRequest import router as deletionRequest_router
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links, get_link
from modules.log_config import setup_logging
from modules.rateLimit import rate_limit
from modules.uploader import router as uploader_router
from Utils import IsUUID

logging.basicConfig(level=logging.INFO)  # setup logging server. TODO: change to file and add more logging
testing = False
scheduler = AsyncIOScheduler(timezone=ZoneInfo("America/New_York"))
interval = testing


app = FastAPI(title="Aegis Backend", root_path="/api", debug=False, docs_url=None, redoc_url=None)
app.include_router(uploader_router)
app.include_router(deletionRequest_router)


# setup_telemetry(app)  # init opentelemetry
# app.add_middleware(TelemetryMiddleware)
@app.post("/links/create/")
@rate_limit(limit=5, window=60, key=lambda args: getattr(args.get("current_user"), "username", "unknown"))  # Limit to 5 requests per minute per user
def create_link(link_request: LinkRequest, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
    # authentication: bool = userAuthenticated(getCurrentUser())
    return generate_links(link_request, current_user)


@app.get("/links/")
@rate_limit(limit=15, window=60, key=lambda args: getattr(args.get("current_user"), "username", "unknown"))
def get_links(current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):  # TODO: Change to getCurrentActiveUser after testing
    return get_all_links(current_user)


@app.get("/links/{uuid}")
def get_link_endpoint(uuid: str, current_user: Annotated[User, Depends(requireRoles("User", "Admin"))]):
    if not IsUUID(uuid):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid uuid",
            },
        )

    return get_link(uuid, current_user)


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def main():  # start the app when run directly and not through docker
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":  # Doesnt get run by docker
    setup_logging()
    main()
