import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminNavigation } from "../../components/AdminNavigation";
import { PublicLayout } from "../../components/SiteLayout";
import {
  getAdminUsers,
  type AdminRole,
  type AdminUserList,
  type AdminUserStatus,
} from "../../services/adminService";

const PAGE_SIZE = 10;

function AdminUsers() {
  const [users, setUsers] = useState<AdminUserList | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminRole | "">("");
  const [status, setStatus] = useState<AdminUserStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getAdminUsers({
          search,
          role: role || undefined,
          status: status || undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        if (active) setUsers(data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load users.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, [page, retryCount, role, search, status]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeRole = (value: string) => {
    setRole(value as AdminRole | "");
    setPage(1);
  };

  const changeStatus = (value: string) => {
    setStatus(value as AdminUserStatus | "");
    setPage(1);
  };

  return (
    <PublicLayout>
      <main className="dashboard-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            ADMIN WORKSPACE
          </span>
          <h1 className="page-title">User management</h1>
          <p className="page-subtitle">
            Search and review registered LinkUp accounts.
          </p>
          <AdminNavigation />

          <form className="admin-user-filters" onSubmit={submitSearch}>
            <label className="form-field">
              <span>Search users</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name or email"
                maxLength={255}
              />
            </label>
            <label className="form-field">
              <span>Role</span>
              <select value={role} onChange={(event) => changeRole(event.target.value)}>
                <option value="">All roles</option>
                <option value="job_seeker">Job seeker</option>
                <option value="employer">Employer</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="form-field">
              <span>Account status</span>
              <select value={status} onChange={(event) => changeStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <button className="button" type="submit">Search</button>
          </form>

          {loading && (
            <div className="loading-state" role="status">Loading users...</div>
          )}
          {error && (
            <div className="empty-state" role="alert">
              <h2>Users unavailable</h2>
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
          {!loading && !error && users && users.items.length === 0 && (
            <div className="empty-state">
              <h2>No users match these filters</h2>
              <p>Try a different search term, role, or status.</p>
            </div>
          )}
          {!loading && !error && users && users.items.length > 0 && (
            <>
              <p className="admin-user-count" role="status">
                {users.total} {users.total === 1 ? "user" : "users"} found
              </p>
              <div className="portal-table-scroll">
                <table className="portal-table admin-users-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <Link to={`/admin/users/${user.id}`}>
                            {user.full_name}
                          </Link>
                        </td>
                        <td>{user.email}</td>
                        <td>{user.role.replaceAll("_", " ")}</td>
                        <td>{user.is_active ? "Active" : "Inactive"}</td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination" aria-label="User list pagination">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>Page {users.page} of {Math.max(users.pages, 1)}</span>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={page >= users.pages || loading}
                  onClick={() => setPage((current) => current + 1)}
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

export default AdminUsers;
