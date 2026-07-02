import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, CheckCircle2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordReset = params.get("reset") === "1";

  const validateEmail = () => {
    if (!email) { setEmailError(""); return false; }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setEmailError(""); setPasswordError(""); setFormError("");
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email: email.trim(), password });
      setUser(data);
      const dest = data.onboarded ? "/dashboard" : "/onboarding";
      navigate(location.state?.from?.pathname || dest, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = errText(err);
      if (status === 404) setEmailError("This email is not registered. Please sign up or check your spelling.");
      else if (status === 401) setPasswordError("Incorrect password. Please try again.");
      else setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex" data-testid="login-page">
      <div className="hidden lg:flex flex-1 bg-graphite text-white items-center justify-center relative overflow-hidden">
        <div className="max-w-md px-12 relative z-10">
          <Sparkles size={22} className="text-apple-blue" />
          <div className="font-display mt-8 leading-[1.08] font-semibold" style={{ fontSize: 44, letterSpacing: "-0.7px" }}>
            Welcome back to the practice studio.
          </div>
          <p className="mt-4 text-[15px] text-white/60 leading-relaxed">
            Continue building real projects with the AI tools engineers actually use.
          </p>
        </div>
        <div className="absolute -bottom-40 -right-20 w-[520px] h-[520px] rounded-full bg-apple-blue/20 blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
              <Sparkles size={15} />
            </div>
            <div className="font-display font-semibold">aidev.practice</div>
          </Link>

          <h1 className="font-display text-[32px] font-semibold tracking-tight text-graphite">Sign in</h1>
          <p className="text-body-sm text-fog mt-2">Enter your email and password to continue.</p>

          {passwordReset && (
            <div className="mt-6 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-body-sm flex items-center gap-2" data-testid="login-reset-success">
              <CheckCircle2 size={15} /> Password updated. Please log in.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="login-form" noValidate>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email" type="email" autoComplete="email" required
                className="field" data-testid="login-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                onBlur={validateEmail}
                placeholder="you@example.com"
                aria-invalid={!!emailError}
              />
              {emailError && <div className="text-caption text-red-600 mt-1" data-testid="login-email-error">{emailError}</div>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="text-[12px] link-blue" data-testid="login-forgot">Forgot password?</Link>
              </div>
              <input
                id="password" type="password" autoComplete="current-password" required
                className="field" data-testid="login-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                placeholder="••••••••"
                aria-invalid={!!passwordError}
              />
              {passwordError && <div className="text-caption text-red-600 mt-1" data-testid="login-password-error">{passwordError}</div>}
            </div>
            {formError && <div className="text-body-sm text-red-600" data-testid="login-error">{formError}</div>}
            <button type="submit" disabled={loading} className="btn-pill btn-primary w-full" data-testid="login-submit">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center text-body-sm text-fog">
            New to aidev.practice?{" "}
            <Link to="/signup" className="link-blue" data-testid="login-create-account">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
