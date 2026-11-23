import { apiRequest } from "./api";

export interface ApplicationResponse {
  message: string;
  application_id: number;
  job_id: number;
  status: string;
}

export interface ApplicationHistoryItem {
  application_id: number;
  job_id: number;
  job_title: string;
  company_name: string;
  status: string;
}

export type ApplicationStatus =
  | "Pending"
  | "Under Review"
  | "Accepted"
  | "Rejected";

export interface EmployerApplication {
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
}

// Submit an application for a job
export async function applyForJob(
  jobId: number
): Promise<ApplicationResponse> {
  return apiRequest<ApplicationResponse>(`/api/jobs/${jobId}/applications`, {
    method: "POST",
  });
}

// Get current Job Seeker's application history
export async function getMyApplications(): Promise<ApplicationHistoryItem[]> {
  return apiRequest<ApplicationHistoryItem[]>("/api/applications/my");
}

export async function getEmployerApplications(): Promise<EmployerApplication[]> {
  return apiRequest<EmployerApplication[]>("/api/applications/employer");
}

export async function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus,
): Promise<{ application_id: number; job_id: number; status: ApplicationStatus }> {
  return apiRequest(`/api/applications/${applicationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}