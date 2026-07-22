import os
import warnings

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError
from jwt import PyJWKClient, decode
from pydantic import BaseModel, Field
import requests
from typing import Annotated
from warnings import deprecated
import logging

logger = logging.getLogger(__name__)
#========================================================================================
# Entra ID SSO Authentication Setup
#========================================================================================

load_dotenv()
#All from Entra ID SSO
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID") 
if os.getenv("TESTING", "false") == "true":
    JWKS_URL = ""
    ISSUER = ""
else:
    OPENID_CONFIG = requests.get(f"https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration", timeout=10).json()

    JWKS_URL = OPENID_CONFIG["jwks_uri"]
    ISSUER = OPENID_CONFIG["issuer"]

    if not CLIENT_ID:
        raise ValueError("CLIENT_ID environment variable is required for Entra ID SSO")

    jwks_client = PyJWKClient(JWKS_URL)

scheme = HTTPBearer()

#========================================================================================
# Token classes
#========================================================================================

class Token(BaseModel): # structure of a token response from entra
    access_token: str = Field(..., description="The access token issued by Entra ID")
    token_type: str = Field(..., description="The type of the token, typically 'Bearer'")

class TokenData(BaseModel): # data contained in the token once decoded
    username: str | None  = Field(None, description="The username extracted from the token")

#========================================================================================
# User classes and functions
#========================================================================================

class User(BaseModel): # structure of a user object
    username: str = Field(..., description="The username of the user")
    disabled: bool | None = Field(None, description="Indicates if the user is disabled")
    roles: list[str] = Field(default_factory=list, description="List of roles assigned to the user")

async def getCurrentUser(credentials: Annotated[HTTPAuthorizationCredentials, Depends(scheme)]): # get the current user from the token
    token = credentials.credentials
    if os.getenv("TESTING", "false").lower() == "true":
        return User(username="testuser", disabled=False)
    
    credentialsException = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        logger.debug(f"Validating token: {token}")
        signingKey = jwks_client.get_signing_key_from_jwt(token).key # get singing key fropm ms jwks endpoint
        
        payload = decode( #decode and validate
            token,
            signingKey,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
        )
        
        username: str = payload.get("preferred_username") or payload.get("upn") or payload.get("oid") # docs list all as possible username claims
        if username is None: # No user claim is found
            raise credentialsException
        roles = payload.get("roles", [])
        
        tokenData = TokenData(username=username) # create a token data object with the username
    except InvalidTokenError as e: # token is invalid or expired
        raise credentialsException
    except Exception as e: # catch all
        raise credentialsException
    
    return User(username=tokenData.username, disabled=False, roles=roles)

async def getCurrentActiveUser(current_user: Annotated[User, Depends(getCurrentUser)]): # get the current active user from the token and check if they are disabled
    if current_user.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

async def userAuthenticated(current_user: Annotated[User, Depends(getCurrentActiveUser)]) -> bool: # provide a bool for authentication status
    return current_user is not None

@deprecated("use getCurrentActiveUser instead. This is insecure and only intended for testing")
async def getCurrentUserNoAuthForTest(): # for testing purposes only, returns a fake user object to avoid needing entra auth
    warnings.warn("getCurrentUserNoAuthForTest is deprecated. Use getCurrentActiveUser instead.", UserWarning, stacklevel=2)
    return User(username="testuser", disabled=False)

getCurrentUserNoAuthForTest.__doc__ = "use getCurrentActiveUser instead. This is insecure and only intended for testing"

#========================================================================================
# Role functions
#========================================================================================

def requireRole(role: str):
    async def checker(current_user: Annotated[User, Depends(getCurrentActiveUser)]):
        if role not in current_user.roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="Insufficient permissions",)
        return current_user
    return checker

def requireRoles(*roles: str, strict: bool = False): # OR if strict is false AND if strict is true
    async def checker(current_user: Annotated[User, Depends(getCurrentActiveUser)]): 
        if strict:
            if not all(role in current_user.roles for role in roles):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        else:
            if not any(role in current_user.roles for role in roles):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker