#go through all the links in the database and update their status from hubspot regardless of expiration status
from fastapi import HTTPException, status
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select, update
from typing import Dict
from modules.HubSpotIntegration import get_caseITARstatus, caseIDExists, get_caseCompany, get_caseStatus
from modules.auth import User
from modules.models import LinkRecord, UploadRecord, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
import os
import AppConstants
from warnings import warn, deprecated
from modules import Session, engine
from Utils import IsCaseID
import logging

logger = logging.getLogger(__name__)
def update_link_status_from_hubspot():
    with Session() as session:
        links = session.scalars(select(LinkRecord)).all()

        for link in links:
            case_id = link.case_id
            if case_id:
                status = get_caseStatus(case_id)
                if status:
                    link.status = status
                else:
                    logger.warning(f"Could not retrieve status for case ID: {case_id}")
            else:
                logger.warning(f"No case ID associated with link UUID: {link.uuid}")

        session.commit()