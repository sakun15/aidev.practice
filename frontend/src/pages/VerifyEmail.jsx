import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, ArrowLeft } from "lucide-react";

const OTP_TTL = 10 * 60;
const RESEND_COOLDOWN = 30;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = (params.get("email") || "").toLowerCase();
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [expiresAt, setExpiresAt] = useState(Date.now() + OTP_TTL * 1000);
  const [cooldownUntil, setCooldownUntil] = useState(Date.now() + RESEND_COOLDOWN * 1000);
  const [now, setNow] = useState(Date.now());
  const [resendMsg, setResendMsg] = useState("");
  const [resendErr, setResendErr] = useState("");

  const timerRef = useRef(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const expired = secondsLeft === 0;
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  useEffect(() => { if (!email) navigate("/signup", { replace: true }); }, [email, navigate]);

  const verify = async (e) => {
    e.preventDefault();
    setCodeError("");
    if (code.length !== 6) { setCodeError("Enter the 6-digit code"); return; }
    setVerifying(true);
    try {
      const { data } = await api.post("/auth/verify-email", { email, code });
      setUser(data);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setCodeError(errText(err));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResendMsg(""); setResendErr("");
    if (cooldownLeft > 0) return;
    try {
      await api.post("/auth/resend-verification", { email });
      setExpiresAt(Date.now() + OTP_TTL * 1000);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN * 1000);
      setCode(""); setCodeError("");
      setResendMsg("A new code has been sent.");
    } catch (err) {
      setResendErr(errText(err));
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex items-center justify-center px-6 py-16" data-testid="verify-page">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <div className="font-display font-semibold">aidev.practice</div>
        </Link>

        <button onClick={() => navigate("/signup")} className="text-body-sm text-fog inline-flex items-center gap-1 hover:text-graphite mb-4">
          <ArrowLeft size={14} /> Change email
        </button>

        <h1 className="font-display text-[28px] font-semibold tracking-tight">Verify your email</h1>
        <p className="text-body-sm text-fog mt-2">
          We sent a 6-digit code to <span className="text-graphite">{email}</span>. It expires in 10 minutes.
        </p>

        <form onSubmit={verify} className="mt-8 space-y-4">
          <div>
            <label className="label">6-digit code</label>
            <input
              type="text" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code"
              className="field text-center tracking-[10px] font-display font-semibold text-[22px]"
              placeholder="••••••"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (codeError) setCodeError(""); }}
              data-testid="verify-otp"
              aria-invalid={!!codeError}
            />
            <div className="flex items-center justify-between mt-2">
              <div className={`text-caption ${expired ? "text-red-600" : "text-fog"}`} data-testid="verify-timer">
                {expired ? "Code expired" : `Expires in ${mmss}`}
              </div>
              <button
                type="button"
                onClick={resend}
                disabled={cooldownLeft > 0}
                className="text-caption link-blue disabled:text-ash disabled:cursor-not-allowed"
                data-testid="verify-resend"
              >
                {cooldownLeft > 0 ? `Resend in ${cooldownLeft}s` : "Resend code"}
              </button>
            </div>
            {codeError && <div className="text-caption text-red-600 mt-2" data-testid="verify-otp-error">{codeError}</div>}
            {resendMsg && <div className="text-caption text-green-700 mt-2" data-testid="verify-resend-msg">{resendMsg}</div>}
            {resendErr && <div className="text-caption text-red-600 mt-2" data-testid="verify-resend-error">{resendErr}</div>}
          </div>

          <button
            type="submit"
            disabled={verifying || expired || code.length !== 6}
            className="btn-pill btn-primary w-full"
            data-testid="verify-submit"
          >
            {verifying ? "Verifying…" : expired ? "Code expired — resend" : "Verify email"}
          </button>
        </form>
      </div>
    </div>
  );
}
