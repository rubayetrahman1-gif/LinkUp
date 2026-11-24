from datetime import datetime

from models import User


def register_user(client, email, role, full_name=None):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": full_name or email.split("@")[0].title(),
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


def make_admin(client, test_db):
    admin = register_user(client, "admin@example.com", "job_seeker")
    with test_db() as db:
        db.query(User).filter(User.id == admin["id"]).update({"role": "admin"})
        db.commit()
    return login_headers(client, "admin@example.com")


def test_admin_user_listing_search_filters_and_pagination(client, test_db):
    admin_headers = make_admin(client, test_db)
    alpha = register_user(
        client,
        "alpha@example.com",
        "job_seeker",
        full_name="Alpha Candidate",
    )
    register_user(
        client,
        "beta@example.com",
        "employer",
        full_name="Beta Employer",
    )
    inactive = register_user(
        client,
        "gamma@example.com",
        "job_seeker",
        full_name="Gamma Candidate",
    )
    with test_db() as db:
        db.query(User).filter(User.id == inactive["id"]).update(
            {"is_active": False}
        )
        db.commit()

    filtered = client.get(
        "/api/admin/users?search=alpha&role=job_seeker&status=active"
        "&page=1&page_size=1",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    filtered_data = filtered.json()
    assert filtered_data["total"] == 1
    assert filtered_data["items"][0]["id"] == alpha["id"]
    assert "password_hash" not in filtered_data["items"][0]

    first_page = client.get(
        "/api/admin/users?page=1&page_size=2",
        headers=admin_headers,
    ).json()
    second_page = client.get(
        "/api/admin/users?page=2&page_size=2",
        headers=admin_headers,
    ).json()
    assert first_page["total"] == 4
    assert first_page["pages"] == 2
    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 2
    assert {
        user["id"] for user in first_page["items"]
    }.isdisjoint({user["id"] for user in second_page["items"]})


def test_admin_user_details_include_safe_sessions_and_account_activity(
    client, test_db
):
    admin_headers = make_admin(client, test_db)
    employer = register_user(client, "employer@example.com", "employer")
    seeker = register_user(client, "seeker@example.com", "job_seeker")
    employer_headers = login_headers(client, "employer@example.com")
    seeker_headers = login_headers(client, "seeker@example.com")
    team_response = client.post(
        "/api/teams",
        headers=employer_headers,
        json={"name": "Design Hiring"},
    )
    assert team_response.status_code == 201

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

    employer_details = client.get(
        f"/api/admin/users/{employer['id']}",
        headers=admin_headers,
    )
    assert employer_details.status_code == 200
    employer_data = employer_details.json()
    assert employer_data["user"]["email"] == "employer@example.com"
    assert {item["type"] for item in employer_data["activity"]} == {
        "account_created",
        "job_posted",
    }
    assert employer_data["sessions"][0]["is_active"] is True
    assert "token_hash" not in str(employer_data)
    assert "password_hash" not in str(employer_data)
    assert employer_data["groups"] == {
        "available": True,
        "memberships": [
            {"id": team_response.json()["id"], "name": "Design Hiring", "role": "owner"}
        ],
    }

    teams_response = client.get("/api/admin/teams", headers=admin_headers)
    assert teams_response.status_code == 200
    assert teams_response.json()["items"][0]["members"][0]["role"] == "owner"

    seeker_details = client.get(
        f"/api/admin/users/{seeker['id']}",
        headers=admin_headers,
    )
    assert seeker_details.status_code == 200
    seeker_activity = seeker_details.json()["activity"]
    application_activity = next(
        item for item in seeker_activity
        if item["type"] == "application_submitted"
    )
    assert "Product Designer" in application_activity["description"]
    assert application_activity["occurred_at"] is None

    missing_user = client.get("/api/admin/users/9999", headers=admin_headers)
    assert missing_user.status_code == 404


def test_admin_user_management_endpoints_require_admin(client):
    seeker = register_user(client, "seeker@example.com", "job_seeker")
    seeker_headers = login_headers(client, "seeker@example.com")

    assert client.get("/api/admin/users").status_code == 401
    assert client.get(
        "/api/admin/users", headers=seeker_headers
    ).status_code == 403
    assert client.get(
        f"/api/admin/users/{seeker['id']}", headers=seeker_headers
    ).status_code == 403
    assert client.get("/api/admin/teams", headers=seeker_headers).status_code == 403


def test_user_list_validates_pagination_limits(client, test_db):
    admin_headers = make_admin(client, test_db)

    invalid_page = client.get(
        "/api/admin/users?page=0", headers=admin_headers
    )
    invalid_page_size = client.get(
        "/api/admin/users?page_size=101", headers=admin_headers
    )

    assert invalid_page.status_code == 422
    assert invalid_page_size.status_code == 422
