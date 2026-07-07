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
import requests

load_dotenv()
#All from entraid sso
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID") 
if os.getenv("TESTING", "false") == "true":
    print("TESTING"+"\n"*3)
    JWKS_URL = ""
    ISSUER = ""
else:
    print("ENTRA"+"\n"*3)
    OPENID_CONFIG = requests.get(f"https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration").json()

    JWKS_URL = OPENID_CONFIG["jwks_uri"]
    ISSUER = OPENID_CONFIG["issuer"]

if not CLIENT_ID:
    raise ValueError("CLIENT_ID environment variable is required for Entra ID SSO")

jwks_client = PyJWKClient(JWKS_URL)

scheme = OAuth2PasswordBearer(tokenUrl="token")

class Token(BaseModel): # structure of a token response from entra
    access_token: str = Field(..., description="The access token issued by Entra ID")
    token_type: str = Field(..., description="The type of the token, typically 'Bearer'")

class TokenData(BaseModel): # data contained in the token once decoded
    username: str | None  = Field(None, description="The username extracted from the token")

class User(BaseModel): # structure of a user object
    username: str = Field(..., description="The username of the user")
    disabled: bool | None = Field(None, description="Indicates if the user is disabled")

async def getCurrentUser(token: Annotated[str, Depends(scheme)]): # get the current user from the token
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
        
        username: str = payload.get("preferred_username") or payload.get("upn") or payload.get("oid") # docs list all as possible username claims
        if username is None: # No user claim is found
            raise credentialsException
        
        tokenData = TokenData(username=username) # create a token data object with the username
    except InvalidTokenError as e: # token is invalid or expired
        print(f"Error in getCurrentUser: {e}")
        print(ISSUER)
        raise credentialsException
    except Exception as e: # catch all
        print(ISSUER)
        print(f"Error in getCurrentUser: {e}")
        raise credentialsException
    
    return User(username=tokenData.username, disabled=False) # TODO: check users status from db later

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
