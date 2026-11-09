// Dynasty analytics: roster age profile / team window, and pick ownership.
(function () {
  const API = "https://api.sleeper.app/v1";
  const CORE = ["QB", "RB", "WR", "TE"];
  const root = document.getElementById("dynasty");
  let charts = [];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const median = (a) => {
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const fmt = (n, d = 1) => (n == null ? "–" : n.toFixed(d));
  const short = (s, n = 14) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function ageOf(p) {
    if (p.birth_date) {
      const d = new Date(p.birth_date + "T00:00:00Z");
      if (!isNaN(d)) return (Date.now() - d) / 31557600000;
    }
    return typeof p.age === "number" ? p.age : null;
  }

  // ---------- Feature 1: age profile and team window ----------
  function analyze(D) {
    const teams = D.rosters.map((r) => {
      const all = [], byPos = { QB: [], RB: [], WR: [], TE: [] };
      (r.players || []).forEach((pid) => {
        const p = D.playersMap[pid];
        if (!p || !CORE.includes(p.position)) return;
        const a = ageOf(p);
        if (a == null) return;
        all.push(a);
        byPos[p.position].push(a);
      });
      const s = r.settings || {};
      const games = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
      return {
        name: D.teamName(r),
        n: all.length,
        age: avg(all),
        young: all.length ? all.filter((a) => a <= 24).length / all.length : null,
        old: all.length ? all.filter((a) => a >= 29).length / all.length : null,
        pos: Object.fromEntries(CORE.map((k) => [k, avg(byPos[k])])),
        games,
        winPct: games ? ((s.wins || 0) + 0.5 * (s.ties || 0)) / games : null,
      };
    });
    const withAge = teams.filter((t) => t.age != null);
    if (!withAge.length) return { teams, ready: false };
    const medAge = median(withAge.map((t) => t.age));
    const played = teams.some((t) => t.games > 0);
    const medWin = played ? median(teams.map((t) => t.winPct ?? 0)) : null;
    teams.forEach((t) => {
      if (t.age == null) return (t.window = "–");
      const older = t.age > medAge;
      if (!played) return (t.window = older ? "Older" : "Younger");
      const winning = (t.winPct ?? 0) >= medWin;
      t.window = older ? (winning ? "Win-now" : "Retool") : winning ? "Contender" : "Rebuild";
    });
    return { teams, ready: true, medAge, medWin, played };
  }

  function renderWindow(D) {
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Roster Age & Team Window"));
    const A = analyze(D);
    if (!A.ready) {
      sec.append(el("p", "dyn-note", "Age data isn't available yet. It appears after the next player data refresh."));
      return sec;
    }
    sec.append(el("p", "dyn-note",
      "Ages cover QB/RB/WR/TE only. Window compares each team to the league median for age and win percentage."));

    if (A.played) {
      const wrap = el("div", "chart-wrap");
      const canvas = el("canvas");
      wrap.append(canvas);
      sec.append(wrap);
      const pts = A.teams.filter((t) => t.age != null);
      const guides = {
        id: "guides",
        afterDatasetsDraw(chart) {
          const { ctx, chartArea: a, scales: { x, y } } = chart;
          ctx.save();
          ctx.strokeStyle = css("--border");
          ctx.setLineDash([5, 5]);
          const mx = x.getPixelForValue(A.medAge), my = y.getPixelForValue(A.medWin * 100);
          ctx.beginPath(); ctx.moveTo(mx, a.top); ctx.lineTo(mx, a.bottom);
          ctx.moveTo(a.left, my); ctx.lineTo(a.right, my); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = css("--text-main");
          ctx.font = "11px sans-serif";
          ctx.textAlign = "left";
          pts.forEach((t) => ctx.fillText(short(t.name), x.getPixelForValue(t.age) + 7, y.getPixelForValue(t.winPct * 100) + 4));
          ctx.globalAlpha = 0.6; ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "left"; ctx.fillText("Contender", a.left + 6, a.top + 14);
          ctx.fillText("Rebuild", a.left + 6, a.bottom - 6);
          ctx.textAlign = "right"; ctx.fillText("Win-now", a.right - 6, a.top + 14);
          ctx.fillText("Retool", a.right - 6, a.bottom - 6);
          ctx.restore();
        },
      };
      charts.push(new Chart(canvas, {
        type: "scatter",
        data: { datasets: [{ data: pts.map((t) => ({ x: t.age, y: t.winPct * 100 })), backgroundColor: "#4c8bf5", pointRadius: 6 }] },
        options: {
          maintainAspectRatio: false,
          layout: { padding: { right: 90 } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `${pts[c.dataIndex].name}: age ${fmt(c.parsed.x)}, ${fmt(c.parsed.y, 0)}% wins` } },
          },
          scales: {
            x: { title: { display: true, text: "Average age (QB/RB/WR/TE)", color: css("--text-main") }, ticks: { color: css("--text-main") }, grid: { color: css("--border") + "55" } },
            y: { min: 0, max: 100, title: { display: true, text: "Win %", color: css("--text-main") }, ticks: { color: css("--text-main") }, grid: { color: css("--border") + "55" } },
          },
        },
        plugins: [guides],
      }));
    }

    const rows = [...A.teams].sort((a, b) => (a.age ?? 99) - (b.age ?? 99));
    const table = el("table", "dyn-table");
    const head = el("tr");
    ["Team", "Avg age", "QB", "RB", "WR", "TE", "≤24", "29+", "Window"].forEach((h) => head.append(el("th", null, h)));
    const thead0 = el("thead");
    thead0.append(head);
    table.append(thead0);
    const body = el("tbody");
    rows.forEach((t) => {
      const tr = el("tr");
      tr.append(el("td", null, t.name), el("td", null, fmt(t.age)));
      CORE.forEach((k) => tr.append(el("td", null, fmt(t.pos[k]))));
      tr.append(el("td", null, t.young == null ? "–" : Math.round(t.young * 100) + "%"),
        el("td", null, t.old == null ? "–" : Math.round(t.old * 100) + "%"),
        el("td", "win-" + t.window.toLowerCase().replace(/[^a-z]/g, ""), t.window));
      body.append(tr);
    });
    table.append(body);
    const scroll = el("div", "table-scroll");
    scroll.append(table);
    sec.append(scroll);
    return sec;
  }

  // ---------- Feature 2: pick ownership ----------
  async function renderPicks(D) {
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Draft Pick Ownership"));
    let league, traded;
    try {
      [league, traded] = await Promise.all([
        D.getJSON(`${API}/league/${D.leagueId}`),
        D.getJSON(`${API}/league/${D.leagueId}/traded_picks`),
      ]);
    } catch (e) {
      console.error(e);
      sec.append(el("p", "dyn-note", "Couldn't load pick data right now."));
      return sec;
    }
    const rounds = league.settings?.draft_rounds || 4;
    const cur = Number(league.season);
    const start = ["pre_draft", "drafting"].includes(league.status) ? cur : cur + 1;
    const seasons = [start, start + 1, start + 2];

    const nameById = new Map(D.rosters.map((r) => [r.roster_id, D.teamName(r)]));
    const ownerOf = new Map();
    traded.forEach((t) => ownerOf.set(`${t.season}-${t.round}-${t.roster_id}`, t.owner_id));

    // holdings[ownerRosterId]["season-round"] = [originalRosterIds]
    const holdings = new Map(D.rosters.map((r) => [r.roster_id, {}]));
    seasons.forEach((s) => {
      for (let rd = 1; rd <= rounds; rd++) {
        D.rosters.forEach((r) => {
          const owner = ownerOf.get(`${s}-${rd}-${r.roster_id}`) ?? r.roster_id;
          const h = holdings.get(owner);
          if (!h) return;
          (h[`${s}-${rd}`] ||= []).push(r.roster_id);
        });
      }
    });

    sec.append(el("p", "dyn-note",
      "● = own pick, +Team = acquired from that team, – = traded away. Net is picks held minus picks a team starts with."));

    const table = el("table", "dyn-table picks");
    const thead = el("thead");
    const r1 = el("tr"), r2 = el("tr");
    r1.append(el("th")); r2.append(el("th", null, "Team"));
    seasons.forEach((s) => {
      const th = el("th", null, String(s)); th.colSpan = rounds; r1.append(th);
      for (let rd = 1; rd <= rounds; rd++) r2.append(el("th", null, "R" + rd));
    });
    r1.append(el("th")); r2.append(el("th", null, "Net"));
    thead.append(r1, r2);
    table.append(thead);

    const body = el("tbody");
    const base = seasons.length * rounds;
    [...D.rosters].sort((a, b) => D.teamName(a).localeCompare(D.teamName(b))).forEach((r) => {
      const tr = el("tr");
      tr.append(el("td", null, D.teamName(r)));
      let count = 0;
      const h = holdings.get(r.roster_id);
      seasons.forEach((s) => {
        for (let rd = 1; rd <= rounds; rd++) {
          const picks = h[`${s}-${rd}`] || [];
          count += picks.length;
          const td = el("td");
          if (!picks.length) { td.textContent = "–"; td.className = "pick-away"; }
          else {
            picks.forEach((o) => {
              const span = el("span", o === r.roster_id ? "pick-own" : "pick-acq",
                o === r.roster_id ? "●" : "+" + short(nameById.get(o) || "?", 8));
              span.title = `${s} round ${rd} (${nameById.get(o)})`;
              td.append(span, " ");
            });
          }
          tr.append(td);
        }
      });
      const net = count - base;
      tr.append(el("td", net > 0 ? "net-pos" : net < 0 ? "net-neg" : "", (net > 0 ? "+" : "") + net));
      body.append(tr);
    });
    table.append(body);
    const scroll = el("div", "table-scroll");
    scroll.append(table);
    sec.append(scroll);
    return sec;
  }

  // ---------- wiring ----------
  async function render() {
    const D = window.EGOFEST;
    if (!D || !root) return;
    charts.forEach((c) => c.destroy());
    charts = [];
    root.hidden = false;
    root.replaceChildren(el("h1", null, "Dynasty Analytics"), renderWindow(D), await renderPicks(D));
  }

  let started = false;
  document.addEventListener("rosters:rendered", () => {
    if (started) return;
    started = true;
    render().catch((e) => console.error(e));
    // redraw charts when the theme changes so colors stay readable
    new MutationObserver(() => render().catch(console.error))
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  });
})();
