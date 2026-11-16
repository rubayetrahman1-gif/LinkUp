
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import User, Job, Application
from dependencies import get_current_job_seeker


router = APIRouter(prefix="/api/jobs", tags=["Applications"])


# Apply for a job (Job Seeker only)
@router.post(
    "/{job_id}/applications",
    status_code=status.HTTP_201_CREATED
)
def apply_for_job(
    job_id: int,
    current_user: User = Depends(get_current_job_seeker)
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

