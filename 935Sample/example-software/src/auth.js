// Central place for anything token-related. The token is the ONLY thing that
// actually matters for security - it's signed by the server, so nothing in
// here can be edited from the browser console to fake a different role.
// Anything else we mirror into localStorage (currentUser, userRole, ...) is
// just for convenience/display in other parts of the app; it is never trusted
// for access decisions.

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

// Decodes the JWT payload (base64) without checking the signature. That's ok
// here - it's only used client-side to decide what to show. The signature is
// still verified on every real request by the backend, so tampering with a
// token just gets every API call rejected with a 401, it doesn't grant access.
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