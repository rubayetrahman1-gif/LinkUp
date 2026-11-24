import { apiRequest } from "./api";
import type { Job, JobCreate, JobUpdate } from "../types/job";
import type { ApplicationStatus } from "./applicationService";

export type TeamRole = "owner" | "recruiter" | "reviewer";
export type TeamRecommendation =
  | "Recommend"
  | "Not Recommend"
  | "Need Further Consideration";

export interface TeamMember {
  user_id: number;
  full_name: string;
  email: string;
  role: TeamRole;
  joined_at: string;
}

export interface TeamSummary {
  id: number;
  name: string;
  owner_id: number;
  my_role: TeamRole;
  member_count: number;
  job_count: number;
  application_count: number;
  created_at: string;
}

export interface TeamDetails extends TeamSummary {
  members: TeamMember[];
}

export interface TeamApplication {
  application_id: number;
  job_id: number;
  job_title: string;
  company_name: string;
  status: ApplicationStatus;
  applicant: {
    id: number;
    full_name: string;
    email: string;
  };
  assigned_reviewer_id: number | null;
  assigned_reviewer_name: string | null;
  review_recommendation: TeamRecommendation | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

export function getMyTeams(): Promise<TeamSummary[]> {
  return apiRequest<TeamSummary[]>("/api/teams");
}

export function getTeam(teamId: number): Promise<TeamDetails> {
  return apiRequest<TeamDetails>(`/api/teams/${teamId}`);
}

export function createTeam(name: string): Promise<TeamSummary> {
  return apiRequest<TeamSummary>("/api/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameTeam(teamId: number, name: string): Promise<{ id: number; name: string }> {
  return apiRequest(`/api/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteTeam(teamId: number): Promise<void> {
  return apiRequest(`/api/teams/${teamId}`, { method: "DELETE" });
}

export function addTeamMember(
  teamId: number,
  email: string,
  role: "recruiter" | "reviewer",
): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/api/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function updateTeamMember(
  teamId: number,
  userId: number,
  role: "recruiter" | "reviewer",
): Promise<{ user_id: number; role: TeamRole }> {
  return apiRequest(`/api/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeTeamMember(teamId: number, userId: number): Promise<void> {
  return apiRequest(`/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}

export function getTeamJobs(teamId: number): Promise<Job[]> {
  return apiRequest<Job[]>(`/api/teams/${teamId}/jobs`);
}

export function createTeamJob(teamId: number, job: JobCreate): Promise<Job> {
  return apiRequest<Job>(`/api/teams/${teamId}/jobs`, {
    method: "POST",
    body: JSON.stringify(job),
  });
}

export function updateTeamJob(
  teamId: number,
  jobId: number,
  job: JobUpdate,
): Promise<Job> {
  return apiRequest<Job>(`/api/teams/${teamId}/jobs/${jobId}`, {
    method: "PUT",
    body: JSON.stringify(job),
  });
}

export function deleteTeamJob(teamId: number, jobId: number): Promise<void> {
  return apiRequest(`/api/teams/${teamId}/jobs/${jobId}`, {
    method: "DELETE",
  });
}

export function getTeamApplications(teamId: number): Promise<TeamApplication[]> {
  return apiRequest<TeamApplication[]>(`/api/teams/${teamId}/applications`);
}

export function assignTeamApplication(
  teamId: number,
  applicationId: number,
  reviewerId: number | null,
): Promise<{ application_id: number; assigned_reviewer_id: number | null }> {
  return apiRequest(
    `/api/teams/${teamId}/applications/${applicationId}/assignment`,
    {
      method: "PATCH",
      body: JSON.stringify({ reviewer_id: reviewerId }),
    },
  );
}

export function reviewTeamApplication(
  teamId: number,
  applicationId: number,
  recommendation: TeamRecommendation,
): Promise<unknown> {
  return apiRequest(
    `/api/teams/${teamId}/applications/${applicationId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({ recommendation }),
    },
  );
}

export function updateTeamApplicationStatus(
  teamId: number,
  applicationId: number,
  status: ApplicationStatus,
): Promise<{ application_id: number; job_id: number; status: ApplicationStatus }> {
  return apiRequest(
    `/api/teams/${teamId}/applications/${applicationId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
