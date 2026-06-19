from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, UploadFile

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/files/") # Define a POST endpoint at the path "/files/" that allows clients to upload files. The function create_file will handle the incoming file data.
async def create_file(
    file: Annotated[bytes | None, File(description="A file read as bytes")] = None, # Define the file parameter, which would be automatically read as bytes by FastAPI. If no file is provided, it defaults to None. And a description is added to the File for possibly some connection to the front end.
):
    if file is None: # If no file is provided, return a message indicating that no file is present.
        return {"message": "No file present"}
    return {"file_size": len(file)} # If a file is provided, return the size of the file in bytes by calculating the length of the byte content.


@router.post("/uploadfile/") # Define a POST endpoint at the path "/uploadfile/" that allows clients to upload files. The function create_upload_file will handle the incoming file data as an UploadFile object, which provides more metadata and functionality compared to raw bytes.
async def create_upload_file(
    file: Annotated[UploadFile | None, File(description="A file read as UploadFile")] = None, # Define the file parameter, which would be automatically read as an UploadFile by FastAPI. If no file is provided, it defaults to None. And a description is added to the File for possibly some connection to the front end.
):
    if file is None: # If no file is provided, return a message indicating that no upload file is sent.
        return {"message": "No upload file sent"}

    contents = await file.read() # If file is present it will read it and upload to the path
    destination = UPLOAD_DIR / Path(file.filename).name

    with destination.open("wb") as f:
        f.write(contents)

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "path": str(destination),
    }


def get_file_size(file: UploadFile) -> int: # Gets the file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    return size


def get_file_type(file: UploadFile): # Gets the file type
    return file.content_type


def get_file_name(file: UploadFile): # Gets the file name
    return file.filename


