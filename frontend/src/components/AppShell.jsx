import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, ListChecks, Send, User, Settings, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/challenges", label: "Challenges", icon: ListChecks, testid: "nav-challenges" },
  { to: "/submissions", label: "My Submissions", icon: Send, testid: "nav-submissions" },
  { to: "/profile", label: "Profile", icon: User, testid: "nav-profile" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cloud text-graphite flex" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-bone bg-paper/70 backdrop-blur-md sticky top-0 h-screen">
        <div className="px-6 pt-7 pb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-graphite text-white flex items-center justify-center">
            <Sparkles size={16} strokeWidth={2} />
          </div>
          <div className="font-display font-semibold text-[19px] tracking-tight">aidev.practice</div>
        </div>
        <nav className="mt-6 flex-1 px-3 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                  isActive ? "bg-bone text-graphite" : "text-slate2 hover:bg-bone/60"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-bone">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-graphite text-white flex items-center justify-center text-[13px] font-semibold">
              {(user?.full_name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">{user?.full_name}</div>
              <div className="text-[12px] text-fog truncate">{user?.email}</div>
            </div>
          </div>
          <button
            data-testid="nav-logout"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="btn-pill btn-ghost w-full text-[13px] justify-start"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-paper/80 backdrop-blur-md border-b border-bone">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-graphite text-white flex items-center justify-center">
              <Sparkles size={13} />
            </div>
            <div className="font-display font-semibold">aidev.practice</div>
          </div>
          <button data-testid="mobile-logout" onClick={async () => { await logout(); navigate("/login"); }} className="text-[13px] text-slate2">
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ to, label, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`m-${testid}`}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-full text-[12px] ${
                  isActive ? "bg-graphite text-white" : "bg-bone/60 text-slate2"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="flex-1 min-w-0 pt-24 md:pt-0" data-testid="app-content">
        <div className="max-w-[1080px] mx-auto px-6 md:px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
