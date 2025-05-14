(async function () {
  // 1) kick off all three fetches in parallel
  const [playersMap, rosters, users] = await Promise.all([
    fetch("players.json").then((r) => r.json()),
    fetch("https://api.sleeper.app/v1/league/1226594146450423808/rosters").then(
      (r) => r.json()
    ),
    fetch("https://api.sleeper.app/v1/league/1226594146450423808/users").then(
      (r) => r.json()
    ),
  ]);

  // 2) build owner→teamName lookup
  const teamNameByOwner = {};
  users.forEach((u) => {
    // metadata.team_name is your league-team name
    const name =
      u.metadata?.team_name ||
      u.display_name || // fallback if no metadata
      `Owner ${u.user_id}`;
    teamNameByOwner[u.user_id] = name;
  });

  const posOrder = ["QB", "RB", "WR", "TE", "DB", "DE", "DL", "LB", "K"];
  const container = document.getElementById("rosters");
  container.innerHTML = "";

  rosters.sort((a, b) => {
    const nameA = teamNameByOwner[a.owner_id] || `Roster ${a.roster_id}`;
    const nameB = teamNameByOwner[b.owner_id] || `Roster ${b.roster_id}`;
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });

  rosters.forEach((r) => {
    // ——— Card & Header Setup ———
    const card = document.createElement("div");
    card.className = "team-card";

    // grab the *team* name via owner_id
    const teamName = teamNameByOwner[r.owner_id] || `Roster ${r.roster_id}`;

    const h2 = document.createElement("h2");
    h2.textContent = teamName;
    card.appendChild(h2);

    // ——— Sort players ———
    const sortedIds = [...r.players].sort((a, b) => {
      const pa = playersMap[a] || {};
      const pb = playersMap[b] || {};
      const posA = pa.position || "";
      const posB = pb.position || "";
      const iA =
        posOrder.indexOf(posA) >= 0 ? posOrder.indexOf(posA) : posOrder.length;
      const iB =
        posOrder.indexOf(posB) >= 0 ? posOrder.indexOf(posB) : posOrder.length;
      if (iA !== iB) return iA - iB;
      const lastA = (pa.full_name || "").split(" ").slice(-1)[0];
      const lastB = (pb.full_name || "").split(" ").slice(-1)[0];
      return lastA.localeCompare(lastB);
    });

    // ——— Render roster ———
    const ul = document.createElement("ul");
    ul.className = "roster";

    sortedIds.forEach((pid) => {
      const p = playersMap[pid] || {};
      const pos = p.position || "";
      const name = p.full_name || pid;
      const team = p.team || "";
      const status = p.injury_status || "";

      const li = document.createElement("li");
      li.innerHTML = `
        <span class="pos-${pos}">${pos}</span>
        <span class="player">${name}</span>
        <span class="team-name">${team}</span>
        <span class="status">${status || ""}</span>
      `;
      ul.appendChild(li);
    });

    card.appendChild(ul);
    container.appendChild(card);
  });
})();
