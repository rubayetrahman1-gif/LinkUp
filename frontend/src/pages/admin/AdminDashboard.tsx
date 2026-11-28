import { useEffect, useState } from "react";
import { PublicLayout } from "../../components/SiteLayout";
import {
  getAdminTeams,
  getAdminDashboardOverview,
  type AdminDashboardOverview,
  type AdminTeamList,
} from "../../services/adminService";
import { AdminNavigation } from "../../components/AdminNavigation";
import { formatDateTime } from "../../dateTime";
import { getStatusPillClass } from "../../components/jobUtils";

function AdminDashboard() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [teamList, setTeamList] = useState<AdminTeamList | null>(null);
  const [teamsPage, setTeamsPage] = useState(1);
  const [teamsError, setTeamsError] = useState("");
  const [teamsRefreshCount, setTeamsRefreshCount] = useState(0);

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

  useEffect(() => {
    let active = true;
    const loadTeams = async () => {
      setTeamsError("");
      try {
        const data = await getAdminTeams(teamsPage, 20);
        if (active) setTeamList(data);
      } catch (requestError) {
        if (active) {
          setTeamsError(requestError instanceof Error ? requestError.message : "Could not load Teams.");
        }
      }
    };
    void loadTeams();
    return () => { active = false; };
  }, [teamsPage, teamsRefreshCount]);

  const totalApplications = overview?.content.applications ?? 0;

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
              <h1 className="page-title">Admin dashboard</h1>
              <p className="page-subtitle">
                Platform health, user distribution, hiring teams, and recent activity at a glance.
              </p>
            </div>
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
          <AdminNavigation />

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
                    <small>
                      {overview.users.by_role.job_seeker} seekers · {overview.users.by_role.employer} employers · {overview.users.by_role.admin} admins
                    </small>
                  </article>
                  <article className="dashboard-stat">
                    <span>Active accounts</span>
                    <strong>{overview.users.active}</strong>
                    <small>
                      {overview.users.inactive} inactive · {overview.users.banned} banned
                    </small>
                  </article>
                  <article className="dashboard-stat">
                    <span>Job postings</span>
                    <strong>{overview.content.jobs}</strong>
                    <small>+{overview.last_7_days.job_posts} in last 7 days</small>
                  </article>
                  <article className="dashboard-stat">
                    <span>Applications & Teams</span>
                    <strong>{overview.content.applications}</strong>
                    <small>{overview.groups.total ?? 0} active employer teams</small>
                  </article>
                </div>
              </section>

              <div className="admin-dashboard-split">
                <section className="admin-panel" aria-labelledby="weekly-stats-heading">
                  <div className="panel-heading">
                    <h2 id="weekly-stats-heading">Last 7 days growth</h2>
                  </div>
                  <div className="admin-weekly-grid">
                    <article className="kpi-card">
                      <span>New users</span>
                      <strong>{overview.last_7_days.new_users}</strong>
                    </article>
                    <article className="kpi-card">
                      <span>New job postings</span>
                      <strong>{overview.last_7_days.job_posts}</strong>
                    </article>
                  </div>
                  <div className="admin-overview-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 14 }}>
                    <article className="kpi-card">
                      <span>Job seekers</span>
                      <strong>{overview.users.by_role.job_seeker}</strong>
                    </article>
                    <article className="kpi-card">
                      <span>Employers</span>
                      <strong>{overview.users.by_role.employer}</strong>
                    </article>
                    <article className="kpi-card">
                      <span>Admins</span>
                      <strong>{overview.users.by_role.admin}</strong>
                    </article>
                  </div>
                </section>

                <section className="admin-panel" aria-labelledby="content-stats-heading">
                  <div className="panel-heading">
                    <h2 id="content-stats-heading">Applications by status</h2>
                    <span className="portal-count">{totalApplications} total</span>
                  </div>
                  <div className="admin-status-list">
                    {Object.entries(overview.content.applications_by_status).length > 0
                      ? Object.entries(overview.content.applications_by_status).map(
                          ([status, count]) => {
                            const percent = totalApplications > 0
                              ? Math.round((count / totalApplications) * 100)
                              : 0;
                            return (
                              <div className="admin-status-item" key={status}>
                                <div className="admin-status-item-top">
                                  <span className={getStatusPillClass(status)}>{status}</span>
                                  <strong>{count}</strong>
                                </div>
                                <div className="status-bar-track" aria-hidden="true">
                                  <div className="status-bar-fill" style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            );
                          },
                        )
                      : <p className="admin-muted">No applications have been submitted.</p>}
                  </div>
                </section>
              </div>

              <section className="admin-dashboard-section admin-panel" aria-labelledby="group-information-heading">
                <div className="panel-heading admin-group-heading">
                  <h2 id="group-information-heading">Group Management</h2>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setTeamsRefreshCount((count) => count + 1)}
                  >
                    Refresh group data
                  </button>
                </div>
                {teamsError && <p className="status-message" role="alert">{teamsError}</p>}
                {!teamList && !teamsError && (
                  <div className="loading-state" role="status">Loading group information...</div>
                )}
                {teamList && (
                  <>
                    <div className="admin-overview-grid admin-group-stats">
                      <article className="dashboard-stat"><span>Total groups</span><strong>{teamList.summary.groups_total}</strong></article>
                      <article className="dashboard-stat"><span>Active groups</span><strong>{teamList.summary.active_groups}</strong><small>{teamList.summary.archived_groups} archived</small></article>
                      <article className="dashboard-stat"><span>Memberships</span><strong>{teamList.summary.members_total}</strong></article>
                      <article className="dashboard-stat"><span>Team jobs</span><strong>{teamList.summary.team_jobs_total}</strong><small>{teamList.summary.team_applications_total} applications</small></article>
                    </div>
                    {teamList.items.length > 0 ? (
                      <div className="admin-team-list">
                        {teamList.items.map((team) => (
                          <article className="admin-team-card" key={team.id}>
                            <div className="admin-team-card-heading">
                              <div>
                                <h3>{team.name}</h3>
                                <span>Group #{team.id} · Created {formatDateTime(team.created_at)}</span>
                                <span>Owner: {team.owner.full_name} · {team.owner.email}</span>
                              </div>
                              <span className={team.is_archived ? "status-pill status-pill-danger" : "status-pill status-pill-success"}>
                                {team.is_archived ? "Archived" : `${team.members.length} members`}
                              </span>
                            </div>
                            <p>{team.job_count} jobs · {team.application_count} applications</p>
                            <ul>
                              {team.members.map((member) => (
                                <li key={member.user_id}>
                                  <span>
                                    <strong>{member.full_name}</strong>{" "}
                                    <span className={getStatusPillClass(member.role)} style={{ marginLeft: 6 }}>{member.role}</span>{" "}
                                    <small>· joined {formatDateTime(member.joined_at)}</small>
                                  </span>
                                  <a href={`mailto:${member.email}`}>{member.email}</a>
                                </li>
                              ))}
                            </ul>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-muted">No groups have been created.</p>
                    )}
                    {teamList.pages > 1 && (
                      <div className="admin-pagination" aria-label="Group pages">
                        <button className="button button-secondary" type="button" disabled={teamsPage <= 1} onClick={() => setTeamsPage((page) => page - 1)}>Previous</button>
                        <span>Page {teamList.page} of {teamList.pages}</span>
                        <button className="button button-secondary" type="button" disabled={teamsPage >= teamList.pages} onClick={() => setTeamsPage((page) => page + 1)}>Next</button>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="admin-dashboard-section admin-panel" aria-labelledby="recent-activity-heading">
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
