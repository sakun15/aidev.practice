import { Link } from "react-router-dom";
import { useState } from "react";
import { api, errText } from "@/lib/api";
import { Sparkles, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center px-6" data-testid="forgot-page">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div className="font-display font-semibold">aidev.practice</div>
        </Link>

        {sent ? (
          <div className="animate-fade-in-up" data-testid="forgot-success">
            <div className="w-12 h-12 rounded-full bg-bone flex items-center justify-center mb-5">
              <MailCheck size={22} className="text-graphite" />
            </div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Check your inbox</h1>
            <p className="text-body-sm text-fog mt-2">
              If an account exists for <b>{email}</b>, we've sent a link to reset your password.
              It expires in one hour.
            </p>
            <div className="mt-6">
              <Link to="/login" className="btn-pill btn-outline" data-testid="forgot-back-login">Back to sign in</Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Forgot password</h1>
            <p className="text-body-sm text-fog mt-2">Enter your email and we'll send a reset link.</p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" required className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
              </div>
              {error && <div className="text-body-sm text-red-600" data-testid="forgot-error">{error}</div>}
              <button type="submit" disabled={loading} className="btn-pill btn-primary w-full" data-testid="forgot-submit">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="mt-6 text-center text-body-sm text-fog">
              Remembered it? <Link to="/login" className="link-blue">Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
