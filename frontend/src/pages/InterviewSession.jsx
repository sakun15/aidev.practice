import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { Loader2, CheckCircle2, AlertCircle, XCircle, Github } from "lucide-react";

const VERDICT_STYLE = {
  "strong understanding": { icon: CheckCircle2, cls: "text-green-700 bg-green-50 border-green-200" },
  "partial understanding": { icon: AlertCircle, cls: "text-amber-700 bg-amber-50 border-amber-200" },
  "answer doesn't match the code": { icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [answers, setAnswers] = useState({});
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try { const { data } = await api.get(`/submissions/${id}`); setSub(data); }
    catch (e) { setErr(errText(e)); }
  };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [id]);

  if (err) return <div className="max-w-2xl mx-auto p-10 text-red-600 text-body-sm">{err}</div>;
  if (!sub) return <div className="max-w-2xl mx-auto p-10 text-fog text-body-sm inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Loading…</div>;

  if (sub.status === "submitted") {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center px-6" data-testid="interview-analyzing">
        <div className="surface-card p-10 max-w-md text-center">
          <Loader2 size={22} className="animate-spin mx-auto text-graphite" />
          <div className="font-display text-[22px] font-semibold mt-4">Analyzing your repository…</div>
          <p className="text-body-sm text-fog mt-2">Fetching files and reading the code. This usually takes 20-40 seconds.</p>
        </div>
      </div>
    );
  }
  if (sub.status === "analysis_failed") {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center px-6">
        <div className="surface-card p-10 max-w-md">
          <XCircle size={24} className="text-red-600" />
          <div className="font-display text-[22px] font-semibold mt-3">Analysis failed</div>
          <p className="text-body-sm text-fog mt-2">{sub.analysis_error || "Could not analyze the repository."}</p>
          <Link to="/challenges/login-page" className="btn-pill btn-primary mt-6 inline-flex text-[13px]">Try another repo</Link>
        </div>
      </div>
    );
  }
  if (sub.status === "graded") { navigate(`/submissions/${id}/report`, { replace: true }); return null; }

  const questions = sub.analysis?.questions || [];

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setErr("");
    try {
      await api.post(`/submissions/${id}/answers`, { answers });
      navigate(`/submissions/${id}/report`, { replace: true });
    } catch (e) { setErr(errText(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-cloud py-12 px-6" data-testid="interview-page">
      <div className="max-w-[820px] mx-auto">
        <div className="text-caption text-fog uppercase tracking-wider">Interview</div>
        <h1 className="font-display text-[32px] font-semibold tracking-tight mt-1">{sub.challenge_title}</h1>
        <a href={sub.github_url} target="_blank" rel="noreferrer" className="text-body-sm link-blue inline-flex items-center gap-1 mt-1">
          <Github size={13} /> {sub.github_url}
        </a>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {questions.map((q, i) => (
            <div key={q.id} className="surface-card p-6" data-testid={`q-${q.id}`}>
              <div className="text-caption text-fog">Question {i + 1}</div>
              <div className="text-[17px] font-medium mt-1">{q.question}</div>
              {q.code_reference?.path && (
                <div className="mt-3 rounded-lg bg-bone/60 border border-bone p-3 text-caption font-mono text-slate2 overflow-x-auto">
                  <div className="text-fog mb-1">{q.code_reference.path}</div>
                  <pre className="whitespace-pre-wrap text-[12px] leading-[1.5]">{q.code_reference.snippet}</pre>
                </div>
              )}
              <textarea
                rows={4}
                className="field mt-4 font-mono text-[13px]"
                placeholder="Your answer…"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                data-testid={`a-${q.id}`}
                required
              />
            </div>
          ))}
          {err && <div className="text-body-sm text-red-600">{err}</div>}
          <button disabled={submitting} className="btn-pill btn-primary w-full" data-testid="submit-answers">
            {submitting ? <><Loader2 size={14} className="animate-spin"/> Grading…</> : "Submit answers"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Report() {
  const { id } = useParams();
  const [sub, setSub] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get(`/submissions/${id}`); setSub(data); }
      catch (e) { setErr(errText(e)); }
    })();
  }, [id]);
  if (err) return <div className="p-10 text-red-600">{err}</div>;
  if (!sub) return <div className="p-10 text-fog">Loading…</div>;
  const a = sub.analysis || {};
  const grades = Object.fromEntries((sub.grades || []).map((g) => [g.id, g]));

  return (
    <div className="min-h-screen bg-cloud py-12 px-6" data-testid="report-page">
      <div className="max-w-[880px] mx-auto space-y-8">
        <header>
          <div className="text-caption text-fog uppercase tracking-wider">Interview report</div>
          <h1 className="font-display text-[36px] font-semibold tracking-tight mt-1">{sub.challenge_title}</h1>
          <a href={sub.github_url} target="_blank" rel="noreferrer" className="text-body-sm link-blue inline-flex items-center gap-1 mt-1">
            <Github size={13} /> {sub.github_url}
          </a>
        </header>

        <section className="surface-card p-6">
          <div className="text-caption text-fog uppercase tracking-wider">Requirements</div>
          <ul className="mt-3 space-y-2">
            {(a.requirements || []).map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-body-sm">
                {r.met ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0"/> : <XCircle size={16} className="text-red-600 mt-0.5 shrink-0"/>}
                <div>
                  <div className="text-slate2">{r.requirement}</div>
                  {r.evidence && <div className="text-caption text-fog mt-0.5">Evidence: {r.evidence}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-6">
          <div className="text-caption text-fog uppercase tracking-wider">Code quality</div>
          <ul className="mt-3 space-y-1 text-body-sm text-slate2 list-disc list-inside">
            {(a.code_quality || []).map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </section>

        <section className="space-y-4">
          <div className="text-caption text-fog uppercase tracking-wider">Interview Q&A</div>
          {(a.questions || []).map((q, i) => {
            const g = grades[q.id];
            const style = g ? VERDICT_STYLE[g.verdict] : null;
            const Icon = style?.icon;
            return (
              <div key={q.id} className="surface-card p-5" data-testid={`report-q-${q.id}`}>
                <div className="text-caption text-fog">Q{i + 1}</div>
                <div className="text-[15px] font-medium mt-1">{q.question}</div>
                <div className="mt-3 grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-caption text-fog">Your answer</div>
                    <div className="mt-1 text-body-sm text-slate2 whitespace-pre-wrap">{sub.answers?.[q.id] || "—"}</div>
                  </div>
                  <div>
                    <div className="text-caption text-fog">Verdict</div>
                    {g ? (
                      <div className={`mt-1 inline-flex items-start gap-2 px-3 py-2 rounded-lg border text-body-sm ${style.cls}`}>
                        {Icon && <Icon size={14} className="mt-0.5"/>}
                        <div>
                          <div className="font-medium capitalize">{g.verdict}</div>
                          <div className="text-caption opacity-80 mt-0.5">{g.reasoning}</div>
                        </div>
                      </div>
                    ) : <div className="text-body-sm text-fog mt-1">Not graded</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <div className="pt-4">
          <Link to="/submissions" className="btn-pill btn-outline text-[13px]">Back to submissions</Link>
        </div>
      </div>
    </div>
  );
}
