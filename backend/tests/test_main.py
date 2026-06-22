import sys
from pathlib import Path
import jwt

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from main import app


client = TestClient(app)


def test_read_root_returns_ok_status():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_normal():
    assert 1 + 1 == 2
    assert 2 * 2 == 4
    assert 5 - 3 == 2
    assert 10 / 2 == 5
    assert 3 ** 2 == 9

def test_jwt():
    jwt_secret = "1234567890987654321abcdefabcdefabcdef"
    payload = {"user_id": 123, "username": "testuser"}
    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    decoded_payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    assert decoded_payload == payload
