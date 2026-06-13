export const CONNECTION_MODE_KEY = "connectionMode";

export const API_ENDPOINTS = {
  local: "http://localhost:3000",
  online: "https://taco-childhood-jailbreak.ngrok-free.dev",
};

export function getConnectionMode() {
  return localStorage.getItem(CONNECTION_MODE_KEY) === "local"
    ? "local"
    : "online";
}

export function getApiBaseUrl() {
  return API_ENDPOINTS[getConnectionMode()];
}

export function setConnectionMode(mode) {
  const nextMode = mode === "online" ? "online" : "local";
  localStorage.setItem(CONNECTION_MODE_KEY, nextMode);
  window.dispatchEvent(
    new CustomEvent("connection-mode-change", { detail: { mode: nextMode } })
  );
  return nextMode;
}

export function getDefaultHeaders(extraHeaders = {}) {
  return {
    "ngrok-skip-browser-warning": "69420",
    ...extraHeaders,
  };
}
