
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
