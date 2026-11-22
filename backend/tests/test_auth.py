def test_health_check(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register_user_success(client):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "TestPassword123!",
            "role": "job_seeker",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["full_name"] == "Test User"
    assert data["email"] == "test@example.com"
    assert data["role"] == "job_seeker"
    assert "password" not in data
    assert "password_hash" not in data


def test_register_user_duplicate_email(client):
    payload = {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123!",
        "role": "job_seeker",
    }

    first_response = client.post("/api/auth/register", json=payload)
    second_response = client.post("/api/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json()["detail"] == "Email already registered"

def create_test_user(client):
    return client.post(
        "/api/auth/register",
        json={
            "full_name": "Test User",
            "email": "login@example.com",
            "password": "TestPassword123!",
            "role": "job_seeker",
        },
    )


def test_login_success(client):
    register_response = create_test_user(client)
    assert register_response.status_code == 201

    response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"
    assert "refresh_token" in response.cookies


def test_login_wrong_password(client):
    create_test_user(client)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_unknown_email(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "unknown@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_login_account_lockout(client):
    create_test_user(client)

    for attempt in range(7):
        response = client.post(
            "/api/auth/login",
            json={
                "email": "login@example.com",
                "password": "WrongPassword123!",
            },
        )

        assert response.status_code == 401, (
            f"Attempt {attempt + 1} should return 401"
        )

    eighth_attempt = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert eighth_attempt.status_code == 429

    correct_password_attempt = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert correct_password_attempt.status_code == 429

def test_refresh_without_token(client):
    response = client.post("/api/auth/refresh")

    assert response.status_code == 401
    assert response.json()["detail"] == "Refresh token is required"

def test_refresh_token_rotation_and_reuse_protection(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    old_refresh_token = login_response.cookies.get("refresh_token")
    assert old_refresh_token is not None

    refresh_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": old_refresh_token},
    )

    assert refresh_response.status_code == 200
    assert "access_token" in refresh_response.json()

    new_refresh_token = refresh_response.cookies.get("refresh_token")

    assert new_refresh_token is not None
    assert new_refresh_token != old_refresh_token

    reuse_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": old_refresh_token},
    )

    assert reuse_response.status_code == 401
    assert reuse_response.json()["detail"] == "Invalid refresh token"

def test_logout_revokes_refresh_token(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    refresh_token = login_response.cookies.get("refresh_token")
    assert refresh_token is not None

    logout_response = client.post(
        "/api/auth/logout",
        cookies={"refresh_token": refresh_token},
    )

    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Logged out successfully"

    refresh_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 401
    assert refresh_response.json()["detail"] == "Invalid refresh token"


def test_logout_without_token(client):
    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

def test_get_user_sessions(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]

    response = client.get(
        "/api/auth/sessions",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert response.status_code == 200

    sessions = response.json()

    assert len(sessions) == 1
    assert sessions[0]["is_current"] is True
    assert "id" in sessions[0]
    assert "created_at" in sessions[0]
    assert "expires_at" in sessions[0]

def test_revoke_user_session(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    sessions_response = client.get(
        "/api/auth/sessions",
        headers=headers,
    )

    assert sessions_response.status_code == 200

    session_id = sessions_response.json()[0]["id"]

    revoke_response = client.delete(
        f"/api/auth/sessions/{session_id}",
        headers=headers,
    )

    assert revoke_response.status_code == 200
    assert revoke_response.json()["message"] == "Session revoked successfully"

    updated_sessions_response = client.get(
        "/api/auth/sessions",
        headers=headers,
    )

    assert updated_sessions_response.status_code == 200
    assert len(updated_sessions_response.json()) == 0
def test_user_cannot_revoke_another_users_session(client):
    create_test_user(client)

    first_login = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    first_token = first_login.json()["access_token"]

    first_sessions = client.get(
        "/api/auth/sessions",
        headers={"Authorization": f"Bearer {first_token}"},
    )

    session_id = first_sessions.json()[0]["id"]

    client.post(
        "/api/auth/register",
        json={
            "full_name": "Another User",
            "email": "another@example.com",
            "password": "AnotherPassword123!",
            "role": "job_seeker",
        },
    )

    second_login = client.post(
        "/api/auth/login",
        json={
            "email": "another@example.com",
            "password": "AnotherPassword123!",
        },
    )

    second_token = second_login.json()["access_token"]

    response = client.delete(
        f"/api/auth/sessions/{session_id}",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found"

def test_revoke_current_session_deletes_cookie(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    refresh_token = login_response.cookies.get("refresh_token")

    assert refresh_token is not None

    sessions_response = client.get(
        "/api/auth/sessions",
        headers={"Authorization": f"Bearer {access_token}"},
        cookies={"refresh_token": refresh_token},
    )

    assert sessions_response.status_code == 200
    assert sessions_response.json()[0]["is_current"] is True

    session_id = sessions_response.json()[0]["id"]

    response = client.delete(
        f"/api/auth/sessions/{session_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        cookies={"refresh_token": refresh_token},
    )

    assert response.status_code == 200

    set_cookie_header = response.headers.get("set-cookie", "")

    assert "refresh_token" in set_cookie_header
    assert "Max-Age=0" in set_cookie_header

    refresh_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 401

def test_password_change_revokes_all_refresh_sessions(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    refresh_token = login_response.cookies.get("refresh_token")

    assert refresh_token is not None

    response = client.post(
        "/api/users/me/change-password",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        json={
            "current_password": "TestPassword123!",
            "new_password": "NewTestPassword123!",
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully"

    refresh_response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 401

    old_password_login = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert old_password_login.status_code == 401

    new_password_login = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "NewTestPassword123!",
        },
    )

    assert new_password_login.status_code == 200
def test_password_change_with_wrong_current_password(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    access_token = login_response.json()["access_token"]

    response = client.post(
        "/api/users/me/change-password",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        json={
            "current_password": "WrongPassword123!",
            "new_password": "NewTestPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Current password is incorrect"

    old_password_login = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert old_password_login.status_code == 200


def test_password_change_rejects_same_password(client):
    create_test_user(client)

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    access_token = login_response.json()["access_token"]

    response = client.post(
        "/api/users/me/change-password",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        json={
            "current_password": "TestPassword123!",
            "new_password": "TestPassword123!",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "New password must be different from current password"
    )