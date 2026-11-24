from models import Application, Job, Team, TeamMember


def register_user(client, email, role):
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": email.split("@")[0].replace("-", " ").title(),
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


def create_team(client, headers, name="Design Hiring"):
    response = client.post("/api/teams", headers=headers, json={"name": name})
    assert response.status_code == 201
    return response.json()


def add_member(client, owner_headers, team_id, email, role):
    return client.post(
        f"/api/teams/{team_id}/members",
        headers=owner_headers,
        json={"email": email, "role": role},
    )


def create_team_job(client, headers, team_id):
    return client.post(
        f"/api/teams/{team_id}/jobs",
        headers=headers,
        json={
            "title": "Product Designer",
            "company_name": "A value supplied by the recruiter",
            "location": "Remote",
            "description": "Work with the team to improve the product experience.",
            "employment_type": "full_time",
            "salary": "$90,000",
        },
    )


def test_team_roles_public_jobs_and_personal_jobs_remain_separate(client):
    register_user(client, "owner@example.com", "employer")
    register_user(client, "recruiter@example.com", "employer")
    register_user(client, "reviewer@example.com", "employer")
    register_user(client, "outsider@example.com", "employer")
    owner = login_headers(client, "owner@example.com")
    recruiter = login_headers(client, "recruiter@example.com")
    reviewer = login_headers(client, "reviewer@example.com")
    outsider = login_headers(client, "outsider@example.com")

    team = create_team(client, owner)
    owner_workspace = client.get(f"/api/teams/{team['id']}", headers=owner)
    assert owner_workspace.status_code == 200
    assert owner_workspace.json()["my_role"] == "owner"
    assert [member["role"] for member in owner_workspace.json()["members"]] == ["owner"]

    assert add_member(client, owner, team["id"], "recruiter@example.com", "recruiter").status_code == 201
    assert add_member(client, owner, team["id"], "reviewer@example.com", "reviewer").status_code == 201

    personal_job = client.post(
        "/api/jobs",
        headers=owner,
        json={
            "title": "Personal role",
            "company_name": "Owner's Company",
            "location": "Remote",
            "description": "A personal employer job posting.",
            "employment_type": "full_time",
        },
    )
    assert personal_job.status_code == 201
    team_job = create_team_job(client, recruiter, team["id"])
    assert team_job.status_code == 201
    assert team_job.json()["team_id"] == team["id"]
    assert team_job.json()["company_name"] == "Design Hiring"

    public_jobs = client.get("/api/jobs")
    assert public_jobs.status_code == 200
    assert team_job.json()["id"] in {job["id"] for job in public_jobs.json()}
    assert client.get("/api/jobs/my-jobs", headers=owner).json() == [personal_job.json()]
    assert client.get("/api/jobs/my-jobs", headers=recruiter).json() == []

    assert client.put(
        f"/api/teams/{team['id']}/jobs/{team_job.json()['id']}",
        headers=recruiter,
        json={"title": "Senior Product Designer"},
    ).status_code == 200
    assert client.put(
        f"/api/teams/{team['id']}/jobs/{team_job.json()['id']}",
        headers=reviewer,
        json={"title": "Unauthorized edit"},
    ).status_code == 403
    assert client.delete(
        f"/api/teams/{team['id']}/jobs/{team_job.json()['id']}",
        headers=recruiter,
    ).status_code == 403
    assert client.get(f"/api/teams/{team['id']}", headers=outsider).status_code == 403

    assert client.delete(
        f"/api/teams/{team['id']}/jobs/{team_job.json()['id']}",
        headers=owner,
    ).status_code == 200
    assert client.put(
        f"/api/jobs/{team_job.json()['id']}",
        headers=recruiter,
        json={"title": "Bypass Team route"},
    ).status_code == 404


