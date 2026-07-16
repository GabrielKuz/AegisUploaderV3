import AppConstants
import logging

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
import AppConstants
import Utils

from modules import Session
from modules.models import LinkRecord, UploadRecord, UploadSession, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
from modules.HubSpotIntegration import is_caseExpirable
from modules.StorageProvider import StorageProvider 
from modules import usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider
from sqlalchemy import select

logger = logging.getLogger(__name__)

LINK_EXPIRY_DAYS = 2

#========================================================================================
# Expiration Functions
#========================================================================================

def _expireUploads():
    now = datetime.now(timezone.utc)

    with Session() as session:
        uploads = session.scalars(
            select(UploadRecord)
            .where(UploadRecord.upload_complete.is_(True))
            .where(UploadRecord.for_deletion.is_(False))
        ).all()

        case_cache: dict[str, bool] = {}


        for upload in uploads:
            if not upload.timestamp:
                continue
            if (upload.timestamp + AppConstants.UPLOAD_DEFAULT_RETENTION_TIME) <= now:
                upload.for_deletion = True
                continue

            case_id = upload.case_id
            if case_id not in case_cache:
                case_cache[case_id] = is_caseExpirable(case_id)

            if case_cache[case_id]:
                upload.for_deletion = True

        session.commit()

def _expireLinks():
    cutoff = datetime.now(timezone.utc) - AppConstants.LINK_EXPIRATION_TIME

    with Session() as session:
        links = session.scalars(
            select(LinkRecord)
            .where(LinkRecord.expired.is_(False))
        ).all()

        for link in links:
            if link.timestamp and link.timestamp <= cutoff:
                link.expired = True

        session.commit()
        update_similar_between_LinkDB_and_UploadDB(session)

#========================================================================================
# Deletion Functions
#========================================================================================

def _deleteExpiredUploadSessions(): # Delete sessions where upload is completeted and the upload id is marked for deletion
    with Session() as session:
        sessions = session.scalars(
            select(UploadSession)
            .where(UploadSession.completed.is_(True))
            .where(UploadSession.upload_id.in_(select(UploadRecord.upload_id).where(UploadRecord.for_deletion.is_(True))))
        ).all()

        for session_record in sessions:
            session.delete(session_record)

        session.commit()

def _deleteExpiredUploads(storage: StorageProvider):
    with Session() as session:
        uploads = session.scalars(
            select(UploadRecord).where(UploadRecord.for_deletion.is_(True))
        ).all()

        for upload in uploads:
            try:
                if upload.blob_name:
                    storage.delete_file(f"{upload.case_id}/{upload.blob_name}")

                session.delete(upload)

            except FileNotFoundError:
                session.delete(upload)

            except Exception as e:
                logger.error(f"Failed deleting file for upload {upload.upload_id} ({upload.blob_name}): {e}")

        session.commit()


def _deleteExpiredLinks():
    with Session() as session: # delete expired likns only once their assoiciated uploads have for_deletion set to True and they are marked as expired
        links = session.scalars(
            select(LinkRecord).where(LinkRecord.expired.is_(True))
        ).all()

        for link in links:
            uploads = session.scalars(
                select(UploadRecord)
                .where(UploadRecord.link_uuid == link.uuid)
                .where(UploadRecord.for_deletion.is_(False))
            ).all()

            if not uploads:
                session.delete(link)

        session.commit()

def _deleteOrphanedUploads(storage: StorageProvider): # Find uploads not in db where the file exists in storage and delete them if the case id their under has no record in the db
    with Session() as session:
        uploads = storage.ls("./")
        for upload in uploads:
            case_id, blob_name = upload.split("/", 1)
            if not session.scalars(select(UploadRecord).where(UploadRecord.case_id == case_id).where(UploadRecord.blob_name == blob_name)).first():
                try:
                    storage.delete_file(upload)
                    logger.info(f"Deleted orphaned upload: {upload}")
                except Exception as e:
                    logger.error(f"Failed to delete orphaned upload {upload}: {e}")

def _deleteEmptyCaseDirs(storage: StorageProvider): # Find case directories in storage that have no uploads in the db and delete them
    with Session() as session:
        case_dirs = storage.ls("./") # includes full file paths, not  dir names (eg ["AIS-6614/1GB.bin", "AIS-6929/End of Day Meeting (2).docx"])
        case_dirs = set(dir.split("/", 1)[0] for dir in case_dirs)
        case_dirs = [dir for dir in case_dirs if not session.scalars(select(UploadRecord).where(UploadRecord.case_id == dir)).first()] # filter out case dirs that have uploads in the db
        case_dirs = [dir for dir in case_dirs if Utils.isCaseID(dir)] # filter out case dirs that are not valid case ids
        for case_dir in case_dirs: 
            if not session.scalars(select(UploadRecord).where(UploadRecord.case_id == case_dir)).first():
                try:
                    storage.delete_directory(case_dir)
                    logger.info(f"Deleted empty case directory: {case_dir}")
                except Exception as e:
                    logger.error(f"Failed to delete empty case directory {case_dir}: {e}")

def expireAndDeleteOldData():
    try:
        logger.info("Starting cleanup job")

        _expireUploads()
        _expireLinks()
        _deleteExpiredUploadSessions()
        for storage in [usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider]:
            _deleteExpiredUploads(storage)
            _deleteEmptyCaseDirs(storage)
        _deleteExpiredLinks()

        logger.info("Cleanup completed successfully")

    except Exception as e:
        logger.exception(f"Cleanup job failed: {e}")