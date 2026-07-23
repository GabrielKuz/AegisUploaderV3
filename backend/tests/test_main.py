import ast
import os
import sys
from pathlib import Path

import jwt
from fastapi import Depends
from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("TENANT_ID", "tenant-id")
os.environ.setdefault("CLIENT_ID", "client-id")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AZURE_STORAGE_CONNECTION_STRING", "UseDevelopmentStorage=true")

from main import app
from modules.auth import getCurrentActiveUser


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
    assert 10 % 3 == 1

def test_python_version():
    major, minor, *_ = sys.version_info
    assert major == 3 and minor >= 13, "Python version must be 3.13 or higher"


def test_jwt():
    jwt_secret = "1234567890987654321abcdefabcdefabcdef"
    payload = {"user_id": 123, "username": "testuser"}
    token = jwt.encode(payload, jwt_secret, algorithm="HS256")
    decoded_payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    assert decoded_payload == payload

def check_main_testing_var_is_false():
    from main import testing
    assert testing is False, "The 'testing' variable in main.py should be set to False for production."

def test_NoAuthNotPresent():
    forbiddenMethod= "getCurrentUserNoAuthForTest"
    violations = []

    for pyfile in PROJECT_ROOT.rglob("*.py"):
        if pyfile.name == "auth.py" or pyfile.name == "test_main.py": # allow the definition of the function in auth.py and test_main.py
            continue
        if any(part in {"venv", ".venv", "__pycache__", ".cache"} for part in pyfile.parts):
            continue

        tree = ast.parse(pyfile.read_text(encoding="utf-8"), filename=str(pyfile))

        for node in ast.walk(tree):
            # from x import getCurrentUserNoAuthForTest
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == forbiddenMethod:
                        violations.append(f"{pyfile}:{node.lineno} imported {forbiddenMethod}")

            # auth.getCurrentUserNoAuthForTest
            elif isinstance(node, ast.Attribute):
                if node.attr == forbiddenMethod:
                    violations.append(f"{pyfile}:{node.lineno} referenced {forbiddenMethod}")

            # getCurrentUserNoAuthForTest
            elif isinstance(node, ast.Name):
                if node.id == forbiddenMethod:
                    violations.append(f"{pyfile}:{node.lineno} referenced {forbiddenMethod}")

    assert not violations, ("Insecure call to getCurrentUserNoAuthForTest() found:\n"+ "\n".join(sorted(set(violations)))) #Only allow the definition of the function in auth.py