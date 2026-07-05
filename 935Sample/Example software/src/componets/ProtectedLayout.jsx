import { Navigate, Outlet } from 'react-router-dom';

// 1. Add 'allowedSubgroups' to the destructuring props
export default function ProtectedLayout({ allowedRoles, allowedSubgroups }) {
  
  // (Replace this with your actual user state/context logic)
  const user = getCurrentUser(); 
  
  const username = user?.username;
  const role = user?.role?.toLowerCase();
  
  // Pull the subgroup from your user object ("Manufacturing")
  const subgroup = user?.subgroup?.toLowerCase(); 

  // Normalize the allowed arrays to lowercase
  const normalizedAllowedRoles = allowedRoles?.map((r) => r.toLowerCase());
  const normalizedAllowedSubgroups = allowedSubgroups?.map((s) => s.toLowerCase());

  // Check 1: Is the user logged in?
  if (!username) {
    return <Navigate to="/" replace />;
  }

  // Check 2: Original Role Check
  if (normalizedAllowedRoles && !normalizedAllowedRoles.includes(role)) {
    return handleFallback(role);
  }

  // Check 3: Copied Subgroup Check (The new part!)
  if (normalizedAllowedSubgroups && !normalizedAllowedSubgroups.includes(subgroup)) {
    return handleFallback(role);
  }

  return <Outlet />;
}

// Your existing fallback router helper
function handleFallback(role) {
  const fallbackByRole = {
    admin: "/admin",
    family: "/family",
    helper: "/helper",
    student: "/student",
    students: "/student",
  };
  return <Navigate to={fallbackByRole[role] || "/scout"} replace />;
}