import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJobById } from "../../services/jobService";
import { getCurrentUser } from "../../services/authService";
import type { Job } from "../../types/job";
import type { User } from "../../types/auth";
import { PublicLayout } from "../../components/SiteLayout";
import { CompanyMark } from "../../components/JobCard";
import { formatEmploymentType } from "../../components/jobUtils";

function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAccessToken, setHasAccessToken] = useState(() => Boolean(localStorage.getItem("access_token")));
  const [userRole, setUserRole] = useState<User["role"] | null>(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchJob = async () => {
      setLoading(true);
      setError("");
      try {
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error("This job link is invalid.");
        }
        const data = await getJobById(Number(id));
        if (active) setJob(data);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Failed to load job details.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchJob();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;

    const loadProfile = async (token: string) => {
      setProfileError("");
      try {
        const user = await getCurrentUser();
        if (active && localStorage.getItem("access_token") === token) setUserRole(user.role);
      } catch (requestError) {
        if (active && localStorage.getItem("access_token") === token) {
          setUserRole(null);
          setProfileError(requestError instanceof Error ? requestError.message : "Could not verify your account.");
        }
      }
    };

    const token = localStorage.getItem("access_token");
    if (token) void loadProfile(token);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "access_token" || event.key === null) {
        const currentToken = localStorage.getItem("access_token");
        setHasAccessToken(Boolean(currentToken));
        setUserRole(null);
        setProfileError("");
        if (currentToken) void loadProfile(currentToken);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <PublicLayout>
      <main className="detail-page">
        <div className="page-shell">
          <Link className="back-link" to="/jobs"><span aria-hidden="true">←</span> Back to all jobs</Link>
          {loading && <div className="loading-state" role="status">Loading job details...</div>}
          {error && <div className="empty-state" role="alert"><h2>We couldn’t open this opportunity</h2><p>{error}</p><Link className="button" to="/jobs">Explore all jobs</Link></div>}
          {!loading && !error && job && (
            <div className="detail-layout">
              <article className="detail-main">
                <div className="detail-title-row">
                  <CompanyMark name={job.company_name} />
                  <div>
                    <span className="detail-eyebrow">JOB OPPORTUNITY</span>
                    <h1>{job.title}</h1>
                    <p>{job.company_name}</p>
                  </div>
                </div>
                <div className="detail-job-meta">
                  <span><span aria-hidden="true">⌖</span> {job.location}</span>
                  <span><span aria-hidden="true">◷</span> Posted {new Date(job.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
                  <span className="job-badge">{formatEmploymentType(job.employment_type)}</span>
                </div>
                <section className="detail-section">
                  <h2>About the role</h2>
                  <div className="detail-copy">{job.description}</div>
                </section>
                <section className="detail-section">
                  <h2>About {job.company_name}</h2>
                  <p className="detail-copy">Join a team that believes great work starts with great people. Learn more about this opportunity and connect with {job.company_name} through LinkUp.</p>
                </section>
              </article>
              <aside className="detail-aside">
                <span className="detail-eyebrow">AT A GLANCE</span>
                <h2>Opportunity overview</h2>
                <dl className="aside-meta">
                  <div><dt>Employment type</dt><dd>{formatEmploymentType(job.employment_type)}</dd></div>
                  <div><dt>Location</dt><dd>{job.location}</dd></div>
                  <div><dt>Compensation</dt><dd>{job.salary || "Not specified"}</dd></div>
                  <div><dt>Company</dt><dd>{job.company_name}</dd></div>
                </dl>
                {hasAccessToken && userRole === "job_seeker" && (
                  <button className="button" type="button" onClick={() => window.alert("This feature is still under development. Coming soon!")}>
                    Apply Now <span aria-hidden="true">→</span>
                  </button>
                )}
                {!hasAccessToken && (
                  <>
                    <Link className="button" to="/auth/register">Join LinkUp <span aria-hidden="true">→</span></Link>
                    <p className="auth-note">Start your next connection, or <Link to="/auth/login">sign in</Link> if you’re already on LinkUp.</p>
                  </>
                )}
                {profileError && <p className="auth-note" role="status">{profileError}</p>}
              </aside>
            </div>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default JobDetails;
