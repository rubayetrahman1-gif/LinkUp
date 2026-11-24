import { NavLink } from "react-router-dom";

export function AdminNavigation() {
  return (
    <nav className="admin-section-nav" aria-label="Admin dashboard sections">
      <NavLink to="/admin" end>
        Overview
      </NavLink>
      <NavLink to="/admin/users">
        Users
      </NavLink>
      <NavLink to="/admin/content">
        Content
      </NavLink>
      <NavLink to="/admin/security">
        Security
      </NavLink>
      <NavLink to="/admin/audit">
        Audit log
      </NavLink>
      <NavLink to="/admin/exports">
        Exports
      </NavLink>
    </nav>
  );
}
