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

The initial design will use three main tables.

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

### 4.3 Applications Table

Stores job applications submitted by job seekers.

| Field         | Description           |
| ------------- | --------------------- |
| id            | Unique application ID |
| job_id        | ID of the job         |
| job_seeker_id | ID of the applicant   |
| status        | Application status    |

The initial application status can be set to Pending. Employers can update it later.

The database will use IDs to connect users, jobs, and applications.

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
| GET    | `/jobs/{job_id}/applications`           | View applications for an employer's job    |
| PATCH  | `/applications/{application_id}/status` | Update an application's status             |

### 5.4 Administration

Administrator operations will use protected backend endpoints to manage users and moderate job postings.

The exact endpoints and request formats will be finalized during implementation.

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
