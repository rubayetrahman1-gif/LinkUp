from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased

from audit import record_audit_event
from database import SessionLocal
from dependencies import get_current_user
from models import Application, Job, Team, TeamMember, User
from schemas import (
    JobCreate,
    JobResponse,
    JobUpdate,
    ApplicationStatusUpdate,
    TeamApplicationAssignment,
    TeamApplicationReview,
    TeamCreate,
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamUpdate,
)


router = APIRouter(prefix="/api/teams", tags=["Employer Teams"])
MANAGERS = {"owner", "recruiter"}


def get_team_employer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Employers can access Employer Teams",
        )
    return current_user


def _get_team_membership(
    db,
    team_id: int,
    user_id: int,
) -> tuple[Team, TeamMember]:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.deleted_at.is_(None))
        .first()
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this Team",
        )
    return team, membership


def _require_role(membership: TeamMember, allowed_roles: set[str]) -> None:
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Your Team role does not allow this action",
        )


def _team_counts(db, team_id: int) -> tuple[int, int, int]:
    member_count = (
        db.query(func.count(TeamMember.id))
        .filter(TeamMember.team_id == team_id)
        .scalar()
        or 0
    )
    job_count = (
        db.query(func.count(Job.id))
        .filter(Job.team_id == team_id)
        .scalar()
        or 0
    )
    application_count = (
        db.query(func.count(Application.id))
        .join(Job, Job.id == Application.job_id)
        .filter(Job.team_id == team_id)
        .scalar()
        or 0
    )
    return member_count, job_count, application_count


def _team_summary(db, team: Team, role: str) -> dict[str, object]:
    member_count, job_count, application_count = _team_counts(db, team.id)
    return {
        "id": team.id,
        "name": team.name,
        "owner_id": team.owner_id,
        "my_role": role,
        "member_count": member_count,
        "job_count": job_count,
        "application_count": application_count,
        "created_at": team.created_at,
    }


