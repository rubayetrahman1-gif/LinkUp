
from fastapi import APIRouter, Depends, HTTPException, status

from database import SessionLocal
from models import User, Job
from schemas import JobCreate, JobUpdate, JobResponse
from dependencies import  get_current_employer

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


# Create a job (Employer only)
@router.post(
    "",
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
@router.get("", response_model=list[JobResponse])
def get_all_jobs():
    with SessionLocal() as db:
        jobs = db.query(Job).order_by(Job.id.desc()).all()
        return jobs


# Get all jobs posted by the current employer
@router.get("/my-jobs", response_model=list[JobResponse])
def get_my_jobs(
    current_user: User = Depends(get_current_employer)
):
    with SessionLocal() as db:
        jobs = db.query(Job).filter(
            Job.employer_id == current_user.id
        ).order_by(Job.id.desc()).all()

        return jobs


# Get a single job by ID
@router.get("/{job_id}", response_model=JobResponse)
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
@router.put("/{job_id}", response_model=JobResponse)
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
@router.delete("/{job_id}")
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
