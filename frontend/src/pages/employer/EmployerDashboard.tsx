import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../../components/SiteLayout";
import { getCurrentUser, logoutUser } from "../../services/authService";
import { deleteJob, getMyJobs } from "../../services/jobService";
import type { User } from "../../types/auth";
import type { Job } from "../../types/job";
import { useAuth } from "../../context/useAuth";
import { formatDate } from "../../dateTime";
import { createTeam, getMyTeams } from "../../services/teamService";
import type { TeamSummary } from "../../services/teamService";
import { getStatusPillClass } from "../../components/jobUtils";

function EmployerDashboard() {
  const navigate = useNavigate();
  const { setUser: setAuthenticatedUser } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [notice, setNotice] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      const [jobsResult, profileResult, teamsResult] = await Promise.allSettled([
        getMyJobs(),
        getCurrentUser(),
        getMyTeams(),
      ]);
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
      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value);
      } else {
        setTeamError(teamsResult.reason instanceof Error ? teamsResult.reason.message : "Could not load your Teams.");
      }

      setLoading(false);
    };

    void fetchData();
    return () => { active = false; };
  }, []);

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTeamError("");
    setCreatingTeam(true);
    try {
      const team = await createTeam(teamName);
      setTeams((current) => [team, ...current]);
      setTeamName("");
    } catch (requestError) {
      setTeamError(requestError instanceof Error ? requestError.message : "Could not create this Team.");
    } finally {
      setCreatingTeam(false);
    }
  };

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

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (logoutError) {
      console.error("Logout request failed:", logoutError);
    } finally {
      setAuthenticatedUser(null);
      navigate("/");
    }
  };

  const totalTeamJobs = teams.reduce((sum, team) => sum + team.job_count, 0);
  const totalTeamApplications = teams.reduce((sum, team) => sum + team.application_count, 0);

  return (
    <main className="employer-portal">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <Brand />
        </div>

        <nav className="portal-navigation" aria-label="Employer dashboard">
          <a className="portal-nav-item active" href="#my-jobs" aria-current="page"><span aria-hidden="true">▣</span> My Jobs</a>
          <a className="portal-nav-item" href="#teams"><span aria-hidden="true">◫</span> Teams</a>
          <Link className="portal-nav-item" to="/employer/applications"><span aria-hidden="true">▤</span> Applications</Link>
          <Link className="portal-nav-item" to="/jobs"><span aria-hidden="true">⌕</span> Browse jobs</Link>
          <Link className="portal-nav-item" to="/settings"><span aria-hidden="true">⚙</span> Account settings</Link>
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
              <h1>Employer Overview</h1>
              <p>Manage personal job postings, track team workspaces, and review incoming candidates.</p>
            </div>
            <button className="button" onClick={() => navigate("/employer/create-job")}>
              <span aria-hidden="true">＋</span> Post New Job
            </button>
          </header>

          {!loading && (
            <div className="kpi-grid" aria-label="Employer metrics">
              <article className="kpi-card">
                <span>Personal jobs</span>
                <strong>{jobs.length}</strong>
                <small>Active solo postings</small>
              </article>
              <article className="kpi-card">
                <span>Hiring teams</span>
                <strong>{teams.length}</strong>
                <small>Workspaces you belong to</small>
              </article>
              <article className="kpi-card">
                <span>Team jobs</span>
                <strong>{totalTeamJobs}</strong>
                <small>Across all teams</small>
              </article>
              <article className="kpi-card">
                <span>Team applicants</span>
                <strong>{totalTeamApplications}</strong>
                <small>Collaborative pipeline</small>
              </article>
            </div>
          )}

          <section className="portal-jobs" id="my-jobs">
            <div className="portal-list-heading">
              <div>
                <h2>Personal job postings</h2>
                <p>Roles posted under your personal employer account.</p>
              </div>
              {!loading && !error && (
                <span className="portal-count">{jobs.length} {jobs.length === 1 ? "job" : "jobs"}</span>
              )}
            </div>

            {notice && <p className="status-success" style={{ margin: "16px 24px 0" }} role="status">{notice}</p>}
            {error && <p className="status-message" style={{ margin: "16px 24px 0" }} role="alert">{error}</p>}
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
                      <th scope="col">Compensation</th>
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
                        <td><span className="job-badge">{job.employment_type.replaceAll("_", " ")}</span></td>
                        <td>{job.salary || <span className="admin-muted">Not specified</span>}</td>
                        <td>{formatDate(job.created_at)}</td>
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

          <section className="portal-jobs team-dashboard-section" id="teams">
            <div className="portal-list-heading">
              <div>
                <h2>Hiring Teams</h2>
                <p>Create a shared workspace or open an existing Team to collaborate with recruiters and reviewers.</p>
              </div>
              <span className="portal-count">{teams.length} {teams.length === 1 ? "Team" : "Teams"}</span>
            </div>
            {teamError && <p className="status-message" style={{ margin: "16px 24px 0" }} role="alert">{teamError}</p>}
            <form className="team-create-form" onSubmit={(event) => void handleCreateTeam(event)}>
              <div className="form-field">
                <label htmlFor="create-team-name">New Team name</label>
                <input
                  id="create-team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. Product Hiring"
                  required
                />
              </div>
              <button className="button" type="submit" disabled={creatingTeam}>
                {creatingTeam ? "Creating..." : "Create Team"}
              </button>
            </form>
            {!teams.length ? (
              <div className="empty-state portal-empty">
                <h3>No Teams yet</h3>
                <p>Create one to collaborate with other Employer accounts on hiring.</p>
              </div>
            ) : (
              <div className="team-dashboard-grid">
                {teams.map((team) => (
                  <article className="team-dashboard-card" key={team.id}>
                    <div className="team-dashboard-card-heading">
                      <div>
                        <span className={getStatusPillClass(team.my_role)}>{team.my_role}</span>
                        <h3>{team.name}</h3>
                      </div>
                      <span className="portal-type">{team.member_count} members</span>
                    </div>
                    <p>{team.job_count} jobs · {team.application_count} applications</p>
                    <Link className="button button-secondary" to={`/employer/teams/${team.id}`}>
                      Open Team workspace <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
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
