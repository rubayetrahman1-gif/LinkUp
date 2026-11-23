from fastapi import (
    APIRouter,
    HTTPException,
    status,
    Cookie,
    Depends,
    Response,
    Request,
)
import os
from datetime import datetime, timedelta, timezone
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from audit import record_audit_event
from rbac import Permission, require_permission
from database import SessionLocal
from models import User, RefreshSession
from schemas import UserRegister, UserResponse, UserLogin
from security import (
    hash_password,
    verify_password,
    verify_legacy_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)


MAX_FAILED_LOGIN_ATTEMPTS = 8
LOGIN_LOCKOUT_MINUTES = 15

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(user: UserRegister):
    with SessionLocal() as db:
        existing_user = db.query(User).filter(User.email == user.email).first()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email already registered",
            )

        hashed_password = hash_password(user.password)

        new_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            role=user.role,
        )

        db.add(new_user)

        try:
            db.commit()
            db.refresh(new_user)

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Email already registered",
            )

        return new_user





@router.post("/login")
def login_user(
    user: UserLogin,
    request: Request,
):
    with SessionLocal() as db:

        existing_user = (
            db.query(User)
            .filter(User.email == user.email)
            .with_for_update()
            .first()
        )

        if not existing_user:
            record_audit_event(
                db,
                request,
                "auth.login.failed",
                target_type="account",
                target_id=user.email,
                details={"reason": "unknown_account"},
            )
            db.commit()
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        now = datetime.now(timezone.utc)

        # Check account lock
        if existing_user.locked_until is not None:

            locked_until = existing_user.locked_until

            # Handle timezone from PostgreSQL
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(
                    tzinfo=timezone.utc
                )

            if locked_until > now:
                record_audit_event(
                    db,
                    request,
                    "auth.login.failed",
                    target_user_id=existing_user.id,
                    target_type="user",
                    target_id=existing_user.email,
                    details={"reason": "account_locked"},
                )
                db.commit()
                raise HTTPException(
                    status_code=429,
                    detail="Your account is temporarily locked. Please try again later.",
                )

            # Reset expired lockout
            existing_user.failed_login_attempts = 0
            existing_user.locked_until = None

        # Verify password
        is_pepper_verified = verify_password(
            user.password,
            existing_user.password_hash,
        )

        is_legacy_verified = False

        if not is_pepper_verified:
            is_legacy_verified = verify_legacy_password(
                user.password,
                existing_user.password_hash,
            )

        # Failed login
        if not is_pepper_verified and not is_legacy_verified:

            existing_user.failed_login_attempts += 1
            record_audit_event(
                db,
                request,
                "auth.login.failed",
                target_user_id=existing_user.id,
                target_type="user",
                target_id=existing_user.email,
                details={"reason": "invalid_credentials"},
            )

            if (
                existing_user.failed_login_attempts
                >= MAX_FAILED_LOGIN_ATTEMPTS
            ):
                existing_user.locked_until = (
                    now + timedelta(
                        minutes=LOGIN_LOCKOUT_MINUTES
                    )
                )

            db.commit()

            if (
                existing_user.failed_login_attempts
                >= MAX_FAILED_LOGIN_ATTEMPTS
            ):
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed attempts. Your account is now locked for 15 minutes.",
                )

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

        # Check account status
        if existing_user.is_banned:
            record_audit_event(
                db,
                request,
                "auth.login.blocked",
                target_user_id=existing_user.id,
                target_type="user",
                target_id=existing_user.email,
                details={"reason": "banned_account"},
            )
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Account is banned",
            )

        if not existing_user.is_active:
            record_audit_event(
                db,
                request,
                "auth.login.blocked",
                target_user_id=existing_user.id,
                target_type="user",
                target_id=existing_user.id,
                details={"reason": "inactive_account"},
            )
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Account is inactive",
            )

        # Reset attempts after successful login
        existing_user.failed_login_attempts = 0
        existing_user.locked_until = None

        # Upgrade legacy password hash
        if is_legacy_verified:
            existing_user.password_hash = hash_password(
                user.password
            )

        # Create access token
        access_token = create_access_token(
            {
                "sub": str(existing_user.id),
                "role": existing_user.role,
            }
        )

        # Create refresh token
        refresh_token = generate_refresh_token()
        refresh_token_hash = hash_refresh_token(refresh_token)

        expires_at = now + timedelta(
            days=REFRESH_TOKEN_EXPIRE_DAYS
        )

        refresh_session = RefreshSession(
            user_id=existing_user.id,
            token_hash=refresh_token_hash,
            expires_at=expires_at,
            user_agent=request.headers.get("user-agent"),
        )

        db.add(refresh_session)
        record_audit_event(
            db,
            request,
            "auth.login.succeeded",
            actor_user_id=existing_user.id,
            target_user_id=existing_user.id,
            target_type="user",
            target_id=existing_user.id,
        )
        db.commit()

        response = JSONResponse(
            content={
                "access_token": access_token,
                "token_type": "bearer",
            }
        )

        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/api/auth",
        )

        return response


