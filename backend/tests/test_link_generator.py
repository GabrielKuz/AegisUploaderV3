import asyncio
from urllib import response
from fastapi.testclient import TestClient
from main import app
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links
from datetime import datetime, timedelta
from modules.auth import User, getCurrentActiveUser, requireRoles
from modules import Session
from modules.models import UploadRecord, LinkRecord, update_other_from_self, update_similar_between_LinkDB_and_UploadDB
from modules.uploader import ensure_uploads_table
import os
import uuid
from modules.LinkGenerator import LinkRequest, generate_links, get_all_links
from datetime import datetime, timedelta
from modules.auth import User, getCurrentActiveUser
import os

client = TestClient(app)
current_user = User(username="testuser", disabled=False, roles=["User"])  # Mock user for testing
url = f"http://{os.getenv('FRONTEND_URL')}/links/"  # Assuming this is the base URL for links

async def override_get_current_active_user() -> User:
    return User(username="testuser", disabled=False, roles=["User"]) 

app.dependency_overrides[getCurrentActiveUser] = override_get_current_active_user
app.dependency_overrides[requireRoles] = lambda *roles, strict=False: override_get_current_active_user()

def test_generate_links_returns_link_and_uuid(monkeypatch):
    link_request = LinkRequest(
        case_id="AIS-1234",
    )
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)  

    result = generate_links(link_request, current_user)

    print(str(result) + "\n"*5)
    assert result["link"].startswith(url)
    assert result["uuid"]
    assert result["link"].endswith(result["uuid"])


def test_create_link_endpoint_returns_generated_link(monkeypatch):
    payload = {
        "case_id": "AIS-1234",
    }
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)  
    
    response = client.post("/links/create/", json=payload)

    assert response.json()["link"].startswith(url)
    assert response.json()["uuid"]



def test_store_link_persists_data(monkeypatch):
    link_request = LinkRequest(
        case_id="AIS-4567",
    )
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)  

    result = generate_links(link_request, current_user)

    # Fetch the link from the database using the returned UUID
    uuid = result["uuid"]

    response = client.get(f"/links/{uuid}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["uuid"] == uuid
    assert data["link"].endswith(uuid)
    assert data["case_id"] == "AIS-4567"
    assert data["itar"] is False
    assert data["creator"]  # Assuming the creator is set to the current user
    assert data["timestamp"]  # Assuming the timestamp is set to the current time
    assert data["users_with_access"]  # Assuming the current user is added to the access list
    assert data["expired"] is False
    assert data["expiration_date"]  # Assuming the expiration date is set to 2 days from now

def test_get_all_links_returns_links_for_user(monkeypatch):
    # Create a link for the test user
    link_request = LinkRequest(
        case_id="AIS-7890",
    )
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)  
    
    generate_links(link_request, current_user)

    response = client.get("/links")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(link["case_id"] == "AIS-7890" for link in data)  # Check if the created link is in the list

# def test_link_expiration(): # fixed on another branch
#     # Create a link
#     link_request = LinkRequest(
#         case_id="case-789",
#         itar=False
#     )

#     result = generate_links(link_request, current_user)
#     uuid = result["uuid"]

#     expiration = expire_old_links(expiry_days=0)  # Expire links immediately for testing

#     # Fetch the link from the database and check if the expiration is updated
#     response = client.get(f"/links/{uuid}")
#     assert response.status_code == 200
#     data = response.json()
    
#     # Assuming the LinkRecord has an 'expiration' field that is updated
#     assert "expired" in data
#     assert data["expired"] == expiration  # The link should be marked as expired

# def test_extend_link_expiration():
#     # Create a link
#     link_request = LinkRequest(
#         case_id="AIS-101",
#         itar=False
#     )

#     result = generate_links(link_request, current_user)
#     uuid = result["uuid"]

#     # Extend the expiration of the link
#     extension_days = 5
#     extend_link_expiration(uuid, current_user, extension_days)

#     # Fetch the link from the database and check if the expiration is extended
#     response = client.get(f"/links/{uuid}")
#     assert response.status_code == 200
#     data = response.json()
    
#     # Assuming the LinkRecord has an 'expiration' field that is updated
#     assert "expired" in data
#     assert "expiration_date" in data
#     expiration_date = datetime.fromisoformat(data["expiration_date"])
#     assert expiration_date >= datetime.now() + timedelta(days=extension_days)  # The expiration date should be in the future
#     assert data["expired"] is False  # The link should not be expired after extension

