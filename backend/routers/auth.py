
from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User
from schemas import UserRegister, UserResponse, UserLogin
from security import hash_password, verify_password, create_access_token


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(user: UserRegister):

    with SessionLocal() as db:

        existing_user = db.query(User).filter(
            User.email == user.email
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        hashed_password = hash_password(user.password)

        new_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            role=user.role
        )

        db.add(new_user)

        try:
            db.commit()
            db.refresh(new_user)

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        return new_user


@router.post("/login")
def login_user(user: UserLogin):

    with SessionLocal() as db:

        existing_user = db.query(User).filter(
            User.email == user.email
        ).first()

        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        if not verify_password(
            user.password,
            existing_user.password_hash
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        if not existing_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account is inactive"
            )

        access_token = create_access_token(
            {"sub": str(existing_user.id)}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
