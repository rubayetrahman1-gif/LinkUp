export interface UserRegister {
    full_name: string;
    email: string;
    password: string;
    role: "job_seeker" | "employer";
}

export interface UserLogin {
    email: string;
    password: string;
}

export interface User {
    id: number;
    full_name: string;
    email: string;
    role: "job_seeker" | "employer" | "admin";
    is_active: boolean;
    created_at: string;
}

export interface UserUpdate {
    full_name: string;
    email: string;
}

export interface PasswordChangeInput {
    current_password: string;
    new_password: string;
}

export interface ActiveSession {
    id: number;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
    user_agent: string | null;
    is_current: boolean;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
}
