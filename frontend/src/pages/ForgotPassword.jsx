import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api, errText } from "@/lib/api";
import { Sparkles, Check, X, ArrowLeft } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL = 10 * 60;
const RESEND_COOLDOWN = 30;

const rules = [
  { key: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "digit", label: "At least 1 number", test: (v) => /\d/.test(v) },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [verificationToken, setVerificationToken] = useState("");

  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const timerRef = useRef(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const expired = expiresAt !== null && secondsLeft === 0;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const requestOtp = async (isResend = false) => {
    setReqError("");
    if (!EMAIL_RE.test(email.trim())) { setEmailError("Please enter a valid email address"); return; }
    setEmailError("");
    if (isResend && cooldownLeft > 0) return;
    setReqLoading(true);
    try {
      const endpoint = isResend ? "/auth/forgot-password/resend" : "/auth/forgot-password/request";
      await api.post(endpoint, { email: email.trim() });
      setExpiresAt(Date.now() + OTP_TTL * 1000);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN * 1000);
      setCode(""); setCodeError("");
      if (!isResend) setStep(2);
    } catch (err) {
      const status = err?.response?.status;
      const msg = errText(err);
      if (status === 404) setEmailError("No account found with this email");
      else setReqError(msg);
    } finally {
      setReqLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setCodeError("");
    if (code.trim().length !== 6) { setCodeError("Enter the 6-digit code"); return; }
    setVerifyLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password/verify", { email: email.trim(), code: code.trim() });
      setVerificationToken(data.verification_token);
      setStep(3);
    } catch (err) {
      setCodeError(errText(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError("");
    if (pw !== confirmPw) { setResetError("Passwords do not match"); return; }
    if (pw.length < 8 || !/\d/.test(pw)) { setResetError("Password must be at least 8 characters and include a number"); return; }
    setResetLoading(true);
    try {
      await api.post("/auth/forgot-password/reset", {
        verification_token: verificationToken,
        new_password: pw,
        confirm_password: confirmPw,
      });
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setResetError(errText(err));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center px-6 py-16" data-testid="forgot-page">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div className="font-display font-semibold">aidev.practice</div>
        </Link>

        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? "bg-graphite" : "bg-bone"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in-up" data-testid="forgot-step-1">
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Forgot password</h1>
            <p className="text-body-sm text-fog mt-2">Enter your email and we'll send a 6-digit code.</p>
            <form onSubmit={(e) => { e.preventDefault(); requestOtp(false); }} className="mt-8 space-y-4" noValidate>
              <div>
                <label className="label">Email</label>
                <input
                  type="email" required className="field" placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                  onBlur={() => { if (email && !EMAIL_RE.test(email.trim())) setEmailError("Please enter a valid email address"); }}
                  data-testid="forgot-email"
                />
                {emailError && <div className="text-caption text-red-600 mt-1" data-testid="forgot-email-error">{emailError}</div>}
              </div>
              {reqError && <div className="text-body-sm text-red-600" data-testid="forgot-error">{reqError}</div>}
              <button type="submit" disabled={reqLoading} className="btn-pill btn-primary w-full" data-testid="forgot-submit">
                {reqLoading ? "Sending code…" : "Send code"}
              </button>
            </form>
            <div className="mt-6 text-center text-body-sm text-fog">
              Remembered it? <Link to="/login" className="link-blue">Sign in</Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in-up" data-testid="forgot-step-2">
            <button onClick={() => setStep(1)} className="text-body-sm text-fog inline-flex items-center gap-1 hover:text-graphite mb-4">
              <ArrowLeft size={14} /> Change email
            </button>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Enter the code</h1>
            <p className="text-body-sm text-fog mt-2">
              We sent a 6-digit code to <span className="text-graphite">{email}</span>. It expires in 10 minutes.
            </p>
            <form onSubmit={verifyOtp} className="mt-8 space-y-4">
              <div>
                <label className="label">6-digit code</label>
                <input
                  type="text" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code"
                  className="field text-center tracking-[10px] font-display font-semibold text-[22px]"
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (codeError) setCodeError(""); }}
                  data-testid="forgot-otp"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className={`text-caption ${expired ? "text-red-600" : "text-fog"}`} data-testid="forgot-timer">
                    {expired ? "Code expired" : `Expires in ${mmss}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => requestOtp(true)}
                    disabled={cooldownLeft > 0 || reqLoading}
                    className="text-caption link-blue disabled:text-ash disabled:cursor-not-allowed"
                    data-testid="forgot-resend"
                  >
                    {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : "Resend code"}
                  </button>
                </div>
                {codeError && <div className="text-caption text-red-600 mt-2" data-testid="forgot-otp-error">{codeError}</div>}
              </div>
              <button
                type="submit"
                disabled={verifyLoading || expired || code.length !== 6}
                className="btn-pill btn-primary w-full"
                data-testid="forgot-verify"
              >
                {verifyLoading ? "Verifying…" : expired ? "Code expired — resend" : "Verify code"}
              </button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in-up" data-testid="forgot-step-3">
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Set a new password</h1>
            <p className="text-body-sm text-fog mt-2">Choose something strong. You'll use this to sign in.</p>
            <form onSubmit={submitReset} className="mt-8 space-y-4">
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
              {resetError && <div className="text-body-sm text-red-600" data-testid="reset-error">{resetError}</div>}
              <button type="submit" disabled={resetLoading} className="btn-pill btn-primary w-full" data-testid="reset-submit">
                {resetLoading ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
