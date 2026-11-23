import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import SessionLocal
from models import User
from rbac import Permission, has_permission
from security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials

    try:
        payload = decode_access_token(token)

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not user_id.isdigit():
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with SessionLocal() as db:
        current_user = db.query(User).filter(User.id == int(user_id)).first()

        if current_user is None:
            raise HTTPException(status_code=401, detail="User not found")

        if not current_user.is_active:
            raise HTTPException(status_code=403, detail="Account is inactive")

        return current_user


def get_current_admin(current_user: User = Depends(get_current_user)):
    if not has_permission(current_user, Permission.READ_ALL_USERS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    return current_user


def get_current_employer(current_user: User = Depends(get_current_user)):
    if not has_permission(current_user, Permission.CREATE_JOB):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Employer access required"
        )

    return current_user


def get_current_job_seeker(current_user: User = Depends(get_current_user)):
    if not has_permission(current_user, Permission.APPLY_FOR_JOB):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Job Seeker access required"
        )

    return current_user
