
import { apiRequest } from "./api";

export interface ApplicationResponse {
  message: string;
  application_id: number;
  job_id: number;
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
