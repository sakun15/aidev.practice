import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, errText } from "@/lib/api";
import { Sparkles, Check, X } from "lucide-react";

const rules = [
  { key: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "letter", label: "A letter", test: (v) => /[A-Za-z]/.test(v) },
  { key: "digit", label: "A number", test: (v) => /\d/.test(v) },
];

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== confirmPw) { setError("Passwords do not match"); return; }
    if (!rules.every((r) => r.test(pw))) { setError("Password must be at least 8 characters and include a letter and a number"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw, confirm_password: confirmPw });
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center px-6 py-16" data-testid="reset-page">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div className="font-display font-semibold">aidev.practice</div>
        </Link>

        <h1 className="font-display text-[28px] font-semibold tracking-tight">Set a new password</h1>
        <p className="text-body-sm text-fog mt-2">Reset links expire 15 minutes after being sent.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" required className="field" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="reset-password" />
            <ul className="mt-2 space-y-1">
              {rules.map((r) => {
                const ok = r.test(pw);
                return (
                  <li key={r.key} className="flex items-center gap-2 text-caption text-fog">
                    {ok ? <Check size={12} className="text-green-600" /> : <X size={12} className="text-ash" />}
                    <span className={ok ? "text-slate2" : ""}>{r.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" required className="field" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} data-testid="reset-confirm" />
            {confirmPw && pw !== confirmPw && (
              <div className="text-caption text-red-600 mt-1" data-testid="reset-mismatch">Passwords do not match</div>
            )}
          </div>
          {error && <div className="text-body-sm text-red-600" data-testid="reset-error">{error}</div>}
          <button type="submit" disabled={loading || !token} className="btn-pill btn-primary w-full" data-testid="reset-submit">
            {loading ? "Updating…" : "Update password"}
          </button>
          {!token && <div className="text-caption text-red-600" data-testid="reset-missing-token">Missing reset token — request a new link.</div>}
        </form>
      </div>
    </div>
  );
}
