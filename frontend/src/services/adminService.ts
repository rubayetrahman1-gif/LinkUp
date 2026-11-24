import { apiRequest } from "./api";

export interface AdminDashboardOverview {
  users: {
    total: number;
    by_role: {
      job_seeker: number;
      employer: number;
      admin: number;
    };
    active: number;
    inactive: number;
    banned: number;
  };
  content: {
    jobs: number;
    applications: number;
    applications_by_status: Record<string, number>;
  };
  groups: {
    available: boolean;
    total: number | null;
  };
  last_7_days: {
    new_users: number;
    job_posts: number;
  };
  recent_activity: {
    id: string;
    type: "user_registered" | "job_posted" | "audit_event";
    actor: string;
    action: string;
    target: string;
    occurred_at: string;
  }[];
}

export interface AdminTeamMember {
  user_id: number;
  full_name: string;
  email: string;
  role: "owner" | "recruiter" | "reviewer";
  joined_at: string;
}

export interface AdminTeamList {
  summary: {
    groups_total: number;
    active_groups: number;
    archived_groups: number;
    members_total: number;
    team_jobs_total: number;
    team_applications_total: number;
  };
  items: {
    id: number;
    name: string;
    created_at: string;
    deleted_at: string | null;
    is_archived: boolean;
    owner: {
      user_id: number;
      full_name: string;
      email: string;
    };
    members: AdminTeamMember[];
    job_count: number;
    application_count: number;
  }[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type AdminRole = "job_seeker" | "employer" | "admin";
export type AdminUserStatus = "active" | "inactive" | "banned";

export interface AdminUserSummary {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
}

export interface AdminUserList {
  items: AdminUserSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminUserDetails {
  user: AdminUserSummary & {
    locked_until: string | null;
    banned_at: string | null;
    banned_by_id: number | null;
  };
  activity: {
    id: string;
    type: string;
    description: string;
    occurred_at: string | null;
  }[];
  sessions: {
    id: number;
    user_agent: string | null;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    is_active: boolean;
  }[];
  groups: {
    available: boolean;
    memberships: { id: number; name: string; role: string }[];
  };
}

export type AdminContentType = "jobs" | "applications";
export type AdminApplicationStatus =
  | "Pending"
  | "Under Review"
  | "Accepted"
  | "Rejected";

export interface AdminContentList {
  items: {
    id: number;
    content_type: AdminContentType;
    title: string;
    summary: string;
    owner_id: number;
    owner_name: string;
    owner_email: string;
    job_id: number;
    status: AdminApplicationStatus | null;
    created_at: string | null;
  }[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminAuditLogList {
  items: {
    id: number;
    action: string;
    actor_user_id: number | null;
    actor_name: string | null;
    target_user_id: number | null;
    target_user_name: string | null;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  }[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminSecurityOverview {
  since: string;
  since_hours: number;
  failed_login_total: number;
  by_ip: { ip_address: string; attempt_count: number }[];
  by_account: { account: string; attempt_count: number }[];
  recent_events: {
    id: number;
    action: string;
    target_id: string | null;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  }[];
}

export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  return apiRequest<AdminDashboardOverview>("/api/admin/dashboard/overview");
}

export function getAdminTeams(
  page: number,
  pageSize: number,
): Promise<AdminTeamList> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return apiRequest<AdminTeamList>(`/api/admin/teams?${params.toString()}`);
}

export async function getAdminUsers(filters: {
  search?: string;
  role?: AdminRole;
  status?: AdminUserStatus;
  page: number;
  pageSize: number;
}): Promise<AdminUserList> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  return apiRequest<AdminUserList>(`/api/admin/users?${params.toString()}`);
}

export async function getAdminUserDetails(
  userId: number,
): Promise<AdminUserDetails> {
  return apiRequest<AdminUserDetails>(`/api/admin/users/${userId}`);
}

export async function banAdminUser(
  userId: number,
  reason: string,
): Promise<void> {
  await apiRequest(`/api/admin/users/${userId}/ban`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function unbanAdminUser(userId: number): Promise<void> {
  await apiRequest(`/api/admin/users/${userId}/unban`, {
    method: "POST",
  });
}

export async function updateAdminUserRole(
  userId: number,
  role: AdminRole,
): Promise<void> {
  await apiRequest(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function revokeAdminUserSession(
  userId: number,
  sessionId: number,
): Promise<void> {
  await apiRequest(
    `/api/admin/users/${userId}/sessions/${sessionId}/revoke`,
    { method: "POST" },
  );
}

export async function bulkUpdateAdminUsers(input: {
  action: "ban" | "unban";
  user_ids: number[];
  reason?: string;
}): Promise<{ affected_count: number }> {
  return apiRequest("/api/admin/users/bulk-action", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAdminContent(filters: {
  contentType: AdminContentType;
  search?: string;
  applicationStatus?: AdminApplicationStatus;
  page: number;
  pageSize: number;
}): Promise<AdminContentList> {
  const params = new URLSearchParams({
    content_type: filters.contentType,
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.applicationStatus) {
    params.set("application_status", filters.applicationStatus);
  }
  return apiRequest<AdminContentList>(
    `/api/admin/content?${params.toString()}`,
  );
}

export async function deleteAdminContent(
  contentType: AdminContentType,
  recordId: number,
): Promise<{ deleted_count: number }> {
  return apiRequest(
    `/api/admin/content/${contentType}/${recordId}`,
    { method: "DELETE" },
  );
}

export async function bulkDeleteAdminContent(input: {
  content_type: AdminContentType;
  record_ids: number[];
}): Promise<{ deleted_count: number }> {
  return apiRequest("/api/admin/content/bulk-delete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAdminAuditLogs(filters: {
  search?: string;
  action?: string;
  ipAddress?: string;
  startAt?: string;
  endAt?: string;
  page: number;
  pageSize: number;
}): Promise<AdminAuditLogList> {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.action) params.set("action", filters.action);
  if (filters.ipAddress) params.set("ip_address", filters.ipAddress);
  if (filters.startAt) params.set("start_at", filters.startAt);
  if (filters.endAt) params.set("end_at", filters.endAt);
  return apiRequest<AdminAuditLogList>(
    `/api/admin/audit-logs?${params.toString()}`,
  );
}

export async function getAdminSecurityOverview(
  sinceHours: number,
): Promise<AdminSecurityOverview> {
  return apiRequest<AdminSecurityOverview>(
    `/api/admin/security/overview?since_hours=${sinceHours}`,
  );
}

export async function exportAdminCsv(endpoint: string): Promise<string> {
  return apiRequest<string>(endpoint);
}
