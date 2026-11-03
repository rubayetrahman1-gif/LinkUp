from pathlib import Path

from fastapi import FastAPI
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User
from schemas import UserRegister, UserResponse
from security import hash_password
from schemas import UserLogin,UserUpdate
from security import verify_password, create_access_token
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from security import decode_access_token

app = FastAPI(title="FastAPI + React")
bearer_scheme = HTTPBearer()



@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello")
def hello(name: str = "World") -> dict[str, str]:
    return {"message": f"Hello, {name}!"}


@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(user: UserRegister):

    with SessionLocal() as db:

        # Check whether email already exists
        existing_user = db.query(User).filter(
            User.email == user.email
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email already registered"
            )

        # Hash the password
        hashed_password = hash_password(user.password)

        # Create new user
        new_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            role=user.role
        )

        # Save user to database
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

    
@app.post("/api/auth/login")
def login_user(user: UserLogin):

    with SessionLocal() as db:

        # Find user by email
        existing_user = db.query(User).filter(
            User.email == user.email
        ).first()

        # Check whether user exists
        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Verify password
        if not verify_password(
            user.password,
            existing_user.password_hash
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Check whether account is active
        if not existing_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account is inactive"
            )

        # Generate JWT token
        access_token = create_access_token(
            {"sub": str(existing_user.id)}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = credentials.credentials

    try:
        payload = decode_access_token(token)

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    with SessionLocal() as db:

        current_user = db.query(User).filter(
            User.id == int(user_id)
        ).first()

        if current_user is None:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        if not current_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account is inactive"
            )

        return current_user

@app.get(
    "/api/users/me",
    response_model=UserResponse
)
def read_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user

@app.put(
    "/api/users/me",
    response_model=UserResponse
)
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




# EXERCISE (part 1): uncomment to add POST /api/user, then test it at /docs.
# from pydantic import BaseModel, EmailStr
#
#
# class User(BaseModel):
#     id: int
#     name: str
#     email: EmailStr  # invalid emails get a 422 response automatically
#
#
# @app.post("/api/user")
# def create_user(user: User) -> dict[str, str]:
#     return {"message": f"Hello {user.name} (ID {user.id}), we'll email you at {user.email}."}


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

# dist/ only exists after `npm run build`; in dev the Vite server serves the UI.
if FRONTEND_DIR.is_dir():
    app.frontend("/", directory=FRONTEND_DIR)
