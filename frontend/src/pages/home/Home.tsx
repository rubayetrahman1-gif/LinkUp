import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "../../assets/hero.png";
import { getAllJobs } from "../../services/jobService";
import type { Job } from "../../types/job";
import { PublicLayout } from "../../components/SiteLayout";
import { JobCard } from "../../components/JobCard";

const categories = [
  { icon: "✳", name: "Technology", count: "Software, data & engineering", search: "developer" },
  { icon: "◈", name: "Design", count: "Product, brand & UX roles", search: "design" },
  { icon: "⌁", name: "Marketing", count: "Growth, content & strategy", search: "marketing" },
  { icon: "↗", name: "Business", count: "Operations, sales & leadership", search: "business" },
];

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [totalJobsCount, setTotalJobsCount] = useState<number | null>(null);
  const [jobsError, setJobsError] = useState("");

  useEffect(() => {
    const fetchFeaturedJobs = async () => {
      try {
        const jobs = await getAllJobs();
        setTotalJobsCount(jobs.length);
        setFeaturedJobs(jobs.slice(0, 4));
      } catch (error) {
        setJobsError(error instanceof Error ? error.message : "Could not load featured jobs.");
      }
    };

    void fetchFeaturedJobs();
  }, []);

  const searchJobs = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (location.trim()) params.set("location", location.trim());
    navigate(params.size ? `/jobs?${params}` : "/jobs");
  };

  return (
    <PublicLayout>
      <main>
        <section className="hero">
          <div className="page-shell hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> A better way to move forward</span>
              <h1>Good things happen when we <span>link up.</span></h1>
              <p>
                Find work that fits your ambition, or connect with the people and hiring teams ready
                to build what comes next.
              </p>
              <div className="hero-actions">
                <Link className="button" to="/jobs">
                  Explore opportunities <span aria-hidden="true">→</span>
                </Link>
                <Link className="button button-secondary" to="/auth/register">
                  I’m hiring
                </Link>
              </div>
              <div className="hero-proof">
                <span className="avatar-stack" aria-hidden="true">
                  <span>AM</span><span>JS</span><span>RK</span><span>+</span>
                </span>
                <span>
                  {totalJobsCount !== null
                    ? `${totalJobsCount} active ${totalJobsCount === 1 ? "role" : "roles"} open right now`
                    : "Teams and candidates connecting across LinkUp"}
                </span>
              </div>
            </div>
            <div className="hero-art" aria-label="Abstract illustration of new opportunities">
              <span className="hero-glow" />
              <img src={heroImage} alt="" />
              <div className="floating-card floating-card-top">
                <span className="floating-icon" aria-hidden="true">✦</span>
                <span><strong>Structured Hiring</strong><small>Direct status & team reviews</small></span>
              </div>
              <div className="floating-card floating-card-bottom">
                <span className="floating-icon" aria-hidden="true">↗</span>
                <span><strong>Your Next Move</strong><small>Apply in one click</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-shell">
            <form className="search-panel" onSubmit={searchJobs} aria-label="Search jobs">
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Job title, skill, or company"
                  aria-label="Job title, skill, or company"
                />
              </label>
              <label className="search-field">
                <span aria-hidden="true">⌖</span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  aria-label="Location"
                  placeholder="City or remote"
                />
              </label>
              <button className="button" type="submit">
                Search jobs <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="stats-row" aria-label="LinkUp highlights">
              <div className="stat">
                <strong>Direct Applications</strong>
                <span>Track Pending, Under Review, and final decisions in real time</span>
              </div>
              <div className="stat">
                <strong>Collaborative Teams</strong>
                <span>Owners, recruiters, and reviewers working in one workspace</span>
              </div>
              <div className="stat">
                <strong>Verified Security</strong>
                <span>Session controls, RBAC protection, and transparent activity</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-surface">
          <div className="page-shell">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-dot" /> Find your direction</span>
                <h2>Explore by focus</h2>
              </div>
              <p>Jump straight into open positions tailored to your craft and experience.</p>
            </div>
            <div className="category-grid">
              {categories.map((category) => (
                <Link
                  className="category-card"
                  key={category.name}
                  to={`/jobs?search=${encodeURIComponent(category.search)}`}
                >
                  <span className="category-icon">{category.icon}</span>
                  <h3>{category.name}</h3>
                  <p>{category.count}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-shell">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-dot" /> The latest</span>
                <h2>Featured opportunities</h2>
              </div>
              <Link className="text-link" to="/jobs">
                See all jobs <span aria-hidden="true">→</span>
              </Link>
            </div>
            {jobsError && <p className="status-message" role="alert">{jobsError}</p>}
            {featuredJobs.length > 0 ? (
              <div className="job-grid">
                {featuredJobs.map((job) => <JobCard key={job.id} job={job} />)}
              </div>
            ) : !jobsError ? (
              <div className="empty-state">
                <h2>Make room for your next move</h2>
                <p>Explore open roles and find the one that feels right.</p>
                <Link className="button" to="/jobs">Browse open jobs</Link>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

export default Home;
