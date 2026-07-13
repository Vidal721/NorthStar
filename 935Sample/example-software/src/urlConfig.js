import { getApiBaseUrl, getConnectionMode } from "./apiConfig";

/**
 * Backend base URL for API calls.
 * Delegates to getApiBaseUrl() so Vite dev uses the /backend proxy.
 */
export function useURL() {
  const url = getApiBaseUrl();
  console.log(
    `From url config Using ${url}` +
      (url === "/backend" ? " (Vite proxy)" : ` (${getConnectionMode()})`) +
      " as the backend url.",
  );
  return url;
}
