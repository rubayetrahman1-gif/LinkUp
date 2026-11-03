import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllJobs } from "../../services/jobService";
import type { Job } from "../../types/job";

function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const data = await getAllJobs();
        setJobs(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load jobs"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  if (loading) {
    return <p>Loading jobs...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div>
      <h1>Available Jobs</h1>
      <p>Explore opportunities available on LinkUp.</p>

      {jobs.length === 0 ? (
        <p>No jobs available at the moment.</p>
      ) : (
        jobs.map((job) => (
          <div key={job.id}>
            <h2>{job.title}</h2>
            <p>Company: {job.company_name}</p>
            <p>Location: {job.location}</p>
            <p>Employment Type: {job.employment_type}</p>
            <p>Salary: {job.salary || "Not specified"}</p>

            <Link to={`/jobs/${job.id}`}>
              View Details
            </Link>

            <hr />
          </div>
        ))
      )}
    </div>
  );
}

export default JobList;