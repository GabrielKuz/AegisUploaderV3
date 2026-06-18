from fastapi import FastAPI
from modules.LinkGenerator import LinkRequest, generate_links

from modules.uploader import router as uploader_router

app = FastAPI(title="Aegis Backend")
app.include_router(uploader_router)

@app.post("/backend/links/")
def create_link(link_request: LinkRequest):
    return generate_links(link_request)

@app.get("/")
def read_root():
    return {"status": "ok"}


def main():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
