import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from audit import record_audit_event
from database import SessionLocal
from models import Application, AuditLog, Job, User
from rbac import Permission, require_permission


router = APIRouter(prefix="/api/admin", tags=["Administration"])
LOGIN_FAILURE_ACTIONS = ("auth.login.failed", "auth.login.blocked")
SECURITY_ACTIONS = (
    "auth.login.failed",
    "auth.login.blocked",
    "auth.password_change.failed",
)


def _filtered_audit_query(
    db: Session,
    *,
    search: str | None,
    action: str | None,
    actor_user_id: int | None,
    target_user_id: int | None,
    ip_address: str | None,
    start_at: datetime | None,
    end_at: datetime | None,
):
    actor = aliased(User)
    target = aliased(User)
    query = (
        db.query(AuditLog, actor.full_name, target.full_name)
        .outerjoin(actor, actor.id == AuditLog.actor_user_id)
        .outerjoin(target, target.id == AuditLog.target_user_id)
    )
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.target_type.ilike(term),
                AuditLog.target_id.ilike(term),
                AuditLog.ip_address.ilike(term),
            )
        )
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_user_id is not None:
        query = query.filter(AuditLog.actor_user_id == actor_user_id)
    if target_user_id is not None:
        query = query.filter(AuditLog.target_user_id == target_user_id)
    if ip_address:
        query = query.filter(AuditLog.ip_address.ilike(f"%{ip_address.strip()}%"))
    if start_at:
        query = query.filter(AuditLog.created_at >= start_at)
    if end_at:
        query = query.filter(AuditLog.created_at <= end_at)
    return query


def _check_date_range(start_at: datetime | None, end_at: datetime | None) -> None:
    if start_at and end_at and start_at > end_at:
        raise HTTPException(
            status_code=422,
            detail="start_at must be earlier than or equal to end_at",
        )


def _audit_item(
    row: tuple[AuditLog, str | None, str | None],
) -> dict[str, object]:
    event, actor_name, target_name = row
    return {
        "id": event.id,
        "action": event.action,
        "actor_user_id": event.actor_user_id,
        "actor_name": actor_name,
        "target_user_id": event.target_user_id,
        "target_user_name": target_name,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "details": event.details,
        "ip_address": event.ip_address,
        "user_agent": event.user_agent,
        "created_at": event.created_at,
    }


