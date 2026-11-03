import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteHeader, SiteFooter } from "../../components/SiteLayout";
import { getJobById, updateJob } from "../../services/jobService";
import type { JobUpdate } from "../../types/job";

function EditJob() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<JobUpdate>({
    title: "",
    company_name: "",
    location: "",
    description: "",
    employment_type: "full_time",
    salary: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchJob = async () => {
      try {
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error("This job link is invalid.");
        }
        const job = await getJobById(Number(id));
        if (active) {
          setFormData({
            title: job.title,
            company_name: job.company_name,
            location: job.location,
            description: job.description,
            employment_type: job.employment_type,
            salary: job.salary || "",
          });
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Failed to load this job.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchJob();
    return () => { active = false; };
  }, [id]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      setError("This job link is invalid.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await updateJob(Number(id), formData);
      navigate("/employer/dashboard", { state: { updated: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update this job.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="form-page">
        <div className="page-shell">
          <Link className="back-link" to="/employer/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
          <span className="eyebrow"><span className="eyebrow-dot" /> EMPLOYER WORKSPACE</span>
          <h1 className="page-title">Keep your opportunity current.</h1>
          <p className="page-subtitle">Make a quick update so the right people know what your team needs.</p>
          {loading && <div className="loading-state" role="status">Loading job details...</div>}
          {!loading && error && <div className="empty-state" role="alert"><h2>We couldn’t open this job</h2><p>{error}</p><Link className="button" to="/employer/dashboard">Return to dashboard</Link></div>}
          {!loading && !error && (
            <div className="form-layout">
              <form className="job-form-card" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="edit-job-title">Job title</label>
                    <input id="edit-job-title" name="title" value={formData.title ?? ""} onChange={handleChange} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="edit-job-company">Company name</label>
                    <input id="edit-job-company" name="company_name" value={formData.company_name ?? ""} onChange={handleChange} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="edit-job-location">Location</label>
                    <input id="edit-job-location" name="location" value={formData.location ?? ""} onChange={handleChange} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="edit-job-type">Employment type</label>
                    <select id="edit-job-type" name="employment_type" value={formData.employment_type ?? "full_time"} onChange={handleChange}>
                      <option value="full_time">Full time</option>
                      <option value="part_time">Part time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div className="form-field form-field-full">
                    <label htmlFor="edit-job-salary">Compensation <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                    <input id="edit-job-salary" name="salary" value={formData.salary ?? ""} onChange={handleChange} placeholder="e.g. $80,000 – $100,000 / year" />
                  </div>
                  <div className="form-field form-field-full">
                    <label htmlFor="edit-job-description">About the role</label>
                    <textarea id="edit-job-description" name="description" value={formData.description ?? ""} onChange={handleChange} required />
                  </div>
                </div>
                {error && <p className="status-message" role="alert">{error}</p>}
                <div className="form-actions">
                  <Link className="button button-secondary" to="/employer/dashboard">Cancel</Link>
                  <button className="button" type="submit" disabled={saving}>{saving ? "Saving changes..." : "Save changes"} <span aria-hidden="true">→</span></button>
                </div>
              </form>
              <aside className="form-aside">
                <h2>Keep it relevant</h2>
                <p>Clear details help candidates decide whether this role is the right next step.</p>
                <ul>
                  <li>Keep the title and requirements specific.</li>
                  <li>Refresh location and compensation details.</li>
                  <li>Review your description before saving.</li>
                </ul>
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default EditJob;
