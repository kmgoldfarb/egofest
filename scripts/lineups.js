// Lineup efficiency and scoring consistency (current season, regular season weeks).
(function () {
  const { el, css, avg, median, sd, fmt, short, table, lazyTab } = U;
  const FLEX = {
    FLEX: ["RB", "WR", "TE"], SUPER_FLEX: ["QB", "RB", "WR", "TE"],
    WRRB_FLEX: ["WR", "RB"], REC_FLEX: ["WR", "TE"], IDP_FLEX: ["DL", "LB", "DB"],
  };
  const norm = (p) => (p === "DE" || p === "DT" ? "DL" : p);
  let statsPromise = null;
  let charts = [];

  async function getStats() {
    return (statsPromise ||= (async () => {
      await window.EGOFEST_LOADED;
      const D = window.EGOFEST;
      const [s] = await window.EGOSEASONS.chain(D, 1);
      return compute(D, s);
    })());
  }

  function compute(D, s) {
    // most restrictive slots first so flex slots take whatever is left
    const slots = (s.positions || [])
      .filter((p) => !["BN", "IR", "TAXI"].includes(p))
      .map((p) => FLEX[p] || [norm(p)])
      .sort((a, b) => a.length - b.length);
    const eligCache = new Map();
    const elig = (pid) => {
      if (!eligCache.has(pid)) {
        const p = D.playersMap[pid] || {};
        eligCache.set(pid, (p.fantasy_positions || [p.position]).filter(Boolean).map(norm));
      }
      return eligCache.get(pid);
    };
    const optimal = (pp) => {
      const ids = Object.keys(pp);
      const used = new Set();
      let total = 0;
      for (const slot of slots) {
        let best = null, bv = -Infinity;
        for (const pid of ids) {
          if (used.has(pid) || !elig(pid).some((x) => slot.includes(x))) continue;
          const v = pp[pid] || 0;
          if (v > bv) { bv = v; best = pid; }
        }
        if (best) { used.add(best); total += bv; }
      }
      return total;
    };

    const T = new Map(D.rosters.map((r) => [r.roster_id, {
      name: D.teamName(r), scores: [], act: 0, opt: 0, lost: 0, worst: null, boom: 0, bust: 0,
    }]));
    const reg = s.weeks.filter((w) => w.week < s.playoffStart);
    reg.forEach(({ week, matchups }) => {
      const sorted = matchups.map((m) => m.points || 0).sort((a, b) => b - a);
      const n = sorted.length, k = Math.max(1, Math.ceil(n * 0.25));
      const topCut = sorted[k - 1], botCut = sorted[n - k];
      matchups.forEach((m) => {
        const t = T.get(m.roster_id);
        if (!t) return;
        const pp = m.players_points || {};
        const act = (m.starters || []).reduce((a, pid) => a + (pp[pid] || 0), 0);
        const opt = Math.max(act, optimal(pp));
        const pts = m.points || 0;
        t.scores.push(pts);
        t.act += act;
        t.opt += opt;
        if (!t.worst || opt - act > t.worst.gap) t.worst = { week, gap: opt - act };
        if (pts >= topCut) t.boom++;
        if (pts <= botCut) t.bust++;
        const opp = matchups.find((x) => x.matchup_id != null && x.matchup_id === m.matchup_id && x.roster_id !== m.roster_id);
        if (opp && pts < (opp.points || 0) && opt > (opp.points || 0)) t.lost++;
      });
    });
    const teams = [...T.values()].filter((t) => t.scores.length).map((t) => {
      const n = t.scores.length;
      return { ...t, n, eff: t.opt ? t.act / t.opt : null, left: t.opt - t.act,
        mean: avg(t.scores), med: median(t.scores), sd: sd(t.scores),
        boomPct: t.boom / n, bustPct: t.bust / n, hi: Math.max(...t.scores), lo: Math.min(...t.scores) };
    });
    return { teams, weeks: reg.length };
  }

  const destroyCharts = () => { charts.forEach((c) => c.destroy()); charts = []; };
  const chartText = () => ({ color: css("--text-main") });
  const grid = () => ({ color: css("--border") + "55" });

  function scatter(canvas, pts, o) {
    const mx = median(pts.map((p) => p.x)), my = median(pts.map((p) => p.y));
    const guides = {
      id: "guides",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: a, scales: { x, y } } = chart;
        ctx.save();
        ctx.strokeStyle = css("--border"); ctx.setLineDash([5, 5]);
        const px = x.getPixelForValue(mx), py = y.getPixelForValue(my);
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom);
        ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = css("--text-main"); ctx.font = "11px sans-serif"; ctx.textAlign = "left";
        pts.forEach((p) => ctx.fillText(short(p.name), x.getPixelForValue(p.x) + 7, y.getPixelForValue(p.y) + 4));
        ctx.globalAlpha = 0.6; ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left"; ctx.fillText(o.corners[0], a.left + 6, a.top + 14); ctx.fillText(o.corners[2], a.left + 6, a.bottom - 6);
        ctx.textAlign = "right"; ctx.fillText(o.corners[1], a.right - 6, a.top + 14); ctx.fillText(o.corners[3], a.right - 6, a.bottom - 6);
        ctx.restore();
      },
    };
    charts.push(new Chart(canvas, {
      type: "scatter",
      data: { datasets: [{ data: pts, backgroundColor: "#4c8bf5", pointRadius: 6 }] },
      options: {
        maintainAspectRatio: false,
        layout: { padding: { right: window.innerWidth < 600 ? 50 : 90 } },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${pts[c.dataIndex].name}: ${o.tip(pts[c.dataIndex])}` } } },
        scales: {
          x: { title: { display: true, text: o.xTitle, ...chartText() }, ticks: chartText(), grid: grid() },
          y: { title: { display: true, text: o.yTitle, ...chartText() }, ticks: chartText(), grid: grid() },
        },
      },
      plugins: [guides],
    }));
  }

  async function renderLineups() {
    const root = document.getElementById("lineups");
    root.textContent = "Loading matchups…";
    let S;
    try { S = await getStats(); } catch (e) { console.error(e); root.textContent = "Couldn't load matchup data."; return; }
    destroyCharts();
    root.replaceChildren();
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Lineup Efficiency"));
    if (!S.teams.length) { sec.append(el("p", "dyn-note", "No completed weeks yet.")); root.append(sec); return; }
    sec.append(el("p", "dyn-note",
      `Regular-season weeks 1–${S.weeks}. Efficiency = points from starters ÷ points from the best lineup your roster slots allowed that week. Costly losses are losses a perfect lineup would have turned into wins.`));
    const rows = [...S.teams].sort((a, b) => b.eff - a.eff);
    const wrap = el("div", "chart-wrap");
    wrap.style.height = rows.length * 30 + 90 + "px";
    const canvas = el("canvas");
    wrap.append(canvas);
    sec.append(wrap);
    charts.push(new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map((t) => short(t.name, 18)),
        datasets: [
          { label: "Starter points", data: rows.map((t) => +t.act.toFixed(1)), backgroundColor: "#4c8bf5" },
          { label: "Left on bench", data: rows.map((t) => +t.left.toFixed(1)), backgroundColor: "#d0562f" },
        ],
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false,
        plugins: { legend: { labels: chartText() } },
        scales: { x: { stacked: true, ticks: chartText(), grid: grid() }, y: { stacked: true, ticks: chartText(), grid: { display: false } } },
      },
    }));
    sec.append(table(
      ["Team", "Actual", "Optimal", "Left", "Eff %", "Costly losses", "Worst week"],
      rows.map((t) => [t.name, fmt(t.act), fmt(t.opt), fmt(t.left), fmt(t.eff * 100) + "%", t.lost,
        t.worst ? `Wk ${t.worst.week} (−${fmt(t.worst.gap)})` : "–"])));
    root.append(sec);
  }

  async function renderConsistency() {
    const root = document.getElementById("consistency");
    root.textContent = "Loading matchups…";
    let S;
    try { S = await getStats(); } catch (e) { console.error(e); root.textContent = "Couldn't load matchup data."; return; }
    destroyCharts();
    root.replaceChildren();
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Scoring Consistency"));
    const T = S.teams.filter((t) => t.sd != null);
    if (!T.length) { sec.append(el("p", "dyn-note", "Needs at least two completed weeks.")); root.append(sec); return; }
    sec.append(el("p", "dyn-note",
      "SD = standard deviation of weekly score (lower is steadier). Boom/bust = a week in the league's top or bottom quarter of scores."));
    const byMean = [...T].sort((a, b) => b.mean - a.mean);
    const steady = [...T].sort((a, b) => a.sd - b.sd)[0];
    const wild = [...T].sort((a, b) => b.sd - a.sd)[0];
    const boomer = [...T].sort((a, b) => b.boomPct - a.boomPct)[0];
    const list = el("ul", "dyn-note");
    [`Steadiest: ${steady.name} (SD ${fmt(steady.sd)})`,
     `Most volatile: ${wild.name} (SD ${fmt(wild.sd)})`,
     `Highest boom rate: ${boomer.name} (${fmt(boomer.boomPct * 100, 0)}%)`].forEach((t) => list.append(el("li", null, t)));
    sec.append(list);
    const wrap = el("div", "chart-wrap");
    const canvas = el("canvas");
    wrap.append(canvas);
    sec.append(wrap);
    scatter(canvas, T.map((t) => ({ x: t.mean, y: t.sd, name: t.name })), {
      xTitle: "Average weekly score", yTitle: "Std. deviation (volatility)",
      corners: ["Volatile, low scoring", "Boom-or-bust", "Steady, low scoring", "Steady & strong"],
      tip: (p) => `avg ${fmt(p.x)}, SD ${fmt(p.y)}`,
    });
    sec.append(table(
      ["Team", "Avg", "Median", "SD", "Boom %", "Bust %", "High", "Low"],
      byMean.map((t) => [t.name, fmt(t.mean), fmt(t.med), fmt(t.sd), fmt(t.boomPct * 100, 0) + "%",
        fmt(t.bustPct * 100, 0) + "%", fmt(t.hi), fmt(t.lo)])));
    root.append(sec);
  }

  lazyTab("lineups", renderLineups);
  lazyTab("consistency", renderConsistency);
})();
