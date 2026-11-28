import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../components/SiteLayout";
import { getMyApplications } from "../../services/applicationService";
import type { ApplicationHistoryItem } from "../../services/applicationService";
import { CompanyMark } from "../../components/JobCard";
import { getStatusPillClass } from "../../components/jobUtils";

function ApplicationHistory() {
  const [applications, setApplications] = useState<ApplicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchApplications = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getMyApplications();
        if (active) setApplications(data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load application history.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchApplications();

    return () => {
      active = false;
    };
  }, []);

  const pendingCount = applications.filter((item) => item.status === "Pending").length;
  const underReviewCount = applications.filter((item) => item.status === "Under Review").length;
  const acceptedCount = applications.filter((item) => item.status === "Accepted").length;

  return (
    <PublicLayout>
      <main className="jobs-page">
        <div className="page-shell">
          <div className="page-header-bar">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Candidate pipeline
              </span>
              <h1 className="page-title">My Applications</h1>
              <p className="page-subtitle">
                Track every position you have applied to and follow status updates from hiring teams.
              </p>
            </div>
            <Link className="button" to="/jobs">
              Browse more jobs <span aria-hidden="true">→</span>
            </Link>
          </div>

          {!loading && !error && applications.length > 0 && (
            <div className="kpi-grid" aria-label="Application summary">
              <article className="kpi-card">
                <span>Total submitted</span>
                <strong>{applications.length}</strong>
              </article>
              <article className="kpi-card">
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </article>
              <article className="kpi-card">
                <span>Under review</span>
                <strong>{underReviewCount}</strong>
              </article>
              <article className="kpi-card">
                <span>Accepted</span>
                <strong>{acceptedCount}</strong>
              </article>
            </div>
          )}

          {loading && (
            <div className="loading-state" role="status">
              Loading applications...
            </div>
          )}

          {error && (
            <div className="empty-state" role="alert">
              <h2>Could not load applications</h2>
              <p>{error}</p>
              <button
                className="button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && applications.length === 0 && (
            <div className="empty-state">
              <h2>No applications yet</h2>
              <p>
                You haven’t applied for any jobs yet. Explore available
                opportunities to get started.
              </p>
              <Link className="button" to="/jobs">
                Find jobs
              </Link>
            </div>
          )}

          {!loading && !error && applications.length > 0 && (
            <div className="job-grid">
              {applications.map((application) => (
                <article className="job-card" key={application.application_id}>
                  <div className="job-card-top">
                    <div className="job-card-identity">
                      <CompanyMark name={application.company_name} />
                      <div>
                        <h2>{application.job_title}</h2>
                        <p className="job-company">{application.company_name}</p>
                      </div>
                    </div>
                    <span className={getStatusPillClass(application.status)}>
                      {application.status}
                    </span>
                  </div>

                  <div className="job-meta">
                    <span className="job-meta-chip">Application #{application.application_id}</span>
                    <span className="job-meta-chip">Job #{application.job_id}</span>
                  </div>

                  <div className="job-card-footer" style={{ marginTop: 18 }}>
                    <span className="salary-muted">Current status: {application.status}</span>
                    <Link
                      className="text-link"
                      to={`/jobs/${application.job_id}`}
                    >
                      View job <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default ApplicationHistory;