@router.get("/audit-logs")
def list_admin_audit_logs(
    search: str | None = Query(default=None, min_length=1, max_length=255),
    action: str | None = Query(default=None, min_length=1, max_length=100),
    actor_user_id: int | None = Query(default=None, ge=1),
    target_user_id: int | None = Query(default=None, ge=1),
    ip_address: str | None = Query(default=None, min_length=1, max_length=45),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    admin_user: User = Depends(
        require_permission(Permission.READ_ADMIN_AUDIT)
    ),
):
    _check_date_range(start_at, end_at)
    with SessionLocal() as db:
        query = _filtered_audit_query(
            db,
            search=search,
            action=action,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            ip_address=ip_address,
            start_at=start_at,
            end_at=end_at,
        )
        total = query.count()
        rows = (
            query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "items": [_audit_item(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }


@router.get("/security/overview")
def get_security_overview(
    since_hours: int = Query(default=24, ge=1, le=720),
    admin_user: User = Depends(
        require_permission(Permission.READ_SECURITY_EVENTS)
    ),
):
    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    with SessionLocal() as db:
        failures = db.query(AuditLog).filter(
            AuditLog.action.in_(LOGIN_FAILURE_ACTIONS),
            AuditLog.created_at >= since,
        )
        failed_login_total = failures.count()

        by_ip = (
            db.query(
                func.coalesce(AuditLog.ip_address, "unknown").label("ip_address"),
                func.count(AuditLog.id).label("attempt_count"),
            )
            .filter(
                AuditLog.action.in_(LOGIN_FAILURE_ACTIONS),
                AuditLog.created_at >= since,
            )
            .group_by(AuditLog.ip_address)
            .order_by(func.count(AuditLog.id).desc())
            .limit(25)
            .all()
        )
        by_account = (
            db.query(
                func.coalesce(AuditLog.target_id, "unknown").label("account"),
                func.count(AuditLog.id).label("attempt_count"),
            )
            .filter(
                AuditLog.action.in_(LOGIN_FAILURE_ACTIONS),
                AuditLog.created_at >= since,
            )
            .group_by(AuditLog.target_id)
            .order_by(func.count(AuditLog.id).desc())
            .limit(25)
            .all()
        )
        recent_events = (
            db.query(AuditLog)
            .filter(
                AuditLog.action.in_(SECURITY_ACTIONS),
                AuditLog.created_at >= since,
            )
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(50)
            .all()
        )
        return {
            "since": since,
            "since_hours": since_hours,
            "failed_login_total": failed_login_total,
            "by_ip": [
                {"ip_address": ip, "attempt_count": count}
                for ip, count in by_ip
            ],
            "by_account": [
                {"account": account, "attempt_count": count}
                for account, count in by_account
            ],
            "recent_events": [
                {
                    "id": event.id,
                    "action": event.action,
                    "target_id": event.target_id,
                    "details": event.details,
                    "ip_address": event.ip_address,
                    "user_agent": event.user_agent,
                    "created_at": event.created_at,
                }
                for event in recent_events
            ],
        }


def _csv_cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    else:
        text = str(value)
    if isinstance(value, str) and text.lstrip().startswith(("=", "+", "-", "@")):
        return f"'{text}"
    return text


def _csv_response(
    headers: list[str],
    rows: list[tuple[object, ...]],
    filename: str,
) -> Response:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows([_csv_cell(value) for value in row] for row in rows)
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _export_response(
    db: Session,
    request: Request,
    admin_user: User,
    export_type: str,
    filters: dict[str, object],
    headers: list[str],
    rows: list[tuple[object, ...]],
    filename: str,
) -> Response:
    record_audit_event(
        db,
        request,
        f"admin.export.{export_type}",
        actor_user_id=admin_user.id,
        target_type="export",
        target_id=export_type,
        details={"filters": filters, "row_count": len(rows)},
    )
    db.commit()
    return _csv_response(headers, rows, filename)


@router.get("/exports/users.csv")
def export_admin_users(
    request: Request,
    search: str | None = Query(default=None, min_length=1, max_length=255),
    role: Literal["job_seeker", "employer", "admin"] | None = None,
    account_status: Literal["active", "inactive", "banned"] | None = Query(
        default=None,
        alias="status",
    ),
    admin_user: User = Depends(
        require_permission(Permission.EXPORT_ADMIN_DATA)
    ),
):
    with SessionLocal() as db:
        query = db.query(User)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(User.full_name.ilike(term), User.email.ilike(term))
            )
        if account_status == "banned":
            query = query.filter(User.is_banned.is_(True))
        elif account_status == "active":
            query = query.filter(
                User.is_active.is_(True),
                User.is_banned.is_(False),
            )
        elif account_status == "inactive":
            query = query.filter(
                User.is_active.is_(False),
                User.is_banned.is_(False),
            )
        if role:
            query = query.filter(User.role == role)
        users = query.order_by(User.id).all()
        rows = [
            (
                user.id,
                user.full_name,
                user.email,
                user.role,
                user.is_active,
                user.is_banned,
                user.created_at,
            )
            for user in users
        ]
        return _export_response(
            db,
            request,
            admin_user,
            "users",
            {"search": search, "role": role, "status": account_status},
            [
                "id",
                "full_name",
                "email",
                "role",
                "is_active",
                "is_banned",
                "created_at",
            ],
            rows,
            "linkup-users.csv",
        )


@router.get("/exports/content.csv")
def export_admin_content(
    request: Request,
    content_type: Literal["jobs", "applications"] = "jobs",
    search: str | None = Query(default=None, min_length=1, max_length=255),
    application_status: Literal[
        "Pending", "Under Review", "Accepted", "Rejected"
    ] | None = None,
    admin_user: User = Depends(
        require_permission(Permission.EXPORT_ADMIN_DATA)
    ),
):
    with SessionLocal() as db:
        if content_type == "jobs":
            if application_status:
                raise HTTPException(
                    status_code=422,
                    detail="Application status can only filter applications",
                )
            query = db.query(Job, User).join(User, User.id == Job.employer_id)
            if search and search.strip():
                term = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        Job.title.ilike(term),
                        Job.company_name.ilike(term),
                        Job.location.ilike(term),
                        User.full_name.ilike(term),
                        User.email.ilike(term),
                    )
                )
            result = query.order_by(Job.id).all()
            headers = [
                "id",
                "title",
                "company_name",
                "location",
                "employment_type",
                "salary",
                "employer_id",
                "employer_name",
                "employer_email",
                "created_at",
            ]
            rows = [
                (
                    job.id,
                    job.title,
                    job.company_name,
                    job.location,
                    job.employment_type,
                    job.salary,
                    employer.id,
                    employer.full_name,
                    employer.email,
                    job.created_at,
                )
                for job, employer in result
            ]
        else:
            query = (
                db.query(Application, Job, User)
                .join(Job, Job.id == Application.job_id)
                .join(User, User.id == Application.job_seeker_id)
            )
            if search and search.strip():
                term = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        Job.title.ilike(term),
                        Job.company_name.ilike(term),
                        User.full_name.ilike(term),
                        User.email.ilike(term),
                    )
                )
            if application_status:
                query = query.filter(Application.status == application_status)
            result = query.order_by(Application.id).all()
            headers = [
                "id",
                "job_id",
                "job_title",
                "company_name",
                "applicant_id",
                "applicant_name",
                "applicant_email",
                "status",
            ]
            rows = [
                (
                    application.id,
                    job.id,
                    job.title,
                    job.company_name,
                    applicant.id,
                    applicant.full_name,
                    applicant.email,
                    application.status,
                )
                for application, job, applicant in result
            ]
        return _export_response(
            db,
            request,
            admin_user,
            content_type,
            {
                "content_type": content_type,
                "search": search,
                "application_status": application_status,
            },
            headers,
            rows,
            f"linkup-{content_type}.csv",
        )


