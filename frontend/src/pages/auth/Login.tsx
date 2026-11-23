import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, loginUser } from "../../services/authService";
import type { User, UserLogin } from "../../types/auth";
import heroImage from "../../assets/hero.png";
import { Brand } from "../../components/SiteLayout";
import { useAuth } from "../../context/useAuth";

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const registered = location.state && typeof location.state === "object" && "registered" in location.state && location.state.registered === true;
  const passwordChanged = location.state && typeof location.state === "object" && "passwordChanged" in location.state && location.state.passwordChanged === true;
  const sessionRevoked = location.state && typeof location.state === "object" && "sessionRevoked" in location.state && location.state.sessionRevoked === true;
  const cleanupWarning = location.state && typeof location.state === "object" && "cleanupWarning" in location.state && location.state.cleanupWarning === true;
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const expiredCleanupWarning = searchParams.get("cleanup") === "failed";
  const [formData, setFormData] = useState<UserLogin>({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginUser(formData);
      const user: User = await getCurrentUser();
      setUser(user);

      if (user.role === "employer") {
        navigate("/");
      } else if (user.role === "job_seeker") {
        navigate("/");
      } else if (user.role === "admin") {
        navigate("/admin");
      } else {
        setError("This account has an unsupported role.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <aside className="auth-visual">
        <Brand />
        <div className="auth-visual-content">
          <span className="eyebrow"><span className="eyebrow-dot" /> A better way to move forward</span>
          <h1>Good things happen when we link up.</h1>
          <p>Find work that fits your life, or meet the people who will help your team grow.</p>
          <div className="auth-art"><img src={heroImage} alt="" /></div>
          <p className="auth-quote">“Find your people. Find your next.”</p>
        </div>
      </aside>
      <section className="auth-main">
        <p className="auth-switch">New to LinkUp? <Link to="/auth/register">Create an account</Link></p>
        <div className="auth-card">
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h2>Sign in to LinkUp</h2>
          <p className="auth-intro">Pick up right where your next opportunity begins.</p>
          {registered && <p className="status-success" role="status">Your account is ready. Sign in to continue.</p>}
          {passwordChanged && <p className="status-success" role="status">Your password was changed. Sign in again with your new password.</p>}
          {sessionRevoked && <p className="status-success" role="status">This session was revoked. Sign in again to continue.</p>}
          {passwordChanged && cleanupWarning && <p className="status-message" role="alert">All sessions were revoked, but the browser could not clear the old session cookie. Signing in again will replace it.</p>}
          {sessionExpired && <p className="status-message" role="alert">Your session expired and could not be restored. Please sign in again.</p>}
          {sessionExpired && expiredCleanupWarning && <p className="status-message" role="alert">The old session cookie could not be cleared because the server could not be reached. It will be rejected if reused.</p>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" type="email" name="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" name="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} autoComplete="current-password" placeholder="Enter your password" required />
            </div>
            {error && <p className="status-message" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"} <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-note">By continuing, you agree to use LinkUp respectfully and responsibly.</p>
        </div>
        <p className="auth-footer"><Link className="text-link" to="/">← Back to home</Link></p>
      </section>
    </main>
  );
}

export default Login;
