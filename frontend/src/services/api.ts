const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

let refreshPromise: Promise<string | null> | null = null;
let sessionCleanupPromise: Promise<void> | null = null;

function clearSessionAndRedirect(): Promise<void> {
  if (!sessionCleanupPromise) {
    localStorage.removeItem("access_token");
    sessionCleanupPromise = (async () => {
      if (typeof window === "undefined") return;

      const cleanupFailed = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).then(
        (response) => !response.ok,
        () => true,
      );

      const cleanupQuery = cleanupFailed ? "&cleanup=failed" : "";
      window.location.replace(
        `/auth/login?reason=session-expired${cleanupQuery}`,
      );
    })();
  }

  return sessionCleanupPromise;
}


async function parseResponse(response: Response): Promise<any> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json")) {
    try {
      return await response.json();
    } catch {
      if (!response.ok) {
        return {
          detail: `Request failed (${response.status}). The server returned invalid JSON.`,
        };
      }

      throw new Error("The server returned invalid JSON.");
    }
  }

  const responseText = await response.text();

  if (!response.ok) {
    return {
      detail: `Request failed (${response.status}). The server returned a non-JSON response.`,
    };
  }

  if (!responseText.trim()) {
    return null;
  }

  throw new Error("The server returned an unexpected non-JSON response.");
}


async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) return null;

        const data = await parseResponse(response);

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

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
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

  if (response.status === 401 && !excludedEndpoints.includes(endpoint)) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      response = await sendRequest(newToken);

      if (response.status === 401) {
        await clearSessionAndRedirect();
        throw new Error("Session expired. Please log in again.");
      }
    } else {
      await clearSessionAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
  }

 const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(data.detail || "Something went wrong");
  }

  return data;
}
