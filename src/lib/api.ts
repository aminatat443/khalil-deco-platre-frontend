export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
let csrfToken = "";

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && typeof document !== "undefined") {
    const csrfCookie = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("kdp_csrf="))
      ?.slice("kdp_csrf=".length);
    const token = csrfCookie ? decodeURIComponent(csrfCookie) : csrfToken;
    if (token) headers.set("X-CSRF-Token", token);
  }
  const response = await fetch(apiUrl(`/api${path}`), {
    credentials: "include",
    ...options,
    cache: options.cache ?? "no-store",
    headers,
  });
  csrfToken = response.headers.get("X-CSRF-Token") || csrfToken;

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (body?.code === "SESSION_EXPIRED" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kdp:session-expired", { detail: body.error }));
    }
    // Une précision de champ (« RIB invalide… ») parle mieux à l'utilisateur que « Données invalides. ».
    const firstFieldIssue = Array.isArray(body?.details)
      ? body.details.find((detail: { field?: string; message?: string }) => typeof detail?.message === "string")
      : undefined;
    const fieldIssue = firstFieldIssue?.message === "Required" && firstFieldIssue.field
      ? `Le champ « ${firstFieldIssue.field} » est obligatoire.`
      : firstFieldIssue?.message;
    throw new ApiError(
      fieldIssue || body?.error || `Erreur serveur (${response.status})`,
      response.status,
      body?.code,
    );
  }

  const expiresAt = response.headers.get("X-Session-Expires-At");
  const maxExpiresAt = response.headers.get("X-Session-Max-Expires-At");
  if (expiresAt && maxExpiresAt && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kdp:session-updated", {
      detail: { expiresAt, maxExpiresAt },
    }));
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const result = await response.json();
    if (typeof result?.secureLink === "string" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kdp:secure-quote-link", { detail: result.secureLink }));
    }
    return result as T;
  }
  return response.blob() as Promise<T>;
}

export function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}
