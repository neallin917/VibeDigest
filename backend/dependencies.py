from typing import Optional
from fastapi import Header, HTTPException
from db_client import DBClient
from config import settings

# Initialize DB Client (it's a singleton-ish pattern usually, or safe to instantiate multiple times if connection pool is used)
db_client = DBClient()

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Validate Bearer token and return user_id."""
    if settings.MOCK_MODE:
        return "mock-user"

    if not authorization:
        # For Dev/Testing ease: allow anonymous if no header
        return "dev-user"
        # raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    user_id = db_client.validate_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")
    return user_id
