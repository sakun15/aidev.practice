import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, requireOnboarded = true }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fog text-body-sm" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace state={{ from: location }} />;
  if (requireOnboarded && !user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}
