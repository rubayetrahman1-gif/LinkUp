from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from audit import record_audit_event
from database import SessionLocal
from models import Application, Job, User
from rbac import Permission, require_permission
from schemas import AdminBulkContentDelete


router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/content")
def list_admin_content(
    content_type: Literal["jobs", "applications"] = "jobs",
    search: str | None = Query(default=None, min_length=1, max_length=255),
    application_status: Literal[
        "Pending", "Under Review", "Accepted", "Rejected"
    ] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin_user: User = Depends(
        require_permission(Permission.MODERATE_CONTENT)
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

            total = query.count()
            rows = (
                query.order_by(Job.created_at.desc(), Job.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )
            items = [
                {
                    "id": job.id,
                    "content_type": "jobs",
                    "title": job.title,
                    "summary": f"{job.company_name} · {job.location}",
                    "owner_id": employer.id,
                    "owner_name": employer.full_name,
                    "owner_email": employer.email,
                    "job_id": job.id,
                    "status": None,
                    "created_at": job.created_at,
                }
                for job, employer in rows
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

            total = query.count()
            rows = (
                query.order_by(Application.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )
            items = [
                {
                    "id": application.id,
                    "content_type": "applications",
                    "title": job.title,
                    "summary": f"{job.company_name} · Applicant: {applicant.full_name}",
                    "owner_id": applicant.id,
                    "owner_name": applicant.full_name,
                    "owner_email": applicant.email,
                    "job_id": job.id,
                    "status": application.status,
                    "created_at": None,
                }
                for application, job, applicant in rows
            ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }


def _delete_content(
    content_type: Literal["jobs", "applications"],
    record_ids: list[int],
    db: Session,
    request: Request,
    admin_user: User,
) -> int:
    if content_type == "jobs":
        jobs = db.query(Job).filter(Job.id.in_(record_ids)).all()
        if len(jobs) != len(record_ids):
            raise HTTPException(status_code=404, detail="One or more jobs not found")

        job_ids = [job.id for job in jobs]
        application_counts = dict(
            db.query(Application.job_id, func.count(Application.id))
            .filter(Application.job_id.in_(job_ids))
            .group_by(Application.job_id)
            .all()
        )
        db.query(Application).filter(
            Application.job_id.in_(job_ids)
        ).delete(synchronize_session=False)
        for job in jobs:
            record_audit_event(
                db,
                request,
                "admin.content.job_deleted",
                actor_user_id=admin_user.id,
                target_user_id=job.employer_id,
                target_type="job",
                target_id=job.id,
                details={
                    "title": job.title,
                    "company_name": job.company_name,
                    "deleted_applications": application_counts.get(job.id, 0),
                },
            )
            db.delete(job)
    else:
        applications = (
            db.query(Application, Job)
            .join(Job, Job.id == Application.job_id)
            .filter(Application.id.in_(record_ids))
            .all()
        )
        if len(applications) != len(record_ids):
            raise HTTPException(
                status_code=404,
                detail="One or more applications not found",
            )

        for application, job in applications:
            record_audit_event(
                db,
                request,
                "admin.content.application_deleted",
                actor_user_id=admin_user.id,
                target_user_id=application.job_seeker_id,
                target_type="application",
                target_id=application.id,
                details={
                    "job_id": job.id,
                    "job_title": job.title,
                    "status": application.status,
                },
            )
            db.delete(application)

    db.commit()
    return len(record_ids)


@router.delete("/content/{content_type}/{record_id}")
def delete_admin_content(
    content_type: Literal["jobs", "applications"],
    record_id: int,
    request: Request,
    admin_user: User = Depends(
        require_permission(Permission.MODERATE_CONTENT)
    ),
):
    with SessionLocal() as db:
        deleted_count = _delete_content(
            content_type,
            [record_id],
            db,
            request,
            admin_user,
        )
        return {
            "message": f"{content_type[:-1].capitalize()} deleted successfully",
            "deleted_count": deleted_count,
        }


@router.post("/content/bulk-delete")
def bulk_delete_admin_content(
    delete_request: AdminBulkContentDelete,
    request: Request,
    admin_user: User = Depends(
        require_permission(Permission.MODERATE_CONTENT)
    ),
):
    with SessionLocal() as db:
        deleted_count = _delete_content(
            delete_request.content_type,
            delete_request.record_ids,
            db,
            request,
            admin_user,
        )
        return {
            "message": f"{delete_request.content_type.capitalize()} deleted",
            "deleted_count": deleted_count,
        }
