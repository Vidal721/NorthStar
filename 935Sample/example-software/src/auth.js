const TOKEN_KEY = "authToken";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Returns the verified claims from the current token, or null if there's no
// token, it's malformed, or it's expired. Use this - not raw localStorage
// fields - for any access-control decision in the UI.
export function getSession() {
  const claims = decodeToken(getToken());
  if (!claims) return null;
  if (claims.exp && Date.now() >= claims.exp * 1000) {
    clearToken();
    return null;
  }
  return claims;
}

export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
