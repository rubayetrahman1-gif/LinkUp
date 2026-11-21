
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/auth/refresh`,
                    {
                        method: "POST",
                        credentials: "include",
                    }
                );

                if (!response.ok) return null;

                const data = await response.json();

                if (!data.access_token) return null;

                localStorage.setItem("access_token", data.access_token);

                return data.access_token;
            } catch {
                return null;
            }
        })().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
) {
    const sendRequest = (token: string | null) => {
        const headers = new Headers(options.headers);

        headers.set("Content-Type", "application/json");

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        } else {
            headers.delete("Authorization");
        }

        return fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            credentials: "include",
            headers,
        });
    };

    const token = localStorage.getItem("access_token");

    let response = await sendRequest(token);

    const excludedEndpoints = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/logout",
    ];

    if (
        response.status === 401 &&
        !excludedEndpoints.includes(endpoint)
    ) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            response = await sendRequest(newToken);
        } else {
            localStorage.removeItem("access_token");
            throw new Error("Session expired. Please log in again.");
        }
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Something went wrong");
    }

    return data;
}