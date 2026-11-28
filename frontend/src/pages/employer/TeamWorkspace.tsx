import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PublicLayout } from "../../components/SiteLayout";
import { formatDate } from "../../dateTime";
import type { Job, JobCreate } from "../../types/job";
import type { ApplicationStatus } from "../../services/applicationService";
import {
  addTeamMember,
  assignTeamApplication,
  createTeamJob,
  deleteTeam,
  deleteTeamJob,
  getTeam,
  getTeamApplications,
  getTeamJobs,
  removeTeamMember,
  renameTeam,
  reviewTeamApplication,
  updateTeamApplicationStatus,
  updateTeamJob,
  updateTeamMember,
} from "../../services/teamService";
import type {
  TeamApplication,
  TeamDetails,
  TeamRecommendation,
} from "../../services/teamService";
import { getStatusPillClass } from "../../components/jobUtils";

const statuses: ApplicationStatus[] = [
  "Pending",
  "Under Review",
  "Accepted",
  "Rejected",
];
const recommendations: TeamRecommendation[] = [
  "Recommend",
  "Not Recommend",
  "Need Further Consideration",
];

const emptyJob: JobCreate = {
  title: "",
  company_name: "",
  location: "",
  description: "",
  employment_type: "full_time",
  salary: "",
};

function TeamWorkspace() {
  const { teamId: teamIdParam } = useParams<{ teamId: string }>();
  const teamId = Number(teamIdParam);
  const isValidTeamId = Number.isInteger(teamId) && teamId > 0;
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [teamName, setTeamName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"recruiter" | "reviewer">("recruiter");
  const [jobDraft, setJobDraft] = useState<JobCreate>(emptyJob);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<number, { recommendation: TeamRecommendation | ""; status: ApplicationStatus }>
  >({});
  const [busyAction, setBusyAction] = useState(false);

  const applyWorkspaceData = useCallback((
    teamData: TeamDetails,
    jobData: Job[],
    applicationData: TeamApplication[],
  ) => {
    setTeam(teamData);
    setTeamName(teamData.name);
    setJobs(jobData);
    setApplications(applicationData);
    const next: Record<number, { recommendation: TeamRecommendation | ""; status: ApplicationStatus }> = {};
    for (const application of applicationData) {
      next[application.application_id] = {
        recommendation: application.review_recommendation ?? "",
        status: application.status,
      };
    }
    setReviewDrafts(next);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const [teamData, jobData, applicationData] = await Promise.all([
        getTeam(teamId),
        getTeamJobs(teamId),
        getTeamApplications(teamId),
      ]);
      applyWorkspaceData(teamData, jobData, applicationData);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load this Team.");
      throw requestError;
    }
  }, [applyWorkspaceData, teamId]);

  useEffect(() => {
    let active = true;
    const loadWorkspace = async () => {
      if (!isValidTeamId) return;
      try {
        const [teamData, jobData, applicationData] = await Promise.all([
          getTeam(teamId),
          getTeamJobs(teamId),
          getTeamApplications(teamId),
        ]);
        if (active) {
          applyWorkspaceData(teamData, jobData, applicationData);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Could not load this Team.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadWorkspace();
    return () => { active = false; };
  }, [applyWorkspaceData, isValidTeamId, teamId]);

  const role = team?.my_role;
  const isOwner = role === "owner";
  const canManageJobs = role === "owner" || role === "recruiter";
  const canManageApplications = canManageJobs;
  const reviewers = useMemo(
    () => team?.members.filter((member) => member.role === "reviewer") ?? [],
    [team],
  );

  const runAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
    refresh = true,
  ) => {
    setError("");
    setNotice("");
    setBusyAction(true);
    try {
      await action();
      if (refresh) await refreshWorkspace();
      setNotice(successMessage);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The action could not be completed.");
      return false;
    } finally {
      setBusyAction(false);
    }
  };

  const handleJobChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setJobDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSaveJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = { ...jobDraft, company_name: team?.name ?? jobDraft.company_name };
    const saved = await runAction(
      () => editingJobId
        ? updateTeamJob(teamId, editingJobId, data)
        : createTeamJob(teamId, data),
      editingJobId ? "Team job updated." : "Team job published.",
    );
    if (saved) {
      setEditingJobId(null);
      setJobDraft({ ...emptyJob, company_name: team?.name ?? "" });
    }
  };

  const startEditingJob = (job: Job) => {
    setEditingJobId(job.id);
    setJobDraft({
      title: job.title,
      company_name: job.company_name,
      location: job.location,
      description: job.description,
      employment_type: job.employment_type,
      salary: job.salary ?? "",
    });
    document.getElementById("team-jobs")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await runAction(
      () => addTeamMember(teamId, memberEmail, memberRole),
      "Team member added.",
    );
    if (saved) setMemberEmail("");
  };

  const handleSaveReview = (application: TeamApplication) => {
    const draft = reviewDrafts[application.application_id] ?? {
      recommendation: "",
      status: application.status,
    };
    const recommendation = draft.recommendation;
    if (!recommendation) return;
    void runAction(
      () => reviewTeamApplication(teamId, application.application_id, recommendation),
      "Recommendation saved.",
    );
  };

  const handleSaveApplicationStatus = (application: TeamApplication) => {
    const draft = reviewDrafts[application.application_id];
    if (!draft || draft.status === application.status) return;
    void runAction(
      () => updateTeamApplicationStatus(teamId, application.application_id, draft.status),
      "Application status updated.",
    );
  };

  const handleRenameTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(
      async () => {
        await renameTeam(teamId, teamName);
        setJobs((current) => current.map((job) => ({ ...job, company_name: teamName })));
      },
      "Team name updated.",
    );
  };

  const handleDeleteTeam = async () => {
    if (!window.confirm("Archive this Team? Its jobs will be hidden from public listings, while jobs, applications, and member history are preserved.")) {
      return;
    }
    const deleted = await runAction(() => deleteTeam(teamId), "Team archived.", false);
    if (deleted) navigate("/employer/dashboard");
  };

  const sectionLinks: Array<[string, string]> = [
    ["overview", "Overview"],
    ["team-jobs", "Jobs"],
    ["team-applications", "Applications"],
    ["team-members", "Members"],
    ...(isOwner ? [["team-settings", "Settings"] as [string, string]] : []),
  ];

  return (
    <PublicLayout>
      <main className="jobs-page team-workspace">
        <div className="page-shell">
          <Link className="back-link" to="/employer/dashboard">
            <span aria-hidden="true">←</span> Employer dashboard
          </Link>
          {loading && isValidTeamId && <div className="loading-state" role="status">Loading Team workspace...</div>}
          {(!isValidTeamId || (!loading && error && !team)) && (
            <div className="empty-state" role="alert">
              <h1>Team workspace unavailable</h1>
              <p>{isValidTeamId ? error : "This Team link is invalid."}</p>
            </div>
          )}
          {team && (
            <>
              <header className="team-workspace-header" id="overview">
                <div className="page-header-bar" style={{ marginBottom: 0 }}>
                  <div>
                    <span className="eyebrow"><span className="eyebrow-dot" /> EMPLOYER TEAM</span>
                    <h1 className="page-title">{team.name}</h1>
                    <p className="page-subtitle">
                      Collaborative workspace for team job postings, candidate assignment, and hiring reviews.
                    </p>
                  </div>
                  {role && <span className={getStatusPillClass(role)}>Role: {role}</span>}
                </div>
                <nav className="team-section-nav" aria-label="Team sections">
                  {sectionLinks.map(([id, label]) => (
                    <a key={id} href={`#${id}`}>{label}</a>
                  ))}
                </nav>
                <div className="team-stat-grid">
                  <article><span>Members</span><strong>{team.member_count}</strong></article>
                  <article><span>Team jobs</span><strong>{team.job_count}</strong></article>
                  <article><span>Applications</span><strong>{team.application_count}</strong></article>
                  <article><span>Your role</span><strong>{role}</strong></article>
                </div>
              </header>

              {error && <p className="status-message" role="alert">{error}</p>}
              {notice && <p className="status-success" role="status">{notice}</p>}

              <section className="team-panel" id="team-jobs">
                <div className="team-panel-heading">
                  <div>
                    <span className="eyebrow">TEAM HIRING</span>
                    <h2>Jobs</h2>
                    <p>Team job posts are public and show {team.name} as the employer.</p>
                  </div>
                  <span className="portal-count">{jobs.length} {jobs.length === 1 ? "job" : "jobs"}</span>
                </div>
                {canManageJobs && (
                  <form className="job-form-card team-job-form" onSubmit={(event) => void handleSaveJob(event)}>
                    <h3>{editingJobId ? "Update Team job" : "Post a Team job"}</h3>
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="team-job-title">Job title</label>
                        <input id="team-job-title" name="title" value={jobDraft.title} onChange={handleJobChange} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="team-job-company">Employer</label>
                        <input id="team-job-company" value={team.name} readOnly />
                      </div>
                      <div className="form-field">
                        <label htmlFor="team-job-location">Location</label>
                        <input id="team-job-location" name="location" value={jobDraft.location} onChange={handleJobChange} required />
                      </div>
                      <div className="form-field">
                        <label htmlFor="team-job-type">Employment type</label>
                        <select id="team-job-type" name="employment_type" value={jobDraft.employment_type} onChange={handleJobChange}>
                          <option value="full_time">Full time</option>
                          <option value="part_time">Part time</option>
                          <option value="contract">Contract</option>
                          <option value="internship">Internship</option>
                        </select>
                      </div>
                      <div className="form-field form-field-full">
                        <label htmlFor="team-job-salary">Compensation (optional)</label>
                        <input id="team-job-salary" name="salary" value={jobDraft.salary ?? ""} onChange={handleJobChange} />
                      </div>
                      <div className="form-field form-field-full">
                        <label htmlFor="team-job-description">About the role</label>
                        <textarea id="team-job-description" name="description" value={jobDraft.description} onChange={handleJobChange} required />
                      </div>
                    </div>
                    <div className="form-actions">
                      {editingJobId && (
                        <button className="button button-secondary" type="button" onClick={() => {
                          setEditingJobId(null);
                          setJobDraft({ ...emptyJob, company_name: team.name });
                        }}>Cancel edit</button>
                      )}
                      <button className="button" type="submit" disabled={busyAction}>
                        {busyAction ? "Saving..." : editingJobId ? "Save changes" : "Publish Team job"}
                      </button>
                    </div>
                  </form>
                )}
                {jobs.length === 0 ? (
                  <div className="empty-state"><h3>No Team jobs yet</h3><p>Published Team roles will be listed here.</p></div>
                ) : (
                  <div className="portal-table-scroll">
                    <table className="portal-table">
                      <thead><tr><th>Job</th><th>Location</th><th>Type</th><th>Posted</th><th>Actions</th></tr></thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.id}>
                            <td className="portal-job-title"><Link to={`/jobs/${job.id}`}>{job.title}</Link><small>{job.company_name}</small></td>
                            <td>{job.location}</td>
                            <td><span className="job-badge">{job.employment_type.replaceAll("_", " ")}</span></td>
                            <td>{formatDate(job.created_at)}</td>
                            <td className="team-row-actions">
                              <div className="portal-row-actions">
                                <Link className="portal-action" to={`/jobs/${job.id}`}>View</Link>
                                {canManageJobs && <button className="portal-action" type="button" onClick={() => startEditingJob(job)}>Edit</button>}
                                {isOwner && <button className="portal-action portal-delete" type="button" onClick={() => {
                                  if (window.confirm("Delete this Team job? Jobs with applications cannot be deleted because application history must be preserved.")) {
                                    void runAction(() => deleteTeamJob(teamId, job.id), "Team job deleted.");
                                  }
                                }}>Delete</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="team-panel" id="team-applications">
                <div className="team-panel-heading">
                  <div>
                    <span className="eyebrow">CANDIDATE PIPELINE</span>
                    <h2>Applications</h2>
                    <p>Assign reviewers, collect internal recommendations, and update final hiring decisions.</p>
                  </div>
                  <span className="portal-count">{applications.length} visible</span>
                </div>
                {applications.length === 0 ? (
                  <div className="empty-state"><h3>No applications to review</h3><p>Applications for Team jobs will appear here. Reviewers see only work assigned to them.</p></div>
                ) : (
                  <div className="team-application-list">
                    {applications.map((application) => {
                      const draft = reviewDrafts[application.application_id] ?? {
                        recommendation: application.review_recommendation ?? "",
                        status: application.status,
                      };
                      return (
                        <article className="team-application-card" key={application.application_id}>
                          <div className="team-application-heading">
                            <div>
                              <span className="eyebrow">{application.job_title}</span>
                              <h3>{application.applicant.full_name}</h3>
                              <a href={`mailto:${application.applicant.email}`}>{application.applicant.email}</a>
                            </div>
                            <span className={getStatusPillClass(application.status)}>{application.status}</span>
                          </div>
                          <div className="team-application-controls">
                            {canManageApplications && (
                              <label className="form-field">
                                <span>Assign reviewer</span>
                                <select
                                  value={application.assigned_reviewer_id ?? ""}
                                  onChange={(event) => {
                                    const nextId = event.target.value ? Number(event.target.value) : null;
                                    void runAction(
                                      () => assignTeamApplication(teamId, application.application_id, nextId),
                                      nextId === null ? "Reviewer assignment cleared." : "Application assigned.",
                                    );
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {reviewers.map((reviewer) => (
                                    <option key={reviewer.user_id} value={reviewer.user_id}>{reviewer.full_name}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {!canManageApplications && (
                              <p className="team-assignment-note">
                                Assigned reviewer: <strong>{application.assigned_reviewer_name ?? "You"}</strong>
                              </p>
                            )}
                            {canManageApplications && (
                              <>
                                <label className="form-field">
                                  <span>Application status</span>
                                  <select
                                    value={draft.status}
                                    onChange={(event) => {
                                      const nextStatus = statuses.find((value) => value === event.target.value);
                                      if (nextStatus) setReviewDrafts((current) => ({
                                        ...current,
                                        [application.application_id]: { ...draft, status: nextStatus },
                                      }));
                                    }}
                                  >
                                    {statuses.map((statusValue) => <option key={statusValue}>{statusValue}</option>)}
                                  </select>
                                </label>
                                <button
                                  className="button button-secondary"
                                  type="button"
                                  disabled={busyAction || draft.status === application.status}
                                  onClick={() => handleSaveApplicationStatus(application)}
                                >
                                  Save status
                                </button>
                              </>
                            )}
                          </div>
                          {role === "reviewer" ? (
                            <label className="form-field">
                              <span>Internal recommendation</span>
                              <select
                                value={draft.recommendation}
                                onChange={(event) => {
                                  const recommendation = recommendations.find((value) => value === event.target.value) ?? "";
                                  setReviewDrafts((current) => ({
                                    ...current,
                                    [application.application_id]: { ...draft, recommendation },
                                  }));
                                }}
                              >
                                <option value="">Select a recommendation</option>
                                {recommendations.map((value) => <option key={value}>{value}</option>)}
                              </select>
                            </label>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="team-assignment-note">Internal recommendation:</span>
                              {application.review_recommendation ? (
                                <span className={getStatusPillClass(application.review_recommendation)}>
                                  {application.review_recommendation}
                                </span>
                              ) : (
                                <span className="status-pill status-pill-neutral">Not reviewed</span>
                              )}
                            </div>
                          )}
                          <div className="team-review-footer">
                            {application.reviewed_by_name && (
                              <small>Recommendation by {application.reviewed_by_name}{application.reviewed_at ? ` · ${formatDate(application.reviewed_at)}` : ""}</small>
                            )}
                            {role === "reviewer" && (
                              <button
                                className="button"
                                type="button"
                                disabled={busyAction || !draft.recommendation}
                                onClick={() => handleSaveReview(application)}
                              >
                                Save recommendation
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="team-panel" id="team-members">
                <div className="team-panel-heading">
                  <div><span className="eyebrow">COLLABORATORS</span><h2>Members</h2></div>
                  <span className="portal-count">{team.members.length} members</span>
                </div>
                {isOwner && (
                  <form className="team-add-member-form" onSubmit={(event) => void handleAddMember(event)}>
                    <label className="form-field">
                      <span>Employer email</span>
                      <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="name@company.com" required />
                    </label>
                    <label className="form-field">
                      <span>Team role</span>
                      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as "recruiter" | "reviewer")}>
                        <option value="recruiter">Recruiter</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                    </label>
                    <button className="button" type="submit" disabled={busyAction}>Add member</button>
                  </form>
                )}
                <div className="portal-table-scroll">
                  <table className="portal-table">
                    <thead><tr><th>Member</th><th>Email</th><th>Role</th>{isOwner && <th>Actions</th>}</tr></thead>
                    <tbody>
                      {team.members.map((member) => (
                        <tr key={member.user_id}>
                          <td><strong>{member.full_name}</strong></td>
                          <td><a href={`mailto:${member.email}`}>{member.email}</a></td>
                          <td>{isOwner && member.role !== "owner" ? (
                            <select
                              className="inline-status-select"
                              aria-label={`Role for ${member.full_name}`}
                              value={member.role}
                              onChange={(event) => void runAction(
                                () => updateTeamMember(teamId, member.user_id, event.target.value as "recruiter" | "reviewer"),
                                "Member role updated.",
                              )}
                            >
                              <option value="recruiter">Recruiter</option>
                              <option value="reviewer">Reviewer</option>
                            </select>
                          ) : <span className={getStatusPillClass(member.role)}>{member.role}</span>}</td>
                          {isOwner && <td>
                            {member.role !== "owner" && (
                              <button className="portal-action portal-delete" type="button" onClick={() => {
                                if (window.confirm(`Remove ${member.full_name} from this Team?`)) {
                                  void runAction(() => removeTeamMember(teamId, member.user_id), "Team member removed.");
                                }
                              }}>Remove</button>
                            )}
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {isOwner && (
                <section className="team-panel team-settings-panel" id="team-settings">
                  <div className="team-panel-heading"><div><span className="eyebrow">OWNER CONTROLS</span><h2>Team settings</h2></div></div>
                  <form className="team-add-member-form" onSubmit={(event) => void handleRenameTeam(event)}>
                    <label className="form-field"><span>Team name</span>
                      <input value={teamName} onChange={(event) => setTeamName(event.target.value)} minLength={2} maxLength={100} required />
                    </label>
                    <button className="button" type="submit" disabled={busyAction}>Save name</button>
                  </form>
                  <div className="team-danger-zone">
                    <div><h3>Archive this Team</h3><p>Team job posts will be hidden, while jobs, applications, and membership history are preserved.</p></div>
                    <button className="button button-danger" type="button" disabled={busyAction} onClick={() => void handleDeleteTeam()}>Archive Team</button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default TeamWorkspace;
