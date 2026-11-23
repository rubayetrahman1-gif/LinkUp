from datetime import datetime, timedelta, timezone

import jwt

from models import User
from security import ALGORITHM, SECRET_KEY


def register_user(client, email, role):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": email.split("@")[0].title(),
            "email": email,
            "password": "TestPassword123!",
            "role": role,
        },
    )
    assert response.status_code == 201
    return response.json()


def login_headers(client, email):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "TestPassword123!"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_job(client, headers, title="Backend Engineer"):
    response = client.post(
        "/api/jobs",
        headers=headers,
        json={
            "title": title,
            "company_name": "LinkUp",
            "location": "Remote",
            "description": "Build reliable services for our product.",
            "employment_type": "full_time",
            "salary": "$100,000",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_protected_endpoints_reject_missing_invalid_tampered_and_expired_tokens(client):
    register_user(client, "employer@example.com", "employer")
    valid_headers = login_headers(client, "employer@example.com")
    valid_token = valid_headers["Authorization"].split(" ", 1)[1]
    expired_token = jwt.encode(
        {
            "sub": "1",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    responses = [
        client.get("/api/jobs/my-jobs"),
        client.get("/api/jobs/my-jobs", headers={"Authorization": "Bearer invalid"}),
        client.get(
            "/api/jobs/my-jobs",
            headers={"Authorization": f"Bearer {valid_token}tampered"},
        ),
        client.get(
            "/api/jobs/my-jobs",
            headers={"Authorization": f"Bearer {expired_token}"},
        ),
    ]

    assert [response.status_code for response in responses] == [401, 401, 401, 401]


def test_inactive_user_cannot_access_protected_endpoints(client, test_db):
    user = register_user(client, "inactive@example.com", "employer")
    headers = login_headers(client, "inactive@example.com")
    with test_db() as db:
        db.query(User).filter(User.id == user["id"]).update({"is_active": False})
        db.commit()

    response = client.get("/api/jobs/my-jobs", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Account is inactive"


def test_admin_can_access_admin_permissions_but_not_employer_resources(
    client, test_db
):
    user = register_user(client, "admin@example.com", "job_seeker")
    with test_db() as db:
        db.query(User).filter(User.id == user["id"]).update({"role": "admin"})
        db.commit()
    admin = login_headers(client, "admin@example.com")

    assert client.get("/api/users", headers=admin).status_code == 200
    assert client.get("/api/jobs/my-jobs", headers=admin).status_code == 403


def test_role_permissions_and_job_ownership(client):
    register_user(client, "employer-one@example.com", "employer")
    register_user(client, "employer-two@example.com", "employer")
    register_user(client, "seeker@example.com", "job_seeker")
    employer_one = login_headers(client, "employer-one@example.com")
    employer_two = login_headers(client, "employer-two@example.com")
    seeker = login_headers(client, "seeker@example.com")
    job = create_job(client, employer_one)

    assert client.get("/api/jobs/my-jobs", headers=seeker).status_code == 403
    assert client.post("/api/jobs", headers=seeker, json={}).status_code == 403
    assert client.get("/api/users", headers=employer_one).status_code == 403
    assert client.put(
        f"/api/jobs/{job['id']}",
        headers=employer_two,
        json={"title": "Changed title"},
    ).status_code == 403
    assert client.delete(
        f"/api/jobs/{job['id']}", headers=employer_two
    ).status_code == 403

    own_jobs = client.get("/api/jobs/my-jobs", headers=employer_one)
    assert own_jobs.status_code == 200
    assert [item["id"] for item in own_jobs.json()] == [job["id"]]


def test_employer_can_view_and_update_only_applications_for_own_jobs(client):
    register_user(client, "employer-one@example.com", "employer")
    register_user(client, "employer-two@example.com", "employer")
    applicant = register_user(client, "applicant@example.com", "job_seeker")
    employer_one = login_headers(client, "employer-one@example.com")
    employer_two = login_headers(client, "employer-two@example.com")
    seeker = login_headers(client, "applicant@example.com")
    first_job = create_job(client, employer_one, "First role")
    second_job = create_job(client, employer_two, "Second role")

    first_application = client.post(
        f"/api/jobs/{first_job['id']}/applications", headers=seeker
    )
    second_application = client.post(
        f"/api/jobs/{second_job['id']}/applications", headers=seeker
    )
    assert first_application.status_code == 201
    assert second_application.status_code == 201

    employer_applications = client.get(
        "/api/applications/employer", headers=employer_one
    )
    assert employer_applications.status_code == 200
    applications = employer_applications.json()
    assert len(applications) == 1
    assert applications[0]["application_id"] == first_application.json()["application_id"]
    assert applications[0]["applicant"] == {
        "id": applicant["id"],
        "full_name": "Applicant",
        "email": "applicant@example.com",
    }

    update_response = client.patch(
        f"/api/applications/{first_application.json()['application_id']}/status",
        headers=employer_one,
        json={"status": "Under Review"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "Under Review"
    refreshed_applications = client.get(
        "/api/applications/employer", headers=employer_one
    )
    assert refreshed_applications.json()[0]["status"] == "Under Review"

    cross_employer_update = client.patch(
        f"/api/applications/{second_application.json()['application_id']}/status",
        headers=employer_one,
        json={"status": "Accepted"},
    )
    assert cross_employer_update.status_code == 404

    invalid_status = client.patch(
        f"/api/applications/{first_application.json()['application_id']}/status",
        headers=employer_one,
        json={"status": "Hired"},
    )
    assert invalid_status.status_code == 422

    assert client.get("/api/applications/employer", headers=seeker).status_code == 403
    assert client.patch(
        f"/api/applications/{first_application.json()['application_id']}/status",
        headers=seeker,
        json={"status": "Accepted"},
    ).status_code == 403

    seeker_history = client.get("/api/applications/my", headers=seeker)
    assert seeker_history.status_code == 200
    assert {item["job_id"] for item in seeker_history.json()} == {
        first_job["id"],
        second_job["id"],
    }


def test_job_seekers_only_see_their_own_application_history(client):
    register_user(client, "employer@example.com", "employer")
    register_user(client, "seeker-one@example.com", "job_seeker")
    register_user(client, "seeker-two@example.com", "job_seeker")
    employer = login_headers(client, "employer@example.com")
    seeker_one = login_headers(client, "seeker-one@example.com")
    seeker_two = login_headers(client, "seeker-two@example.com")
    job = create_job(client, employer)

    application = client.post(
        f"/api/jobs/{job['id']}/applications", headers=seeker_one
    )
    assert application.status_code == 201

    own_history = client.get("/api/applications/my", headers=seeker_one)
    other_history = client.get("/api/applications/my", headers=seeker_two)

    assert len(own_history.json()) == 1
    assert other_history.json() == []
