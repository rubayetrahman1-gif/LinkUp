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

export interface LoginResponse {
    access_token: string;
    token_type: string;
}
