// Draft and trade grades, based on production inside this league's own matchups.
(function () {
  const { el, avg, sd, fmt, signed, table, lazyTab } = U;
  const letter = (z) => (z >= 1 ? "A" : z >= 0.35 ? "B" : z >= -0.35 ? "C" : z >= -1 ? "D" : "F");
  const badge = (g) => ({ t: g, cls: "grade grade-" + (g === "–" ? "na" : g) });
  let dataPromise = null;

  function build(D, seasons) {
    // PP: player -> Map(seasonIndex*100+week -> points)
    const PP = new Map();
    seasons.forEach((s, i) => s.weeks.forEach(({ week, matchups }) => matchups.forEach((m) => {
      const pp = m.players_points || {};
      for (const pid in pp) {
        let mp = PP.get(pid);
        if (!mp) PP.set(pid, (mp = new Map()));
        const k = i * 100 + week;
        mp.set(k, Math.max(mp.get(k) ?? -Infinity, pp[pid] || 0));
      }
    })));
    const since = (pid, i, wk) => {
      const mp = PP.get(pid);
      if (!mp) return 0;
      const min = i * 100 + wk;
      let t = 0;
      mp.forEach((v, k) => { if (k >= min) t += v; });
      return t;
    };
    const nameOf = (pid) => D.playersMap[pid]?.full_name || pid;
    const teamByRid = new Map(D.rosters.map((r) => [r.roster_id, D.teamName(r)]));
    const gamesPlayed = seasons.reduce((n, s) => n + s.weeks.length, 0);
    return { seasons, since, nameOf, teamByRid, gamesPlayed };
  }

  // ---------- drafts ----------
  function gradeDraft(B, si, d) {
    const picks = d.picks.filter((p) => p.player_id).sort((a, b) => a.pick_no - b.pick_no)
      .map((p) => ({ ...p, pts: B.since(p.player_id, si, 0) }));
    const teams = d.teams || new Set(picks.map((p) => p.roster_id)).size || 12;
    picks.forEach((p) => {
      const near = picks.filter((q) => Math.abs(q.pick_no - p.pick_no) <= teams);
      p.exp = avg(near.map((q) => q.pts));
      p.diff = p.pts - p.exp;
    });
    const by = new Map();
    picks.forEach((p) => {
      const t = by.get(p.roster_id) || { rid: p.roster_id, n: 0, diff: 0, best: null };
      t.n++; t.diff += p.diff;
      if (!t.best || p.diff > t.best.diff) t.best = p;
      by.set(p.roster_id, t);
    });
    const rows = [...by.values()];
    const m = avg(rows.map((r) => r.diff)), s = sd(rows.map((r) => r.diff));
    rows.forEach((r) => { r.grade = s ? letter((r.diff - m) / s) : "–"; });
    return { picks, rows: rows.sort((a, b) => b.diff - a.diff), total: picks.reduce((a, p) => a + p.pts, 0) };
  }

  function renderDrafts(B) {
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Draft Grades"));
    const all = [];
    B.seasons.forEach((s, si) => s.drafts.forEach((d) => all.push({ si, d })));
    if (!all.length) { sec.append(el("p", "dyn-note", "No completed drafts found.")); return sec; }
    sec.append(el("p", "dyn-note",
      "Each pick is compared with the average production of picks near that spot in the same draft. Production = fantasy points scored in this league's matchups since the draft. Grades rank teams within one draft."));
    all.sort((a, b) => b.d.season.localeCompare(a.d.season));
    const sel = el("select", "dyn-select");
    all.forEach((x, i) => sel.append(new Option(`${x.d.season} ${x.d.type} draft`, i)));
    sec.append(sel);
    const out = el("div");
    sec.append(out);
    const show = () => {
      const { si, d } = all[+sel.value];
      const R = gradeDraft(B, si, d);
      out.replaceChildren();
      if (R.total === 0) { out.append(el("p", "dyn-note", "No points have been scored by these players yet, so there's nothing to grade.")); return; }
      out.append(table(["Team", "Picks", "Pts vs expected", "Best pick", "Grade"],
        R.rows.map((r) => [B.teamByRid.get(r.rid) || "Team " + r.rid, r.n, signed(r.diff),
          r.best ? `${r.best.name} (${signed(r.best.diff)})` : "–", badge(r.grade)])));
      const sorted = [...R.picks].sort((a, b) => b.diff - a.diff);
      const line = (p) => [`#${p.pick_no}`, p.name || B.nameOf(p.player_id), B.teamByRid.get(p.roster_id) || "", fmt(p.pts), fmt(p.exp), signed(p.diff)];
      out.append(el("h3", null, "Biggest steals"));
      out.append(table(["Pick", "Player", "Team", "Pts", "Exp", "Diff"], sorted.slice(0, 5).map(line)));
      out.append(el("h3", null, "Biggest busts"));
      out.append(table(["Pick", "Player", "Team", "Pts", "Exp", "Diff"], sorted.slice(-5).reverse().map(line)));
    };
    sel.addEventListener("change", show);
    show();
    return sec;
  }

  // ---------- trades ----------
  function analyzeTrades(B) {
    // resolve traded picks to the players eventually drafted with them
    const drafted = new Map();
    B.seasons.forEach((s, si) => s.drafts.forEach((d) => d.picks.forEach((p) => {
      const orig = d.slot_to_roster_id[String(p.draft_slot)];
      if (orig != null && p.player_id) drafted.set(`${d.season}-${p.round}-${orig}`, p.player_id);
    })));
    const trades = [];
    B.seasons.forEach((s, si) => s.trades.forEach((t) => {
      const sides = t.roster_ids.map((rid) => {
        const assets = (list, ids) => ids.map((pid) => ({ label: B.nameOf(pid), pts: B.since(pid, si, t.week) }));
        const pickAssets = (pks) => pks.map((pk) => {
          const pid = drafted.get(`${pk.season}-${pk.round}-${pk.roster_id}`);
          return pid ? { label: `${pk.season} R${pk.round} → ${B.nameOf(pid)}`, pts: B.since(pid, si, t.week) }
            : { label: `${pk.season} R${pk.round} pick`, pts: 0, pending: true };
        });
        const recv = [
          ...assets(null, Object.keys(t.adds).filter((p) => t.adds[p] === rid)),
          ...pickAssets(t.draft_picks.filter((pk) => pk.owner_id === rid)),
        ];
        const sent = [
          ...assets(null, Object.keys(t.drops).filter((p) => t.drops[p] === rid)),
          ...pickAssets(t.draft_picks.filter((pk) => pk.previous_owner_id === rid)),
        ];
        const r = recv.reduce((a, x) => a + x.pts, 0), snt = sent.reduce((a, x) => a + x.pts, 0);
        const share = r + snt > 0 ? r / (r + snt) : null;
        const grade = r + snt < 15 || share == null ? "–"
          : share >= 0.75 ? "A" : share >= 0.6 ? "B" : share >= 0.4 ? "C" : share >= 0.25 ? "D" : "F";
        return { rid, recv, sent, r, s: snt, net: r - snt, grade };
      });
      trades.push({ season: s.season, week: t.week, created: t.created, sides });
    }));
    return trades.sort((a, b) => (b.created || 0) - (a.created || 0));
  }

  function renderTrades(B) {
    const sec = el("div", "dyn-block");
    sec.append(el("h2", null, "Trade Grades"));
    const trades = analyzeTrades(B);
    if (!trades.length) { sec.append(el("p", "dyn-note", "No completed trades found.")); return sec; }
    sec.append(el("p", "dyn-note",
      "Compares points scored after the trade by what each team received against what it gave up. Picks count once the player drafted with them has scored; undrafted picks count as 0 and are marked pending. Trades with under 15 combined points are ungraded."));
    const tot = new Map();
    trades.forEach((t) => t.sides.forEach((s) => {
      const x = tot.get(s.rid) || { n: 0, net: 0 };
      x.n++; x.net += s.net;
      tot.set(s.rid, x);
    }));
    const lb = [...tot.entries()].sort((a, b) => b[1].net - a[1].net);
    sec.append(el("h3", null, "Net points from trades"));
    sec.append(table(["Team", "Trades", "Net pts"],
      lb.map(([rid, x]) => [B.teamByRid.get(rid) || "Team " + rid, x.n,
        { t: signed(x.net), cls: x.net >= 0 ? "net-pos" : "net-neg" }])));

    sec.append(el("h3", null, "Trade log"));
    const log = el("div");
    sec.append(log);
    const draw = (limit) => {
      log.replaceChildren();
      trades.slice(0, limit).forEach((t) => {
        const card = el("div", "trade-card");
        const date = t.created ? new Date(t.created).toLocaleDateString() : "";
        card.append(el("div", "trade-head", `${t.season} · week ${t.week}${date ? " · " + date : ""}`));
        t.sides.forEach((s) => {
          const row = el("div", "trade-side");
          const head = el("div", "trade-team");
          head.append(el("strong", null, B.teamByRid.get(s.rid) || "Team " + s.rid + " "), " ");
          const b = badge(s.grade);
          head.append(el("span", b.cls, b.t));
          row.append(head);
          const fmtList = (l) => l.length ? l.map((a) => `${a.label} (${a.pending ? "pending" : fmt(a.pts) + " pts"})`).join(", ") : "nothing";
          row.append(el("div", null, `Got: ${fmtList(s.recv)}`), el("div", null, `Gave: ${fmtList(s.sent)}`));
          card.append(row);
        });
        log.append(card);
      });
      if (trades.length > limit) {
        const more = el("button", "dyn-btn", `Show all ${trades.length} trades`);
        more.addEventListener("click", () => draw(trades.length));
        log.append(more);
      }
    };
    draw(10);
    return sec;
  }

  async function render() {
    const root = document.getElementById("grades");
    root.textContent = "Loading league history (this can take a few seconds the first time)…";
    try {
      dataPromise ||= (async () => {
        await window.EGOFEST_LOADED;
        const D = window.EGOFEST;
        return build(D, await window.EGOSEASONS.chain(D, 3));
      })();
      const B = await dataPromise;
      root.replaceChildren(renderDrafts(B), renderTrades(B));
    } catch (e) {
      console.error(e);
      dataPromise = null;
      root.textContent = "Couldn't load league history. Please refresh in a minute.";
    }
  }

  lazyTab("grades", render);
})();
