import re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
p = sys.argv[1]
s = open(p, encoding="utf-8").read()

# protect coloured category chip that must stay white-on-colour
s = s.replace("rounded-full px-2 py-0.5 text-[11px] font-bold text-white", "rounded-full px-2 py-0.5 text-[11px] font-bold text-@@WHITE@@")

pairs = [
    # combos first
    (r"bg-slate-200 text-slate-950", "bg-ink text-surface"),
    (r"hover:bg-emerald-500 hover:text-slate-950", "hover:bg-brand hover:text-brand-ink"),
    (r"hover:border-amber-400 hover:text-amber-300", "hover:border-warn hover:text-warn"),
    (r"hover:border-emerald-400 hover:text-emerald-300", "hover:border-brand hover:text-brand"),
    (r"hover:border-emerald-400", "hover:border-brand"),
    (r"focus:border-emerald-400", "focus:border-brand"),
    (r"bg-emerald-500 text-slate-950", "bg-brand text-brand-ink"),
    (r"bg-amber-400 text-slate-950", "bg-warn text-white"),
    (r"bg-sky-500 text-slate-950", "bg-info text-brand-ink"),
    (r"hover:bg-sky-400", "hover:brightness-110"),
    # surfaces
    (r"bg-slate-950/\d+", "bg-bg"),
    (r"bg-slate-950", "bg-bg"),
    (r"bg-slate-900/\d+", "bg-surface"),
    (r"bg-slate-900", "bg-surface"),
    (r"bg-slate-800", "bg-surface-2"),
    (r"ring-slate-800", "ring-line"),
    (r"hover:border-slate-\d+", "hover:border-line-strong"),
    (r"border-slate-\d+/\d+", "border-line"),
    (r"border-slate-\d+", "border-line"),
    # text
    (r"text-slate-(100|200)", "text-ink"),
    (r"text-slate-300", "text-ink-2"),
    (r"text-slate-(400|500)", "text-ink-3"),
    (r"hover:text-white", "hover:text-ink"),
    (r"text-white", "text-ink"),
    (r"text-slate-950", "text-brand-ink"),
    (r"placeholder-slate-500", "placeholder:text-ink-3"),
    # emerald -> brand
    (r"bg-emerald-950/\d+", "bg-brand-soft"),
    (r"border-emerald-500/\d+", "border-brand/35"),
    (r"ring-emerald-500/\d+", "ring-brand/35"),
    (r"bg-emerald-500/\d+", "bg-brand/15"),
    (r"bg-emerald-500", "bg-brand"),
    (r"text-emerald-300/70", "text-brand/80"),
    (r"text-emerald-(300|400)", "text-brand"),
    # amber -> warn
    (r"bg-amber-950/\d+", "bg-warn/10"),
    (r"border-amber-500/\d+", "border-warn/35"),
    (r"ring-amber-500/\d+", "ring-warn/35"),
    (r"bg-amber-500/\d+", "bg-warn/15"),
    (r"text-amber-300/70", "text-warn/80"),
    (r"text-amber-(300|400)", "text-warn"),
    (r"bg-amber-400", "bg-warn"),
    # sky -> info
    (r"bg-sky-950/\d+", "bg-info/10"),
    (r"border-sky-500/\d+", "border-info/35"),
    (r"ring-sky-500/\d+", "ring-info/35"),
    (r"bg-sky-500/\d+", "bg-info/15"),
    (r"text-sky-300/70", "text-info/80"),
    (r"text-sky-(300|400)", "text-info"),
    (r"bg-sky-500", "bg-info"),
    # rose -> danger
    (r"bg-rose-950/\d+", "bg-danger/10"),
    (r"border-rose-500/\d+", "border-danger/35"),
    (r"text-rose-300/70", "text-danger/80"),
    (r"text-rose-(300|400)", "text-danger"),
    # teal -> ok
    (r"bg-teal-950/\d+", "bg-ok/10"),
    (r"border-teal-500/\d+", "border-ok/35"),
    (r"text-teal-300/70", "text-ok/80"),
    (r"text-teal-(300|400)", "text-ok"),
]
for pat, rep in pairs:
    s, n = re.subn(pat, rep, s)
    print(f"{n:3d}  {pat}")

s = s.replace("text-@@WHITE@@", "text-white")
open(p, "w", encoding="utf-8").write(s)
leftover = re.findall(r"(?:slate|emerald|amber|sky|rose|teal)-\d+", s)
print("LEFTOVER:", sorted(set(leftover)))
