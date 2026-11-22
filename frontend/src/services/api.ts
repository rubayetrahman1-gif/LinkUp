const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RefreshResult =
  | { accessToken: string }
  | { failure: "rejected" | "unavailable" };

let refreshPromise: Promise<RefreshResult> | null = null;
let sessionCleanupPromise: Promise<void> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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


async function parseResponse(response: Response): Promise<unknown> {
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


async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise;

  const pendingRefresh = (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.status === 401) return { failure: "rejected" };
      if (!response.ok) return { failure: "unavailable" };

      const data = await parseResponse(response);

      if (!isRecord(data) || typeof data.access_token !== "string" || !data.access_token) {
        return { failure: "unavailable" };
      }

      localStorage.setItem("access_token", data.access_token);

      return { accessToken: data.access_token };
    } catch {
      return { failure: "unavailable" };
    }
  })();

  const sharedRefresh = pendingRefresh.finally(() => {
    refreshPromise = null;
  });
  refreshPromise = sharedRefresh;
  return sharedRefresh;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
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
    const refreshResult = await refreshAccessToken();

    if ("accessToken" in refreshResult) {
      response = await sendRequest(refreshResult.accessToken);

      if (response.status === 401) {
        await clearSessionAndRedirect();
        throw new Error("Session expired. Please log in again.");
      }
    } else if (refreshResult.failure === "rejected") {
      await clearSessionAndRedirect();
      throw new Error("Session expired. Please log in again.");
    } else {
      throw new Error("Could not refresh your session. Please try again.");
    }
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const detail = isRecord(data) && typeof data.detail === "string"
      ? data.detail
      : "Something went wrong";
    throw new Error(detail);
  }

  return data as T;
}