@router.get("/exports/audit.csv")
def export_admin_audit_logs(
    request: Request,
    search: str | None = Query(default=None, min_length=1, max_length=255),
    action: str | None = Query(default=None, min_length=1, max_length=100),
    actor_user_id: int | None = Query(default=None, ge=1),
    target_user_id: int | None = Query(default=None, ge=1),
    ip_address: str | None = Query(default=None, min_length=1, max_length=45),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    admin_user: User = Depends(
        require_permission(Permission.EXPORT_ADMIN_DATA)
    ),
):
    _check_date_range(start_at, end_at)
    with SessionLocal() as db:
        query = _filtered_audit_query(
            db,
            search=search,
            action=action,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            ip_address=ip_address,
            start_at=start_at,
            end_at=end_at,
        )
        result = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).all()
        rows = [
            (
                event.id,
                event.action,
                actor_name,
                event.actor_user_id,
                target_name,
                event.target_user_id,
                event.target_type,
                event.target_id,
                event.details,
                event.ip_address,
                event.user_agent,
                event.created_at,
            )
            for event, actor_name, target_name in result
        ]
        return _export_response(
            db,
            request,
            admin_user,
            "audit_logs",
            {
                "search": search,
                "action": action,
                "actor_user_id": actor_user_id,
                "target_user_id": target_user_id,
                "ip_address": ip_address,
                "start_at": start_at.isoformat() if start_at else None,
                "end_at": end_at.isoformat() if end_at else None,
            },
            [
                "id",
                "action",
                "actor_name",
                "actor_user_id",
                "target_user_name",
                "target_user_id",
                "target_type",
                "target_id",
                "details",
                "ip_address",
                "user_agent",
                "created_at",
            ],
            rows,
            "linkup-audit-logs.csv",
        )
