
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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
    team_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Change Password
class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ApplicationStatusUpdate(BaseModel):
    status: Literal["Pending", "Under Review", "Accepted", "Rejected"]


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)

    @field_validator("name", mode="before")
    @classmethod
    def trim_team_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class TeamUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)

    @field_validator("name", mode="before")
    @classmethod
    def trim_team_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class TeamMemberCreate(BaseModel):
    email: EmailStr
    role: Literal["recruiter", "reviewer"]


class TeamMemberUpdate(BaseModel):
    role: Literal["recruiter", "reviewer"]


class TeamApplicationAssignment(BaseModel):
    reviewer_id: int | None


class TeamApplicationReview(BaseModel):
    recommendation: Literal[
        "Recommend",
        "Not Recommend",
        "Need Further Consideration",
    ]

    model_config = {"extra": "forbid"}


class AdminUserRoleUpdate(BaseModel):
    role: Literal["job_seeker", "employer", "admin"]


class AdminUserBanRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class AdminBulkUserAction(BaseModel):
    action: Literal["ban", "unban"]
    user_ids: list[int] = Field(min_length=1, max_length=100)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("user_ids")
    @classmethod
    def require_unique_user_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("User IDs must be unique")
        return value

    @field_validator("reason", mode="before")
    @classmethod
    def trim_bulk_reason(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def require_reason_for_ban(self):
        if self.action == "ban" and (
            self.reason is None or len(self.reason) < 5
        ):
            raise ValueError("A ban reason of at least 5 characters is required")
        return self


class AdminBulkContentDelete(BaseModel):
    content_type: Literal["jobs", "applications"]
    record_ids: list[int] = Field(min_length=1, max_length=100)

    @field_validator("record_ids")
    @classmethod
    def require_unique_record_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("Record IDs must be unique")
        return value
