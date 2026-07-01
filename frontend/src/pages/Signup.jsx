import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Check, X } from "lucide-react";

const rules = [
  { key: "len", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "letter", label: "A letter", test: (v) => /[A-Za-z]/.test(v) },
  { key: "digit", label: "A number", test: (v) => /\d/.test(v) },
];

export default function Signup() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const passMatch = form.password.length > 0 && form.password === form.confirm_password;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud flex" data-testid="signup-page">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
              <Sparkles size={15} />
            </div>
            <div className="font-display font-semibold">aidev.practice</div>
          </Link>

          <h1 className="font-display text-[32px] font-semibold tracking-tight text-graphite">Create your account</h1>
          <p className="text-body-sm text-fog mt-2">Start practicing AI-native software engineering.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" data-testid="signup-form">
            <div>
              <label className="label">Full name</label>
              <input required className="field" placeholder="Ada Lovelace" value={form.full_name} onChange={set("full_name")} data-testid="signup-name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" required className="field" placeholder="you@example.com" value={form.email} onChange={set("email")} data-testid="signup-email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" required className="field" placeholder="••••••••" value={form.password} onChange={set("password")} data-testid="signup-password" />
              <ul className="mt-2 space-y-1">
                {rules.map((r) => {
                  const ok = r.test(form.password);
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
              <input type="password" required className="field" placeholder="••••••••" value={form.confirm_password} onChange={set("confirm_password")} data-testid="signup-confirm" />
              {form.confirm_password && (
                <div className={`text-caption mt-1 ${passMatch ? "text-green-700" : "text-red-600"}`}>
                  {passMatch ? "Passwords match" : "Passwords do not match"}
                </div>
              )}
            </div>
            {error && <div className="text-body-sm text-red-600" data-testid="signup-error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-pill btn-primary w-full" data-testid="signup-submit">
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-body-sm text-fog">
            Already have an account?{" "}
            <Link to="/login" className="link-blue" data-testid="signup-to-login">Sign in</Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-graphite text-white items-center justify-center relative overflow-hidden">
        <div className="max-w-md px-12 relative z-10">
          <div className="font-display text-[36px] font-semibold leading-[1.1] tracking-tight">
            Real projects.<br />Real repositories.<br /><span className="text-apple-blue">Real interview signal.</span>
          </div>
          <p className="mt-6 text-[15px] text-white/60 leading-relaxed">
            Every challenge you ship lands in your submissions gallery — the portfolio recruiters actually want to see.
          </p>
        </div>
        <div className="absolute -top-40 -left-20 w-[520px] h-[520px] rounded-full bg-apple-blue/20 blur-3xl" />
      </div>
    </div>
  );
}
