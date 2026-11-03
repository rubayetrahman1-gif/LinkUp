import { Link } from "react-router-dom";
import type { Job } from "../types/job";
import { formatEmploymentType } from "./jobUtils";

export function CompanyMark({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return <span className="company-mark" aria-hidden="true">{initials || "LU"}</span>;
}

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <CompanyMark name={job.company_name} />
        <span className="job-badge">{formatEmploymentType(job.employment_type)}</span>
      </div>
      <h2>{job.title}</h2>
      <p className="job-company">{job.company_name}</p>
      <div className="job-meta">
        <span aria-label="Location">⌖ &nbsp;{job.location}</span>
        <span aria-label="Posted date">◷ &nbsp;{new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
      <p className="job-card-description">{job.description}</p>
      <div className="job-card-footer">
        <span className="salary">{job.salary || "Compensation not specified"}</span>
        <Link className="text-link" to={`/jobs/${job.id}`}>View details <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
