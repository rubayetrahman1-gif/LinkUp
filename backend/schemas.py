
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# User Registration
class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["job_seeker", "employer"] = "job_seeker"


# User Login
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Update User Profile
class UserUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )
    email: EmailStr | None = None


# User Profile Response
class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: Literal["job_seeker", "employer", "admin"]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


    
# Job Creation
class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    company_name: str = Field(min_length=2, max_length=150)
    location: str = Field(min_length=2, max_length=150)
    description: str = Field(min_length=10)
    employment_type: Literal[
        "full_time",
        "part_time",
        "internship",
        "contract"
    ]
    salary: str | None = None


# Job Update
class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    company_name: str | None = Field(default=None, min_length=2, max_length=150)
    location: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, min_length=10)
    employment_type: Literal[
        "full_time",
        "part_time",
        "internship",
        "contract"
    ] | None = None
    salary: str | None = None


# Job Response
class JobResponse(BaseModel):
    id: int
    title: str
    company_name: str
    location: str
    description: str
    employment_type: str
    salary: str | None
    employer_id: int
    created_at: datetime

    model_config = {"from_attributes": True}