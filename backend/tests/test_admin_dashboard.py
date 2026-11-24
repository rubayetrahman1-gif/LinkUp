from datetime import datetime, timedelta, timezone

from models import User


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


def test_admin_dashboard_overview_requires_admin(client):
    register_user(client, "seeker@example.com", "job_seeker")
    seeker_headers = login_headers(client, "seeker@example.com")

    assert client.get("/api/admin/dashboard/overview").status_code == 401
    assert client.get(
        "/api/admin/dashboard/overview", headers=seeker_headers
    ).status_code == 403


def test_admin_dashboard_overview_returns_platform_statistics(
    client, test_db
):
    admin = register_user(client, "admin@example.com", "job_seeker")
    old_seeker = register_user(client, "old-seeker@example.com", "job_seeker")
    employer = register_user(client, "employer@example.com", "employer")
    employer_headers = login_headers(client, "employer@example.com")
    seeker_headers = login_headers(client, "old-seeker@example.com")

    job_response = client.post(
        "/api/jobs",
        headers=employer_headers,
        json={
            "title": "Product Designer",
            "company_name": "LinkUp",
            "location": "Remote",
            "description": "Design helpful experiences for job seekers.",
            "employment_type": "full_time",
            "salary": None,
        },
    )
    assert job_response.status_code == 201
    application_response = client.post(
        f"/api/jobs/{job_response.json()['id']}/applications",
        headers=seeker_headers,
    )
    assert application_response.status_code == 201

    with test_db() as db:
        db.query(User).filter(User.id == admin["id"]).update({"role": "admin"})
        db.query(User).filter(User.id == old_seeker["id"]).update(
            {
                "is_active": False,
                "created_at": datetime.now(timezone.utc) - timedelta(days=8),
            }
        )
        db.commit()
    admin_headers = login_headers(client, "admin@example.com")

    response = client.get(
        "/api/admin/dashboard/overview", headers=admin_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["users"] == {
        "total": 3,
        "by_role": {"job_seeker": 1, "employer": 1, "admin": 1},
        "active": 2,
        "inactive": 1,
        "banned": 0,
    }
    assert data["content"] == {
        "jobs": 1,
        "applications": 1,
        "applications_by_status": {"Pending": 1},
    }
    assert data["groups"] == {"available": True, "total": 0}
    assert data["last_7_days"] == {"new_users": 2, "job_posts": 1}
    assert {item["type"] for item in data["recent_activity"]} == {
        "user_registered",
        "job_posted",
        "audit_event",
    }
    registration = next(
        item
        for item in data["recent_activity"]
        if item["type"] == "user_registered" and item["actor"] == "Admin"
    )
    job_activity = next(
        item
        for item in data["recent_activity"]
        if item["type"] == "job_posted"
    )
    assert registration["action"] == "registered"
    assert registration["target"] == "account"
    assert job_activity["actor"] == "Employer"
    assert job_activity["action"] == "posted"
    assert job_activity["target"] == "Product Designer at LinkUp"
    assert all(
        datetime.fromisoformat(item["occurred_at"])
        for item in data["recent_activity"]
    )
    assert "password_hash" not in str(data)
    assert "password" not in str(data)
    assert employer["id"] != old_seeker["id"]


def test_admin_group_management_overview_includes_group_details(
    client, test_db
):
    admin = register_user(client, "admin@example.com", "job_seeker")
    owner = register_user(client, "owner@example.com", "employer")
    reviewer = register_user(client, "reviewer@example.com", "employer")
    applicant = register_user(client, "applicant@example.com", "job_seeker")
    owner_headers = login_headers(client, "owner@example.com")
    applicant_headers = login_headers(client, "applicant@example.com")
    with test_db() as db:
        db.query(User).filter(User.id == admin["id"]).update({"role": "admin"})
        db.commit()
    admin_headers = login_headers(client, "admin@example.com")

    team_response = client.post(
        "/api/teams",
        headers=owner_headers,
        json={"name": "Design Hiring"},
    )
    assert team_response.status_code == 201
    team_id = team_response.json()["id"]
    reviewer_response = client.post(
        f"/api/teams/{team_id}/members",
        headers=owner_headers,
        json={"email": "reviewer@example.com", "role": "reviewer"},
    )
    assert reviewer_response.status_code == 201

    job_response = client.post(
        f"/api/teams/{team_id}/jobs",
        headers=owner_headers,
        json={
            "title": "Product Designer",
            "company_name": "Ignored input",
            "location": "Remote",
            "description": "Design helpful experiences for job seekers.",
            "employment_type": "full_time",
        },
    )
    assert job_response.status_code == 201
    application_response = client.post(
        f"/api/jobs/{job_response.json()['id']}/applications",
        headers=applicant_headers,
    )
    assert application_response.status_code == 201

    response = client.get(
        "/api/admin/teams",
        headers=admin_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == {
        "groups_total": 1,
        "active_groups": 1,
        "archived_groups": 0,
        "members_total": 2,
        "team_jobs_total": 1,
        "team_applications_total": 1,
    }
    assert data["total"] == 1
    team = data["items"][0]
    assert team["name"] == "Design Hiring"
    assert team["owner"]["email"] == "owner@example.com"
    assert team["is_archived"] is False
    assert team["job_count"] == 1
    assert team["application_count"] == 1
    assert {member["role"] for member in team["members"]} == {
        "owner",
        "reviewer",
    }

    assert client.get(
        "/api/admin/teams",
        headers=applicant_headers,
    ).status_code == 403

    archived = client.delete(
        f"/api/teams/{team_id}",
        headers=owner_headers,
    )
    assert archived.status_code == 200
    archived_response = client.get(
        "/api/admin/teams",
        headers=admin_headers,
    )
    assert archived_response.status_code == 200
    archived_data = archived_response.json()
    assert archived_data["summary"]["active_groups"] == 0
    assert archived_data["summary"]["archived_groups"] == 1
    assert archived_data["items"][0]["is_archived"] is True
    assert archived_data["items"][0]["application_count"] == 1