def _application_response(
    application: Application,
    job: Job,
    applicant: User,
    reviewer: User | None,
    reviewer_author: User | None,
) -> dict[str, object]:
    return {
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
        "assigned_reviewer_id": application.assigned_reviewer_id,
        "assigned_reviewer_name": reviewer.full_name if reviewer else None,
        "review_recommendation": application.review_recommendation,
        "reviewed_by_name": reviewer_author.full_name if reviewer_author else None,
        "reviewed_at": application.reviewed_at,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_team(
    team_data: TeamCreate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team = Team(name=team_data.name, owner_id=current_user.id)
        db.add(team)
        db.flush()
        db.add(
            TeamMember(
                team_id=team.id,
                user_id=current_user.id,
                role="owner",
            )
        )
        record_audit_event(
            db,
            request,
            "team.created",
            actor_user_id=current_user.id,
            target_type="team",
            target_id=team.id,
            details={"name": team.name},
        )
        db.commit()
        db.refresh(team)
        return _team_summary(db, team, "owner")


@router.get("")
def list_my_teams(current_user: User = Depends(get_team_employer)):
    with SessionLocal() as db:
        memberships = (
            db.query(Team, TeamMember.role)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .filter(
                TeamMember.user_id == current_user.id,
                Team.deleted_at.is_(None),
            )
            .order_by(Team.created_at.desc(), Team.id.desc())
            .all()
        )
        return [
            _team_summary(db, team, role)
            for team, role in memberships
        ]


@router.get("/{team_id}")
def get_team(
    team_id: int,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        members = (
            db.query(TeamMember, User)
            .join(User, User.id == TeamMember.user_id)
            .filter(TeamMember.team_id == team_id)
            .order_by(TeamMember.joined_at, TeamMember.id)
            .all()
        )
        result = _team_summary(db, team, membership.role)
        result["members"] = [
            {
                "user_id": member.user_id,
                "full_name": user.full_name,
                "email": user.email,
                "role": member.role,
                "joined_at": member.joined_at,
            }
            for member, user in members
        ]
        return result


@router.patch("/{team_id}")
def rename_team(
    team_id: int,
    team_data: TeamUpdate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        team.name = team_data.name
        db.query(Job).filter(Job.team_id == team_id).update(
            {Job.company_name: team.name},
            synchronize_session=False,
        )
        record_audit_event(
            db,
            request,
            "team.renamed",
            actor_user_id=current_user.id,
            target_type="team",
            target_id=team.id,
            details={"name": team.name},
        )
        db.commit()
        return {"id": team.id, "name": team.name}


@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        team.deleted_at = datetime.now(timezone.utc)
        record_audit_event(
            db,
            request,
            "team.deleted",
            actor_user_id=current_user.id,
            target_type="team",
            target_id=team.id,
            details={"name": team.name},
        )
        db.commit()
        return {
            "message": "Team archived successfully; its jobs and applications were preserved",
            "team_id": team.id,
        }


@router.post("/{team_id}/members", status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: int,
    member_data: TeamMemberCreate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        user = (
            db.query(User)
            .filter(func.lower(User.email) == str(member_data.email).lower())
            .first()
        )
        if user is None:
            raise HTTPException(status_code=404, detail="Employer account not found")
        if user.role != "employer":
            raise HTTPException(
                status_code=403,
                detail="Only Employer accounts can join a Team",
            )
        if not user.is_active or user.is_banned:
            raise HTTPException(
                status_code=409,
                detail="Inactive or banned accounts cannot join a Team",
            )

        member = TeamMember(
            team_id=team.id,
            user_id=user.id,
            role=member_data.role,
        )
        db.add(member)
        record_audit_event(
            db,
            request,
            "team.member.added",
            actor_user_id=current_user.id,
            target_user_id=user.id,
            target_type="team",
            target_id=team.id,
            details={"role": member_data.role},
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="User is already a Team member",
            )
        db.refresh(member)
        return {
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": member.role,
            "joined_at": member.joined_at,
        }


def _clear_reviewer_assignments(db, team_id: int, reviewer_id: int) -> None:
    job_ids = [
        job_id
        for (job_id,) in db.query(Job.id).filter(Job.team_id == team_id).all()
    ]
    if job_ids:
        db.query(Application).filter(
            Application.job_id.in_(job_ids),
            Application.assigned_reviewer_id == reviewer_id,
        ).update(
            {Application.assigned_reviewer_id: None},
            synchronize_session=False,
        )


@router.patch("/{team_id}/members/{user_id}")
def update_team_member(
    team_id: int,
    user_id: int,
    member_data: TeamMemberUpdate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        target = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
            .first()
        )
        if target is None:
            raise HTTPException(status_code=404, detail="Team member not found")
        if target.role == "owner":
            raise HTTPException(
                status_code=403,
                detail="The Team Owner role cannot be changed",
            )
        if target.role == "reviewer" and member_data.role != "reviewer":
            _clear_reviewer_assignments(db, team_id, user_id)
        target.role = member_data.role
        record_audit_event(
            db,
            request,
            "team.member.role_changed",
            actor_user_id=current_user.id,
            target_user_id=user_id,
            target_type="team",
            target_id=team.id,
            details={"role": member_data.role},
        )
        db.commit()
        return {"user_id": user_id, "role": target.role}


@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(
    team_id: int,
    user_id: int,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        target = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
            .first()
        )
        if target is None:
            raise HTTPException(status_code=404, detail="Team member not found")
        if target.role == "owner":
            raise HTTPException(
                status_code=403,
                detail="The Team Owner cannot be removed",
            )
        _clear_reviewer_assignments(db, team_id, user_id)
        db.delete(target)
        record_audit_event(
            db,
            request,
            "team.member.removed",
            actor_user_id=current_user.id,
            target_user_id=user_id,
            target_type="team",
            target_id=team.id,
        )
        db.commit()
        return {"message": "Team member removed successfully"}


@router.get("/{team_id}/jobs", response_model=list[JobResponse])
def list_team_jobs(
    team_id: int,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        _get_team_membership(db, team_id, current_user.id)
        return (
            db.query(Job)
            .filter(Job.team_id == team_id)
            .order_by(Job.created_at.desc(), Job.id.desc())
            .all()
        )


@router.post(
    "/{team_id}/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_team_job(
    team_id: int,
    job_data: JobCreate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, MANAGERS)
        job = Job(
            title=job_data.title,
            company_name=team.name,
            location=job_data.location,
            description=job_data.description,
            employment_type=job_data.employment_type,
            salary=job_data.salary,
            employer_id=current_user.id,
            team_id=team_id,
        )
        db.add(job)
        db.flush()
        record_audit_event(
            db,
            request,
            "team.job.created",
            actor_user_id=current_user.id,
            target_type="job",
            target_id=job.id,
            details={"team_id": team_id, "title": job.title},
        )
        db.commit()
        db.refresh(job)
        return job


@router.put(
    "/{team_id}/jobs/{job_id}",
    response_model=JobResponse,
)
def update_team_job(
    team_id: int,
    job_id: int,
    job_data: JobUpdate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        team, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, MANAGERS)
        job = (
            db.query(Job)
            .filter(Job.id == job_id, Job.team_id == team_id)
            .first()
        )
        if job is None:
            raise HTTPException(status_code=404, detail="Team job not found")
        updates = job_data.model_dump(exclude_unset=True)
        updates.pop("company_name", None)
        if not updates or any(
            value is None and field != "salary"
            for field, value in updates.items()
        ):
            raise HTTPException(
                status_code=422,
                detail="Provide at least one editable job field",
            )
        for field, value in updates.items():
            setattr(job, field, value)
        job.company_name = team.name
        record_audit_event(
            db,
            request,
            "team.job.updated",
            actor_user_id=current_user.id,
            target_type="job",
            target_id=job.id,
            details={"team_id": team_id},
        )
        db.commit()
        db.refresh(job)
        return job


@router.delete("/{team_id}/jobs/{job_id}")
def delete_team_job(
    team_id: int,
    job_id: int,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        _, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"owner"})
        job = (
            db.query(Job)
            .filter(Job.id == job_id, Job.team_id == team_id)
            .first()
        )
        if job is None:
            raise HTTPException(status_code=404, detail="Team job not found")
        if db.query(Application.id).filter(
            Application.job_id == job.id
        ).first():
            raise HTTPException(
                status_code=409,
                detail="Team jobs with applications cannot be deleted; archive the Team to preserve its history",
            )
        record_audit_event(
            db,
            request,
            "team.job.deleted",
            actor_user_id=current_user.id,
            target_type="job",
            target_id=job.id,
            details={"team_id": team_id, "title": job.title},
        )
        db.delete(job)
        db.commit()
        return {"message": "Team job deleted successfully"}


@router.get("/{team_id}/applications")
def list_team_applications(
    team_id: int,
    current_user: User = Depends(get_team_employer),
):
    reviewer_user = aliased(User)
    review_author = aliased(User)
    with SessionLocal() as db:
        _, membership = _get_team_membership(db, team_id, current_user.id)
        query = (
            db.query(Application, Job, User, reviewer_user, review_author)
            .join(Job, Job.id == Application.job_id)
            .join(User, User.id == Application.job_seeker_id)
            .outerjoin(
                reviewer_user,
                reviewer_user.id == Application.assigned_reviewer_id,
            )
            .outerjoin(review_author, review_author.id == Application.reviewed_by_id)
            .filter(Job.team_id == team_id)
        )
        if membership.role == "reviewer":
            query = query.filter(
                Application.assigned_reviewer_id == current_user.id
            )
        rows = query.order_by(Application.id.desc()).all()
        return [
            _application_response(
                application,
                job,
                applicant,
                reviewer,
                review_author_user,
            )
            for application, job, applicant, reviewer, review_author_user in rows
        ]


@router.patch("/{team_id}/applications/{application_id}/assignment")
def assign_team_application(
    team_id: int,
    application_id: int,
    assignment: TeamApplicationAssignment,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        _, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, MANAGERS)
        application = (
            db.query(Application)
            .join(Job, Job.id == Application.job_id)
            .filter(
                Application.id == application_id,
                Job.team_id == team_id,
            )
            .first()
        )
        if application is None:
            raise HTTPException(status_code=404, detail="Team application not found")

        if assignment.reviewer_id is not None:
            reviewer = (
                db.query(TeamMember, User)
                .join(User, User.id == TeamMember.user_id)
                .filter(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == assignment.reviewer_id,
                )
                .first()
            )
            if reviewer is None or reviewer[0].role != "reviewer":
                raise HTTPException(
                    status_code=422,
                    detail="Applications can only be assigned to Team Reviewers",
                )
            if not reviewer[1].is_active or reviewer[1].is_banned:
                raise HTTPException(
                    status_code=409,
                    detail="Inactive or banned accounts cannot review applications",
                )

        application.assigned_reviewer_id = assignment.reviewer_id
        application.review_recommendation = None
        application.reviewed_by_id = None
        application.reviewed_at = None
        record_audit_event(
            db,
            request,
            "team.application.assigned",
            actor_user_id=current_user.id,
            target_user_id=assignment.reviewer_id,
            target_type="application",
            target_id=application.id,
            details={"team_id": team_id},
        )
        db.commit()
        return {
            "application_id": application.id,
            "assigned_reviewer_id": application.assigned_reviewer_id,
        }


@router.patch("/{team_id}/applications/{application_id}/review")
def review_team_application(
    team_id: int,
    application_id: int,
    review: TeamApplicationReview,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        _, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, {"reviewer"})
        application = (
            db.query(Application)
            .join(Job, Job.id == Application.job_id)
            .filter(
                Application.id == application_id,
                Job.team_id == team_id,
            )
            .first()
        )
        if application is None:
            raise HTTPException(status_code=404, detail="Team application not found")

        if application.assigned_reviewer_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Reviewers can only review applications assigned to them",
            )

        application.review_recommendation = review.recommendation
        application.reviewed_by_id = current_user.id
        application.reviewed_at = datetime.now(timezone.utc)
        record_audit_event(
            db,
            request,
            "team.application.reviewed",
            actor_user_id=current_user.id,
            target_type="application",
            target_id=application.id,
            details={
                "team_id": team_id,
                "recommendation": review.recommendation,
            },
        )
        db.commit()
        return {
            "application_id": application.id,
            "job_id": application.job_id,
            "status": application.status,
            "review_recommendation": application.review_recommendation,
            "reviewed_by_id": application.reviewed_by_id,
            "reviewed_at": application.reviewed_at,
        }


@router.patch("/{team_id}/applications/{application_id}/status")
def update_team_application_status(
    team_id: int,
    application_id: int,
    status_update: ApplicationStatusUpdate,
    request: Request,
    current_user: User = Depends(get_team_employer),
):
    with SessionLocal() as db:
        _, membership = _get_team_membership(db, team_id, current_user.id)
        _require_role(membership, MANAGERS)
        application = (
            db.query(Application)
            .join(Job, Job.id == Application.job_id)
            .filter(
                Application.id == application_id,
                Job.team_id == team_id,
            )
            .first()
        )
        if application is None:
            raise HTTPException(status_code=404, detail="Team application not found")
        application.status = status_update.status
        record_audit_event(
            db,
            request,
            "team.application.status_changed",
            actor_user_id=current_user.id,
            target_type="application",
            target_id=application.id,
            details={"team_id": team_id, "status": status_update.status},
        )
        db.commit()
        return {
            "application_id": application.id,
            "job_id": application.job_id,
            "status": application.status,
        }
