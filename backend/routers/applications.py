
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User, Job, Application
from rbac import Permission, require_permission
from schemas import ApplicationStatusUpdate


router = APIRouter(prefix="/api/jobs", tags=["Applications"])


# Apply for a job (Job Seeker only)
@router.post(
    "/{job_id}/applications",
    status_code=status.HTTP_201_CREATED
)
def apply_for_job(
    job_id: int,
    current_user: User = Depends(require_permission(Permission.APPLY_FOR_JOB))
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

        existing_application = db.query(Application).filter(
            Application.job_id == job_id,
            Application.job_seeker_id == current_user.id
        ).first()

        if existing_application is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already applied for this job"
            )

        new_application = Application(
            job_id=job_id,
            job_seeker_id=current_user.id,
            status="Pending"
        )

        try:
            db.add(new_application)
            db.commit()
            db.refresh(new_application)

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already applied for this job"
            )

        return {
            "message": "Application submitted successfully",
            "application_id": new_application.id,
            "job_id": new_application.job_id,
            "status": new_application.status
        }
# View current Job Seeker's applications
history_router = APIRouter(
    prefix="/api/applications",
    tags=["Applications"]
)


@history_router.get("/my")
def get_my_applications(
    current_user: User = Depends(
        require_permission(Permission.READ_OWN_APPLICATIONS)
    )
):
    with SessionLocal() as db:
        applications = db.query(
            Application,
            Job
        ).join(
            Job,
            Application.job_id == Job.id
        ).filter(
            Application.job_seeker_id == current_user.id
        ).all()

        return [
            {
                "application_id": application.id,
                "job_id": job.id,
                "job_title": job.title,
                "company_name": job.company_name,
                "status": application.status
            }
            for application, job in applications
        ]


@history_router.get("/employer")
def get_employer_applications(
    current_user: User = Depends(
        require_permission(Permission.MANAGE_OWN_APPLICATIONS)
    ),
):
    with SessionLocal() as db:
        applications = (
            db.query(Application, Job, User)
            .join(Job, Application.job_id == Job.id)
            .join(User, Application.job_seeker_id == User.id)
            .filter(Job.employer_id == current_user.id)
            .order_by(Application.id.desc())
            .all()
        )

        return [
            {
                "application_id": application.id,
                "job_id": job.id,
                "job_title": job.title,
                "company_name": job.company_name,
                "status": application.status,
                "applicant": {
                    "id": applicant.id,
                    "full_name": applicant.full_name,
                    "email": applicant.email,
                },
            }
            for application, job, applicant in applications
        ]


@history_router.patch("/{application_id}/status")
def update_application_status(
    application_id: int,
    status_data: ApplicationStatusUpdate,
    current_user: User = Depends(
        require_permission(Permission.MANAGE_OWN_APPLICATIONS)
    ),
):
    with SessionLocal() as db:
        application = (
            db.query(Application)
            .join(Job, Application.job_id == Job.id)
            .filter(
                Application.id == application_id,
                Job.employer_id == current_user.id,
            )
            .first()
        )

        if application is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        application.status = status_data.status
        db.commit()
        db.refresh(application)

        return {
            "application_id": application.id,
            "job_id": application.job_id,
            "status": application.status,
        }

