import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { User } from "../types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: User["role"][];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading, error, refreshUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-state" role="status">Verifying your session...</div>;
  }

  if (error && !user) {
    return (
      <main className="form-page">
        <div className="page-shell">
          <div className="empty-state" role="alert">
            <h1>We couldn’t verify your session</h1>
            <p>{error}</p>
            <button
              className="button"
              type="button"
              onClick={() => void refreshUser().catch(() => undefined)}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
