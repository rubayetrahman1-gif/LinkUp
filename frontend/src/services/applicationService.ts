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

// Submit an application for a job
export async function applyForJob(
  jobId: number
): Promise<ApplicationResponse> {
  return apiRequest(`/api/jobs/${jobId}/applications`, {
    method: "POST",
  });
}

// Get current Job Seeker's application history
export async function getMyApplications(): Promise<ApplicationHistoryItem[]> {
  return apiRequest("/api/applications/my");
}