def test_get_files_for_link(monkeypatch):
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)

    link_request = LinkRequest(
        case_id="AIS-1234",
    )
    result = generate_links(link_request, current_user)
    link_uuid = result["uuid"]
    upload_uuid = uuid.uuid4()

    with Session() as session:
        upload = UploadRecord(
            upload_id=upload_uuid,
            link_uuid=link_uuid,
            original_filename="report.txt",
            blob_name="report.txt",
            content_type="text/plain",
            sha256="1234567890abcdef",
            date_uploaded=datetime.now(),
            itar_status=False,
            combined_file_size=42,
            timestamp=datetime.now(),
            max_days_in_storage=30,
            case_id="case-files",
            original_link=f"http://example.test/{link_uuid}",
            sas_retrieval_link=None,
            upload_complete=True,
            users_with_access=[current_user.username],
        )
        session.add(upload)
        session.commit()

    response = client.get(f"/links/{link_uuid}/files")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(
        item["filename"] == "report.txt" and item["size"] == 42
        for item in data
    )


def test_updating_link_update_other_from_self(monkeypatch):
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)

    with Session() as session:
        link = LinkRecord(
            uuid=str(uuid.uuid4()),
            link="https://example.test/link",
            case_id="AIS-100",
            itar=True,
            creator=current_user.username,
            timestamp=datetime.now(),
            expiration_date=datetime.now() + timedelta(days=2),
            users_with_access=[current_user.username],
            expired=False,
        )
        upload = UploadRecord(
            upload_id=uuid.uuid4(),
            link_uuid=link.uuid,
            case_id="old-case",
            original_filename="report.txt",
            blob_name="report.txt",
            content_type="text/plain",
            sha256="1234567890abcdef",
            date_uploaded=datetime.now() - timedelta(days=1),
            itar_status=False,
            combined_file_size=42,
            timestamp=datetime.now(),
            max_days_in_storage=30,
            original_link=f"http://example.test/{link.uuid}",
            sas_retrieval_link=None,
            upload_complete=True,
            users_with_access=[current_user.username],
        )
        session.add_all([link, upload])
        session.commit()

        uuid1 = str(uuid.uuid4())
        #update itar
        update_other_from_self(link, upload, session, "itar_status", "itar")
        update_other_from_self(link, upload, session, "timestamp","timestamp")
        update_other_from_self(link, upload, session, "link_uuid","uuid")

        session.expire_all()

        assert upload.itar_status == link.itar
        assert upload.timestamp == link.timestamp
        assert upload.link_uuid == link.uuid

def test_updating_link_update_similar_between_LinkDB_and_UploadDB(monkeypatch):
    monkeypatch.setattr("modules.LinkGenerator.caseIDExists", lambda case_id: True)
    monkeypatch.setattr("modules.LinkGenerator.get_caseITARstatus", lambda case_id: False)

    with Session() as session:
        link = LinkRecord(
            uuid=str(uuid.uuid4()),
            link="https://example.test/link",
            case_id="AIS-6767",
            itar=True,
            creator=current_user.username,
            timestamp=datetime.now(),
            expiration_date=datetime.now() + timedelta(days=2),
            users_with_access=[current_user.username],
            expired=False,
        )
        upload = UploadRecord(
            upload_id=uuid.uuid4(),
            link_uuid=link.uuid,
            case_id="AIS-6614",
            original_filename="report.txt",
            blob_name="report.txt",
            content_type="text/plain",
            sha256="1234567890abcdef",
            date_uploaded=datetime.now() - timedelta(days=1),
            itar_status=False,
            combined_file_size=42,
            timestamp=datetime.now(),
            max_days_in_storage=30,
            original_link=f"http://example.test/{link.uuid}",
            sas_retrieval_link=None,
            upload_complete=True,
            users_with_access=[current_user.username],
        )
        session.add_all([link, upload])
        session.commit()

        uuid1 = str(uuid.uuid4())
        #update itar
        update_similar_between_LinkDB_and_UploadDB(session)
        session.expire_all()

        assert upload.itar_status == link.itar
        assert upload.timestamp == link.timestamp
        assert upload.link_uuid == link.uuid
        assert upload.users_with_access == link.users_with_access
        assert upload.case_id == link.case_id