def test_reviewer_recommendations_and_manager_status_are_separate(
    client, test_db
):
    register_user(client, "owner@example.com", "employer")
    register_user(client, "recruiter@example.com", "employer")
    register_user(client, "reviewer@example.com", "employer")
    register_user(client, "other-reviewer@example.com", "employer")
    register_user(client, "applicant@example.com", "job_seeker")
    owner = login_headers(client, "owner@example.com")
    recruiter = login_headers(client, "recruiter@example.com")
    reviewer = login_headers(client, "reviewer@example.com")
    other_reviewer = login_headers(client, "other-reviewer@example.com")
    applicant = login_headers(client, "applicant@example.com")

    team = create_team(client, owner)
    add_member(
        client, owner, team["id"], "recruiter@example.com", "recruiter"
    )
    reviewer_member = add_member(
        client, owner, team["id"], "reviewer@example.com", "reviewer"
    ).json()
    add_member(
        client, owner, team["id"], "other-reviewer@example.com", "reviewer"
    )
    job = create_team_job(client, owner, team["id"]).json()

    application_response = client.post(
        f"/api/jobs/{job['id']}/applications",
        headers=applicant,
    )
    assert application_response.status_code == 201
    application_id = application_response.json()["application_id"]
    assert application_response.json()["status"] == "Pending"
    assert "review_recommendation" not in client.get(
        "/api/applications/my",
        headers=applicant,
    ).json()[0]

    assert client.get(
        f"/api/teams/{team['id']}/applications",
        headers=reviewer,
    ).json() == []
    assert client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/review",
        headers=reviewer,
        json={"recommendation": "Recommend"},
    ).status_code == 403

    assigned = client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/assignment",
        headers=owner,
        json={"reviewer_id": reviewer_member["user_id"]},
    )
    assert assigned.status_code == 200

    reviewer_applications = client.get(
        f"/api/teams/{team['id']}/applications",
        headers=reviewer,
    )
    assert [item["application_id"] for item in reviewer_applications.json()] == [
        application_id
    ]
    assert client.get(
        f"/api/teams/{team['id']}/applications",
        headers=other_reviewer,
    ).json() == []

    review_response = client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/review",
        headers=reviewer,
        json={"recommendation": "Recommend"},
    )
    assert review_response.status_code == 200
    assert review_response.json()["review_recommendation"] == "Recommend"
    assert review_response.json()["status"] == "Pending"
    assert client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/review",
        headers=reviewer,
        json={"recommendation": "Invalid"},
    ).status_code == 422
    assert client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/status",
        headers=reviewer,
        json={"status": "Accepted"},
    ).status_code == 403
    assert client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/review",
        headers=recruiter,
        json={"recommendation": "Not Recommend"},
    ).status_code == 403

    updated_status = client.patch(
        f"/api/teams/{team['id']}/applications/{application_id}/status",
        headers=recruiter,
        json={"status": "Accepted"},
    )
    assert updated_status.status_code == 200
    manager_applications = client.get(
        f"/api/teams/{team['id']}/applications",
        headers=owner,
    )
    assert manager_applications.status_code == 200
    assert manager_applications.json()[0]["status"] == "Accepted"
    assert manager_applications.json()[0]["review_recommendation"] == "Recommend"
    assert client.delete(
        f"/api/teams/{team['id']}/jobs/{job['id']}",
        headers=owner,
    ).status_code == 409
    assert client.get(
        f"/api/teams/{team['id']}/applications",
        headers=applicant,
    ).status_code == 403

    archived = client.delete(f"/api/teams/{team['id']}", headers=owner)
    assert archived.status_code == 200
    assert "preserved" in archived.json()["message"]
    assert client.get(f"/api/teams/{team['id']}", headers=owner).status_code == 404
    assert client.get(f"/api/jobs/{job['id']}").status_code == 404
    assert client.post(
        f"/api/jobs/{job['id']}/applications",
        headers=applicant,
    ).status_code == 404
    assert job["id"] not in {
        item["id"] for item in client.get("/api/jobs").json()
    }
    history = client.get("/api/applications/my", headers=applicant)
    assert history.status_code == 200
    assert history.json()[0]["status"] == "Accepted"
    assert history.json()[0]["job_id"] == job["id"]
    with test_db() as db:
        archived_team = db.query(Team).filter(Team.id == team["id"]).one()
        assert archived_team.deleted_at is not None
        assert db.query(TeamMember).filter(
            TeamMember.team_id == team["id"]
        ).count() == 4
        assert db.query(Job).filter(Job.id == job["id"]).count() == 1
        application = db.query(Application).filter(
            Application.id == application_id
        ).one()
        assert application.status == "Accepted"
        assert application.review_recommendation == "Recommend"


def test_owner_only_team_management_and_employer_validation(client):
    register_user(client, "owner@example.com", "employer")
    register_user(client, "recruiter@example.com", "employer")
    register_user(client, "seeker@example.com", "job_seeker")
    owner = login_headers(client, "owner@example.com")
    seeker = login_headers(client, "seeker@example.com")
    team = create_team(client, owner)

    assert client.post(
        "/api/teams",
        headers=seeker,
        json={"name": "Not allowed"},
    ).status_code == 403
    assert client.patch(
        f"/api/teams/{team['id']}",
        headers=owner,
        json={"name": "Updated Team"},
    ).status_code == 200

    recruiter = add_member(
        client, owner, team["id"], "recruiter@example.com", "recruiter"
    )
    assert recruiter.status_code == 201
    recruiter_headers = login_headers(client, "recruiter@example.com")
    assert client.patch(
        f"/api/teams/{team['id']}",
        headers=recruiter_headers,
        json={"name": "Unauthorized rename"},
    ).status_code == 403
    assert client.delete(
        f"/api/teams/{team['id']}/members/{recruiter.json()['user_id']}",
        headers=recruiter_headers,
    ).status_code == 403
    assert client.delete(
        f"/api/teams/{team['id']}/members/{team['owner_id']}",
        headers=owner,
    ).status_code == 403
