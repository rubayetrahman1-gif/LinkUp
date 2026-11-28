
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User, RefreshSession
from datetime import datetime, timezone
from schemas import UserResponse, UserUpdate, PasswordChange
from security import verify_password, verify_legacy_password, hash_password
from rbac import Permission, require_permission
from audit import record_audit_event

router = APIRouter(prefix="/api/users", tags=["Users"])


# Get all users (Admin only)
@router.get("", response_model=list[UserResponse])
def get_all_users(
    admin_user: User = Depends(require_permission(Permission.READ_ALL_USERS))
):
    with SessionLocal() as db:
        users = db.query(User).order_by(User.id).all()
        return users


# Get current user's profile
@router.get("/me", response_model=UserResponse)
def read_my_profile(
    current_user: User = Depends(require_permission(Permission.READ_PROFILE))
):
    return current_user


# Update current user's profile
@router.put("/me", response_model=UserResponse)
def update_my_profile(
    user_data: UserUpdate,
    current_user: User = Depends(require_permission(Permission.UPDATE_PROFILE))
):
    with SessionLocal() as db:
        user = db.query(User).filter(
            User.id == current_user.id
        ).first()

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        if user_data.email is not None:
            existing_user = db.query(User).filter(
                User.email == user_data.email,
                User.id != current_user.id
            ).first()

            if existing_user:
                raise HTTPException(
                    status_code=409,
                    detail="Email already registered"
                )

            user.email = user_data.email

        if user_data.full_name is not None:
            user.full_name = user_data.full_name

        try:
            db.commit()
            db.refresh(user)

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        return user
# Change current user's password
@router.post("/me/change-password")
def change_my_password(
    password_data: PasswordChange,
    request: Request,
    current_user: User = Depends(require_permission(Permission.CHANGE_PASSWORD))
):
    with SessionLocal() as db:
        user = db.query(User).filter(
            User.id == current_user.id
        ).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Verify current password
        is_current_password_valid = verify_password(
            password_data.current_password,
            user.password_hash
        )

        if not is_current_password_valid:
            is_current_password_valid = verify_legacy_password(
                password_data.current_password,
                user.password_hash
            )

        if not is_current_password_valid:
            record_audit_event(
                db,
                request,
                "auth.password_change.failed",
                actor_user_id=user.id,
                target_user_id=user.id,
                target_type="user",
                target_id=user.id,
                details={"reason": "incorrect_current_password"},
            )
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect"
            )

        # Prevent using the same password
        is_same_password = verify_password(
            password_data.new_password,
            user.password_hash
        )

        if not is_same_password:
            is_same_password = verify_legacy_password(
                password_data.new_password,
                user.password_hash
            )

        if is_same_password:
            raise HTTPException(
                status_code=400,
                detail="New password must be different from current password"
            )

        # Hash and save the new password
        user.password_hash = hash_password(
            password_data.new_password
        )
        now = datetime.now(timezone.utc)

        active_sessions = db.query(RefreshSession).filter(
           RefreshSession.user_id == user.id,
           RefreshSession.revoked_at.is_(None)
        ).all()

        for session in active_sessions:
            session.revoked_at = now

        record_audit_event(
            db,
            request,
            "auth.password_change.succeeded",
            actor_user_id=user.id,
            target_user_id=user.id,
            target_type="user",
            target_id=user.id,
        )

        db.commit()

        return {
            "message": "Password changed successfully"
        }
