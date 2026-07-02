import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Challenges from "@/pages/Challenges";
import ChallengeDetail from "@/pages/ChallengeDetail";
import MySubmissions from "@/pages/MySubmissions";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";

function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return null;
  if (user && user.onboarded) return <Navigate to="/dashboard" replace />;
  if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/onboarding"
              element={<ProtectedRoute requireOnboarded={false}><Onboarding /></ProtectedRoute>}
            />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/:slug" element={<ChallengeDetail />} />
              <Route path="/submissions" element={<MySubmissions />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
