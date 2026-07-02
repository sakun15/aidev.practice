import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { ArrowLeft, Clock, Github, CheckCircle2, Loader2 } from "lucide-react";

export default function ChallengeDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [ch, setCh] = useState(null);
  const [github, setGithub] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(`/challenges/${slug}`); setCh(data); }
      catch (e) { setErr(errText(e)); }
    })();
  }, [slug]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/submissions", { challenge_id: slug, github_url: github });
      if (data?.eval_enabled) { navigate(`/submissions/${data.id}/interview`); return; }
      setSuccess(true);
      setGithub("");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ch) return <div className="text-fog text-body-sm">Loading…</div>;

  const diffClass = ch.difficulty === "Easy" ? "pill-easy" : ch.difficulty === "Medium" ? "pill-medium" : "pill-hard";

  return (
    <div className="space-y-8" data-testid="challenge-detail">
      <button onClick={() => navigate(-1)} className="text-body-sm text-fog inline-flex items-center gap-1 hover:text-graphite">
        <ArrowLeft size={14} /> Back
      </button>

      <header className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span className={`pill ${diffClass}`}>{ch.difficulty}</span>
          <span className="text-caption text-fog">{ch.category}</span>
          <span className="text-caption text-fog inline-flex items-center gap-1"><Clock size={12} /> {ch.estimated_time}</span>
        </div>
        <h1 className="font-display text-[44px] font-semibold tracking-tight mt-4 leading-[1.05]">{ch.title}</h1>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="surface-card p-6">
            <div className="text-caption text-fog uppercase tracking-wider">Problem statement</div>
            <p className="text-body text-slate2 mt-3 font-light leading-relaxed">{ch.description}</p>
          </div>

          <div className="surface-card p-6">
            <div className="text-caption text-fog uppercase tracking-wider">Requirements</div>
            <ul className="mt-3 space-y-2">
              {ch.requirements?.map((r, i) => (
                <li key={i} className="flex gap-3 text-body-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-graphite shrink-0" />
                  <span className="text-slate2">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-6">
            <div className="text-caption text-fog uppercase tracking-wider">Acceptance criteria</div>
            <ul className="mt-3 space-y-2">
              {ch.acceptance?.map((r, i) => (
                <li key={i} className="flex gap-3 text-body-sm">
                  <CheckCircle2 size={14} className="text-graphite mt-1 shrink-0" />
                  <span className="text-slate2">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-6 bg-bone/40">
            <div className="text-caption text-fog uppercase tracking-wider">Submission instructions</div>
            <p className="text-body-sm text-slate2 mt-3">
              Build the project with any framework, language, or AI tool you prefer. Push your code to a public
              GitHub repository and paste the URL below. We store the link — no code analysis (yet).
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-6 sticky top-6" data-testid="submission-form">
            <div className="text-caption text-fog uppercase tracking-wider">Submit your solution</div>
            {success ? (
              <div className="mt-5 animate-fade-in-up" data-testid="submission-success">
                <CheckCircle2 size={26} className="text-green-600" />
                <div className="font-display font-semibold text-[20px] mt-3">Submission Successful</div>
                <p className="text-body-sm text-fog mt-1">Nice work. Track it under My Submissions.</p>
                <div className="mt-5 flex gap-2">
                  <Link to="/submissions" className="btn-pill btn-outline text-[13px]">View submissions</Link>
                  <button onClick={() => setSuccess(false)} className="btn-pill btn-ghost text-[13px]">Submit another</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3">
                <label className="label">GitHub repository URL</label>
                <div className="relative">
                  <Github size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
                  <input
                    required
                    className="field pl-9"
                    placeholder="https://github.com/user/repo"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    data-testid="submission-github-url"
                  />
                </div>
                {err && <div className="text-body-sm text-red-600" data-testid="submission-error">{err}</div>}
                <button disabled={submitting} className="btn-pill btn-primary w-full" data-testid="submission-submit">
                  {submitting ? (<><Loader2 size={14} className="animate-spin" /> Submitting…</>) : "Submit"}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
