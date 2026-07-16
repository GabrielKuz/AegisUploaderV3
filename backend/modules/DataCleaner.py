import AppConstants
import logging

from datetime import datetime, timedelta, timezone
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
            select(UploadRecord)
            .where(UploadRecord.for_deletion.is_(True))
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
            select(LinkRecord)
            .where(LinkRecord.expired.is_(True))
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
        


def expireAndDeleteOldData():
    try:
        logger.info("Starting cleanup job")

        _expireUploads()
        _expireLinks()
        _deleteExpiredUploadSessions()
        for storage in [usFileStorageProvider, euFileStorageProvider, itarFileStorageProvider]:
            _deleteExpiredUploads(storage)
        _deleteExpiredLinks()

        logger.info("Cleanup completed successfully")

    except Exception as e:
        logger.exception(f"Cleanup job failed: {e}")