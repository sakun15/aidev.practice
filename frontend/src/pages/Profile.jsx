import { useEffect, useState } from "react";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TYPE_LABEL = {
  student: "Student", internships: "Preparing for internships", placements: "Preparing for placements",
  professional: "Working professional", switcher: "Career switcher",
};
const EXP_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ attempts: 0, solved: 0 });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/me/stats"); setStats(data); }
      catch (e) { setErr(errText(e)); }
    })();
  }, []);

  return (
    <div className="space-y-8" data-testid="profile-page">
      <header className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-graphite text-white flex items-center justify-center font-display font-semibold text-[24px]">
          {(user?.full_name || "U").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-[32px] font-semibold tracking-tight">{user?.full_name}</h1>
          <div className="text-body-sm text-fog">{user?.email}</div>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Row label="User type" value={TYPE_LABEL[user?.user_type] || "—"} testid="profile-user-type" />
        <Row label="AI experience level" value={EXP_LABEL[user?.ai_experience] || "—"} testid="profile-ai-exp" />
        <Row label="Problems attempted" value={stats.attempts} testid="profile-attempts" />
        <Row label="Problems solved" value={stats.solved} testid="profile-solved" />
        <Row label="Joined" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"} testid="profile-joined" />
        <Row label="Role" value={user?.role || "—"} testid="profile-role" />
      </div>

      {err && <div className="text-red-600 text-body-sm">{err}</div>}
    </div>
  );
}

function Row({ label, value, testid }) {
  return (
    <div className="surface-card p-5" data-testid={testid}>
      <div className="text-caption text-fog uppercase tracking-wider">{label}</div>
      <div className="font-display text-[22px] font-semibold tracking-tight mt-1">{value}</div>
    </div>
  );
}
