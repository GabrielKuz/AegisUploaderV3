from typing import Annotated
import os
import warnings
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from jwt import PyJWKClient, decode
from pydantic import BaseModel, Field
from warnings import deprecated

load_dotenv()
"""Use
const response = await fetch("http://localhost:8000/auth/me", {
  headers: {
    Authorization: `Bearer ${entraIdToken}`,
  },
});
const user = await response.json();
console.log(user);
"""
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
ISSUER = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"

if not CLIENT_ID:
    raise ValueError("CLIENT_ID environment variable is required for Entra ID SSO")

jwks_client = PyJWKClient(JWKS_URL)

scheme = OAuth2PasswordBearer(tokenUrl="token")

class Token(BaseModel):
    access_token: str = Field(..., description="The access token issued by Entra ID")
    token_type: str = Field(..., description="The type of the token, typically 'Bearer'")

class TokenData(BaseModel):
    username: str | None  = Field(None, description="The username extracted from the token")

class User(BaseModel):
    username: str = Field(..., description="The username of the user")
    disabled: bool | None = Field(None, description="Indicates if the user is disabled")

async def getCurrentUser(token: Annotated[str, Depends(scheme)]):
    credentialsException = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        signingKey = jwks_client.get_signing_key_from_jwt(token).key # get singing key fropm ms jwks endpoint
        
        payload = decode( #decode and validate
            token,
            signingKey,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
        )
        
        username: str = payload.get("preferred_username") or payload.get("upn") or payload.get("oid")
        if username is None:
            raise credentialsException
        
        tokenData = TokenData(username=username)
    except InvalidTokenError as e:
        raise credentialsException
    except Exception as e:
        raise credentialsException
    
    return User(username=tokenData.username, disabled=False)

async def getCurrentActiveUser(current_user: Annotated[User, Depends(getCurrentUser)]):
    if current_user.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

async def userAuthenticated(current_user: Annotated[User, Depends(getCurrentUser)]) -> bool:
    return current_user is not None

@deprecated("use getCurrentActiveUser instead. This is insecure and only intended for testing")
async def getCurrentUserNoAuthForTest():
    warnings.warn("getCurrentUserNoAuthForTest is deprecated. Use getCurrentActiveUser instead.", UserWarning, stacklevel=2)
    return User(username="testuser", disabled=False)

getCurrentUserNoAuthForTest.__doc__ = "use getCurrentActiveUser instead. This is insecure and only intended for testing"
