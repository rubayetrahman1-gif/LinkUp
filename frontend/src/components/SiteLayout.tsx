import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../services/authService";
import type { User } from "../types/auth";
import { useAuth } from "../context/useAuth";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="LinkUp home">
      <span className="brand-mark" aria-hidden="true">↗</span>
      <span>linkup</span>
    </Link>
  );
}

export function SiteHeader() {
  const navigate = useNavigate();
  const { setUser: setAuthenticatedUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(() => Boolean(localStorage.getItem("access_token")));
  const [retryCount, setRetryCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const profile = await getCurrentUser();

        if (active && localStorage.getItem("access_token")) {
          setUser(profile);
          setProfileError("");
        }
      } catch (error) {
        if (active) {
          setUser(null);

          setProfileError(
            localStorage.getItem("access_token")
              ? error instanceof Error
                ? error.message
                : "Could not load your profile."
              : ""
          );
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "access_token" && event.key !== null) return;
      if (!event.newValue) {
        setUser(null);
        setProfileError("");
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
        setRetryCount((count) => count + 1);
      }
    };

    void loadProfile();
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, [retryCount]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      setAuthenticatedUser(null);
      setProfileError("");
      setProfileMenuOpen(false);
      navigate("/");
    }
  };

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Brand />
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/jobs">Explore jobs</Link>
          {user?.role === "job_seeker" && <Link to="/applications">My Applications</Link>}
          {user?.role === "employer" && <Link to="/employer/applications">Applications</Link>}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              {user.role === "employer" && (
                <Link className="button" to="/employer/dashboard">
                  Workspace <span aria-hidden="true">↗</span>
                </Link>
              )}
              {user.role === "job_seeker" && (
                <Link className="button" to="/jobs">
                  Find jobs <span aria-hidden="true">↗</span>
                </Link>
              )}
              {user.role === "admin" && (
                <Link className="button" to="/admin">
                  Admin console <span aria-hidden="true">↗</span>
                </Link>
              )}
              <div className="profile-menu" ref={profileMenuRef}>
                <button
                  className="profile-menu-trigger"
                  type="button"
                  aria-label={`Open profile menu for ${user.full_name}`}
                  aria-expanded={profileMenuOpen}
                  aria-controls="profile-menu-dropdown"
                  onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
                >
                  <svg className="profile-avatar" viewBox="0 0 40 40" aria-hidden="true">
                    <circle cx="20" cy="14" r="7" />
                    <path d="M7 36c1.7-7.5 6.1-11.2 13-11.2S31.3 28.5 33 36" />
                  </svg>
                  <span className="profile-trigger-name">{user.full_name}</span>
                  <span className="profile-menu-caret" aria-hidden="true">▾</span>
                </button>
                {profileMenuOpen && (
                  <div className="profile-menu-dropdown" id="profile-menu-dropdown">
                    <div className="profile-menu-header">
                      <p className="profile-menu-name" title={user.email}>{user.full_name}</p>
                      <span className="profile-menu-email">{user.email}</span>
                      <span className="profile-menu-role">{user.role.replaceAll("_", " ")}</span>
                    </div>
                    {user.role === "job_seeker" && (
                      <Link to="/applications" onClick={() => setProfileMenuOpen(false)}>
                        My Applications
                      </Link>
                    )}
                    {user.role === "employer" && (
                      <Link to="/employer/dashboard" onClick={() => setProfileMenuOpen(false)}>
                        Employer dashboard
                      </Link>
                    )}
                    {user.role === "admin" && (
                      <Link to="/admin" onClick={() => setProfileMenuOpen(false)}>
                        Admin dashboard
                      </Link>
                    )}
                    <Link to="/settings" onClick={() => setProfileMenuOpen(false)}>
                      Account settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleLogout();
                      }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : profileLoading ? (
            <span className="nav-profile-status" role="status">Loading profile…</span>
          ) : profileError ? (
            <>
              <span className="nav-profile-status nav-profile-error" role="status" title={profileError}>Profile unavailable</span>
              <button className="nav-logout" type="button" onClick={() => { setProfileLoading(true); setRetryCount((count) => count + 1); }}>Retry</button>
              <button className="nav-logout" type="button" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/auth/login">Log in</Link>
              <Link className="button" to="/auth/register">Get started <span aria-hidden="true">↗</span></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <Brand />
        <span>© {new Date().getFullYear()} LinkUp. Find your people. Find your next.</span>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link to="/jobs">Explore jobs</Link>
          <Link to="/auth/register">Join LinkUp</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
