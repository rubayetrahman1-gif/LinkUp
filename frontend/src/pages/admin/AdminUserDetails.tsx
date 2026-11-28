import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../dateTime";
import { getStatusPillClass } from "../../components/jobUtils";
import {
  banAdminUser,
  getAdminUserDetails,
  revokeAdminUserSession,
  unbanAdminUser,
  updateAdminUserRole,
  type AdminRole,
  type AdminUserDetails as AdminUserDetailsData,
} from "../../services/adminService";

const ADMIN_ROLES: AdminRole[] = ["job_seeker", "employer", "admin"];

function AdminUserDetails() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [details, setDetails] = useState<AdminUserDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole>("job_seeker");
  const [pendingAction, setPendingAction] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadDetails = async () => {
      setLoading(true);
      setError("");
      if (!id || !/^[1-9]\d*$/.test(id)) {
        setError("This user link is invalid.");
        setLoading(false);
        return;
      }

      try {
        const data = await getAdminUserDetails(Number(id));
        if (active) {
          setDetails(data);
          setSelectedRole(data.user.role);
        }
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
  }, [id, reloadCount]);

  const runAction = async (
    action: string,
    operation: () => Promise<void>,
    message: string,
  ) => {
    setPendingAction(action);
    setActionError("");
    setSuccess("");
    try {
      await operation();
      setSuccess(message);
      setReloadCount((count) => count + 1);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "The requested account action failed.",
      );
    } finally {
      setPendingAction("");
    }
  };

  const accountStatus = details
    ? details.user.is_banned
      ? "Banned"
      : details.user.is_active
        ? "Active"
        : "Inactive"
    : "";

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <div className="admin-dashboard-heading">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                ADMIN WORKSPACE
              </span>
              <h1 className="page-title">
                {details ? details.user.full_name : "User details"}
              </h1>
              <p className="page-subtitle">
                {details ? details.user.email : "Inspect account status, role controls, sessions, and activity."}
              </p>
            </div>
            {details && (
              <span className={getStatusPillClass(accountStatus)}>
                {accountStatus}
              </span>
            )}
          </div>
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
              {(actionError || success) && (
                <div className={actionError ? "status-message" : "admin-action-success"} role={actionError ? "alert" : "status"}>
                  {actionError || success}
                </div>
              )}
              <section className="admin-detail-section" aria-labelledby="account-details-heading">
                <div className="panel-heading">
                  <h2 id="account-details-heading">Account information</h2>
                  <span className="portal-type">{details.user.role.replaceAll("_", " ")}</span>
                </div>
                <dl className="admin-detail-grid">
                  <div><dt>Name</dt><dd>{details.user.full_name}</dd></div>
                  <div><dt>Email</dt><dd>{details.user.email}</dd></div>
                  <div><dt>Role</dt><dd>{details.user.role.replaceAll("_", " ")}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={getStatusPillClass(accountStatus)}>{accountStatus}</span>
                    </dd>
                  </div>
                  {details.user.is_banned && (
                    <>
                      <div><dt>Ban reason</dt><dd>{details.user.ban_reason || "Not recorded"}</dd></div>
                      <div>
                        <dt>Banned at</dt>
                        <dd>
                          {details.user.banned_at
                            ? formatDateTime(details.user.banned_at)
                            : "Not recorded"}
                        </dd>
                      </div>
                    </>
                  )}
                  <div><dt>Joined</dt><dd>{formatDateTime(details.user.created_at)}</dd></div>
                  <div>
                    <dt>Login lock</dt>
                    <dd>
                      {details.user.locked_until
                        ? formatDateTime(details.user.locked_until)
                        : "Not locked"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="admin-detail-section" aria-labelledby="user-administration-heading">
                <div className="panel-heading">
                  <h2 id="user-administration-heading">User administration</h2>
                </div>
                <div className="admin-user-actions">
                  <form
                    className="admin-action-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runAction(
                        "role",
                        () => updateAdminUserRole(details.user.id, selectedRole),
                        "User role updated.",
                      );
                    }}
                  >
                    <label className="form-field">
                      <span>Account role</span>
                      <select
                        value={selectedRole}
                        onChange={(event) => setSelectedRole(event.target.value as AdminRole)}
                        disabled={pendingAction !== "" || currentUser?.id === details.user.id}
                      >
                        {ADMIN_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button"
                      type="submit"
                      disabled={
                        pendingAction !== "" ||
                        selectedRole === details.user.role ||
                        currentUser?.id === details.user.id
                      }
                    >
                      Update role
                    </button>
                  </form>

                  {details.user.is_banned ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={pendingAction !== ""}
                      onClick={() =>
                        void runAction(
                          "unban",
                          () => unbanAdminUser(details.user.id),
                          "User unbanned.",
                        )
                      }
                    >
                      {pendingAction === "unban" ? "Unbanning..." : "Unban user"}
                    </button>
                  ) : (
                    <form
                      className="admin-action-form admin-ban-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void runAction(
                          "ban",
                          () => banAdminUser(details.user.id, banReason),
                          "User banned and active sessions revoked.",
                        );
                      }}
                    >
                      <label className="form-field">
                        <span>Ban reason (required)</span>
                        <input
                          value={banReason}
                          onChange={(event) => setBanReason(event.target.value)}
                          minLength={5}
                          maxLength={500}
                          required
                          disabled={pendingAction !== "" || currentUser?.id === details.user.id}
                        />
                      </label>
                      <button
                        className="button button-danger"
                        type="submit"
                        disabled={
                          pendingAction !== "" ||
                          banReason.trim().length < 5 ||
                          currentUser?.id === details.user.id
                        }
                      >
                        {pendingAction === "ban" ? "Banning..." : "Ban user"}
                      </button>
                    </form>
                  )}
                  {currentUser?.id === details.user.id && (
                    <p className="admin-muted">You cannot change your own role or ban your own account.</p>
                  )}
                </div>
              </section>

              <section className="admin-detail-section" aria-labelledby="user-sessions-heading">
                <div className="panel-heading">
                  <h2 id="user-sessions-heading">Sessions</h2>
                  <span className="portal-count">
                    {details.sessions.filter((session) => session.is_active).length} active
                  </span>
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
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>{session.user_agent || "Unknown device"}</td>
                            <td>{formatDateTime(session.created_at)}</td>
                            <td>
                              {session.last_used_at
                                ? formatDateTime(session.last_used_at)
                                : "Not used"}
                            </td>
                            <td>{formatDateTime(session.expires_at)}</td>
                            <td>
                              <span className={session.is_active ? "status-pill status-pill-success" : "status-pill status-pill-neutral"}>
                                {session.is_active ? "Active" : "Revoked/expired"}
                              </span>
                            </td>
                            <td>
                              {session.is_active && (
                                <button
                                  className="portal-action portal-delete"
                                  type="button"
                                  disabled={pendingAction !== ""}
                                  onClick={() =>
                                    void runAction(
                                      `session-${session.id}`,
                                      () => revokeAdminUserSession(details.user.id, session.id),
                                      "Session revoked.",
                                    )
                                  }
                                >
                                  {pendingAction === `session-${session.id}` ? "Revoking..." : "Revoke"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-muted">No sessions are recorded.</p>
                )}
              </section>

              <div className="admin-dashboard-split">
                <section className="admin-detail-section" style={{ marginTop: 0 }} aria-labelledby="account-activity-heading">
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
                              ? formatDateTime(activity.occurred_at)
                              : "Time not tracked"}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-muted">No account activity is available.</p>
                  )}
                </section>

                <section className="admin-detail-section" style={{ marginTop: 0 }} aria-labelledby="group-memberships-heading">
                  <div className="panel-heading">
                    <h2 id="group-memberships-heading">Group memberships</h2>
                  </div>
                  <p className="admin-muted">
                    {details.groups.available
                      ? details.groups.memberships.length > 0
                        ? details.groups.memberships.map((group) => `${group.name} (${group.role})`).join(", ")
                        : "No group memberships."
                      : "Team membership information is unavailable."}
                  </p>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminUserDetails;
