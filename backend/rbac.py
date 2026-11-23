from enum import Enum

from fastapi import Depends, HTTPException, status

from models import User


class Permission(str, Enum):
    CREATE_JOB = "create_job"
    READ_OWN_JOBS = "read_own_jobs"
    UPDATE_OWN_JOBS = "update_own_jobs"
    DELETE_OWN_JOBS = "delete_own_jobs"
    APPLY_FOR_JOB = "apply_for_job"
    READ_OWN_APPLICATIONS = "read_own_applications"
    MANAGE_OWN_APPLICATIONS = "manage_own_applications"
    READ_ALL_USERS = "read_all_users"
    READ_ADMIN_DASHBOARD = "read_admin_dashboard"
    READ_ADMIN_USERS = "read_admin_users"
    READ_PROFILE = "read_profile"
    UPDATE_PROFILE = "update_profile"
    CHANGE_PASSWORD = "change_password"
    READ_SESSIONS = "read_sessions"
    REVOKE_SESSIONS = "revoke_sessions"


ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    "employer": frozenset(
        {
            Permission.CREATE_JOB,
            Permission.READ_OWN_JOBS,
            Permission.UPDATE_OWN_JOBS,
            Permission.DELETE_OWN_JOBS,
            Permission.MANAGE_OWN_APPLICATIONS,
            Permission.READ_PROFILE,
            Permission.UPDATE_PROFILE,
            Permission.CHANGE_PASSWORD,
            Permission.READ_SESSIONS,
            Permission.REVOKE_SESSIONS,
        }
    ),
    "job_seeker": frozenset(
        {
            Permission.APPLY_FOR_JOB,
            Permission.READ_OWN_APPLICATIONS,
            Permission.READ_PROFILE,
            Permission.UPDATE_PROFILE,
            Permission.CHANGE_PASSWORD,
            Permission.READ_SESSIONS,
            Permission.REVOKE_SESSIONS,
        }
    ),
    "admin": frozenset(
        {
            Permission.READ_ALL_USERS,
            Permission.READ_ADMIN_DASHBOARD,
            Permission.READ_ADMIN_USERS,
            Permission.READ_PROFILE,
            Permission.UPDATE_PROFILE,
            Permission.CHANGE_PASSWORD,
            Permission.READ_SESSIONS,
            Permission.REVOKE_SESSIONS,
        }
    ),
}


def has_permission(user: User, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(user.role, frozenset())


def require_permission(permission: Permission):
    from dependencies import get_current_user

    def authorize(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return authorize
