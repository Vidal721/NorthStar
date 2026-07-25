// ─────────────────────────────────────────────────────────────────────────────
// 🔧 DEV OVERRIDE: Set this to `true` to ALWAYS use the local backend
//    (http://localhost:3000) regardless of the toggle in the Admin dashboard.
//    Set to `false` to use the URL stored in localStorage (Admin toggle).
// ─────────────────────────────────────────────────────────────────────────────
export const USE_LOCAL_BACKEND = false;

export const CONNECTION_MODE_KEY = "useLocalApi";

export const API_ENDPOINTS = {
  local: "http://localhost:3000",
  online: "https://taco-childhood-jailbreak.ngrok-free.dev",
};

function readStoredUseLocalApi() {
  if (typeof window === "undefined") return false;

  const storedValue = localStorage.getItem(CONNECTION_MODE_KEY);
  if (storedValue === null) {
    const legacyValue = localStorage.getItem("connectionMode");
    if (legacyValue === "local") return true;
    if (legacyValue === "online") return false;
    return false;
  }

  return storedValue === "true";
}

export function getUseLocalApi() {
  if (USE_LOCAL_BACKEND) return true;
  return readStoredUseLocalApi();
}

export function getConnectionMode() {
  return getUseLocalApi() ? "local" : "online";
}

/** In Vite dev on localhost, use same-origin `/backend` proxy (avoids CORS + ngrok interstitial). */
export function getApiBaseUrl() {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "/backend";
    }
  }
  return API_ENDPOINTS[getConnectionMode()];
}

export function setUseLocalApi(useLocalApi) {
  const nextValue = Boolean(useLocalApi);
  if (typeof window !== "undefined") {
    localStorage.setItem(CONNECTION_MODE_KEY, String(nextValue));
    localStorage.removeItem("connectionMode");
    window.dispatchEvent(
      new CustomEvent("connection-mode-change", {
        detail: { mode: nextValue ? "local" : "online", useLocalApi: nextValue },
      }),
    );
  }
  return nextValue;
}

export function setConnectionMode(mode) {
  return setUseLocalApi(mode === "local" || mode === true);
}

export function getDefaultHeaders(extraHeaders = {}) {
  return {
    "ngrok-skip-browser-warning": "69420",
    ...extraHeaders,
  };
}

const API_HOST_PATTERN =
  /ngrok(-free)?\.dev|localhost:3000|127\.0\.0\.1:3000|\/backend/i;

/** True when the URL targets our backend (local, proxy, or ngrok). */
export function isApiUrl(url) {
  return API_HOST_PATTERN.test(String(url || ""));
}

/**
 * Install once at app startup. Ngrok's free interstitial has no CORS headers,
 * which browsers report as a CORS failure — always send the skip-warning header.
 */
export function installApiFetchDefaults() {
  if (typeof window === "undefined" || window.__apiFetchPatched) return;
  window.__apiFetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);

    if (!isApiUrl(url)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("ngrok-skip-browser-warning", "69420");

    return originalFetch(input, { ...init, headers });
  };
}
