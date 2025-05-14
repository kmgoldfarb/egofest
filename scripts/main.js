(async function () {
  // kick off all three fetches
  const [playersMap, rosters, users] = await Promise.all([
    fetch("players.json").then((r) => r.json()),
    fetch("https://api.sleeper.app/v1/league/1226594146450423808/rosters").then(
      (r) => r.json()
    ),
    fetch("https://api.sleeper.app/v1/league/1226594146450423808/users").then(
      (r) => r.json()
    ),
  ]);

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
    const card = document.createElement("div");
    card.className = "team-card";

    const teamName = teamNameByOwner[r.owner_id] || `Roster ${r.roster_id}`;

    const header = document.createElement("div");
    header.className = "team-header";

    const h2 = document.createElement("h2");
    h2.textContent = teamName;

    const { fpts, wins, losses } = r.settings || {};

    const stats = document.createElement("small");
    stats.className = "team-stats";
    stats.textContent = `${wins}–${losses} | ${fpts} total points`;

    header.append(h2, stats);
    card.appendChild(header);

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

    const ul = document.createElement("ul");
    ul.className = "roster";

    sortedIds.forEach((pid) => {
      const p = playersMap[pid] || {};

      const parts = [];

      if (p.injury_status) {
        parts.push(`<span class="status-injury">${p.injury_status}</span>`);
      }

      if (Array.isArray(r.taxi) && r.taxi.includes(pid)) {
        if (parts.length) {
          parts.push(`<span class="status-separator"> | </span>`);
        }
        parts.push(`<span class="status-taxi">Taxi</span>`);
      }

      const pos = p.position || "";
      const name = p.full_name || pid;
      const team = p.team || "";
      const statusHTML = parts.join("");

      const li = document.createElement("li");
      li.innerHTML = `
        <span class="pos-${pos}">${pos}</span>
        <span class="player">${name}</span>
        <span class="team-name">${team}</span>
        <span class="status">${statusHTML}</span>
      `;
      ul.appendChild(li);
    });

    card.appendChild(ul);
    container.appendChild(card);
    document.dispatchEvent(new Event("rosters:rendered"));
  });
})();
