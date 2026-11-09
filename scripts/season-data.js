// Loads matchups, trades and drafts for the current season and past seasons
// (following previous_league_id). Completed seasons are cached in localStorage.
(function () {
  const API = "https://api.sleeper.app/v1";
  const memo = new Map();
  let statePromise = null;
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

  async function loadSeason(D, id) {
    const g = (u) => D.getJSON(API + u);
    const league = await g(`/league/${id}`);
    const complete = league.status === "complete";
    const key = "ego-season-v1-" + id;
    const cached = complete ? lsGet(key) : null;
    if (cached) return cached;

    const state = await (statePromise ||= g("/state/nfl"));
    const lastPlayed = complete ? 18
      : ["pre_draft", "drafting"].includes(league.status) ? 0
      : state.season_type === "regular" ? Math.max(0, state.week - 1) : 18;
    const txWeeks = complete ? 18 : Math.max(1, state.week || 1);

    const [matchupWeeks, txWeeksData, drafts] = await Promise.all([
      Promise.all(range(1, lastPlayed).map((w) =>
        g(`/league/${id}/matchups/${w}`).then((m) => ({ week: w, matchups: m })).catch(() => ({ week: w, matchups: [] })))),
      Promise.all(range(1, txWeeks).map((w) =>
        g(`/league/${id}/transactions/${w}`).then((t) => t.map((x) => ({ ...x, _week: w }))).catch(() => []))),
      g(`/league/${id}/drafts`).catch(() => []),
    ]);

    const weeks = matchupWeeks
      .filter((w) => w.matchups.some((m) => (m.points || 0) > 0))
      .map((w) => ({
        week: w.week,
        matchups: w.matchups.map((m) => ({
          roster_id: m.roster_id, matchup_id: m.matchup_id, points: m.points,
          starters: m.starters, players_points: m.players_points,
        })),
      }));

    const trades = txWeeksData.flat()
      .filter((t) => t.type === "trade" && t.status === "complete")
      .map((t) => ({
        week: t._week, created: t.created, adds: t.adds || {}, drops: t.drops || {},
        draft_picks: t.draft_picks || [], roster_ids: t.roster_ids || [],
      }));

    const doneDrafts = [];
    for (const d of drafts.filter((x) => x.status === "complete")) {
      const picks = await g(`/draft/${d.draft_id}/picks`).catch(() => []);
      doneDrafts.push({
        season: String(d.season), type: d.type, slot_to_roster_id: d.slot_to_roster_id || {},
        teams: d.settings?.teams || null,
        picks: picks.map((p) => ({
          pick_no: p.pick_no, round: p.round, draft_slot: p.draft_slot, player_id: p.player_id,
          roster_id: p.roster_id,
          name: [p.metadata?.first_name, p.metadata?.last_name].filter(Boolean).join(" "),
          pos: p.metadata?.position,
        })),
      });
    }

    const out = {
      id, season: String(league.season), status: league.status,
      positions: league.roster_positions || [],
      playoffStart: league.settings?.playoff_week_start || 15,
      previous: league.previous_league_id, weeks, trades, drafts: doneDrafts,
    };
    if (complete) lsSet(key, out);
    return out;
  }

  const season = (D, id) => {
    if (!memo.has(id)) memo.set(id, loadSeason(D, id).catch((e) => { memo.delete(id); throw e; }));
    return memo.get(id);
  };

  // n most recent seasons, oldest first
  async function chain(D, n) {
    const out = [];
    let id = D.leagueId;
    while (out.length < n && id && id !== "0") {
      const s = await season(D, id);
      out.push(s);
      id = s.previous;
    }
    return out.reverse();
  }

  window.EGOSEASONS = { chain };
})();
