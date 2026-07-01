import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Flame, Trophy, Target, Sparkles } from "lucide-react";

const EXP_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

function DifficultyPill({ d }) {
  const c = d === "Easy" ? "pill-easy" : d === "Medium" ? "pill-medium" : "pill-hard";
  return <span className={`pill ${c}`}>{d}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: c }, { data: r }] = await Promise.all([
          api.get("/me/stats"), api.get("/challenges"), api.get("/submissions"),
        ]);
        setStats(s); setChallenges(c); setRecent(r.slice(0, 4));
      } catch (e) { setErr(errText(e)); }
    })();
  }, []);

  const attempted = new Set(recent.map((s) => s.challenge_slug));
  const continueList = challenges.filter((c) => attempted.has(c.slug)).slice(0, 3);
  const recommended = challenges
    .filter((c) => !attempted.has(c.slug))
    .filter((c) => {
      if (user?.ai_experience === "beginner") return c.difficulty === "Easy";
      if (user?.ai_experience === "intermediate") return c.difficulty !== "Hard";
      return true;
    })
    .slice(0, 4);

  return (
    <div className="space-y-10" data-testid="dashboard-page">
      <header className="animate-fade-in-up">
        <div className="text-caption text-fog uppercase tracking-wider">Welcome back</div>
        <h1 className="font-display mt-1 text-[40px] font-semibold tracking-tight leading-tight">
          Hi {user?.full_name?.split(" ")[0] || "there"}.
        </h1>
        <p className="text-body text-slate2 mt-1 font-light">
          Your AI skill level: <span className="text-graphite font-medium">{EXP_LABEL[user?.ai_experience] || "—"}</span>
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Target} label="Problems solved" value={stats?.solved ?? "—"} testid="stat-solved" />
        <StatCard icon={Flame} label="Current streak" value={stats?.streak ?? "—"} suffix="days" testid="stat-streak" />
        <StatCard icon={Trophy} label="Overall score" value={stats?.score ?? "—"} testid="stat-score" />
        <StatCard icon={Sparkles} label="Attempts" value={stats?.attempts ?? "—"} testid="stat-attempts" />
      </section>

      {continueList.length > 0 && (
        <section>
          <SectionHeader title="Continue practicing" href="/submissions" />
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            {continueList.map((c) => <MiniChallengeCard key={c.slug} c={c} />)}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Recommended challenges" href="/challenges" />
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {recommended.map((c) => (
            <Link to={`/challenges/${c.slug}`} key={c.slug} className="surface-card p-5 hover:shadow-[var(--shadow-soft)] transition-shadow" data-testid={`rec-${c.slug}`}>
              <div className="flex items-center gap-2 text-caption text-fog">
                <span>{c.category}</span> · <span>{c.estimated_time}</span>
              </div>
              <div className="mt-2 text-[17px] font-semibold text-graphite">{c.title}</div>
              <div className="mt-3 flex items-center justify-between">
                <DifficultyPill d={c.difficulty} />
                <ArrowRight size={15} className="text-fog" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Recent attempts" href="/submissions" />
        {recent.length === 0 ? (
          <div className="mt-4 surface-card p-6 text-body-sm text-fog" data-testid="no-attempts">
            No submissions yet — pick a challenge and ship your first one.
          </div>
        ) : (
          <div className="mt-4 surface-card divide-y divide-bone" data-testid="recent-list">
            {recent.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-medium">{s.challenge_title}</div>
                  <div className="text-caption text-fog mt-0.5">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <a href={s.github_url} target="_blank" rel="noreferrer" className="text-body-sm link-blue">Repo →</a>
              </div>
            ))}
          </div>
        )}
      </section>

      {err && <div className="text-red-600 text-body-sm">{err}</div>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, testid }) {
  return (
    <div className="surface-card p-5" data-testid={testid}>
      <Icon size={16} strokeWidth={1.75} className="text-fog" />
      <div className="mt-3 font-display text-[32px] leading-none font-semibold tracking-tight">
        {value}{suffix && <span className="text-body-sm text-fog font-normal ml-1">{suffix}</span>}
      </div>
      <div className="mt-1 text-caption text-fog">{label}</div>
    </div>
  );
}

function SectionHeader({ title, href }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-[22px] font-semibold tracking-tight">{title}</h2>
      {href && <Link to={href} className="text-body-sm link-blue">View all</Link>}
    </div>
  );
}

function MiniChallengeCard({ c }) {
  return (
    <Link to={`/challenges/${c.slug}`} className="surface-card p-4 hover:shadow-[var(--shadow-soft)] transition-shadow">
      <div className="flex items-center justify-between">
        <DifficultyPill d={c.difficulty} />
        <span className="text-caption text-fog">{c.category}</span>
      </div>
      <div className="mt-3 text-[15px] font-semibold">{c.title}</div>
      <div className="text-caption text-fog mt-1">{c.estimated_time}</div>
    </Link>
  );
}
