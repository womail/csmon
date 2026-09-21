export function apiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (typeof window !== "undefined") {
    const token = window.sessionStorage.getItem("csmon.token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

export async function apiFetch(input: string, init?: RequestInit) {
  const headers = apiHeaders(init?.headers);
  return fetch(input, { ...init, headers });
}
