# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

The purpose of this document is to describe the functional and non-functional requirements of LinkUp, a web-based job portal and recruitment management system.

This document is based on the Product Requirements Document (PRD) and defines how the main features of LinkUp should behave.

### 1.2 Project Scope

LinkUp connects job seekers with employers. Job seekers can view available jobs and submit applications. Employers can create and manage their own job postings and review applications. Administrators can manage users and moderate job postings.

The project will be developed in two releases: MVP (Midterm Release) and Beta (Final Release).

### 1.3 Technology Stack

* Frontend: React.js with TypeScript
* Backend: Python with FastAPI
* Communication: REST APIs
* Database: To be selected during technical design

## 2. User Roles

### 2.1 Job Seeker

A Job Seeker can:

* Register and log in.
* View available job listings and job details.
* Apply for jobs.
* View their own applications and application status.

### 2.2 Employer

An Employer can:

* Register and log in.
* Create job postings.
* Edit and delete their own job postings.
* View applications submitted for their job postings.
* Update application status.

### 2.3 Administrator

An Administrator can:

* View and manage user accounts.
* View and moderate job postings.

## 3. Functional Requirements

### 3.1 User Authentication

* **FR-01:** The system shall allow users to register an account.
* **FR-02:** The system shall allow registered users to log in and log out.
* **FR-03:** The system shall store passwords securely using password hashing.

### 3.2 Job Management

* **FR-04:** The system shall display available job listings.
* **FR-05:** The system shall display detailed information about a selected job.
* **FR-06:** The system shall allow Employers to create job postings.
* **FR-07:** The system shall allow Employers to edit and delete their own job postings.

### 3.3 Job Application Management

* **FR-08:** The system shall allow Job Seekers to apply for available jobs.
* **FR-09:** The system shall allow Job Seekers to view their own applications and application status.
* **FR-10:** The system shall allow Employers to review applications submitted for their job postings.
* **FR-11:** The system shall allow Employers to update the status of applications for their job postings.

### 3.4 Authorization and Administration

* **FR-12:** The system shall support three roles: Job Seeker, Employer, and Administrator.
* **FR-13:** The system shall restrict protected operations according to user roles and permissions.
* **FR-14:** The system shall verify resource ownership before allowing users to modify restricted resources or access restricted records.
* **FR-15:** The system shall allow Administrators to manage user accounts and moderate job postings.
* **FR-16:** The backend shall enforce the required security scopes and permissions.

## 4. Non-Functional Requirements

* **NFR-01:** The application shall provide a simple and user-friendly interface.
* **NFR-02:** Passwords shall not be stored as plain text.
* **NFR-03:** Protected backend endpoints shall enforce authentication and authorization.
* **NFR-04:** The system shall validate user inputs and handle errors appropriately.
* **NFR-05:** The frontend and backend shall communicate through REST APIs.
* **NFR-06:** The code shall be organized and easy to understand and maintain.

## 5. Security Requirements

* Users shall log in before accessing protected features.
* Users shall only perform actions permitted by their roles.
* Employers shall only edit or delete their own job postings.
* Job Seekers shall only view their own application records.
* Employers shall only review applications for their own job postings.
* Passwords shall be stored using secure password hashing.
* The backend shall check the required security scopes and permissions.
* Frontend restrictions alone shall not be considered sufficient security.

## 6. Release Requirements

### 6.1 MVP (Midterm Release)

The MVP shall include the basic working features of LinkUp:

* React and TypeScript frontend setup.
* Python and FastAPI backend setup.
* Basic database structure.
* User registration and login.
* Job listing and job details.
* Job posting creation.
* Job application submission.
* Frontend and backend integration through REST APIs.
* Basic input validation and error handling.

**MVP Acceptance Criteria:**

* Users can register and log in.
* Users can view available jobs and job details.
* Employers can create job postings.
* Job Seekers can submit applications.
* The frontend can communicate with the backend.

### 6.2 Beta (Final Release)

The Beta release shall complete and improve the MVP features:

* User logout and improved authentication.
* Complete Role-Based Access Control (RBAC).
* Required security scopes and permission checks.
* Ownership checks for job postings and applications.
* Job Seeker application tracking.
* Employer application review and status updates.
* Basic Administrator functions.
* Improved input validation and error handling.
* Frontend and backend integration testing.
* Bug fixing and deployment preparation.

**Beta Acceptance Criteria:**

* The three user roles have appropriate access permissions.
* Employers can manage only their own job postings and related applications.
* Job Seekers can access only their own application records.
* Administrators can manage users and moderate job postings.
* The backend enforces the required security scopes and permissions.
* The main application features work correctly together.

## 7. Assumptions and Constraints

* LinkUp is an academic course project.
* The project shall follow the MVP and Beta release plan defined in the PRD.
* The frontend shall use React.js with TypeScript.
* The backend shall use Python with FastAPI.
* REST APIs shall be used for frontend-backend communication.
* Authentication, authorization, RBAC, security scopes, and permissions are required.
* The project shall focus on essential job portal functionality.
* Database and detailed API design decisions shall be documented in the TDD.

