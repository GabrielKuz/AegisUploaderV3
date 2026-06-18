from fastapi import FastAPI, Depends
from modules.LinkGenerator import LinkRequest, generate_links
from modules.auth import getCurrentActiveUser, User
from modules.uploader import router as uploader_router
from typing import Annotated

app = FastAPI(title="Aegis Backend")
app.include_router(uploader_router)

@app.post("/backend/links/")
def create_link(link_request: LinkRequest):
    return generate_links(link_request)

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/auth/me")
def get_current_user(user: Annotated[User, Depends(getCurrentActiveUser)]):
    return {"username": user.username, "disabled": user.disabled}



def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
