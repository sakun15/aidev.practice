import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-8" data-testid="settings-page">
      <header>
        <h1 className="font-display text-[40px] font-semibold tracking-tight">Settings</h1>
        <p className="text-body text-slate2 mt-1 font-light">Preferences will grow with the platform.</p>
      </header>

      <section className="surface-card p-6">
        <div className="text-caption text-fog uppercase tracking-wider">Account</div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">Email</div>
              <div className="text-body-sm text-fog">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">Full name</div>
              <div className="text-body-sm text-fog">{user?.full_name}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="text-caption text-fog uppercase tracking-wider">Session</div>
        <div className="mt-3 text-body-sm text-fog">Sign out from this browser.</div>
        <button
          onClick={async () => { await logout(); navigate("/login"); }}
          className="btn-pill btn-dark mt-4"
          data-testid="settings-logout"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
