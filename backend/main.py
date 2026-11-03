from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi import (FastAPI,HTTPException,status,Depends)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User, Job
from schemas import (UserRegister,UserResponse,UserLogin,UserUpdate,JobCreate,JobUpdate,JobResponse)
from security import (hash_password,verify_password,create_access_token,decode_access_token)

app = FastAPI(title="FastAPI + React")
bearer_scheme = HTTPBearer()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




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

    
   # Check whether the current user is an admin
def get_current_admin(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


# Check whether the current user is an employer
def get_current_employer(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employer access required"
        )

    return current_user



# Create a new job (Employer only)
@app.post(
    "/api/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED
)
def create_job(
    job_data: JobCreate,
    current_user: User = Depends(get_current_employer)
):
    with SessionLocal() as db:
        new_job = Job(
            title=job_data.title,
            company_name=job_data.company_name,
            location=job_data.location,
            description=job_data.description,
            employment_type=job_data.employment_type,
            salary=job_data.salary,
            employer_id=current_user.id
        )

        db.add(new_job)
        db.commit()
        db.refresh(new_job)

        return new_job

    

# Get all available jobs
@app.get(
    "/api/jobs",
    response_model=list[JobResponse]
)
def get_all_jobs():
    with SessionLocal() as db:
        jobs = db.query(Job).order_by(Job.id.desc()).all()

        return jobs


# Get all jobs posted by the current employer
@app.get("/api/jobs/my-jobs", response_model=list[JobResponse])
def get_my_jobs(
    current_user: User = Depends(get_current_employer)
):
    with SessionLocal() as db:
        jobs = db.query(Job).filter(
            Job.employer_id == current_user.id
        ).order_by(Job.id.desc()).all()

        return jobs

    

# Get a single job by ID
@app.get(
    "/api/jobs/{job_id}",
    response_model=JobResponse
)
def get_job_by_id(job_id: int):
    with SessionLocal() as db:
        job = db.query(Job).filter(
            Job.id == job_id
        ).first()

        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )

        return job    
# Update a job (Employer only)
@app.put(
    "/api/jobs/{job_id}",
    response_model=JobResponse
)
def update_job(
    job_id: int,
    job_data: JobUpdate,
    current_user: User = Depends(get_current_employer)
):
    with SessionLocal() as db:
        job = db.query(Job).filter(
            Job.id == job_id
        ).first()

        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )

        if job.employer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own jobs"
            )

        update_data = job_data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(job, key, value)

        db.commit()
        db.refresh(job)

        return job

    
    # Delete a job (Employer only)
@app.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_employer)
):
    with SessionLocal() as db:
        job = db.query(Job).filter(
            Job.id == job_id
        ).first()

        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )

        if job.employer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own jobs"
            )

        db.delete(job)
        db.commit()

        return {"message": "Job deleted successfully"}



# Get all users (Admin only)
@app.get(
    "/api/users",
    response_model=list[UserResponse]
)
def get_all_users(
    admin_user: User = Depends(get_current_admin)
):
    with SessionLocal() as db:
        users = db.query(User).order_by(User.id).all()

        return users


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
