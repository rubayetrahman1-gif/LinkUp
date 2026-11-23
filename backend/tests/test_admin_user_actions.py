from models import AuditLog, RefreshSession, User


def register_user(client, email, role="job_seeker"):
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


def login(client, email):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "TestPassword123!"},
    )
    return response


def make_admin(client, test_db):
    user = register_user(client, "admin@example.com")
    with test_db() as db:
        db.query(User).filter(User.id == user["id"]).update({"role": "admin"})
        db.commit()
    response = login(client, "admin@example.com")
    assert response.status_code == 200
    return user["id"], {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def test_admin_can_ban_and_unban_user_and_revoke_refresh_session(
    client, test_db
):
    admin_id, admin_headers = make_admin(client, test_db)
    target = register_user(client, "target@example.com")
    target_login = login(client, "target@example.com")
    assert target_login.status_code == 200
    target_access = target_login.json()["access_token"]
    target_refresh = target_login.cookies.get("refresh_token")
    assert target_refresh

    missing_reason = client.patch(
        f"/api/admin/users/{target['id']}/ban",
        headers=admin_headers,
        json={"reason": "  "},
    )
    assert missing_reason.status_code == 422

    ban_response = client.patch(
        f"/api/admin/users/{target['id']}/ban",
        headers=admin_headers,
        json={"reason": "Repeated abusive messages"},
    )
    assert ban_response.status_code == 200
    assert ban_response.json()["is_banned"] is True

    with test_db() as db:
        banned_user = db.query(User).filter(User.id == target["id"]).one()
        assert banned_user.is_active is False
        assert banned_user.is_banned is True
        assert banned_user.ban_reason == "Repeated abusive messages"
        assert banned_user.banned_by_id == admin_id
        refresh_session = (
            db.query(RefreshSession)
            .filter(RefreshSession.user_id == target["id"])
            .one()
        )
        assert refresh_session.revoked_at is not None

    protected_response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {target_access}"},
    )
    refresh_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": target_refresh},
    )
    assert protected_response.status_code == 403
    assert protected_response.json()["detail"] == "Account is banned"
    assert refresh_response.status_code == 401
    assert login(client, "target@example.com").status_code == 403

    unban_response = client.post(
        f"/api/admin/users/{target['id']}/unban",
        headers=admin_headers,
    )
    assert unban_response.status_code == 200
    with test_db() as db:
        unbanned_user = db.query(User).filter(User.id == target["id"]).one()
        assert unbanned_user.is_active is True
        assert unbanned_user.is_banned is False
        assert unbanned_user.ban_reason == "Repeated abusive messages"
        action_names = {
            action
            for (action,) in db.query(AuditLog.action)
            .filter(AuditLog.target_user_id == target["id"])
            .all()
        }
        assert "admin.user.banned" in action_names
        assert "admin.user.unbanned" in action_names

    assert login(client, "target@example.com").status_code == 200


def test_admin_cannot_ban_self_or_change_own_role(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)

    self_ban = client.patch(
        f"/api/admin/users/{admin_id}/ban",
        headers=admin_headers,
        json={"reason": "This should not be allowed"},
    )
    self_role_change = client.patch(
        f"/api/admin/users/{admin_id}/role",
        headers=admin_headers,
        json={"role": "job_seeker"},
    )

    assert self_ban.status_code == 403
    assert self_role_change.status_code == 403


def test_admin_role_changes_are_validated_and_admin_only(client, test_db):
    target = register_user(client, "role-target@example.com", role="employer")
    _, admin_headers = make_admin(client, test_db)

    invalid_role = client.patch(
        f"/api/admin/users/{target['id']}/role",
        headers=admin_headers,
        json={"role": "owner"},
    )
    changed_role = client.patch(
        f"/api/admin/users/{target['id']}/role",
        headers=admin_headers,
        json={"role": "job_seeker"},
    )
    non_admin = login(client, "role-target@example.com")
    forbidden_change = client.patch(
        f"/api/admin/users/{target['id']}/role",
        headers={
            "Authorization": f"Bearer {non_admin.json()['access_token']}"
        },
        json={"role": "admin"},
    )

    assert invalid_role.status_code == 422
    assert changed_role.status_code == 200
    assert changed_role.json()["role"] == "job_seeker"
    assert forbidden_change.status_code == 403
    with test_db() as db:
        role_event = (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "admin.user.role_changed",
                AuditLog.target_user_id == target["id"],
            )
            .one()
        )
        assert role_event.details == {
            "old_role": "employer",
            "new_role": "job_seeker",
        }

    forbidden_ban = client.patch(
        f"/api/admin/users/{target['id']}/ban",
        headers={
            "Authorization": f"Bearer {non_admin.json()['access_token']}"
        },
        json={"reason": "Not authorized"},
    )
    assert forbidden_ban.status_code == 403


def test_admin_can_revoke_an_individual_user_session(client, test_db):
    _, admin_headers = make_admin(client, test_db)
    target = register_user(client, "session-target@example.com")
    target_login = login(client, "session-target@example.com")
    session_token = target_login.cookies.get("refresh_token")

    with test_db() as db:
        session_id = (
            db.query(RefreshSession.id)
            .filter(RefreshSession.user_id == target["id"])
            .scalar()
        )

    response = client.post(
        f"/api/admin/users/{target['id']}/sessions/{session_id}/revoke",
        headers=admin_headers,
    )
    assert response.status_code == 200
    with test_db() as db:
        revoke_event = (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "admin.session.revoked",
                AuditLog.target_id == str(session_id),
            )
            .one()
        )
        assert revoke_event.target_user_id == target["id"]
    assert client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": session_token},
    ).status_code == 401

    assert client.post(
        f"/api/admin/users/{target['id']}/sessions/9999/revoke",
        headers=admin_headers,
    ).status_code == 404


def test_bulk_ban_and_unban_validate_targets_and_reason(client, test_db):
    admin_id, admin_headers = make_admin(client, test_db)
    first = register_user(client, "bulk-one@example.com")
    second = register_user(client, "bulk-two@example.com")

    no_reason = client.post(
        "/api/admin/users/bulk-action",
        headers=admin_headers,
        json={"action": "ban", "user_ids": [first["id"]]},
    )
    self_ban = client.post(
        "/api/admin/users/bulk-action",
        headers=admin_headers,
        json={
            "action": "ban",
            "user_ids": [first["id"], admin_id],
            "reason": "Bulk ban attempt",
        },
    )
    missing_target = client.post(
        "/api/admin/users/bulk-action",
        headers=admin_headers,
        json={
            "action": "ban",
            "user_ids": [first["id"], 9999],
            "reason": "Bulk ban attempt",
        },
    )
    with test_db() as db:
        assert db.query(User).filter(User.id == first["id"]).one().is_banned is False

    bulk_ban = client.post(
        "/api/admin/users/bulk-action",
        headers=admin_headers,
        json={
            "action": "ban",
            "user_ids": [first["id"], second["id"]],
            "reason": "Coordinated abuse",
        },
    )
    bulk_unban = client.post(
        "/api/admin/users/bulk-action",
        headers=admin_headers,
        json={"action": "unban", "user_ids": [first["id"], second["id"]]},
    )

    assert no_reason.status_code == 422
    assert self_ban.status_code == 403
    assert missing_target.status_code == 404
    assert bulk_ban.json()["affected_count"] == 2
    assert bulk_unban.json()["affected_count"] == 2
