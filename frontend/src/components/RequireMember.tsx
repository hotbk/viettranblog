import { Navigate, Outlet } from 'react-router-dom';
import { isMemberAuthenticated } from '../memberAuth';

export default function RequireMember() {
  if (!isMemberAuthenticated()) {
    return <Navigate to="/member/login" replace />;
  }

  return <Outlet />;
}
