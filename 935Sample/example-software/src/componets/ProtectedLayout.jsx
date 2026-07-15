import { Navigate, Outlet } from 'react-router-dom';
import PushNotifications from "./PushNotifications";

// 1. Add allowedSubgroups to the parameters
export default function ProtectedLayout({ allowedRoles, allowedSubgroups }) {
  const username = localStorage.getItem('currentUser');
  const role = localStorage.getItem('userRole');
  // Grab the subgroup from localStorage just like the username and role
  const subgroup = localStorage.getItem('userSubgroup'); 

  // 2. If not authenticated at all, kick out to main screen login
  if (!username) {
    return <Navigate to="/" replace />;
  }

  // 3. If authenticated but role isn't inside allowed bounds
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/scout" replace />;
  }

  // 4. Copied Logic: If subgroup isn't inside allowed bounds, kick them out too
  if (allowedSubgroups && !allowedSubgroups.includes(subgroup)) {
    return <Navigate to="/scout" replace />;
  }

  // 5. Permitted access layout rendering
  return <><PushNotifications /><Outlet /></>;
}
