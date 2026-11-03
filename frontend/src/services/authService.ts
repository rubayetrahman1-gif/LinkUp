
import { apiRequest } from "./api";

import type {
    UserRegister,
    UserLogin,
    User,
    LoginResponse,
} from "../types/auth";

// Register a new user
export async function registerUser(userData: UserRegister): Promise<User> {
    return apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
    });
}

// Login user
export async function loginUser(userData: UserLogin): Promise<LoginResponse> {
    const data: LoginResponse = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(userData),
    });

    localStorage.setItem("access_token", data.access_token);

    return data;
}

// Get logged-in user's profile
export async function getCurrentUser(): Promise<User> {
    return apiRequest("/api/users/me");
}

// Logout user
export function logoutUser(): void {
    localStorage.removeItem("access_token");
}

