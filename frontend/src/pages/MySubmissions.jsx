import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { Github } from "lucide-react";

export default function MySubmissions() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/submissions"); setItems(data); }
      catch (e) { setErr(errText(e)); }
    })();
  }, []);

  return (
    <div className="space-y-8" data-testid="submissions-page">
      <header>
        <h1 className="font-display text-[40px] font-semibold tracking-tight">My submissions</h1>
        <p className="text-body text-slate2 mt-1 font-light">Every repository you've shipped, in one place.</p>
      </header>

      {err && <div className="text-red-600 text-body-sm">{err}</div>}

      {items.length === 0 ? (
        <div className="surface-card p-10 text-center" data-testid="submissions-empty">
          <div className="font-display text-[22px] font-semibold">No submissions yet</div>
          <p className="text-body-sm text-fog mt-2">Solve your first challenge to see it here.</p>
          <Link to="/challenges" className="btn-pill btn-primary mt-6 inline-flex">Browse challenges</Link>
        </div>
      ) : (
        <div className="surface-card divide-y divide-bone">
          {items.map((s) => (
            <div key={s.id} className="p-5 flex items-center justify-between gap-4" data-testid={`sub-${s.id}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`pill ${s.challenge_difficulty === "Easy" ? "pill-easy" : s.challenge_difficulty === "Medium" ? "pill-medium" : "pill-hard"}`}>
                    {s.challenge_difficulty}
                  </span>
                  <Link to={`/challenges/${s.challenge_slug}`} className="text-[15px] font-medium truncate">{s.challenge_title}</Link>
                </div>
                <div className="text-caption text-fog mt-1">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <a href={s.github_url} target="_blank" rel="noreferrer" className="btn-pill btn-outline text-[13px]">
                <Github size={13} /> View repo
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
