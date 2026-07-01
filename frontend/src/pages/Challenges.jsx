import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errText } from "@/lib/api";
import { Search, Clock, ArrowRight } from "lucide-react";

const DIFFICULTIES = ["All", "Easy", "Medium", "Hard"];

export default function Challenges() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [d, setD] = useState("All");
  const [cat, setCat] = useState("All");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/challenges"); setItems(data); }
      catch (e) { setErr(errText(e)); }
    })();
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category)))], [items]);

  const filtered = items.filter((c) => {
    if (d !== "All" && c.difficulty !== d) return false;
    if (cat !== "All" && c.category !== cat) return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8" data-testid="challenges-page">
      <header>
        <h1 className="font-display text-[40px] font-semibold tracking-tight">Challenges</h1>
        <p className="text-body text-slate2 mt-1 font-light">Real engineering tasks. Ship with any AI tool you like.</p>
      </header>

      <div className="surface-card p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
          <input
            className="field pl-9"
            placeholder="Search challenges…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="challenges-search"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {DIFFICULTIES.map((x) => (
            <button
              key={x}
              onClick={() => setD(x)}
              data-testid={`filter-diff-${x.toLowerCase()}`}
              className={`btn-pill text-[13px] px-4 py-1.5 whitespace-nowrap ${d === x ? "btn-dark" : "btn-ghost border-bone border"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          data-testid="challenges-category"
          className="field md:w-52"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {err && <div className="text-red-600 text-body-sm">{err}</div>}

      <div className="grid md:grid-cols-2 gap-4" data-testid="challenges-list">
        {filtered.map((c) => (
          <Link
            key={c.slug}
            to={`/challenges/${c.slug}`}
            className="surface-card p-6 hover:shadow-[var(--shadow-soft)] transition-shadow group animate-fade-in-up"
            data-testid={`challenge-card-${c.slug}`}
          >
            <div className="flex items-center justify-between">
              <span className={`pill ${c.difficulty === "Easy" ? "pill-easy" : c.difficulty === "Medium" ? "pill-medium" : "pill-hard"}`}>
                {c.difficulty}
              </span>
              <span className="text-caption text-fog">{c.category}</span>
            </div>
            <div className="mt-4 text-[19px] font-semibold text-graphite tracking-tight">{c.title}</div>
            <p className="text-body-sm text-fog mt-2 line-clamp-2">{c.description}</p>
            <div className="mt-4 flex items-center justify-between text-caption text-fog">
              <span className="inline-flex items-center gap-1"><Clock size={12} />{c.estimated_time}</span>
              <span className="link-blue inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Start <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="surface-card p-8 text-center text-body-sm text-fog md:col-span-2">
            No challenges match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
