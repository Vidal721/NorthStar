import { Navigate, Outlet } from "react-router-dom";
import PushNotifications from "./PushNotifications";
import { getSession, clearToken } from "../auth";

export default function ProtectedLayout({
  allowedRoles,
  allowedSubgroups,
  allowedCompetitionRoles,
}) {
  // getSession() decodes the JWT the server signed at login. Someone can still
  // edit userRole/userSubgroup/etc in localStorage from devtools, but those
  // values are no longer read here - only the token's claims matter, and the
  // token can't be forged without the server's secret. Any real data request
  // these pages make is also re-checked against this same token on the
  // backend, so even a stale/expired route guard here can't grant real access.
  const session = getSession();

  if (!session) {
    clearToken();
    return <Navigate to="/" replace />;
  }

  const { role, subgroup, competitionRole } = session;

  // Check 1: Main system role
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Check 2: Subgroup check
  if (allowedSubgroups && !allowedSubgroups.includes(subgroup)) {
    return <Navigate to="/students" replace />;
  }

  // Check 3: Competition role check
  if (
    allowedCompetitionRoles &&
    !allowedCompetitionRoles.includes(competitionRole)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // Permitted access layout rendering
  return (
    <>
      <PushNotifications />
      <Outlet />
    </>
  );
}
