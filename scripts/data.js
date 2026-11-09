// Shared data loader for both pages. Exposes window.EGOFEST_LOADED (a Promise).
(function () {
  const LEAGUE_ID = "1362433573851783168";
  const API = "https://api.sleeper.app/v1";

  // Bypass stale HTTP caches (GitHub Pages caches ~10 min) and surface errors
  const getJSON = async (url) => {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.json();
  };

  window.EGOFEST_LOADED = (async () => {
    const [playersMap, rosters, users] = await Promise.all([
      getJSON("players.json"),
      getJSON(`${API}/league/${LEAGUE_ID}/rosters`),
      getJSON(`${API}/league/${LEAGUE_ID}/users`),
    ]);

    const teamNameByOwner = {};
    users.forEach((u) => {
      teamNameByOwner[u.user_id] =
        u.metadata?.team_name || u.display_name || `Owner ${u.user_id}`;
    });
    const teamName = (r) => teamNameByOwner[r.owner_id] || `Roster ${r.roster_id}`;

    const data = { leagueId: LEAGUE_ID, rosters, users, playersMap, getJSON, teamName, teamNameByOwner };
    window.EGOFEST = data;
    return data;
  })();
})();
