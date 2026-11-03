import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJobById } from "../../services/jobService";
import type { Job } from "../../types/job";

function JobDetails() {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      try {
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error("Invalid job ID");
        }

        const data = await getJobById(Number(id));
        setJob(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load job details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  if (loading) return <p>Loading job details...</p>;
  if (error) return <p>{error}</p>;
  if (!job) return <p>Job not found.</p>;

  return (
    <div>
      <h1>{job.title}</h1>

      <p>Company: {job.company_name}</p>
      <p>Location: {job.location}</p>
      <p>Employment Type: {job.employment_type}</p>
      <p>Salary: {job.salary || "Not specified"}</p>

      <h2>Job Description</h2>
      <p>{job.description}</p>

      <Link to="/jobs">Back to Jobs</Link>
    </div>
  );
}

export default JobDetails;