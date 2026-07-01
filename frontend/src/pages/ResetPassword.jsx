import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, errText } from "@/lib/api";
import { Sparkles } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center px-6" data-testid="reset-page">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div className="font-display font-semibold">aidev.practice</div>
        </Link>
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Set a new password</h1>
        <p className="text-body-sm text-fog mt-2">Choose something strong. You'll use this to sign in.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" required className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm" />
          </div>
          {error && <div className="text-body-sm text-red-600" data-testid="reset-error">{error}</div>}
          <button type="submit" disabled={loading || !token} className="btn-pill btn-primary w-full" data-testid="reset-submit">
            {loading ? "Updating…" : "Update password"}
          </button>
          {!token && <div className="text-caption text-red-600">Missing reset token — request a new link.</div>}
        </form>
      </div>
    </div>
  );
}
