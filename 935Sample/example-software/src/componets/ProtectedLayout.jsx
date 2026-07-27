import { Navigate, Outlet } from 'react-router-dom';
import PushNotifications from "./PushNotifications";

export default function ProtectedLayout({ 
  allowedRoles, 
  allowedSubgroups, 
  allowedCompetitionRoles // 1. Pass the new prop here
}) {
  const username = localStorage.getItem('currentUser');
  const role = localStorage.getItem('userRole');
  const subgroup = localStorage.getItem('userSubgroup'); 
  
  // 2. Grab the new competition role variable from localStorage
  const competitionRole = localStorage.getItem('userCompetitionRole');

  // If not authenticated at all, kick out to login
  if (!username) {
    return <Navigate to="/" replace />;
  }

  // Check 1: Main system role
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Check 2: Subgroup check
  if (allowedSubgroups && !allowedSubgroups.includes(subgroup)) {
    return <Navigate to="/students" replace />;
  }

  // Check 3: Competition role check
  if (allowedCompetitionRoles && !allowedCompetitionRoles.includes(competitionRole)) {
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