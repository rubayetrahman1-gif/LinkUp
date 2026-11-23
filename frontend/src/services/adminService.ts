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
    type: "user_registered" | "job_posted";
    actor: string;
    action: string;
    target: string;
    occurred_at: string;
  }[];
}

export type AdminRole = "job_seeker" | "employer" | "admin";
export type AdminUserStatus = "active" | "inactive";

export interface AdminUserSummary {
  id: number;
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
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
  user: AdminUserSummary & { locked_until: string | null };
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
    memberships: { id: number; name: string }[];
  };
}

export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  return apiRequest<AdminDashboardOverview>("/api/admin/dashboard/overview");
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
