import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedLayout({ allowedRoles }) {
  const username = localStorage.getItem('currentUser');
  const role = localStorage.getItem('userRole')?.toLowerCase();
  const normalizedAllowedRoles = allowedRoles?.map((allowedRole) => allowedRole.toLowerCase());

  // 1. If not authenticated at all, kick out to main screen login
  if (!username) {
    return <Navigate to="/" replace />;
  }

  // 2. If authenticated but role isn't inside allowed bounds, force back to secure user space hub
  if (normalizedAllowedRoles && !normalizedAllowedRoles.includes(role)) {
    return <Navigate to="/scout" replace />;
  }

  // 3. Permitted access layout rendering
  return <Outlet />;
}
