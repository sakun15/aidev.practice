import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, ArrowLeft, GraduationCap, Briefcase, Rocket, Building2, Repeat, Bot, BotMessageSquare, Sparkles } from "lucide-react";

const USER_TYPES = [
  { id: "student", icon: GraduationCap, title: "Student", body: "Learning software engineering." },
  { id: "internships", icon: Rocket, title: "Preparing for internships", body: "Getting ready for internship interviews." },
  { id: "placements", icon: Briefcase, title: "Preparing for placements", body: "Aiming for campus placement offers." },
  { id: "professional", icon: Building2, title: "Working professional", body: "Sharpening AI-native skills for work." },
  { id: "switcher", icon: Repeat, title: "Career switcher", body: "Transitioning into software engineering." },
];

const AI_LEVELS = [
  { id: "beginner", icon: Bot, title: "Beginner", body: "I have barely used AI." },
  { id: "intermediate", icon: BotMessageSquare, title: "Intermediate", body: "I regularly use ChatGPT or Claude." },
  { id: "advanced", icon: Sparkles, title: "Advanced", body: "I build software daily using AI." },
];

export default function Onboarding() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState("");
  const [aiLevel, setAiLevel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setError("");
    setSaving(true);
    try {
      const { data } = await api.post("/auth/onboarding", { user_type: userType, ai_experience: aiLevel });
      setUser(data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud px-6 py-16 flex items-start justify-center" data-testid="onboarding-page">
      <div className="w-full max-w-[720px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="text-caption text-fog">Step {step} of 2</div>
          <div className="flex-1 h-1 rounded-full bg-bone overflow-hidden">
            <div className="h-full bg-graphite transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fade-in-up">
            <h1 className="font-display text-[36px] font-semibold tracking-tight">What best describes you?</h1>
            <p className="text-body-sm text-fog mt-2">We'll tailor challenges to your goals.</p>
            <div className="mt-8 grid sm:grid-cols-2 gap-3" data-testid="onboarding-user-types">
              {USER_TYPES.map(({ id, icon: Icon, title, body }) => {
                const selected = userType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUserType(id)}
                    data-testid={`ob-user-${id}`}
                    className={`text-left p-4 rounded-xl border transition-all bg-paper ${selected ? "border-graphite ring-4 ring-graphite/5" : "border-bone hover:border-ash"}`}
                  >
                    <Icon size={18} strokeWidth={1.75} className="text-graphite" />
                    <div className="mt-3 text-[15px] font-semibold text-graphite">{title}</div>
                    <div className="text-caption text-fog mt-1">{body}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!userType}
                className="btn-pill btn-primary"
                data-testid="ob-next"
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in-up">
            <h1 className="font-display text-[36px] font-semibold tracking-tight">How comfortable are you with AI coding tools?</h1>
            <p className="text-body-sm text-fog mt-2">This calibrates your recommendations.</p>
            <div className="mt-8 grid gap-3" data-testid="onboarding-ai-levels">
              {AI_LEVELS.map(({ id, icon: Icon, title, body }) => {
                const selected = aiLevel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAiLevel(id)}
                    data-testid={`ob-ai-${id}`}
                    className={`text-left p-5 rounded-xl border transition-all bg-paper flex items-start gap-4 ${selected ? "border-graphite ring-4 ring-graphite/5" : "border-bone hover:border-ash"}`}
                  >
                    <Icon size={20} strokeWidth={1.75} className="text-graphite mt-0.5" />
                    <div>
                      <div className="text-[16px] font-semibold text-graphite">{title}</div>
                      <div className="text-body-sm text-fog mt-1">{body}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {error && <div className="text-body-sm text-red-600 mt-4" data-testid="ob-error">{error}</div>}
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(1)} className="btn-pill btn-ghost" data-testid="ob-back">
                <ArrowLeft size={15} /> Back
              </button>
              <button
                onClick={finish}
                disabled={!aiLevel || saving}
                className="btn-pill btn-primary"
                data-testid="ob-finish"
              >
                {saving ? "Saving…" : "Finish setup"} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
