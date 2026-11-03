import { apiRequest } from "./api";
import type { Job, JobCreate, JobUpdate } from "../types/job";

// Get all available jobs
export async function getAllJobs(): Promise<Job[]> {
  return apiRequest("/api/jobs");
}

// Get a single job by ID
export async function getJobById(id: number): Promise<Job> {
  return apiRequest(`/api/jobs/${id}`);
}

// Get employer's own jobs
export async function getMyJobs(): Promise<Job[]> {
  return apiRequest("/api/jobs/my-jobs");
}

// Create a new job
export async function createJob(jobData: JobCreate): Promise<Job> {
  return apiRequest("/api/jobs", {
    method: "POST",
    body: JSON.stringify(jobData),
  });
}

// Update an existing job
export async function updateJob(
  id: number,
  jobData: JobUpdate
): Promise<Job> {
  return apiRequest(`/api/jobs/${id}`, {
    method: "PUT",
    body: JSON.stringify(jobData),
  });
}

// Delete a job
export async function deleteJob(id: number): Promise<void> {
  return apiRequest(`/api/jobs/${id}`, {
    method: "DELETE",
  });
}