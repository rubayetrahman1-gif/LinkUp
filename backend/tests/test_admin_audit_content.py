from models import Application, AuditLog, Job, User


PASSWORD = "TestPassword123!"


def register_user(client, email, role="job_seeker", full_name=None):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": full_name or email.split("@")[0].title(),
            "email": email,
            "password": PASSWORD,
            "role": role,
        },
    )
    assert response.status_code == 201
    return response.json()


def login(client, email, password=PASSWORD):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


def make_admin(client, test_db):
    admin = register_user(client, "admin@example.com")
    with test_db() as db:
        db.query(User).filter(User.id == admin["id"]).update({"role": "admin"})
        db.commit()
    response = login(client, "admin@example.com")
    assert response.status_code == 200
    return admin["id"], {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def create_job(client, employer_headers, title="Designer"):
    response = client.post(
        "/api/jobs",
        headers=employer_headers,
        json={
            "title": title,
            "company_name": "LinkUp",
            "location": "Remote",
            "description": "Build useful products for people.",
            "employment_type": "full_time",
            "salary": None,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_authentication_audit_and_security_groups(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)
    target = register_user(client, "target@example.com")

    failed_one = client.post(
        "/api/auth/login",
        headers={"user-agent": "audit-test-browser"},
        json={"email": target["email"], "password": "WrongPassword123!"},
    )
    failed_two = client.post(
        "/api/auth/login",
        headers={"user-agent": "audit-test-browser"},
        json={"email": target["email"], "password": "WrongPassword123!"},
    )
    unknown_account = login(client, "unknown@example.com", "WrongPassword123!")
    assert failed_one.status_code == 401
    assert failed_two.status_code == 401
    assert unknown_account.status_code == 401

    audit_response = client.get(
        "/api/admin/audit-logs?action=auth.login.failed",
        headers=admin_headers,
    )
    assert audit_response.status_code == 200
    events = audit_response.json()["items"]
    assert len(events) == 3
    known_failure = next(item for item in events if item["target_user_id"] == target["id"])
    assert known_failure["target_id"] == target["email"]
    assert known_failure["ip_address"] == "testclient"
    assert known_failure["user_agent"] == "audit-test-browser"
    assert known_failure["details"] == {"reason": "invalid_credentials"}

    security_response = client.get(
        "/api/admin/security/overview?since_hours=24",
        headers=admin_headers,
    )
    assert security_response.status_code == 200
    security = security_response.json()
    assert security["failed_login_total"] == 3
    assert security["by_ip"][0] == {
        "ip_address": "testclient",
        "attempt_count": 3,
    }
    account_failure = next(
        item for item in security["by_account"]
        if item["account"] == target["email"]
    )
    assert account_failure["attempt_count"] == 2
    target_headers = {
        "Authorization": f"Bearer {login(client, target['email']).json()['access_token']}"
    }
    assert client.get(
        "/api/admin/audit-logs",
        headers=target_headers,
    ).status_code == 403
    assert client.get(
        "/api/admin/security/overview",
        headers=target_headers,
    ).status_code == 403
    assert any(
        item["action"] == "auth.login.succeeded"
        and item["actor_user_id"] == admin_id
        for item in client.get(
            "/api/admin/audit-logs?action=auth.login.succeeded",
            headers=admin_headers,
        ).json()["items"]
    )


def test_logout_and_password_change_are_audited(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)
    user = register_user(client, "user@example.com")
    login_response = login(client, user["email"])
    access_token = login_response.json()["access_token"]
    refresh_token = login_response.cookies.get("refresh_token")
    assert refresh_token

    logout_response = client.post(
        "/api/auth/logout",
        cookies={"refresh_token": refresh_token},
    )
    assert logout_response.status_code == 200

    next_login = login(client, user["email"])
    password_change = client.post(
        "/api/users/me/change-password",
        headers={"Authorization": f"Bearer {next_login.json()['access_token']}"},
        json={
            "current_password": PASSWORD,
            "new_password": "NewTestPassword456!",
        },
    )
    assert password_change.status_code == 200

    logs = client.get(
        "/api/admin/audit-logs?target_user_id=" + str(user["id"]),
        headers=admin_headers,
    ).json()["items"]
    actions = {item["action"] for item in logs}
    assert "auth.logout" in actions
    assert "auth.password_change.succeeded" in actions
    assert all("password" not in str(item["details"]).lower() for item in logs)
    assert access_token


def test_admin_content_listing_deletion_and_audit(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)
    employer = register_user(client, "employer@example.com", "employer")
    applicant = register_user(
        client,
        "applicant@example.com",
        full_name="Applicant Candidate",
    )
    employer_login = login(client, employer["email"])
    applicant_login = login(client, applicant["email"])
    employer_headers = {
        "Authorization": f"Bearer {employer_login.json()['access_token']}"
    }
    applicant_headers = {
        "Authorization": f"Bearer {applicant_login.json()['access_token']}"
    }
    job = create_job(client, employer_headers, "Moderated Designer Role")
    application_response = client.post(
        f"/api/jobs/{job['id']}/applications",
        headers=applicant_headers,
    )
    assert application_response.status_code == 201
    application_id = application_response.json()["application_id"]

    assert client.get("/api/admin/content").status_code == 401
    assert client.get("/api/admin/content", headers=applicant_headers).status_code == 403

    jobs = client.get(
        "/api/admin/content?content_type=jobs&search=Moderated",
        headers=admin_headers,
    )
    applications = client.get(
        "/api/admin/content?content_type=applications&application_status=Pending",
        headers=admin_headers,
    )
    assert jobs.status_code == applications.status_code == 200
    assert jobs.json()["items"][0]["id"] == job["id"]
    assert applications.json()["items"][0]["id"] == application_id
    assert applications.json()["items"][0]["owner_email"] == applicant["email"]

    removed = client.delete(
        f"/api/admin/content/jobs/{job['id']}",
        headers=admin_headers,
    )
    assert removed.status_code == 200
    assert removed.json()["deleted_count"] == 1
    with test_db() as db:
        assert db.query(Job).filter(Job.id == job["id"]).first() is None
        assert db.query(Application).filter(
            Application.id == application_id
        ).first() is None
        event = (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "admin.content.job_deleted",
                AuditLog.target_id == str(job["id"]),
            )
            .one()
        )
        assert event.actor_user_id == admin_id
        assert event.details["deleted_applications"] == 1


def test_bulk_application_moderation_is_validated_and_atomic(client, test_db):
    _, admin_headers = make_admin(client, test_db)
    employer = register_user(client, "bulk-employer@example.com", "employer")
    seeker = register_user(client, "bulk-seeker@example.com")
    employer_token = login(client, employer["email"]).json()["access_token"]
    seeker_token = login(client, seeker["email"]).json()["access_token"]
    employer_headers = {"Authorization": f"Bearer {employer_token}"}
    seeker_headers = {"Authorization": f"Bearer {seeker_token}"}
    first_job = create_job(client, employer_headers, "First Job")
    second_job = create_job(client, employer_headers, "Second Job")
    first_application = client.post(
        f"/api/jobs/{first_job['id']}/applications",
        headers=seeker_headers,
    ).json()["application_id"]
    second_application = client.post(
        f"/api/jobs/{second_job['id']}/applications",
        headers=seeker_headers,
    ).json()["application_id"]

    missing_record = client.post(
        "/api/admin/content/bulk-delete",
        headers=admin_headers,
        json={
            "content_type": "applications",
            "record_ids": [first_application, 9999],
        },
    )
    assert missing_record.status_code == 404
    with test_db() as db:
        assert db.query(Application).filter(
            Application.id.in_([first_application, second_application])
        ).count() == 2

    bulk_delete = client.post(
        "/api/admin/content/bulk-delete",
        headers=admin_headers,
        json={
            "content_type": "applications",
            "record_ids": [first_application, second_application],
        },
    )
    assert bulk_delete.status_code == 200
    assert bulk_delete.json()["deleted_count"] == 2


def test_csv_exports_apply_filters_and_exclude_credentials(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)
    employer = register_user(
        client,
        "formula@example.com",
        "employer",
        "=Candidate",
    )
    applicant = register_user(client, "seeker@example.com")
    employer_token = login(client, employer["email"]).json()["access_token"]
    applicant_token = login(client, applicant["email"]).json()["access_token"]
    job = create_job(
        client,
        {"Authorization": f"Bearer {employer_token}"},
        "Exported designer role",
    )
    application = client.post(
        f"/api/jobs/{job['id']}/applications",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert application.status_code == 201

    user_export = client.get(
        "/api/admin/exports/users.csv?role=employer",
        headers=admin_headers,
    )
    assert user_export.status_code == 200
    assert user_export.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=\"linkup-users.csv\"" in user_export.headers[
        "content-disposition"
    ]
    assert "'=Candidate" in user_export.text
    assert "password_hash" not in user_export.text
    assert "refresh_token" not in user_export.text

    content_export = client.get(
        "/api/admin/exports/content.csv"
        "?content_type=applications&application_status=Pending&search=Exported",
        headers=admin_headers,
    )
    assert content_export.status_code == 200
    assert "Exported designer role" in content_export.text
    assert applicant["email"] in content_export.text

    audit_export = client.get(
        "/api/admin/exports/audit.csv?action=admin.export.users",
        headers=admin_headers,
    )
    assert audit_export.status_code == 200
    assert "admin.export.users" in audit_export.text

    with test_db() as db:
        export_event = (
            db.query(AuditLog)
            .filter(AuditLog.action == "admin.export.users")
            .one()
        )
        assert export_event.actor_user_id == admin_id
        assert export_event.details["row_count"] == 1

    seeker = client.post(
        "/api/auth/login",
        json={"email": "seeker@example.com", "password": PASSWORD},
    )
    forbidden = client.get(
        "/api/admin/exports/users.csv",
        headers={"Authorization": f"Bearer {seeker.json()['access_token']}"},
    )
    assert forbidden.status_code == 403
