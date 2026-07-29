# go through all the links in the database and update their status from hubspot regardless of expiration status
import logging

from sqlalchemy import select

from modules import Session
from modules.HubSpotIntegration import get_caseStatus_scheduler
from modules.models import LinkRecord

logger = logging.getLogger(__name__)


def update_link_status_from_hubspot():
    with Session() as session:
        links = session.scalars(select(LinkRecord)).all()

        for link in links:
            case_id = link.case_id
            if case_id:
                for _ in range(3):  # Retry up to 3 times
                    try:
                        status = get_caseStatus_scheduler(case_id)
                        if status:
                            link.status = status
                            logger.info(f"Updated status for case ID {case_id} to {status}")
                        else:
                            logger.warning(f"Could not retrieve status for case ID: {case_id}, retrying...")
                        break  # Exit the retry loop if successful
                    except Exception as e:
                        logger.error(f"Error retrieving status for case ID {case_id}: {e}")

            else:
                logger.warning(f"No case ID associated with link UUID: {link.uuid}")

        session.commit()
