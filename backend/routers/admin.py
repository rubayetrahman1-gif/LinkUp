from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import aliased

from audit import record_audit_event
from database import SessionLocal
from models import Application, AuditLog, Job, RefreshSession, User
from rbac import Permission, require_permission
from schemas import (
    AdminBulkUserAction,
    AdminUserBanRequest,
    AdminUserRoleUpdate,
)


router = APIRouter(prefix="/api/admin", tags=["Administration"])
ADMIN_ROLES = ("job_seeker", "employer", "admin")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get("/dashboard/overview")
def get_dashboard_overview(
    admin_user: User = Depends(
        require_permission(Permission.READ_ADMIN_DASHBOARD)
    ),
):
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    with SessionLocal() as db:
        users_by_role = {role: 0 for role in ADMIN_ROLES}
        for role, count in db.query(User.role, func.count(User.id)).group_by(
            User.role
        ):
            users_by_role[role] = count

        application_statuses = {
            application_status: count
            for application_status, count in db.query(
                Application.status, func.count(Application.id)
            ).group_by(Application.status)
        }

        activities: list[tuple[datetime, dict[str, str | int]]] = []
        recent_users = (
            db.query(User.id, User.full_name, User.created_at)
            .order_by(User.created_at.desc())
            .limit(10)
            .all()
        )
        for user_id, full_name, created_at in recent_users:
            activities.append(
                (
                    _as_utc(created_at),
                    {
                        "id": f"user-{user_id}",
                        "type": "user_registered",
                        "actor": full_name,
                        "action": "registered",
                        "target": "account",
                    },
                )
            )

        recent_jobs = (
            db.query(
                Job.id,
                Job.title,
                Job.company_name,
                Job.created_at,
                User.full_name,
            )
            .join(User, User.id == Job.employer_id)
            .order_by(Job.created_at.desc())
            .limit(10)
            .all()
        )
        for job_id, title, company_name, created_at, employer_name in recent_jobs:
            activities.append(
                (
                    _as_utc(created_at),
                    {
                        "id": f"job-{job_id}",
                        "type": "job_posted",
                        "actor": employer_name,
                        "action": "posted",
                        "target": f"{title} at {company_name}",
                    },
                )
            )

        actor = aliased(User)
        target = aliased(User)
        recent_audit_events = (
            db.query(AuditLog, actor.full_name, target.full_name)
            .outerjoin(actor, actor.id == AuditLog.actor_user_id)
            .outerjoin(target, target.id == AuditLog.target_user_id)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(10)
            .all()
        )
        for event, actor_name, target_name in recent_audit_events:
            details = event.details or {}
            target_label = (
                target_name
                or details.get("title")
                or details.get("job_title")
                or (
                    f"{event.target_type} {event.target_id}"
                    if event.target_type or event.target_id
                    else "platform"
                )
            )
            activities.append(
                (
                    _as_utc(event.created_at),
                    {
                        "id": f"audit-{event.id}",
                        "type": "audit_event",
                        "actor": actor_name or "Unauthenticated",
                        "action": event.action,
                        "target": str(target_label),
                    },
                )
            )

        activities.sort(key=lambda item: item[0], reverse=True)
        recent_activity = [
            {**activity, "occurred_at": occurred_at.isoformat()}
            for occurred_at, activity in activities[:10]
        ]

        return {
            "users": {
                "total": db.query(User).count(),
                "by_role": users_by_role,
                "active": db.query(User).filter(
                    User.is_active.is_(True),
                    User.is_banned.is_(False),
                ).count(),
                "inactive": db.query(User).filter(
                    User.is_active.is_(False),
                    User.is_banned.is_(False),
                ).count(),
                "banned": db.query(User).filter(
                    User.is_banned.is_(True)
                ).count(),
            },
            "content": {
                "jobs": db.query(Job).count(),
                "applications": db.query(Application).count(),
                "applications_by_status": application_statuses,
            },
            "groups": {
                "available": False,
                "total": None,
            },
            "last_7_days": {
                "new_users": db.query(User)
                .filter(User.created_at >= seven_days_ago)
                .count(),
                "job_posts": db.query(Job)
                .filter(Job.created_at >= seven_days_ago)
                .count(),
            },
            "recent_activity": recent_activity,
        }


