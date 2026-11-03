import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyJobs } from "../../services/jobService";
import type { Job } from "../../types/job";
import { useNavigate } from "react-router-dom";

function EmployerDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMyJobs = async () => {
      try {
        const data = await getMyJobs();
        setJobs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchMyJobs();
  }, []);

  if (loading) return <p>Loading your jobs...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Employer Dashboard</h1>
      <p>Manage your job postings from here.</p>

      <h2>My Job Postings</h2>
      <button onClick={() => navigate("/employer/create-job")}>
        Create New Job
      </button>

      {jobs.length === 0 ? (
        <p>You have not posted any jobs yet.</p>
      ) : (
        jobs.map((job) => (
          <div key={job.id}>
            <h3>{job.title}</h3>
            <p>Company: {job.company_name}</p>
            <p>Location: {job.location}</p>
            <Link to={`/jobs/${job.id}`}>View Details</Link>
            <Link to={`/employer/edit-job/${job.id}`}>Edit Job</Link>
            <hr />
          </div>
        ))
      )}
    </div>
  );
}

export default EmployerDashboard;
