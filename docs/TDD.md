# Technical Design Document (TDD)

## 1. Introduction

### 1.1 Purpose

This document describes the technical design of LinkUp, a web-based job portal and recruitment management system.

It explains the system architecture, technologies, database structure, API design, and security approach.

### 1.2 Project Overview

LinkUp connects job seekers with employers. Job seekers can view jobs and apply for them. Employers can create job postings and manage applications. Administrators can manage users and moderate job postings.

The system will be developed in two releases: MVP (Midterm Release) and Beta (Final Release).

## 2. Technology Stack

The project will use the following technologies:

* **Frontend:** React.js with TypeScript
* **Backend:** Python with FastAPI
* **Communication:** REST APIs
* **Database:** PostgreSQL (proposed; subject to confirmation)
* **Version Control:** Git and GitHub

The frontend will provide the user interface, while the backend will handle application logic, database operations, authentication, and authorization.

## 3. System Architecture

LinkUp will use a simple three-part architecture:

### 3.1 Frontend

The frontend will be developed using React and TypeScript.

It will provide pages for:

* User registration and login
* Job listings and job details
* Creating job postings
* Applying for jobs
* Viewing applications

### 3.2 Backend

The backend will be developed using FastAPI.

It will handle:

* User registration and login
* Job-related operations
* Application-related operations
* Database communication
* Authentication and authorization
* Role and permission checks

### 3.3 Database

The database will store user accounts, job postings, and job applications.

The frontend will communicate with the backend through REST APIs. The backend will read and update information in the database.

## 4. Database Design

The core design uses users, jobs, applications, Teams and memberships,
refresh sessions, and audit logs.

### 4.1 Users Table

Stores information about registered users.

| Field         | Description                            |
| ------------- | -------------------------------------- |
| id            | Unique user ID                         |
| name          | User's name                            |
| email         | User's email address                   |
| password_hash | Securely hashed password               |
| role          | Job Seeker, Employer, or Administrator |

### 4.2 Jobs Table

Stores job posting information.

| Field        | Description                            |
| ------------ | -------------------------------------- |
| id           | Unique job ID                          |
| title        | Job title                              |
| description  | Job description                        |
| company_name | Company name                           |
| location     | Job location                           |
| employer_id  | ID of the employer who created the job |
| group_id     | Optional Team/group ID; null for personal Employer jobs |

### 4.3 Applications Table

Stores job applications submitted by job seekers.

| Field         | Description           |
| ------------- | --------------------- |
| id            | Unique application ID |
| job_id        | ID of the job         |
| job_seeker_id | ID of the applicant   |
| status        | Application status    |

The initial application status can be set to Pending. Personal Employers can
update their own applications; Team application access is governed by Team role.
Team applications store a Reviewer assignment and an internal recommendation
(`Recommend`, `Not Recommend`, or `Need Further Consideration`) with reviewer
and timestamp metadata. The recommendation is independent of final application
status and is not included in Job Seeker history. Applications do not store CV
files.

The database will use IDs to connect users, jobs, and applications.

### 4.5 Teams and Team Members

The existing `groups` table is the physical storage for Employer Teams.
`group_members` stores the unique group/user association and the `owner`,
`recruiter`, or `reviewer` role. Team job posts use nullable `jobs.group_id`;
personal jobs keep it null. The API exposes this association as `team_id`.
The existing group and membership records are reused, not copied into new
tables. Team deletion is a soft archive using `groups.deleted_at`; it retains
jobs, applications, memberships, and recommendation history, while public job
listing, detail, and application routes exclude archived Team jobs. Team jobs
with applications cannot be individually deleted. The
`backend/migrations/20261124_employer_teams.sql` migration creates the legacy
group tables only if absent, adds `groups.deleted_at` and `jobs.group_id`, and
adds application assignment/recommendation metadata to existing PostgreSQL
databases. It adds no CV columns.

The existing `shared_resources` table remains separate from the Team hiring
workflow; it is not modified by the Teams migration or used in the Group
Management dashboard.

### 4.4 Audit Logs Table

Stores security and administrative events. Each record includes a nullable
actor and target user reference, action name, target type and identifier,
JSON action details, request IP address, user agent, and UTC creation time.
Authentication secrets and password data are never stored in audit details.
Indexes support lookup by action, actor/target, IP address, and event time.

### 4.5 Time Handling

Timestamp columns use timezone-aware database types and API responses use
ISO-8601 timestamps with timezone information. The frontend displays dates and
times in the viewer's device timezone; date-time values include the timezone
abbreviation so the displayed time is unambiguous. If an API timestamp has no
offset, the frontend treats it as UTC. Invalid or missing values are shown as
unavailable rather than as an incorrect date.

## 5. REST API Design

The frontend will use REST APIs to communicate with the backend.

### 5.1 Authentication APIs

