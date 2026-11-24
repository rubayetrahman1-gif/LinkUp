import { useState } from "react";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import { exportAdminCsv } from "../../services/adminService";

type ExportType = "users" | "jobs" | "applications" | "audit";

function AdminExports() {
  const [exportType, setExportType] = useState<ExportType>("users");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [action, setAction] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const downloadExport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const params = new URLSearchParams();
    let endpoint: string;
    let filename: string;
    if (exportType === "users") {
      endpoint = "/api/admin/exports/users.csv";
      filename = "linkup-users.csv";
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);
    } else if (exportType === "jobs" || exportType === "applications") {
      endpoint = "/api/admin/exports/content.csv";
      filename = `linkup-${exportType}.csv`;
      params.set("content_type", exportType);
      if (search.trim()) params.set("search", search.trim());
      if (exportType === "applications" && status) {
        params.set("application_status", status);
      }
    } else {
      endpoint = "/api/admin/exports/audit.csv";
      filename = "linkup-audit-logs.csv";
      if (search.trim()) params.set("search", search.trim());
      if (action.trim()) params.set("action", action.trim());
      if (startAt) params.set("start_at", new Date(startAt).toISOString());
      if (endAt) params.set("end_at", new Date(endAt).toISOString());
    }

    try {
      const query = params.toString();
      const csv = await exportAdminCsv(query ? `${endpoint}?${query}` : endpoint);
      const objectUrl = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setSuccess(`Downloaded ${filename}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not export the selected data.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow"><span className="eyebrow-dot" />ADMIN WORKSPACE</span>
          <h1 className="page-title">Data exports</h1>
          <p className="page-subtitle">Download filtered user, content, or audit data as CSV.</p>
          <AdminNavigation />

          <form className="admin-export-form" onSubmit={(event) => void downloadExport(event)}>
            <label className="form-field">
              <span>Export data</span>
              <select
                value={exportType}
                onChange={(event) => {
                  setExportType(event.target.value as ExportType);
                  setStatus("");
                }}
              >
                <option value="users">Users</option>
                <option value="jobs">Job postings</option>
                <option value="applications">Applications</option>
                <option value="audit">Audit logs</option>
              </select>
            </label>
            <label className="form-field">
              <span>Search filter</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={255}
                placeholder="Name, email, title, or target"
              />
            </label>
            {exportType === "users" && (
              <>
                <label className="form-field">
                  <span>User role</span>
                  <select value={role} onChange={(event) => setRole(event.target.value)}>
                    <option value="">All roles</option>
                    <option value="job_seeker">Job seeker</option>
                    <option value="employer">Employer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Account status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="banned">Banned</option>
                  </select>
                </label>
              </>
            )}
            {exportType === "applications" && (
              <label className="form-field">
                <span>Application status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>
            )}
            {exportType === "audit" && (
              <>
                <label className="form-field">
                  <span>Exact action</span>
                  <input value={action} onChange={(event) => setAction(event.target.value)} maxLength={100} />
                </label>
                <label className="form-field">
                  <span>From</span>
                  <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                </label>
                <label className="form-field">
                  <span>To</span>
                  <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                </label>
              </>
            )}
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Preparing CSV..." : "Download CSV"}
            </button>
          </form>

          {error && <div className="empty-state" role="alert">{error}</div>}
          {success && <div className="admin-action-success" role="status">{success}</div>}
          <p className="admin-muted admin-export-note">
            Passwords, password hashes, access tokens, and refresh tokens are never included.
            Each completed export is recorded in the audit log.
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminExports;
