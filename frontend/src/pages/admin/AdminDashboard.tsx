import { useEffect, useState } from "react";
import { PublicLayout } from "../../components/SiteLayout";
import {
  getAdminDashboardOverview,
  type AdminDashboardOverview,
} from "../../services/adminService";
import { AdminNavigation } from "../../components/AdminNavigation";
import { formatDateTime } from "../../dateTime";

function AdminDashboard() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getAdminDashboardOverview();
        if (active) setOverview(data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load dashboard statistics.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOverview();
    return () => {
      active = false;
    };
  }, [retryCount]);

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            ADMIN WORKSPACE
          </span>
          <div className="admin-dashboard-heading">
            <div>
              <h1 className="page-title">Admin dashboard</h1>
              <p className="page-subtitle">
                Platform health and recent activity at a glance.
              </p>
            </div>
            <AdminNavigation />
            {overview && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Refresh overview
              </button>
            )}
          </div>

          {loading && (
            <div className="loading-state" role="status">
              Loading platform statistics...
            </div>
          )}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Dashboard statistics unavailable</h2>
              <p>{error}</p>
              <button
                className="button"
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && overview && (
            <>
              <section aria-labelledby="platform-stats-heading">
                <div className="panel-heading">
                  <h2 id="platform-stats-heading">Platform overview</h2>
                </div>
                <div className="admin-overview-grid">
                  <article className="dashboard-stat">
                    <span>Total users</span>
                    <strong>{overview.users.total}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Active accounts</span>
                    <strong>{overview.users.active}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Inactive accounts</span>
                    <strong>{overview.users.inactive}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Banned accounts</span>
                    <strong>{overview.users.banned}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Job seekers</span>
                    <strong>{overview.users.by_role.job_seeker}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Employers</span>
                    <strong>{overview.users.by_role.employer}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Administrators</span>
                    <strong>{overview.users.by_role.admin}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Job postings</span>
                    <strong>{overview.content.jobs}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Applications</span>
                    <strong>{overview.content.applications}</strong>
                  </article>
                </div>
              </section>

              <section className="admin-dashboard-section" aria-labelledby="weekly-stats-heading">
                <div className="panel-heading">
                  <h2 id="weekly-stats-heading">Last 7 days</h2>
                </div>
                <div className="admin-weekly-grid">
                  <article className="dashboard-stat">
                    <span>New users</span>
                    <strong>{overview.last_7_days.new_users}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>New job postings</span>
                    <strong>{overview.last_7_days.job_posts}</strong>
                  </article>
                </div>
              </section>

              <section className="admin-dashboard-section" aria-labelledby="content-stats-heading">
                <div className="panel-heading">
                  <h2 id="content-stats-heading">Applications by status</h2>
                </div>
                <div className="admin-status-list">
                  {Object.entries(overview.content.applications_by_status).length > 0
                    ? Object.entries(overview.content.applications_by_status).map(
                        ([status, count]) => (
                          <div className="admin-status-item" key={status}>
                            <span>{status}</span>
                            <strong>{count}</strong>
                          </div>
                        ),
                      )
                    : <p className="admin-muted">No applications have been submitted.</p>}
                </div>
                <div className="admin-groups-note" role="note">
                  {overview.groups.available
                    ? `Groups: ${overview.groups.total ?? 0}`
                    : "Group statistics are unavailable because Groups/Teams are not implemented yet."}
                </div>
              </section>

              <section className="admin-dashboard-section" aria-labelledby="recent-activity-heading">
                <div className="panel-heading">
                  <h2 id="recent-activity-heading">Recent platform activity</h2>
                </div>
                {overview.recent_activity.length > 0 ? (
                  <ul className="admin-activity-list">
                    {overview.recent_activity.map((activity) => (
                      <li key={activity.id}>
                        <div className="admin-activity-description">
                          <span className="admin-activity-type">
                            {activity.type === "user_registered"
                              ? "Account"
                              : activity.type === "job_posted"
                                ? "Job"
                                : "Audit"}
                          </span>
                          <span>
                            <strong>{activity.actor}</strong> {activity.action}{" "}
                            <strong>{activity.target}</strong>
                          </span>
                        </div>
                        <time dateTime={activity.occurred_at}>
                          {formatDateTime(activity.occurred_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-muted">No recent platform activity.</p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminDashboard;
