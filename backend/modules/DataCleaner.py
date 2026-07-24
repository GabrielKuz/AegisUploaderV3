import AppConstants
import logging
import Utils

from datetime import datetime, timedelta, timezone
from modules import Session, usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider
from modules.HubSpotIntegration import is_caseExpirable
from modules.models import LinkRecord, UploadRecord, UploadChunk, UploadSession, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
from modules.StorageProvider import StorageProvider 
from sqlalchemy import select
from Utils import IsCaseID
from modules.log_config import setup_logging
setup_logging()  # Initialize logging configuration
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

async def _deleteExpiredUploads(storage: StorageProvider):
    with Session() as session:
        uploads = session.scalars(
            select(UploadRecord)
            .where(UploadRecord.for_deletion.is_(True))
        ).all()

        for upload in uploads:
            try:
                if upload.blob_name:
                    await storage.delete_file(f"{upload.case_id}/{upload.blob_name}")

                session.delete(upload)

            except FileNotFoundError:
                session.delete(upload)

            except Exception as e:
                logger.error(f"Failed deleting file for upload {upload.upload_id} ({upload.blob_name}): {e}")

        session.commit()


def _deleteExpiredLinks():
    with Session() as session: # delete expired likns only once their assoiciated uploads have for_deletion set to True and they are marked as expired
        expired_links = session.scalars(
            select(LinkRecord)
            .where(LinkRecord.expired.is_(True))
        ).all()

        active_links = set(session.scalars(
            select(UploadRecord.link_uuid)
            .where(UploadRecord.for_deletion.is_(False))
            ).all()
        )

        for link in expired_links:
            if link.uuid not in active_links:
                session.delete(link)

        session.commit()

async def _deleteOrphanedUploads(storage: StorageProvider): # Find uploads not in db where the file exists in storage and delete them if the case id their under has no record in the db
    with Session() as session:
        db_uploads = set(
            session.execute(
                select(UploadRecord.case_id, UploadRecord.blob_name)
            ).all()
        )

        for upload in await storage.ls("./"):
            case_id, blob_name = upload.split("/", 1)
            if (case_id, blob_name) not in db_uploads:
                try:
                    await storage.delete_file(upload)
                    logger.info(f"Deleted orphaned upload: {upload}")
                except Exception as e:
                    logger.error(f"Failed to delete orphaned upload {upload}: {e}")

async def _deleteEmptyCaseDirs(storage: StorageProvider): # Find case directories in storage that have no uploads in the db and delete them
    with Session() as session:
        existing_case_ids = set(
            session.scalars(
                select(UploadRecord.case_id).distinct()
            ).all()
        )

        case_dirs = {path.split("/", 1)[0] for path in await storage.ls("./")}
        
        for case_dir in case_dirs:
            if not Utils.IsCaseID(case_dir):
                continue

            if case_dir not in existing_case_ids:
                try:
                    await storage.delete_case_directory(case_dir)
                    logger.info(f"Deleted empty case directory: {case_dir}")
                except Exception as e:
                    logger.error(f"Failed to delete empty case directory {case_dir}: {e}")

def _deleteOldUploadChunks():
    with Session() as session:
        chunks = session.scalars(
            select(UploadChunk)
            .where(UploadChunk.upload_id.in_(select(UploadRecord.upload_id).where(UploadRecord.for_deletion.is_(True))))
        ).all()

        for chunk in chunks:
            try:
                session.delete(chunk)

            except FileNotFoundError:
                session.delete(chunk)

            except Exception as e:
                logger.error(f"Failed deleting file for upload chunk {chunk.chunk_id} ({chunk.blob_name}): {e}")

        session.commit()

async def expireAndDeleteOldData():
    try:
        logger.info("Starting cleanup job")

        _expireUploads()
        _expireLinks()
        _deleteExpiredUploadSessions()
        for storage in [usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider]:
            await _deleteExpiredUploads(storage)
            logger.info(f"Deleted expired uploads in storage: {storage.base_path}")
            await _deleteEmptyCaseDirs(storage)
            logger.info(f"Deleted empty case directories in storage: {storage.base_path}")
        _deleteExpiredLinks()

        logger.info("Cleanup completed successfully")

    except Exception as e:
        logger.exception(f"Cleanup job failed: {e}")