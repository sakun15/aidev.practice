import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Terminal, Bot, Cpu } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-cloud" data-testid="landing-page">
      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-paper/70 border-b border-bone">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-graphite text-white flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <div className="font-display font-semibold tracking-tight">aidev.practice</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-pill btn-ghost text-[13px]" data-testid="landing-login">Sign in</Link>
            <Link to="/signup" className="btn-pill btn-primary text-[13px]" data-testid="landing-signup">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-[980px] mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-bone text-slate2 text-caption mb-8 animate-fade-in-up">
          <Cpu size={13} /> Practice engineering, the AI-native way
        </div>
        <h1 className="font-display text-display text-graphite animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          Interview practice
          <br />
          <span className="text-fog">for the AI era.</span>
        </h1>
        <p className="text-body-lg text-slate2 mt-6 max-w-2xl mx-auto font-light animate-fade-in-up" style={{ animationDelay: "140ms" }}>
          Ship real software using Cursor, Claude, and ChatGPT. Not LeetCode — the actual work
          engineers do every day.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
          <Link to="/signup" className="btn-pill btn-primary" data-testid="hero-signup">
            Create your account <ArrowRight size={15} />
          </Link>
          <Link to="/login" className="btn-pill btn-outline" data-testid="hero-login">I already have one</Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[980px] mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: Terminal, title: "15 realistic challenges", body: "From login pages to chat apps. Everything real engineers build." },
          { icon: Bot, title: "AI-native workflow", body: "Use ChatGPT, Claude, Cursor, Windsurf — whatever ships fastest." },
          { icon: Sparkles, title: "Ship, then submit", body: "Push to GitHub, drop the URL, and grow a portfolio interviewers can see." },
        ].map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="surface-card p-6 animate-fade-in-up" style={{ animationDelay: `${300 + i * 60}ms` }}>
            <Icon size={20} className="text-graphite" strokeWidth={1.75} />
            <div className="mt-4 text-subheading font-semibold" style={{ fontSize: 20, lineHeight: 1.2, letterSpacing: "-0.2px" }}>
              {title}
            </div>
            <p className="mt-2 text-body-sm text-fog">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
