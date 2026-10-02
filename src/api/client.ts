/**
 * Central API Client configuration.
 * Reads API base URL from VITE_API_URL or defaults to http://localhost:3000.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  "http://localhost:3000";

/**
 * Builds a fully qualified API URL from a relative path or returns the absolute URL as-is.
 */
export function getApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Custom fetch wrapper that automatically prefixes API_BASE_URL and sets credentials: 'include'.
 */
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  let url: string | URL | Request = input;
  if (typeof input === "string") {
    url = getApiUrl(input);
  }
  return fetch(url, {
    credentials: "include",
    ...init,
  });
}