| Method | Endpoint         | Purpose         |
| ------ | ---------------- | --------------- |
| POST   | `/auth/register` | Register a user |
| POST   | `/auth/login`    | Log in          |
| POST   | `/auth/logout`   | Log out         |

### 5.2 Job APIs

| Method | Endpoint         | Purpose              |
| ------ | ---------------- | -------------------- |
| GET    | `/jobs`          | View job listings    |
| GET    | `/jobs/{job_id}` | View job details     |
| POST   | `/jobs`          | Create a job posting |
| PUT    | `/jobs/{job_id}` | Edit a job posting   |
| DELETE | `/jobs/{job_id}` | Delete a job posting |

### 5.3 Application APIs

| Method | Endpoint                                | Purpose                                    |
| ------ | --------------------------------------- | ------------------------------------------ |
| POST   | `/jobs/{job_id}/applications`           | Apply for a job                            |
| GET    | `/applications/my`                      | View the current job seeker's applications |
| GET    | `/applications/employer`                 | View applications for personal jobs        |
| PATCH  | `/applications/{application_id}/status` | Update an application's status             |

Team and personal job applications use the same request flow; no application
endpoint accepts CV uploads.

### 5.4 Administration

Administrator operations use protected backend endpoints. The dashboard
overview is available at `GET /api/admin/dashboard/overview` and requires the
`read_admin_dashboard` permission from the centralized RBAC configuration.

The response contains total users and counts by role, active/inactive account
counts, total jobs and applications with application-status counts, recent user
registrations and job postings with actor, action, target, and UTC timestamp,
and user/job counts for the last seven days. The response does not include
credentials or authentication tokens.

The dashboard reports the active Team count. `GET /api/admin/teams` provides
group totals and paginated, read-only Team, Owner, member-role, job, and
application details, including archived groups. Admin user details include
each account's Team memberships. Admin accounts remain platform-level roles
and are not Team members. Applications currently have no creation timestamp,
so they are included in lifetime content counts but not in last-seven-days
activity statistics.

User management uses `read_admin_users` and exposes:

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/admin/users` | Search, filter, and paginate users |
| GET | `/api/admin/users/{user_id}` | View account details, activity, and session metadata |

The user list accepts `search` (name/email), `role`, `status` (`active`,
`inactive`, or `banned`), `page`, and `page_size` query parameters. Page size
is limited to 100. User responses omit password hashes and authentication tokens. Session
details omit refresh-token hashes. The details response includes Team
membership names and roles. Application activity is
included without an event time because application records currently have no
creation timestamp.

Administrators with the corresponding centralized RBAC permissions can:

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| PATCH | `/api/admin/users/{user_id}/ban` | Ban a user with a required reason and revoke active refresh sessions |
| POST | `/api/admin/users/{user_id}/unban` | Restore a banned user account |
| PATCH | `/api/admin/users/{user_id}/role` | Change a user's role among the three supported roles |
| POST | `/api/admin/users/{user_id}/sessions/{session_id}/revoke` | Revoke one active session belonging to that user |
| POST | `/api/admin/users/bulk-action` | Perform validated bulk ban/unban operations (maximum 100 users) |

Administrators cannot ban themselves or change their own role. A ban marks
the account inactive, records the reason, timestamp, and acting administrator,
and prevents subsequent protected requests and refreshes. Ban state is stored
separately from ordinary account inactivity. The `backend/migrations/20261123_admin_user_controls.sql`
migration adds the ban metadata fields to existing PostgreSQL databases; it
must be applied before deploying the user-management changes.

Content moderation requires `moderate_content` and supports jobs and
applications:

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/admin/content` | Search/filter and paginate jobs or applications |
| DELETE | `/api/admin/content/{content_type}/{record_id}` | Remove one supported content record |
| POST | `/api/admin/content/bulk-delete` | Remove up to 100 records of one content type |

Deleting a job and its applications runs in one database transaction. A
moderation event is recorded with the affected job/application identifiers.
Team jobs and their applications remain visible to platform moderation through
the existing jobs/applications content routes. Team settings are not managed
through moderation routes.

Audit and security APIs require `read_admin_audit` or
`read_security_events`:

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/admin/audit-logs` | Search/filter and paginate audit events |
| GET | `/api/admin/security/overview` | Summarize failed login attempts by IP/account and list recent security events |

Audit entries cover successful/failed/blocked login, logout, successful and
failed password changes, user bans/unbans, role changes, session revocation,
content deletion, and data exports. Available actor/target IDs, UTC timestamp,
IP address, user agent, and safe action details are stored. Failed logins for
unknown accounts retain the submitted account identifier, but never passwords.

CSV exports require `export_admin_data` and honor the provided filters:

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/admin/exports/users.csv` | Export filtered user records |
| GET | `/api/admin/exports/content.csv` | Export filtered jobs or applications |
| GET | `/api/admin/exports/audit.csv` | Export filtered audit events |

