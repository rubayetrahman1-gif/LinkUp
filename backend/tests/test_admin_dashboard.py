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
    assert data["groups"] == {"available": False, "total": None}
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
