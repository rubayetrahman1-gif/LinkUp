import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../components/SiteLayout";
import { getMyApplications } from "../../services/applicationService";
import type { ApplicationHistoryItem } from "../../services/applicationService";
import { CompanyMark } from "../../components/JobCard";

function ApplicationHistory() {
  const [applications, setApplications] = useState<ApplicationHistoryItem[]>(
    [],
  );
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

  return (
    <PublicLayout>
      <main className="jobs-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Your activity
          </span>

          <h1 className="page-title">My Applications</h1>

          <p className="page-subtitle">
            Keep track of the jobs you have applied for and check your
            application status.
          </p>

          <div className="section-heading" style={{ marginTop: 36 }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Application History</h2>
              <p>
                {loading
                  ? "Loading your applications..."
                  : `${applications.length} ${
                      applications.length === 1 ? "application" : "applications"
                    } submitted`}
              </p>
            </div>
          </div>

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
                You haven't applied for any jobs yet. Explore available
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
                    <CompanyMark name={application.company_name} />
                    <span className="job-badge">{application.status}</span>
                  </div>

                  <h2>{application.job_title}</h2>

                  <p className="job-company">{application.company_name}</p>

                  <div className="job-card-footer">
                    <span className="salary">Applied successfully</span>

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
