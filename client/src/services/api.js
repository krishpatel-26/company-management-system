
const API_BASE = "/api";

// Keep authentication isolated per browser tab.
// sessionStorage is separate between tabs, unlike localStorage.
export function getAuthToken() {
  return sessionStorage.getItem("authToken") || "";
}

export function setAuthSession(token, employee = null) {
  sessionStorage.setItem("authToken", token);

  if (employee) {
    sessionStorage.setItem("currentUser", JSON.stringify(employee));
  } else {
    sessionStorage.removeItem("currentUser");
  }
}

export function getCurrentUser() {
  try {
    const user = sessionStorage.getItem("currentUser");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("currentUser");
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
}
