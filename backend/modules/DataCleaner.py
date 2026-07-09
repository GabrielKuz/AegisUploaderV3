
from datetime import datetime, timedelta
import os
import logging
from modules import Session
from modules.models import LinkRecord, UploadRecord, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
from modules.HubSpotIntegration import is_caseExpirable
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

from modules.uploader import AZURE_CONTAINER_NAME
logger = logging.getLogger(__name__)

LINK_EXPIRY_DAYS = 2  

def _expireUploads():
    now = datetime.now(timezone.utc)
    cache = {}

    with Session() as session:
        records = session.scalars(select(UploadRecord).where(UploadRecord.upload_complete.is_(True)).where(UploadRecord.for_deletion.is_(False))).all() 

        for record in records:
            if record.timestamp is None:
                continue

            if record.timestamp + timedelta(days=record.max_days_in_storage) <= now:
                record.for_deletion = True
                continue

            if record.case_id not in cache:
                cache[record.case_id] = is_caseExpirable(record.case_id)

            if cache[record.case_id]:
                record.for_deletion = True

        session.commit()


def _expireLinks():
    cutoff = datetime.now(timezone.utc) - timedelta(days=LINK_EXPIRY_DAYS)

    with Session() as session:
        records = session.scalars(select(LinkRecord).where(LinkRecord.expired.is_not(True))).all()

        for record in records:
            if record.timestamp and record.timestamp <= cutoff:
                record.expired = True

        session.commit()
        update_similar_between_LinkDB_and_UploadDB(session)

def _deleteExpiredUploads(): #delete from azure blob then drop record
    with Session() as session:
        expired_uploads = session.scalars(select(UploadRecord).where(UploadRecord.for_deletion.is_(True))).all()

        blob_service_client = BlobServiceClient.from_connection_string(os.environ.get("AZURE_STORAGE_CONNECTION_STRING"))

        for upload in expired_uploads:
            if upload.blob_name:
                try:
                    blob_client = blob_service_client.get_blob_client(container=os.environ.get("AZURE_CONTAINER_NAME"), blob=upload.blob_name)
                    blob_client.delete_blob()
                except Exception as e:
                    logger.error(f"Error deleting blob {upload.blob_name}: {e}")
                    continue  # Skip deletion of the record if blob deletion fails

            session.delete(upload)

        session.commit()
    

def _deleteExpiredLinks():
    with Session() as session:
        session.query(LinkRecord).filter(LinkRecord.expired.is_(True)).delete(synchronize_session=False)
        session.commit()
        update_similar_between_LinkDB_and_UploadDB(session)


def expireAndDeleteOldData():
    try:
        logger.info("starting data cleanup")
        _expireUploads()
        _expireLinks()
        _deleteExpiredUploads()
        _deleteExpiredLinks()
        logger.info("data successfully deleted")
    except Exception as e:
        logger.error(f"Error in expireAndDeleteOldData: {e}")