
import { apiRequest } from "./api";

import type {
    UserRegister,
    UserLogin,
    User,
    ActiveSession,
    LoginResponse,
    PasswordChangeInput,
    UserUpdate,
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

export async function updateCurrentUser(userData: UserUpdate): Promise<User> {
    return apiRequest("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(userData),
    });
}

export async function changeCurrentPassword(
    passwordData: PasswordChangeInput,
): Promise<{ message: string }> {
    return apiRequest("/api/users/me/change-password", {
        method: "POST",
        body: JSON.stringify(passwordData),
    });
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
    return apiRequest("/api/auth/sessions");
}

export async function revokeSession(sessionId: number): Promise<{ message: string }> {
    return apiRequest(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
    });
}

// Logout user
export async function logoutUser(): Promise<void> {
    try {
        await apiRequest("/api/auth/logout", {
            method: "POST",
        });
    } finally {
        localStorage.removeItem("access_token");
    }
}
