import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyJobs, deleteJob } from "../../services/jobService";
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

  const handleDelete = async (jobId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job?",
    );

    if (!confirmed) return;

    try {
      await deleteJob(jobId);

      setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));

      alert("Job deleted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  };

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
            <button onClick={() => handleDelete(job.id)}>Delete Job</button>
            <hr />
          </div>
        ))
      )}
    </div>
  );
}

export default EmployerDashboard;
