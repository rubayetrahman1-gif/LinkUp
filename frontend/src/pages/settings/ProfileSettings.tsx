import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicLayout } from "../../components/SiteLayout";
import {
  changeCurrentPassword,
  getActiveSessions,
  getCurrentUser,
  logoutUser,
  revokeSession,
  updateCurrentUser,
} from "../../services/authService";
import type { ActiveSession, User } from "../../types/auth";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../dateTime";

function ProfileSettings() {
  const navigate = useNavigate();
  const { setUser: setAuthenticatedUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionsNotice, setSessionsNotice] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const user = await getCurrentUser();
        if (active) {
          setProfile(user);
          setFullName(user.full_name);
          setEmail(user.email);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load your profile.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSessions = async () => {
      try {
        const activeSessions = await getActiveSessions();
        if (active) setSessions(activeSessions);
      } catch (requestError) {
        if (active) {
          setSessionsError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load active sessions.",
          );
        }
      } finally {
        if (active) setSessionsLoading(false);
      }
    };

    void loadSessions();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim();

    if (normalizedName.length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    if (!normalizedEmail) {
      setError("Email address is required.");
      return;
    }

    setSaving(true);
    try {
      const updatedProfile = await updateCurrentUser({
        full_name: normalizedName,
        email: normalizedEmail,
      });
      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name);
      setEmail(updatedProfile.email);
      setSuccess("Your profile has been updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changeCurrentPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      let cleanupWarning = false;
      try {
        await logoutUser();
      } catch {
        cleanupWarning = true;
      } finally {
        setAuthenticatedUser(null);
      }

      navigate("/auth/login", {
        replace: true,
        state: { passwordChanged: true, cleanupWarning },
      });
    } catch (requestError) {
      setPasswordError(
        requestError instanceof Error
          ? requestError.message
          : "Could not change your password.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRevokeSession = async (session: ActiveSession) => {
    setSessionsError("");
    setSessionsNotice("");
    setRevokingSessionId(session.id);

    try {
      await revokeSession(session.id);

      if (session.is_current) {
        let cleanupWarning = false;
        try {
          await logoutUser();
        } catch {
          cleanupWarning = true;
        } finally {
          setAuthenticatedUser(null);
        }
        navigate("/auth/login", {
          replace: true,
          state: { sessionRevoked: true, cleanupWarning },
        });
        return;
      }

      setSessions((currentSessions) =>
        currentSessions.filter((currentSession) => currentSession.id !== session.id),
      );
      setSessionsNotice("The selected session has been revoked.");
    } catch (requestError) {
      setSessionsError(
        requestError instanceof Error
          ? requestError.message
          : "Could not revoke this session.",
      );
    } finally {
      setRevokingSessionId(null);
    }
  };

  return (
    <PublicLayout>
      <main className="form-page">
        <div className="page-shell">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            ACCOUNT SETTINGS
          </span>
          <h1 className="page-title">Your profile</h1>
          <p className="page-subtitle">
            Keep your name and email address up to date.
          </p>

          {loading && (
            <div className="loading-state" role="status">
              Loading your profile...
            </div>
          )}

          {!loading && !profile && (
            <div className="empty-state" role="alert">
              <h2>Profile unavailable</h2>
              <p>{error || "Please sign in to manage your profile."}</p>
              <Link className="button" to="/auth/login">
                Sign in
              </Link>
            </div>
          )}

          {!loading && profile && (
            <>
              <section className="job-form-card" aria-labelledby="profile-section-title">
                <h2 id="profile-section-title">Profile details</h2>
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-field form-field-full">
                      <label htmlFor="profile-full-name">Full name</label>
                      <input
                        id="profile-full-name"
                        name="full_name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="form-field form-field-full">
                      <label htmlFor="profile-email">Email address</label>
                      <input
                        id="profile-email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {error && <p className="status-message" role="alert">{error}</p>}
                  {success && <p className="status-success" role="status">{success}</p>}

                  <div className="form-actions">
                    <button className="button" type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="job-form-card" aria-labelledby="password-section-title">
                <h2 id="password-section-title">Change password</h2>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="form-grid">
                    <div className="form-field form-field-full">
                      <label htmlFor="current-password">Current password</label>
                      <input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    <div className="form-field form-field-full">
                      <label htmlFor="new-password">New password</label>
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="form-field form-field-full">
                      <label htmlFor="confirm-password">Confirm new password</label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  {passwordError && <p className="status-message" role="alert">{passwordError}</p>}

                  <div className="form-actions">
                    <button className="button" type="submit" disabled={passwordSaving}>
                      {passwordSaving ? "Changing..." : "Change password"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="job-form-card" aria-labelledby="sessions-section-title">
                <h2 id="sessions-section-title">Active sessions</h2>
                <p>Review and revoke sessions connected to your account.</p>

                {sessionsLoading && (
                  <div className="loading-state" role="status">
                    Loading active sessions...
                  </div>
                )}
                {sessionsError && <p className="status-message" role="alert">{sessionsError}</p>}
                {sessionsNotice && <p className="status-success" role="status">{sessionsNotice}</p>}

                {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                  <p className="empty-state">There are no active sessions.</p>
                )}

                {!sessionsLoading && sessions.length > 0 && (
                  <div className="portal-table-scroll">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th scope="col">Session</th>
                          <th scope="col">Last used</th>
                          <th scope="col">Expires</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              {session.user_agent || "Unknown device"}
                              {session.is_current && <small>Current session</small>}
                            </td>
                            <td>
                              {session.last_used_at
                                ? formatDateTime(session.last_used_at)
                                : "Not used yet"}
                            </td>
                            <td>{formatDateTime(session.expires_at)}</td>
                            <td>
                              <button
                                className="portal-action portal-delete"
                                type="button"
                                onClick={() => void handleRevokeSession(session)}
                                disabled={revokingSessionId === session.id}
                              >
                                {revokingSessionId === session.id ? "Revoking..." : "Revoke"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </PublicLayout>
  );
}

export default ProfileSettings;
