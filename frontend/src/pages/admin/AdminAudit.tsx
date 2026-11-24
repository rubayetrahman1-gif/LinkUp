import { useEffect, useState } from "react";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import { formatDateTime } from "../../dateTime";
import {
  getAdminAuditLogs,
  type AdminAuditLogList,
} from "../../services/adminService";

const PAGE_SIZE = 25;

function AdminAudit() {
  const [searchInput, setSearchInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<AdminAuditLogList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getAdminAuditLogs({
          search,
          action,
          ipAddress,
          startAt,
          endAt,
          page,
          pageSize: PAGE_SIZE,
        });
        if (active) setLogs(response);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load audit events.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadLogs();
    return () => {
      active = false;
    };
  }, [action, endAt, ipAddress, page, retryCount, search, startAt]);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setAction(actionInput.trim());
    setIpAddress(ipInput.trim());
    setStartAt(startInput ? new Date(startInput).toISOString() : "");
    setEndAt(endInput ? new Date(endInput).toISOString() : "");
  };

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow"><span className="eyebrow-dot" />ADMIN WORKSPACE</span>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">Review recorded authentication and administrative actions.</p>
          <AdminNavigation />

          <form className="admin-audit-filters" onSubmit={applyFilters}>
            <label className="form-field">
              <span>Search action, target, or IP</span>
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={255} />
            </label>
            <label className="form-field">
              <span>Exact action</span>
              <input value={actionInput} onChange={(event) => setActionInput(event.target.value)} maxLength={100} placeholder="auth.login.failed" />
            </label>
            <label className="form-field">
              <span>IP address</span>
              <input value={ipInput} onChange={(event) => setIpInput(event.target.value)} maxLength={45} />
            </label>
            <label className="form-field">
              <span>From</span>
              <input type="datetime-local" value={startInput} onChange={(event) => setStartInput(event.target.value)} />
            </label>
            <label className="form-field">
              <span>To</span>
              <input type="datetime-local" value={endInput} onChange={(event) => setEndInput(event.target.value)} />
            </label>
            <button className="button" type="submit">Apply filters</button>
          </form>

          {loading && <div className="loading-state" role="status">Loading audit log...</div>}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Audit log unavailable</h2>
              <p>{error}</p>
              <button className="button" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
            </div>
          )}
          {!loading && !error && logs && logs.items.length === 0 && (
            <div className="empty-state">
              <h2>No audit events found</h2>
              <p>Events are recorded from the time audit logging is enabled.</p>
            </div>
          )}
          {!loading && !error && logs && logs.items.length > 0 && (
            <>
              <p className="admin-user-count">{logs.total} event(s) found</p>
              <div className="portal-table-scroll">
                <table className="portal-table admin-audit-table">
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Action</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Target</th>
                      <th scope="col">IP address</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateTime(item.created_at)}</td>
                        <td><code>{item.action}</code></td>
                        <td>{item.actor_name || "System / unauthenticated"}</td>
                        <td>
                          {item.target_user_name || item.target_id || "—"}
                          {item.target_type && <span className="admin-table-subtext">{item.target_type}</span>}
                        </td>
                        <td>{item.ip_address || "Unknown"}</td>
                        <td>
                          <details>
                            <summary>View</summary>
                            <pre className="admin-audit-details">
                              {JSON.stringify(item.details ?? {}, null, 2)}
                            </pre>
                            <span className="admin-table-subtext">{item.user_agent || "User agent not recorded"}</span>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination" aria-label="Audit log pagination">
                <button className="button button-secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {logs.page} of {Math.max(logs.pages, 1)}</span>
                <button className="button button-secondary" type="button" disabled={page >= logs.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminAudit;
