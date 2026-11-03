import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../services/authService";
import type { User } from "../types/auth";

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
  const [user, setUser] = useState<User | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(() => Boolean(localStorage.getItem("access_token")));
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      try {
        const profile = await getCurrentUser();
        if (active && localStorage.getItem("access_token") === token) {
          setUser(profile);
          setProfileError("");
        }
      } catch (error) {
        if (active && localStorage.getItem("access_token") === token) {
          setUser(null);
          setProfileError(error instanceof Error ? error.message : "Could not load your profile.");
        }
      } finally {
        if (active && localStorage.getItem("access_token") === token) setProfileLoading(false);
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

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setProfileError("");
    navigate("/");
  };

  // const canBrowseJobs = user?.role === "job_seeker" || (!user && !profileLoading && !profileError);

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Brand />
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/">Home</Link>
          {/* {canBrowseJobs && <Link to="/jobs">Find a job</Link>} */}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-greeting" title={user.email}>Hi, {user.full_name}</span>
              {user.role === "employer" && <Link className="button" to="/employer/dashboard">Dashboard <span aria-hidden="true">↗</span></Link>}
              {user.role === "job_seeker" && <Link className="button" to="/jobs">Find jobs <span aria-hidden="true">↗</span></Link>}
              <button className="nav-logout" type="button" onClick={handleLogout}>Log out</button>
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
