import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "../../assets/hero.png";
import { registerUser } from "../../services/authService";
import type { UserRegister } from "../../types/auth";
import { Brand } from "../../components/SiteLayout";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<UserRegister>({
    full_name: "",
    email: "",
    password: "",
    role: "job_seeker",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerUser(formData);
      navigate("/auth/login", { state: { registered: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <aside className="auth-visual">
        <Brand />
        <div className="auth-visual-content">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>Make your next move a good one.</h1>
          <p>Join a community that helps people and teams find the right connection.</p>
          <div className="auth-art"><img src={heroImage} alt="" /></div>
          <p className="auth-quote">People first. Possibilities always.</p>
        </div>
      </aside>
      <section className="auth-main">
        <p className="auth-switch">Already have an account? <Link to="/auth/login">Log in</Link></p>
        <div className="auth-card">
          <p className="auth-eyebrow">GET STARTED FOR FREE</p>
          <h2>Create your account</h2>
          <p className="auth-intro">A few details and you’re ready to make your next move.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="register-name">Full name</label>
              <input id="register-name" type="text" name="full_name" value={formData.full_name} onChange={handleChange} autoComplete="name" placeholder="e.g. Alex Morgan" required />
            </div>
            <div className="form-field">
              <label htmlFor="register-email">Email address</label>
              <input id="register-email" type="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="form-field">
              <label htmlFor="register-password">Password</label>
              <input id="register-password" type="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
            </div>
            <fieldset className="role-field">
              <legend>I’m here to...</legend>
              <div className="role-options">
                <label className="role-option">
                  <input type="radio" name="role" value="job_seeker" checked={formData.role === "job_seeker"} onChange={() => setFormData({ ...formData, role: "job_seeker" })} />
                  <strong>Find a job</strong><small>Explore roles and grow your career</small>
                </label>
                <label className="role-option">
                  <input type="radio" name="role" value="employer" checked={formData.role === "employer"} onChange={() => setFormData({ ...formData, role: "employer" })} />
                  <strong>Hire talent</strong><small>Share opportunities with great people</small>
                </label>
              </div>
            </fieldset>
            {error && <p className="status-message" role="alert">{error}</p>}
            <button className="button" type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"} <span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-note">By continuing, you agree to use LinkUp respectfully and responsibly.</p>
        </div>
        <p className="auth-footer"><Link className="text-link" to="/">← Back to home</Link></p>
      </section>
    </main>
  );
}

export default Register;
