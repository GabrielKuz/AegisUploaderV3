import datetime
import inspect
import json
import inspect
import os

from typing import Any, Literal
from dataclasses import dataclass, field, asdict
from uuid import UUID
from enum import Enum
from functools import wraps
from modules import usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider, Session
from modules.models import StorageRegion, LinkRecord, UploadSession


EXCLUDED_FIELDS = {
    "db",
    "session",
    "current_user",
    "request",
    "background_tasks",
}

TRUNCATED_FIELDS = {
    "upload_token",
}

def serialize(key:str, value):
    if value is None:
        return None

    if key in TRUNCATED_FIELDS and isinstance(value, str):
        return truncateMiddle(value)

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, datetime.datetime):
        return value.isoformat()

    if isinstance(value, Enum):
        return value.value

    # User object
    if hasattr(value, "username"):
        return value.username

    return str(value)

def getRegionFromCaseId(case_id: str) -> StorageRegion: # Get the storage region for a given case id by querying the database
    db = Session()
    try:
        link_entry = db.query(LinkRecord).filter(LinkRecord.case_id == case_id).first()
        if link_entry is None:
            raise ValueError(f"No link entry found for case_id: {case_id}")
        return link_entry.storage_region
    finally:
        db.close()

def getRegionFromUploadID(upload_id: str) -> StorageRegion: # Get the storage region for a given upload id by querying the database
    db = Session()
    try:
        upload_session = db.query(UploadSession).filter(UploadSession.upload_id == upload_id).first()
        if upload_session is None:
            raise ValueError(f"No upload session found for upload_id: {upload_id}")
        return upload_session.storage_region
    finally:
        db.close()

def getRegionFromlinkID(link_id: str) -> StorageRegion: # Get the storage region for a given link id by querying the database
    db = Session()
    try:
        link_entry = db.query(LinkRecord).filter(LinkRecord.uuid == link_id).first()
        if link_entry is None:
            raise ValueError(f"No link entry found for link_id: {link_id}")
        return link_entry.storage_region
    finally:
        db.close()

def getCaseIdFromLinkID(link_id: str) -> str: # Get the case id for a given link id by querying the database
    db = Session()
    try:
        link_entry = db.query(LinkRecord).filter(LinkRecord.uuid == link_id).first()
        if link_entry is None:
            raise ValueError(f"No link entry found for link_id: {link_id}")
        return link_entry.case_id
    finally:
        db.close()

def getCaseIdFromUploadID(upload_id: str) -> str: # Get the case id for a given upload id by querying the database
    db = Session()
    try:
        upload_session = db.query(UploadSession).filter(UploadSession.upload_id == upload_id).first()
        if upload_session is None:
            raise ValueError(f"No upload session found for upload_id: {upload_id}")
        return upload_session.case_id
    finally:
        db.close()


def storageRegionToLiteral(region: StorageRegion) -> Literal["US", "EU", "ITAR"]: # Convert a StorageRegion enum to a string literal for use in the audit log
    match region:
        case StorageRegion.US:
            return "US"
        case StorageRegion.EU:
            return "EU"
        case StorageRegion.ITAR:
            return "ITAR"
        case _:
            raise ValueError(f"Unknown storage region: {region}")

@dataclass(slots=True)
class LogEntry:
    timestamp: datetime.datetime
    action: str
    case_id: str
    user: str
    details: dict[str, Any] = field(default_factory=dict)
    status: str = "success"


def truncateMiddle(value: str, prefix: int = 6, suffix: int = 4) -> str:
    if len(value) <= prefix + suffix:
        return value

    return f"{value[:prefix]}...{value[-suffix:]}"

def auditLog(location: Literal["US", "EU", "ITAR"] | None = None, fromParameter: str | None = None, parameterToRegionFunction: callable | None = None, parameterToCaseIdFunction: callable | None = None):
    def decorator_function(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if os.getenv("TESTING").lower() == "true":
                if inspect.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
            signature = inspect.signature(func)
            bound = signature.bind(*args, **kwargs)
            bound.apply_defaults()

            arguments = bound.arguments

            result = func(*args, **kwargs)
            if inspect.isawaitable(result):
                result = await result

            case_id = None
            if fromParameter is not None and parameterToCaseIdFunction is not None:
                param_value = arguments.get(fromParameter)
                if param_value is not None:
                    case_id = parameterToCaseIdFunction(param_value)

            user = "anonymous"
            current_user = arguments.get("current_user")
            if current_user is not None:
                user = current_user.username

            log_entry = LogEntry(
                timestamp=datetime.datetime.now(datetime.timezone.utc),
                action=func.__name__,
                case_id=case_id,
                user=user,
                details={
                    key: serialize(key, value)
                    for key, value in arguments.items()
                    if key not in EXCLUDED_FIELDS
                },
            )

            if location is not None:
                locations = [location]
            elif fromParameter is not None and parameterToRegionFunction is not None:
                param_value = arguments.get(fromParameter)
                if param_value is not None:
                    locations = storageRegionToLiteral(parameterToRegionFunction(param_value))
                    if isinstance(locations, str):
                        locations = [locations]
                else:
                    locations = []
            else:
                raise ValueError("Either location or fromParameter must be provided")

            for loc in locations:
                await appendAuditLog(log_entry, loc)

            return result
        return wrapper
    return decorator_function

async def appendAuditLog(log_entry, location: Literal["US", "EU", "ITAR"]):
    storage_provider = None
    match location:
        case "US":
            storage_provider = usFileStorageProvider
        case "EU":
            storage_provider = euFileStorageProvider
        case "ITAR":
            storage_provider = itarFileStorageProvider
        case _:
            raise ValueError(f"Invalid location: {location}")

    await storage_provider.append(f"logs/{log_entry.case_id}.jsonl",
        json.dumps(
            asdict(log_entry),
            default=serialize,
            separators=(",", ":"),
        ))