import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAllJobs } from "../../services/jobService";
import type { Job } from "../../types/job";
import { PublicLayout } from "../../components/SiteLayout";
import { JobCard } from "../../components/JobCard";

function JobList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const search = searchParams.get("search") ?? "";
  const location = searchParams.get("location") ?? "";
  const [employmentType, setEmploymentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAllJobs();
        if (active) setJobs(data);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Failed to load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchJobs();
    return () => { active = false; };
  }, [reload]);

  const filteredJobs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const locationTerm = location.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch = !searchTerm || [job.title, job.company_name, job.description].some((value) => value.toLowerCase().includes(searchTerm));
      const matchesLocation = !locationTerm || job.location.toLowerCase().includes(locationTerm);
      const matchesType = !employmentType || job.employment_type === employmentType;
      return matchesSearch && matchesLocation && matchesType;
    });
  }, [employmentType, jobs, location, search]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (location.trim()) params.set("location", location.trim());
    setSearchParams(params, { replace: true });
  };

  const updateQuery = (key: "search" | "location", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  };

  return (
    <PublicLayout>
      <main className="jobs-page">
        <div className="page-shell">
          <span className="eyebrow"><span className="eyebrow-dot" /> Find your next</span>
          <h1 className="page-title">Work that moves you forward.</h1>
          <p className="page-subtitle">Explore thoughtful opportunities from teams ready to meet you. Your next chapter could be one search away.</p>

          <form className="search-panel" onSubmit={submitSearch}>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => updateQuery("search", event.target.value)} placeholder="Job title, skill, or company" aria-label="Job title, skill, or company" />
            </label>
            <label className="search-field">
              <span aria-hidden="true">⌖</span>
              <input value={location} onChange={(event) => updateQuery("location", event.target.value)} placeholder="City or remote" aria-label="Location" />
            </label>
            <button className="button" type="submit">Find jobs <span aria-hidden="true">→</span></button>
          </form>

          <div className="section-heading">
            <div><h2 style={{ marginTop: 0 }}>Open opportunities</h2><p>{loading ? "Finding the right roles..." : error ? "Please try again shortly." : `${filteredJobs.length} ${filteredJobs.length === 1 ? "opportunity" : "opportunities"} to explore`}</p></div>
            <label className="search-field" style={{ minWidth: 180 }}>
              <span aria-hidden="true">☷</span>
              <select aria-label="Employment type" value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}>
                <option value="">All job types</option>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </label>
          </div>

          {loading && <div className="loading-state" role="status">Loading opportunities...</div>}
          {error && <div className="empty-state" role="alert"><h2>We couldn’t load the jobs</h2><p>{error}</p><button className="button" onClick={() => setReload((count) => count + 1)}>Try again</button></div>}
          {!loading && !error && filteredJobs.length > 0 && <div className="job-grid">{filteredJobs.map((job) => <JobCard key={job.id} job={job} />)}</div>}
          {!loading && !error && filteredJobs.length === 0 && (
            <div className="empty-state">
              <h2>No matches just yet</h2>
              <p>Try a different title or location, or clear your filters to see every opportunity.</p>
              {(search || location || employmentType) ? (
                <button className="button button-secondary" onClick={() => { setEmploymentType(""); setSearchParams({}); }}>Clear filters</button>
              ) : <Link className="button" to="/auth/register">Get job alerts</Link>}
            </div>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default JobList;
