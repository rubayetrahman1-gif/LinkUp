import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "../../assets/hero.png";
import { getAllJobs } from "../../services/jobService";
import type { Job } from "../../types/job";
import { PublicLayout } from "../../components/SiteLayout";
import { JobCard } from "../../components/JobCard";

const categories = [
  { icon: "✳", name: "Technology", count: "Build what’s next", search: "developer" },
  { icon: "◈", name: "Design", count: "Make ideas tangible", search: "design" },
  { icon: "⌁", name: "Marketing", count: "Tell a better story", search: "marketing" },
  { icon: "↗", name: "Business", count: "Help teams grow", search: "business" },
];

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [jobsError, setJobsError] = useState("");

  useEffect(() => {
    const fetchFeaturedJobs = async () => {
      try {
        const jobs = await getAllJobs();
        setFeaturedJobs(jobs.slice(0, 3));
      } catch (error) {
        setJobsError(error instanceof Error ? error.message : "Could not load featured jobs.");
      }
    };

    fetchFeaturedJobs();
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
              <p>Find work that fits your life, or meet the people who will help your team grow. Your next chapter starts with a connection.</p>
              <div className="hero-actions">
                <Link className="button" to="/jobs">Explore opportunities <span aria-hidden="true">→</span></Link>
                <Link className="button button-secondary" to="/auth/register">I’m hiring</Link>
              </div>
              <div className="hero-proof">
                <span className="avatar-stack" aria-hidden="true">
                  <span>AM</span><span>JS</span><span>RK</span><span>+</span>
                </span>
                <span>Good people are finding their next move</span>
              </div>
            </div>
            <div className="hero-art" aria-label="Abstract illustration of new opportunities">
              <span className="hero-glow" />
              <img src={heroImage} alt="" />
              <div className="floating-card floating-card-top">
                <span className="floating-icon" aria-hidden="true">✦</span>
                <span><strong>New possibilities</strong><small>Right around the corner</small></span>
              </div>
              <div className="floating-card floating-card-bottom">
                <span className="floating-icon" aria-hidden="true">↗</span>
                <span><strong>Your next move</strong><small>Starts with a connection</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-shell">
            <form className="search-panel" onSubmit={searchJobs} aria-label="Search jobs">
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title, skill, or company" aria-label="Job title, skill, or company" />
              </label>
              <label className="search-field">
                <span aria-hidden="true">⌖</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Location" placeholder="City or remote" />
              </label>
              <button className="button" type="submit">Search jobs <span aria-hidden="true">→</span></button>
            </form>

            <div className="stats-row" aria-label="LinkUp highlights">
              <div className="stat"><strong>People first</strong><span>Human connections, real opportunities</span></div>
              <div className="stat"><strong>One next step</strong><span>Make finding your fit feel simpler</span></div>
              <div className="stat"><strong>Built to connect</strong><span>Better work starts together</span></div>
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "#fff" }}>
          <div className="page-shell">
            <div className="section-heading">
              <div><span className="eyebrow"><span className="eyebrow-dot" /> Find your direction</span><h2>Explore by focus</h2></div>
              <p>Whatever you’re good at, there’s a team out there that needs it.</p>
            </div>
            <div className="category-grid">
              {categories.map((category) => (
                <Link className="category-card" key={category.name} to={`/jobs?search=${encodeURIComponent(category.search)}`}>
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
              <div><span className="eyebrow"><span className="eyebrow-dot" /> The latest</span><h2>Good work is out there</h2></div>
              <Link className="text-link" to="/jobs">See all jobs <span aria-hidden="true">→</span></Link>
            </div>
            {jobsError && <p className="status-message" role="alert">{jobsError}</p>}
            {featuredJobs.length > 0 ? (
              <div className="job-grid">{featuredJobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
            ) : !jobsError ? (
              <div className="empty-state"><h2>Make room for your next move</h2><p>Explore open roles and find the one that feels right.</p><Link className="button" to="/jobs">Browse open jobs</Link></div>
            ) : null}
          </div>
        </section>

        
      </main>
    </PublicLayout>
  );
}

export default Home;
