
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User
from schemas import UserResponse, UserUpdate
from dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


# Get all users (Admin only)
@router.get("", response_model=list[UserResponse])
def get_all_users(
    admin_user: User = Depends(get_current_admin)
):
    with SessionLocal() as db:
        users = db.query(User).order_by(User.id).all()
        return users


# Get current user's profile
@router.get("/me", response_model=UserResponse)
def read_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


# Update current user's profile
@router.put("/me", response_model=UserResponse)
def update_my_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    with SessionLocal() as db:
        user = db.query(User).filter(
            User.id == current_user.id
        ).first()

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