@router.post("/refresh")
def refresh_access_token(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Refresh token is required",
        )

    with SessionLocal() as db:
        token_hash = hash_refresh_token(refresh_token)

        refresh_session = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.token_hash == token_hash,
                RefreshSession.revoked_at.is_(None),
            )
            .with_for_update()
            .first()
        )

        if not refresh_session:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token",
            )

        now = datetime.now(timezone.utc)

        expires_at = refresh_session.expires_at

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(
                tzinfo=timezone.utc
            )

        if expires_at <= now:
            raise HTTPException(
                status_code=401,
                detail="Refresh token has expired",
            )
        existing_user = (
            db.query(User).filter(User.id == refresh_session.user_id).first()
        )

        if (
            not existing_user
            or not existing_user.is_active
            or existing_user.is_banned
        ):
            raise HTTPException(
                status_code=401,
                detail="User account is unavailable",
            )

        # Revoke the old refresh session
        refresh_session.revoked_at = now
        refresh_session.last_used_at = now

        # Generate a new refresh token
        new_refresh_token = generate_refresh_token()
        new_refresh_token_hash = hash_refresh_token(new_refresh_token)

        new_expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        new_session = RefreshSession(
            user_id=existing_user.id,
            token_hash=new_refresh_token_hash,
            expires_at=new_expires_at,
            user_agent=request.headers.get("user-agent"),
        )

        db.add(new_session)

        # Create a new access token
        access_token = create_access_token(
            {
                "sub": str(existing_user.id),
                "role": existing_user.role,
            }
        )

        db.commit()

        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            path="/api/auth",
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
        }


@router.post("/logout")
def logout_user(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
):
    with SessionLocal() as db:
        refresh_session = None
        if refresh_token:
            token_hash = hash_refresh_token(refresh_token)
            refresh_session = (
                db.query(RefreshSession)
                .filter(RefreshSession.token_hash == token_hash)
                .with_for_update()
                .first()
            )

            if refresh_session and refresh_session.revoked_at is None:
                refresh_session.revoked_at = datetime.now(timezone.utc)

        record_audit_event(
            db,
            request,
            "auth.logout",
            actor_user_id=refresh_session.user_id if refresh_session else None,
            target_user_id=refresh_session.user_id if refresh_session else None,
            target_type="user" if refresh_session else None,
            target_id=refresh_session.user_id if refresh_session else None,
            details={"refresh_session_found": refresh_session is not None},
        )
        db.commit()

    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/api/auth",
    )

    return {"message": "Logged out successfully"}


@router.get("/sessions")
def get_user_sessions(
    current_user: User = Depends(require_permission(Permission.READ_SESSIONS)),
    refresh_token: str | None = Cookie(default=None),
):
    now = datetime.now(timezone.utc)
    current_token_hash = (
    hash_refresh_token(refresh_token) if refresh_token else None
    )

    with SessionLocal() as db:
        sessions = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.user_id == current_user.id,
                RefreshSession.revoked_at.is_(None),
                RefreshSession.expires_at > now,
            )
            .order_by(RefreshSession.created_at.desc())
            .all()
        )

        return [
            {
                "id": session.id,
                "created_at": session.created_at,
                "expires_at": session.expires_at,
                "last_used_at": session.last_used_at,
                "user_agent": session.user_agent,
                "is_current": (
                    session.token_hash == current_token_hash
                    if current_token_hash
                    else False
                ),
            }
            for session in sessions
        ]


@router.delete("/sessions/{session_id}")
def revoke_user_session(
    session_id: int,
    request: Request,
    response: Response,
    current_user: User = Depends(require_permission(Permission.REVOKE_SESSIONS)),
    refresh_token: str | None = Cookie(default=None),
):
    with SessionLocal() as db:
        session = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.id == session_id,
                RefreshSession.user_id == current_user.id,
                RefreshSession.revoked_at.is_(None),
            )
            .with_for_update()
            .first()
        )

        if not session:
            raise HTTPException(
                status_code=404,
                detail="Session not found",
            )

        session.revoked_at = datetime.now(timezone.utc)
        record_audit_event(
            db,
            request,
            "auth.session.revoked",
            actor_user_id=current_user.id,
            target_user_id=current_user.id,
            target_type="refresh_session",
            target_id=session.id,
        )

        if refresh_token and session.token_hash == hash_refresh_token(refresh_token):
            response.delete_cookie(
                key="refresh_token",
                httponly=True,
                secure=COOKIE_SECURE,
                samesite=COOKIE_SAMESITE,
                path="/api/auth",
            )

        db.commit()

        return {"message": "Session revoked successfully"}
