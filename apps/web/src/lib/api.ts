export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sesión expirada");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error desconocido" }));
    const detail = typeof error.detail === "object"
      ? JSON.stringify(error.detail)
      : error.detail || `HTTP ${res.status}`;
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
