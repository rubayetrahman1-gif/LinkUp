import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader, SiteFooter } from "../../components/SiteLayout";
import { createJob } from "../../services/jobService";
import type { JobCreate } from "../../types/job";

function CreateJob() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<JobCreate>({
    title: "",
    company_name: "",
    location: "",
    description: "",
    employment_type: "full_time",
    salary: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createJob(formData);
      navigate("/employer/dashboard", { state: { created: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create the job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="form-page">
        <div className="page-shell">
          <Link className="back-link" to="/employer/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
          <span className="eyebrow"><span className="eyebrow-dot" /> EMPLOYER WORKSPACE</span>
          <h1 className="page-title">Create a new opportunity.</h1>
          <p className="page-subtitle">A clear, thoughtful job post helps the right person see themselves on your team.</p>
          <div className="form-layout">
            <form className="job-form-card" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="job-title">Job title</label>
                  <input id="job-title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Product Designer" required />
                </div>
                <div className="form-field">
                  <label htmlFor="job-company">Company name</label>
                  <input id="job-company" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="e.g. Acme Studio" required />
                </div>
                <div className="form-field">
                  <label htmlFor="job-location">Location</label>
                  <input id="job-location" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. New York, NY or Remote" required />
                </div>
                <div className="form-field">
                  <label htmlFor="job-type">Employment type</label>
                  <select id="job-type" name="employment_type" value={formData.employment_type} onChange={handleChange}>
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="job-salary">Compensation <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                  <input id="job-salary" name="salary" value={formData.salary ?? ""} onChange={handleChange} placeholder="e.g. $80,000 – $100,000 / year" />
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="job-description">About the role</label>
                  <textarea id="job-description" name="description" value={formData.description} onChange={handleChange} placeholder="Tell people what they’ll work on, what they’ll bring, and what makes your team special..." required />
                </div>
              </div>
              {error && <p className="status-message" role="alert">{error}</p>}
              <div className="form-actions">
                <Link className="button button-secondary" to="/employer/dashboard">Cancel</Link>
                <button className="button" type="submit" disabled={loading}>{loading ? "Publishing..." : "Publish job"} <span aria-hidden="true">→</span></button>
              </div>
            </form>
            <aside className="form-aside">
              <h2>Make your post stand out</h2>
              <p>Great job posts make the role and your team easy to picture.</p>
              <ul>
                <li>Use a clear, specific title.</li>
                <li>Share what success looks like in this role.</li>
                <li>Include compensation details when you can.</li>
              </ul>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default CreateJob;
