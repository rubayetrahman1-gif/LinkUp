import { useEffect, useState } from "react";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import { formatDateTime } from "../../dateTime";
import {
  getAdminSecurityOverview,
  type AdminSecurityOverview,
} from "../../services/adminService";

function AdminSecurity() {
  const [sinceHours, setSinceHours] = useState(24);
  const [overview, setOverview] = useState<AdminSecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getAdminSecurityOverview(sinceHours);
        if (active) setOverview(response);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load security activity.",
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
  }, [retryCount, sinceHours]);

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow"><span className="eyebrow-dot" />ADMIN WORKSPACE</span>
          <h1 className="page-title">Security monitoring</h1>
          <p className="page-subtitle">Review failed sign-ins grouped by source and account.</p>
          <AdminNavigation />

          <label className="admin-time-range">
            <span>Activity window</span>
            <select
              value={sinceHours}
              onChange={(event) => setSinceHours(Number(event.target.value))}
            >
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last 7 days</option>
              <option value={720}>Last 30 days</option>
            </select>
          </label>

          {loading && <div className="loading-state" role="status">Loading security events...</div>}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Security events unavailable</h2>
              <p>{error}</p>
              <button className="button" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
            </div>
          )}
          {!loading && !error && overview && (
            <>
              <section className="admin-dashboard-section" aria-labelledby="security-summary-heading">
                <div className="panel-heading"><h2 id="security-summary-heading">Sign-in attempts</h2></div>
                <div className="admin-overview-grid">
                  <article className="dashboard-stat">
                    <span>Failed or blocked logins</span>
                    <strong>{overview.failed_login_total}</strong>
                  </article>
                  <article className="dashboard-stat">
                    <span>Window</span>
                    <strong>{overview.since_hours}h</strong>
                  </article>
                </div>
              </section>

              <section className="admin-security-columns">
                <div className="admin-detail-section">
                  <div className="panel-heading"><h2>Attempts by IP</h2></div>
                  {overview.by_ip.length ? (
                    <ul className="admin-security-list">
                      {overview.by_ip.map((item) => (
                        <li key={item.ip_address}>
                          <span>{item.ip_address}</span><strong>{item.attempt_count}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="admin-muted">No failed login activity in this window.</p>}
                </div>
                <div className="admin-detail-section">
                  <div className="panel-heading"><h2>Attempts by account</h2></div>
                  {overview.by_account.length ? (
                    <ul className="admin-security-list">
                      {overview.by_account.map((item) => (
                        <li key={item.account}>
                          <span>{item.account}</span><strong>{item.attempt_count}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="admin-muted">No account attempts in this window.</p>}
                </div>
              </section>

              <section className="admin-dashboard-section">
                <div className="panel-heading"><h2>Recent security events</h2></div>
                {overview.recent_events.length ? (
                  <ul className="admin-activity-list">
                    {overview.recent_events.map((event) => (
                      <li key={event.id}>
                        <div>
                          <strong>{event.action}</strong>
                          <span className="admin-table-subtext">
                            {event.target_id || "Unknown account"} · {event.ip_address || "Unknown IP"}
                            {event.details?.reason ? ` · ${String(event.details.reason)}` : ""}
                          </span>
                        </div>
                        <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : <p className="admin-muted">No recent security events.</p>}
              </section>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminSecurity;
