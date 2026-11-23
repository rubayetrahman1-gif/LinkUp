import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import {
  getAdminUserDetails,
  type AdminUserDetails as AdminUserDetailsData,
} from "../../services/adminService";

function AdminUserDetails() {
  const { id } = useParams<{ id: string }>();
  const [details, setDetails] = useState<AdminUserDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDetails = async () => {
      if (!id || !/^[1-9]\d*$/.test(id)) {
        setError("This user link is invalid.");
        setLoading(false);
        return;
      }

      try {
        const data = await getAdminUserDetails(Number(id));
        if (active) setDetails(data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load this user's details.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDetails();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            ADMIN WORKSPACE
          </span>
          <h1 className="page-title">User details</h1>
          <AdminNavigation />
          <Link className="back-link" to="/admin/users">
            <span aria-hidden="true">←</span> Back to users
          </Link>

          {loading && (
            <div className="loading-state" role="status">
              Loading account details...
            </div>
          )}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Account details unavailable</h2>
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && details && (
            <>
              <section className="admin-detail-section" aria-labelledby="account-details-heading">
                <div className="panel-heading">
                  <h2 id="account-details-heading">Account information</h2>
                </div>
                <dl className="admin-detail-grid">
                  <div><dt>Name</dt><dd>{details.user.full_name}</dd></div>
                  <div><dt>Email</dt><dd>{details.user.email}</dd></div>
                  <div><dt>Role</dt><dd>{details.user.role.replaceAll("_", " ")}</dd></div>
                  <div><dt>Status</dt><dd>{details.user.is_active ? "Active" : "Inactive"}</dd></div>
                  <div><dt>Joined</dt><dd>{new Date(details.user.created_at).toLocaleString()}</dd></div>
                  <div>
                    <dt>Login lock</dt>
                    <dd>
                      {details.user.locked_until
                        ? new Date(details.user.locked_until).toLocaleString()
                        : "Not locked"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="admin-detail-section" aria-labelledby="account-activity-heading">
                <div className="panel-heading">
                  <h2 id="account-activity-heading">Account activity</h2>
                </div>
                {details.activity.length > 0 ? (
                  <ul className="admin-activity-list">
                    {details.activity.map((activity) => (
                      <li key={activity.id}>
                        <span>{activity.description}</span>
                        <time dateTime={activity.occurred_at ?? undefined}>
                          {activity.occurred_at
                            ? new Date(activity.occurred_at).toLocaleString()
                            : "Time not tracked"}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-muted">No account activity is available.</p>
                )}
              </section>

              <section className="admin-detail-section" aria-labelledby="user-sessions-heading">
                <div className="panel-heading">
                  <h2 id="user-sessions-heading">Sessions</h2>
                </div>
                {details.sessions.length > 0 ? (
                  <div className="portal-table-scroll">
                    <table className="portal-table admin-users-table">
                      <thead>
                        <tr>
                          <th scope="col">Device</th>
                          <th scope="col">Started</th>
                          <th scope="col">Last used</th>
                          <th scope="col">Expires</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>{session.user_agent || "Unknown device"}</td>
                            <td>{new Date(session.created_at).toLocaleString()}</td>
                            <td>
                              {session.last_used_at
                                ? new Date(session.last_used_at).toLocaleString()
                                : "Not used"}
                            </td>
                            <td>{new Date(session.expires_at).toLocaleString()}</td>
                            <td>{session.is_active ? "Active" : "Revoked/expired"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-muted">No sessions are recorded.</p>
                )}
              </section>

              <section className="admin-detail-section" aria-labelledby="group-memberships-heading">
                <div className="panel-heading">
                  <h2 id="group-memberships-heading">Group memberships</h2>
                </div>
                <p className="admin-muted">
                  {details.groups.available
                    ? details.groups.memberships.length > 0
                      ? details.groups.memberships.map((group) => group.name).join(", ")
                      : "No group memberships."
                    : "Groups/Teams are not implemented yet."}
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminUserDetails;
