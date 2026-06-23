from fastapi import FastAPI

from modules.uploader import router as uploader_router

from modules.downloadData import downloadData
from modules.auth import getCurrentUser, User, getCurrentActiveUser, getCurrentUserNoAuthForTest
from fastapi import Depends
from typing import Annotated

app = FastAPI(title="Aegis Backend", root_path="/api")
app.include_router(uploader_router)

@app.get("/")
def read_root():
    return {"status": "ok"}


def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

@app.get("/links/{uuid}/download")
def download_link(uuid: str, currentUser: Annotated[User, Depends(getCurrentUserNoAuthForTest)]):
    return downloadData(uuid, currentUser)

if __name__ == "__main__":
    main()