Exported user records omit password hashes and authentication tokens. CSV
cells beginning with spreadsheet formula characters are escaped. Every
completed export creates an audit event. The migration
`backend/migrations/20261123_admin_audit_logs.sql` creates the audit table and
its indexes for existing PostgreSQL databases; apply it before enabling these
routes in an existing deployment.

### 5.5 Employer Team APIs

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET / POST | `/api/teams` | List the current Employer's Teams / create a Team and Owner membership |
| GET / PATCH / DELETE | `/api/teams/{team_id}` | View a member workspace / Owner rename or archive |
| POST | `/api/teams/{team_id}/members` | Owner adds an Employer as Recruiter or Reviewer |
| PATCH / DELETE | `/api/teams/{team_id}/members/{user_id}` | Owner changes role or removes member |
| GET / POST | `/api/teams/{team_id}/jobs` | List or create Team jobs |
| PUT / DELETE | `/api/teams/{team_id}/jobs/{job_id}` | Update (Owner/Recruiter) or delete an application-free job (Owner) |
| GET | `/api/teams/{team_id}/applications` | Managers see all; Reviewers see assigned applications only |
| PATCH | `/api/teams/{team_id}/applications/{application_id}/assignment` | Owner/Recruiter assigns or unassigns a Reviewer |
| PATCH | `/api/teams/{team_id}/applications/{application_id}/review` | Assigned Reviewer submits an internal recommendation |
| PATCH | `/api/teams/{team_id}/applications/{application_id}/status` | Owner/Recruiter updates final application status |
| GET | `/api/admin/teams` | Admin-only paginated read view of Teams and members |

Team endpoints first validate the global Employer role, membership, and
per-team role. Personal `/api/jobs/my-jobs`, job update/delete, and
`/api/applications/employer` routes exclude Team jobs to prevent personal
ownership checks from bypassing Team permissions. Public job listing and
details include jobs from active Teams and exclude archived-Team jobs. Team
job company names are synchronized to the Team name. Archiving a Team preserves
its history, prevents regular Team workspace operations, and hides its jobs
from public listing, details, and application submission.

## 6. Authentication and Authorization

### 6.1 Authentication

Users will register and log in through the backend. Passwords will be stored as secure password hashes, not plain text.

The backend will authenticate users before allowing access to protected endpoints.

### 6.2 Role-Based Access Control (RBAC)

LinkUp will support three roles:

* **Job Seeker:** Can view jobs and manage their own applications.
* **Employer:** Can create and manage their own job postings and review related applications.
* **Administrator:** Can manage users and moderate job postings.

### 6.3 Security Scopes and Permissions

FastAPI security scopes will be used where required by the project.

The backend will check whether a user has the required permission before allowing a protected operation.

For example, creating a job requires job-creation permission. Editing a job also requires checking that the job belongs to the current employer.

Role checks, permission checks, and resource ownership checks will be enforced by the backend.

Administrator content moderation, audit/security review, and data exports use
the centralized `moderate_content`, `read_admin_audit`,
`read_security_events`, and `export_admin_data` permissions respectively.

Team Owner, Recruiter, and Reviewer roles are scoped to a Team and do not
replace global account roles or RBAC permissions. The backend enforces Team
membership for every private operation. Reviewers cannot query unassigned
applications or change final application status. Admin APIs are read-only for
Team data; Admins are not inserted as Team members. An Owner must archive all
active Teams before an Administrator can change the Owner's global role away
from Employer.

## 7. Frontend and Backend Integration

* React will send HTTP requests to the FastAPI backend.
* FastAPI will process requests and interact with the database.
* The backend will return responses in JSON format.
* React will display the returned information to the user.
* Appropriate error messages will be displayed when requests fail.

## 8. Error Handling and Validation

* Required fields shall be validated.
* Invalid login details shall produce an appropriate error response.
* Missing jobs or applications shall return an appropriate error.
* Unauthorized operations shall be rejected by the backend.
* Invalid application data shall not be stored.

## 9. Release Plan

### 9.1 MVP (Midterm Release)

The MVP will focus on:

* Basic frontend and backend setup
* Initial database structure
* User registration and login
* Viewing job listings and job details
* Creating job postings
* Submitting job applications
* Basic REST API integration

### 9.2 Beta (Final Release)

The Beta release will focus on:

* Completing authentication and logout
* Implementing RBAC and required security scopes
* Enforcing permissions and resource ownership
* Managing and updating job applications
* Adding basic administrator operations
* Testing, bug fixing, and deployment preparation

## 10. Conclusion

This technical design provides a simple structure for implementing LinkUp. The system will use React and TypeScript for the frontend, FastAPI for the backend, REST APIs for communication, and a relational database for storing application data.

The implementation will follow the PRD and SRS and will be completed in two releases: MVP and Beta.