@router.get("/users")
def list_users(
    search: str | None = Query(default=None, min_length=1, max_length=255),
    role: Literal["job_seeker", "employer", "admin"] | None = None,
    account_status: Literal["active", "inactive", "banned"] | None = Query(
        default=None,
        alias="status",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin_user: User = Depends(require_permission(Permission.READ_ADMIN_USERS)),
):
    with SessionLocal() as db:
        query = db.query(User)
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            query = query.filter(
                User.full_name.ilike(search_term) | User.email.ilike(search_term)
            )
        if role:
            query = query.filter(User.role == role)
        if account_status:
            if account_status == "banned":
                query = query.filter(User.is_banned.is_(True))
            elif account_status == "active":
                query = query.filter(
                    User.is_active.is_(True),
                    User.is_banned.is_(False),
                )
            else:
                query = query.filter(
                    User.is_active.is_(False),
                    User.is_banned.is_(False),
                )

        total = query.count()
        users = (
            query.order_by(User.created_at.desc(), User.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return {
            "items": [
                {
                    "id": user.id,
                    "full_name": user.full_name,
                    "email": user.email,
                    "role": user.role,
                    "is_active": user.is_active,
                    "is_banned": user.is_banned,
                    "ban_reason": user.ban_reason,
                    "created_at": user.created_at,
                }
                for user in users
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }


@router.get("/users/{user_id}")
def get_user_details(
    user_id: int,
    admin_user: User = Depends(require_permission(Permission.READ_ADMIN_USERS)),
):
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        sessions = (
            db.query(RefreshSession)
            .filter(RefreshSession.user_id == user.id)
            .order_by(RefreshSession.created_at.desc())
            .all()
        )

        activity: list[dict[str, str | None]] = [
            {
                "id": f"user-{user.id}",
                "type": "account_created",
                "description": "Account created",
                "occurred_at": _as_utc(user.created_at).isoformat(),
            }
        ]

        if user.role == "employer":
            jobs = (
                db.query(Job)
                .filter(Job.employer_id == user.id)
                .order_by(Job.created_at.desc(), Job.id.desc())
                .limit(10)
                .all()
            )
            activity.extend(
                {
                    "id": f"job-{job.id}",
                    "type": "job_posted",
                    "description": f"Posted {job.title} at {job.company_name}",
                    "occurred_at": _as_utc(job.created_at).isoformat(),
                }
                for job in jobs
            )
        elif user.role == "job_seeker":
            applications = (
                db.query(Application, Job)
                .join(Job, Application.job_id == Job.id)
                .filter(Application.job_seeker_id == user.id)
                .order_by(Application.id.desc())
                .limit(10)
                .all()
            )
            activity.extend(
                {
                    "id": f"application-{application.id}",
                    "type": "application_submitted",
                    "description": (
                        f"Applied to {job.title} at {job.company_name} "
                        f"(status: {application.status})"
                    ),
                    "occurred_at": None,
                }
                for application, job in applications
            )

        timed_activity = [
            item for item in activity if item["occurred_at"] is not None
        ]
        untimed_activity = [
            item for item in activity if item["occurred_at"] is None
        ]
        timed_activity.sort(
            key=lambda item: item["occurred_at"] or "",
            reverse=True,
        )

        return {
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "is_banned": user.is_banned,
                "ban_reason": user.ban_reason,
                "banned_at": user.banned_at,
                "banned_by_id": user.banned_by_id,
                "created_at": user.created_at,
                "locked_until": user.locked_until,
            },
            "activity": timed_activity + untimed_activity,
            "sessions": [
                {
                    "id": session.id,
                    "user_agent": session.user_agent,
                    "created_at": session.created_at,
                    "expires_at": session.expires_at,
                    "last_used_at": session.last_used_at,
                    "revoked_at": session.revoked_at,
                    "is_active": (
                        session.revoked_at is None
                        and _as_utc(session.expires_at) > now
                    ),
                }
                for session in sessions
            ],
            "groups": {
                "available": False,
                "memberships": [],
            },
        }


@router.patch("/users/{user_id}/ban")
def ban_user(
    user_id: int,
    ban_request: AdminUserBanRequest,
    request: Request,
    admin_user: User = Depends(require_permission(Permission.BAN_USERS)),
):
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot ban their own account",
        )

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .with_for_update()
            .first()
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already banned",
            )

        user.is_banned = True
        user.is_active = False
        user.ban_reason = ban_request.reason
        user.banned_at = now
        user.banned_by_id = admin_user.id

        sessions = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.user_id == user.id,
                RefreshSession.revoked_at.is_(None),
            )
            .with_for_update()
            .all()
        )
        for session in sessions:
            session.revoked_at = now

        record_audit_event(
            db,
            request,
            "admin.user.banned",
            actor_user_id=admin_user.id,
            target_user_id=user.id,
            target_type="user",
            target_id=user.id,
            details={"reason": ban_request.reason},
        )
        db.commit()
        return {
            "message": "User banned successfully",
            "user_id": user.id,
            "is_banned": user.is_banned,
        }


