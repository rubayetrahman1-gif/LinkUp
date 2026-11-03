
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
    const fetchJob = async () => {
      try {
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error("Invalid job ID");
        }

        const job = await getJobById(Number(id));

        setFormData({
          title: job.title,
          company_name: job.company_name,
          location: job.location,
          description: job.description,
          employment_type: job.employment_type,
          salary: job.salary || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;

    setError("");
    setSaving(true);

    try {
      await updateJob(Number(id), formData);
      alert("Job updated successfully!");
      navigate("/employer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading job...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Edit Job</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Job Title</label>
          <input name="title" value={formData.title || ""} onChange={handleChange} required />
        </div>

        <div>
          <label>Company Name</label>
          <input name="company_name" value={formData.company_name || ""} onChange={handleChange} required />
        </div>

        <div>
          <label>Location</label>
          <input name="location" value={formData.location || ""} onChange={handleChange} required />
        </div>

        <div>
          <label>Job Description</label>
          <textarea name="description" value={formData.description || ""} onChange={handleChange} required />
        </div>

        <div>
          <label>Employment Type</label>
          <select name="employment_type" value={formData.employment_type || "full_time"} onChange={handleChange}>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="internship">Internship</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <div>
          <label>Salary</label>
          <input name="salary" value={formData.salary || ""} onChange={handleChange} />
        </div>

        {error && <p>{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? "Updating..." : "Update Job"}
        </button>
      </form>
    </div>
  );
}

export default EditJob;
