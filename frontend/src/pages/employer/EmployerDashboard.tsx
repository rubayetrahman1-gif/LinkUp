import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../../components/SiteLayout";
import { getCurrentUser, logoutUser } from "../../services/authService";
import { deleteJob, getMyJobs } from "../../services/jobService";
import type { User } from "../../types/auth";
import type { Job } from "../../types/job";

function EmployerDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      const [jobsResult, profileResult] = await Promise.allSettled([getMyJobs(), getCurrentUser()]);
      if (!active) return;

      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value);
      } else {
        setError(jobsResult.reason instanceof Error ? jobsResult.reason.message : "Could not load your job postings.");
      }

      if (profileResult.status === "fulfilled") {
        setUser(profileResult.value);
      } else {
        setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : "Could not load your profile.");
      }

      setLoading(false);
    };

    void fetchData();
    return () => { active = false; };
  }, []);

  const handleDelete = async (jobId: number) => {
    if (!window.confirm("Delete this job posting? This action cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      await deleteJob(jobId);
      setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
      setNotice("Job posting deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete this job.");
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/");
  };

  return (
    <main className="employer-portal">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <Brand />
        </div>

        <nav className="portal-navigation" aria-label="Employer dashboard">
          <a className="portal-nav-item active" href="#my-jobs" aria-current="page"><span aria-hidden="true">▣</span> My Jobs</a>
          <Link className="portal-nav-item" to="/jobs"><span aria-hidden="true">⌕</span> Browse jobs</Link>
        </nav>

        <div className="portal-account">
          <span className="portal-avatar" aria-hidden="true">{user?.full_name.trim().charAt(0).toUpperCase() || "U"}</span>
          <span className="portal-account-info">
            <strong>{user?.full_name || (profileError ? "Profile unavailable" : "Loading profile…")}</strong>
            <small>{user?.email || (profileError ? "Please sign in again" : " ")}</small>
          </span>
          <button className="portal-logout" type="button" onClick={handleLogout} aria-label="Log out" title="Log out">↗</button>
        </div>
      </aside>

      <section className="portal-main">
        <div className="portal-content">
          <header className="portal-page-header">
            <div>
              <span className="eyebrow"><span className="eyebrow-dot" /> EMPLOYER WORKSPACE</span>
              <h1>My Jobs</h1>
              <p>Manage your job postings and keep your opportunities up to date.</p>
            </div>
            <button className="button" onClick={() => navigate("/employer/create-job")}>
              <span aria-hidden="true">＋</span> Post New Job
            </button>
          </header>

          <section className="portal-jobs" id="my-jobs">
            <div className="portal-list-heading">
              <div>
                <h2>Job postings</h2>
                <p>Manage your job postings and view role details.</p>
              </div>
              {!loading && !error && <span className="portal-count">{jobs.length} {jobs.length === 1 ? "job" : "jobs"}</span>}
            </div>

            {notice && <p className="status-success" role="status">{notice}</p>}
            {error && <p className="status-message" role="alert">{error}</p>}
            {loading && <div className="loading-state" role="status">Loading your job postings...</div>}

            {!loading && !error && jobs.length === 0 && (
              <div className="empty-state portal-empty">
                <span className="portal-empty-icon" aria-hidden="true">▣</span>
                <h2>Your next great hire starts with a job post.</h2>
                <p>Create your first opportunity and help the right people find your team.</p>
                <button className="button" onClick={() => navigate("/employer/create-job")}>Post your first job</button>
              </div>
            )}

            {!loading && !error && jobs.length > 0 && (
              <div className="portal-table-scroll">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Job title</th>
                      <th scope="col">Company</th>
                      <th scope="col">Location</th>
                      <th scope="col">Employment</th>
                      <th scope="col">Posted</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="portal-job-title">
                          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                          <small>Job #{job.id}</small>
                        </td>
                        <td>{job.company_name}</td>
                        <td><span className="portal-location"><span aria-hidden="true">⌖</span>{job.location}</span></td>
                        <td><span className="portal-type">{job.employment_type.replaceAll("_", " ")}</span></td>
                        <td>{new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td>
                          <div className="portal-row-actions">
                            <Link className="portal-action" to={`/employer/edit-job/${job.id}`} aria-label={`Edit ${job.title}`} title="Edit job">Edit</Link>
                            <button className="portal-action portal-delete" type="button" onClick={() => handleDelete(job.id)} aria-label={`Delete ${job.title}`} title="Delete job">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <footer className="portal-footer">
            <Brand />
            <span>Manage your team’s next connection.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default EmployerDashboard;
