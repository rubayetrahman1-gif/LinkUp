import { useEffect, useState } from "react";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import { formatDateTime } from "../../dateTime";
import { getStatusPillClass } from "../../components/jobUtils";
import {
  bulkDeleteAdminContent,
  deleteAdminContent,
  getAdminContent,
  type AdminApplicationStatus,
  type AdminContentList,
  type AdminContentType,
} from "../../services/adminService";

const PAGE_SIZE = 10;

function AdminContent() {
  const [contentType, setContentType] = useState<AdminContentType>("jobs");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<
    AdminApplicationStatus | ""
  >("");
  const [page, setPage] = useState(1);
  const [content, setContent] = useState<AdminContentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadContent = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getAdminContent({
          contentType,
          search,
          applicationStatus: applicationStatus || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (active) setContent(response);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load platform content.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadContent();

    return () => {
      active = false;
    };
  }, [applicationStatus, contentType, page, retryCount, search]);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedIds([]);
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeContentType = (value: AdminContentType) => {
    setSelectedIds([]);
    setApplicationStatus("");
    setContentType(value);
    setPage(1);
  };

  const performDelete = async (recordIds: number[]) => {
    setActionLoading(true);
    setActionError("");
    setSuccess("");
    try {
      const singleId = recordIds.length === 1 ? recordIds[0] : undefined;
      const result = singleId !== undefined
        ? await deleteAdminContent(contentType, singleId)
        : await bulkDeleteAdminContent({
            content_type: contentType,
            record_ids: recordIds,
          });
      setSuccess(`${result.deleted_count} record(s) removed.`);
      setSelectedIds([]);
      setRetryCount((count) => count + 1);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not remove the selected content.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmAndDelete = (recordId: number) => {
    const label = contentType === "jobs" ? "job posting" : "application";
    if (window.confirm(`Permanently remove this ${label}?`)) {
      void performDelete([recordId]);
    }
  };

  const selectableIds = content?.items.map((item) => item.id) ?? [];
  const allSelected = selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <div className="admin-dashboard-heading">
            <div>
              <span className="eyebrow"><span className="eyebrow-dot" />ADMIN WORKSPACE</span>
              <h1 className="page-title">Content moderation</h1>
              <p className="page-subtitle">Review, filter, and moderate job postings and submitted applications.</p>
            </div>
            {content && (
              <span className="portal-count">{content.total} record(s) found</span>
            )}
          </div>
          <AdminNavigation />

          <form className="admin-user-filters" onSubmit={applyFilters}>
            <label className="form-field">
              <span>Content type</span>
              <select
                value={contentType}
                onChange={(event) => changeContentType(event.target.value as AdminContentType)}
              >
                <option value="jobs">Job postings</option>
                <option value="applications">Applications</option>
              </select>
            </label>
            <label className="form-field">
              <span>Search content</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Title, company, owner"
                maxLength={255}
              />
            </label>
            {contentType === "applications" && (
              <label className="form-field">
                <span>Application status</span>
                <select
                  value={applicationStatus}
                  onChange={(event) => {
                    setSelectedIds([]);
                    setApplicationStatus(
                      event.target.value as AdminApplicationStatus | "",
                    );
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>
            )}
            <button className="button" type="submit">Search</button>
          </form>

          {actionError && <div className="status-message" role="alert">{actionError}</div>}
          {success && <div className="admin-action-success" role="status">{success}</div>}
          {loading && <div className="loading-state" role="status">Loading content...</div>}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Content unavailable</h2>
              <p>{error}</p>
              <button className="button" type="button" onClick={() => setRetryCount((n) => n + 1)}>
                Try again
              </button>
            </div>
          )}
          {!loading && !error && content && content.items.length === 0 && (
            <div className="empty-state">
              <h2>No records match these filters</h2>
              <p>Try a different search term or status.</p>
            </div>
          )}
          {!loading && !error && content && content.items.length > 0 && (
            <>
              <div className="admin-bulk-actions">
                <label className="admin-selection-label">
                  <input
                    type="checkbox"
                    aria-label="Select all records on this page"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? selectableIds : [])
                    }
                  />
                  <span>{selectedIds.length} selected</span>
                </label>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={!selectedIds.length || actionLoading}
                  onClick={() => {
                    if (window.confirm(`Permanently remove ${selectedIds.length} selected record(s)?`)) {
                      void performDelete(selectedIds);
                    }
                  }}
                >
                  {actionLoading ? "Removing..." : "Remove selected"}
                </button>
              </div>
              <div className="admin-table-card">
                <div className="portal-table-scroll">
                  <table className="portal-table admin-moderation-table">
                    <thead>
                      <tr>
                        <th scope="col">Select</th>
                        <th scope="col">Record</th>
                        <th scope="col">Owner / applicant</th>
                        <th scope="col">Status</th>
                        <th scope="col">Created</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.title} ${item.id}`}
                              checked={selectedIds.includes(item.id)}
                              disabled={actionLoading}
                              onChange={() =>
                                setSelectedIds((ids) =>
                                  ids.includes(item.id)
                                    ? ids.filter((id) => id !== item.id)
                                    : [...ids, item.id],
                                )
                              }
                            />
                          </td>
                          <td>
                            <strong>{item.title}</strong>
                            <span className="admin-table-subtext">{item.summary}</span>
                          </td>
                          <td>
                            <strong>{item.owner_name}</strong>
                            <span className="admin-table-subtext">{item.owner_email}</span>
                          </td>
                          <td>
                            {item.status ? (
                              <span className={getStatusPillClass(item.status)}>{item.status}</span>
                            ) : (
                              <span className="status-pill status-pill-info">Published</span>
                            )}
                          </td>
                          <td>
                            {item.created_at
                              ? formatDateTime(item.created_at)
                              : "Time not tracked"}
                          </td>
                          <td>
                            <button
                              className="portal-action portal-delete"
                              type="button"
                              disabled={actionLoading}
                              onClick={() => confirmAndDelete(item.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="admin-pagination" aria-label="Content pagination">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setSelectedIds([]);
                    setPage((current) => current - 1);
                  }}
                >
                  Previous
                </button>
                <span>Page {content.page} of {Math.max(content.pages, 1)}</span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page >= content.pages || loading}
                  onClick={() => {
                    setSelectedIds([]);
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default AdminContent;
