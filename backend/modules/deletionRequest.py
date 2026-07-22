from zoneinfo import ZoneInfo

import fastapi
import uuid

from fastapi import APIRouter, Depends, HTTPException
from modules.auth import getCurrentActiveUser, getCurrentUser, User, userAuthenticated
from pydantic import Field, BaseModel
from typing import Annotated
from azure.communication.email.aio import EmailClient
import os
import logging
from modules.models import LinkRecord, UploadRecord
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from Utils import IsUUID
import logging

logger = logging.getLogger(__name__)
engine = create_engine(os.environ['DATABASE_URL'],)
Session = sessionmaker(bind=engine)
router = APIRouter()
CONNECTION_STRING = os.getenv("ACS_CONNECTION_STRING")



@router.post("/requestfordeletion/{link_uuid}") #Requests from client side to delete data. Only sends email 
async def request_For_Data_Deletion(link_uuid: str):
    if not IsUUID(link_uuid):
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    try:
        if not os.getenv("TESTING") or os.getenv("TESTING").lower() != "true": # Only send email if not in testing mode
            session = Session()
            link_record = session.query(LinkRecord).filter_by(uuid=link_uuid).first()
            creator = link_record.creator if link_record else "Unknown"
            company = link_record.customer if link_record else "Unknown"
            itar = link_record.itar if link_record else "Unknown"
            logger.debug(f"Retrieved link record for UUID {link_uuid} in Datadeletion: {link_record}")
            storage_region = (session.query(UploadRecord.storage_region).filter(UploadRecord.link_uuid == link_uuid).first() if link_record else "Unknown") or "Unknown" # if theirs an uplaod sharing the uuid gets its region else Unknown
            status = link_record.status if link_record else "Unknown"
            created_at = link_record.timestamp if link_record else "Unknown"
            case_id = link_record.case_id if link_record else "Unknown"
            async with EmailClient.from_connection_string(CONNECTION_STRING) as client:
                message = {
                    "content": {
                        "subject": f"Deletion Request - {case_id}",
                        "plainText": f"""A data deletion request has been received from Uploader V3.
Case ID: {case_id}
UUID: {link_uuid}
Company: {company}
Status: {status}
ITAR: {itar}
Storage Region: {storage_region}
Created By: {creator}
Created At: {created_at.astimezone(ZoneInfo("America/New_York")).strftime("%B %-d, %Y at %-I:%M:%S %p %Z")}

Please review this request and take the appropriate action.
""",
                "html": f"""
                <html>
                    <body style="font-family: Arial, Helvetica, sans-serif; color: #333;">
                        <h2 style="color: #b22222;">Data Deletion Request Received</h2>

                        <p>
                            A request has been submitted from UploaderV3 to delete data associated with the
                            following record.
                        </p>

                        <table style="border-collapse: collapse;">
                            <tr>
                                <td><strong>Case ID:</strong></td>
                                <td>{case_id}</td>
                            </tr>
                            <tr>
                                <td><strong>UUID:</strong></td>
                                <td>{link_uuid}</td>
                            </tr>
                            <tr>
                                <td><strong>Company:</strong></td>
                                <td>{company}</td>
                            </tr>
                            <tr>
                                <td><strong>Status:</strong></td>
                                <td>{status}</td>
                            </tr>
                            <tr>
                                <td><strong>ITAR:</strong></td>
                                <td>{itar}</td>
                            </tr>
                            <tr>
                                <td><strong>Storage Region:</strong></td>
                                <td>{storage_region}</td>
                            </tr>
                            <tr>
                                <td><strong>Created By:</strong></td>
                                <td>{creator}</td>
                            </tr>
                            <tr>
                                <td><strong>Created At:</strong></td>
                                <td>{created_at.astimezone(ZoneInfo("America/New_York")).strftime("%B %-d, %Y at %-I:%M:%S %p %Z")}</td>
                            </tr>
                        </table>

                        <p style="margin-top: 20px;">
                            Please review this request and take the appropriate action.
                        </p>

                        <hr>


                    </body>
                </html>
                """
            },
            "recipients": {
                "to": [
                    {
                        "address": os.getenv("ACS_HELPDESK_ADDRESS"),
                        "displayName": os.getenv("ACS_HELPDESK_ADDRESS")
                    }
                ],
                "cc": [
                    {"address": creator, "displayName": creator} if creator != "Unknown" else {}
                ],
            },
            "senderAddress": os.getenv("ACS_SENDER_ADDRESS", "DoNotReply@aiscorp.com")
        }

            try:
                response = await client.begin_send(message) # can be async
                await response.result()  # Wait for the operation to complete
                logger.info(f"Email sent successfully.")
            except Exception as e:
                logger.warning(f"Error occurred while sending email: {e}")

        return {"message": "Request for data deletion received. An email has been sent to the administrator for further action."}

    except Exception as e:
        logger.error(f"Error processing deletion request for UUID {link_uuid}: {e}")
        raise HTTPException(status_code=400, detail="Internal Server Error")
