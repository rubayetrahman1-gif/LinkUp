import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../components/SiteLayout";
import {
  getEmployerApplications,
  updateApplicationStatus,
} from "../../services/applicationService";
import type { EmployerApplication } from "../../services/applicationService";

const applicationStatuses = [
  "Pending",
  "Under Review",
  "Accepted",
  "Rejected",
] as const;

function EmployerApplications() {
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    const loadApplications = async () => {
      try {
        const data = await getEmployerApplications();
        if (active) setApplications(data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load applications.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadApplications();
    return () => {
      active = false;
    };
  }, []);

  const handleStatusChange = async (
    application: EmployerApplication,
    nextStatus: EmployerApplication["status"],
  ) => {
    setError("");
    setNotice("");
    setUpdatingId(application.application_id);

    try {
      await updateApplicationStatus(application.application_id, nextStatus);
      setApplications((current) =>
        current.map((item) =>
          item.application_id === application.application_id
            ? { ...item, status: nextStatus }
            : item,
        ),
      );
      setNotice(`Application for ${application.job_title} updated.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update this application.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PublicLayout>
      <main className="jobs-page">
        <div className="page-shell">
          <Link className="back-link" to="/employer/dashboard">
            <span aria-hidden="true">←</span> Back to dashboard
          </Link>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            EMPLOYER WORKSPACE
          </span>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">
            Review candidates who applied to your job postings and update their
            application status.
          </p>

          {error && <p className="status-message" role="alert">{error}</p>}
          {notice && <p className="status-success" role="status">{notice}</p>}
          {loading && (
            <div className="loading-state" role="status">
              Loading applications...
            </div>
          )}
          {!loading && !error && applications.length === 0 && (
            <div className="empty-state">
              <h2>No applications yet</h2>
              <p>Applications for your job postings will appear here.</p>
            </div>
          )}
          {!loading && applications.length > 0 && (
            <div className="portal-table-scroll">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th scope="col">Applicant</th>
                    <th scope="col">Job</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.application_id}>
                      <td>{application.applicant.full_name}</td>
                      <td>
                        <Link to={`/jobs/${application.job_id}`}>
                          {application.job_title}
                        </Link>
                      </td>
                      <td>
                        <a href={`mailto:${application.applicant.email}`}>
                          {application.applicant.email}
                        </a>
                      </td>
                      <td>
                        <label>
                          <select
                            aria-label={`Status for ${application.applicant.full_name}`}
                            value={application.status}
                            disabled={updatingId === application.application_id}
                            onChange={(event) => {
                              const nextStatus = applicationStatuses.find(
                                (status) => status === event.target.value,
                              );
                              if (nextStatus) {
                                void handleStatusChange(application, nextStatus);
                              }
                            }}
                          >
                            {applicationStatuses.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default EmployerApplications;