@router.post("/users/{user_id}/unban")
def unban_user(
    user_id: int,
    request: Request,
    admin_user: User = Depends(require_permission(Permission.BAN_USERS)),
):
    with SessionLocal() as db:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .with_for_update()
            .first()
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        if not user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is not banned",
            )

        user.is_banned = False
        user.is_active = True
        record_audit_event(
            db,
            request,
            "admin.user.unbanned",
            actor_user_id=admin_user.id,
            target_user_id=user.id,
            target_type="user",
        )
        db.commit()
        return {
            "message": "User unbanned successfully",
            "user_id": user.id,
            "is_banned": user.is_banned,
        }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role_update: AdminUserRoleUpdate,
    request: Request,
    admin_user: User = Depends(
        require_permission(Permission.CHANGE_USER_ROLES)
    ),
):
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot change their own role",
        )

    with SessionLocal() as db:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .with_for_update()
            .first()
        )
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        previous_role = user.role
        user.role = role_update.role
        if previous_role != role_update.role:
            record_audit_event(
                db,
                request,
                "admin.user.role_changed",
                actor_user_id=admin_user.id,
                target_user_id=user.id,
                target_type="user",
                target_id=user.id,
                details={
                    "old_role": previous_role,
                    "new_role": role_update.role,
                },
            )
        db.commit()
        return {
            "message": "User role updated successfully",
            "user_id": user.id,
            "role": user.role,
        }


@router.post("/users/{user_id}/sessions/{session_id}/revoke")
def revoke_user_session(
    user_id: int,
    session_id: int,
    request: Request,
    admin_user: User = Depends(
        require_permission(Permission.REVOKE_USER_SESSIONS)
    ),
):
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        session = (
            db.query(RefreshSession)
            .filter(
                RefreshSession.id == session_id,
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
            .with_for_update()
            .first()
        )
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active user session not found",
            )

        session.revoked_at = now
        record_audit_event(
            db,
            request,
            "admin.session.revoked",
            actor_user_id=admin_user.id,
            target_user_id=user_id,
            target_type="refresh_session",
            target_id=session_id,
        )
        db.commit()
        return {
            "message": "User session revoked successfully",
            "user_id": user_id,
            "session_id": session_id,
        }


@router.post("/users/bulk-action")
def bulk_update_users(
    action_request: AdminBulkUserAction,
    request: Request,
    admin_user: User = Depends(
        require_permission(Permission.BULK_MANAGE_USERS)
    ),
):
    user_ids = action_request.user_ids
    if action_request.action == "ban" and admin_user.id in user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot ban their own account",
        )

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        users = (
            db.query(User)
            .filter(User.id.in_(user_ids))
            .with_for_update()
            .all()
        )
        if len(users) != len(user_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more users were not found",
            )

        affected_count = 0
        for user in users:
            if action_request.action == "ban":
                user.is_banned = True
                user.is_active = False
                user.ban_reason = action_request.reason
                user.banned_at = now
                user.banned_by_id = admin_user.id
                affected_count += 1
                record_audit_event(
                    db,
                    request,
                    "admin.user.bulk_banned",
                    actor_user_id=admin_user.id,
                    target_user_id=user.id,
                    target_type="user",
                    target_id=user.id,
                    details={"reason": action_request.reason},
                )
            elif user.is_banned:
                user.is_banned = False
                user.is_active = True
                affected_count += 1
                record_audit_event(
                    db,
                    request,
                    "admin.user.bulk_unbanned",
                    actor_user_id=admin_user.id,
                    target_user_id=user.id,
                    target_type="user",
                    target_id=user.id,
                )

        if action_request.action == "ban":
            sessions = (
                db.query(RefreshSession)
                .filter(
                    RefreshSession.user_id.in_(user_ids),
                    RefreshSession.revoked_at.is_(None),
                )
                .with_for_update()
                .all()
            )
            for session in sessions:
                session.revoked_at = now

        db.commit()
        return {
            "message": f"Bulk {action_request.action} completed",
            "action": action_request.action,
            "affected_count": affected_count,
        }
