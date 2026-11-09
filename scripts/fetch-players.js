// scripts/fetch-players.js
const fs = require("fs/promises");

async function main() {
  console.log("Fetching players…");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const all = await res.json();

  // Keep only the fields the site renders (~19 MB -> ~1-2 MB)
  const slim = {};
  for (const [id, p] of Object.entries(all)) {
    slim[id] = {
      full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || undefined,
      position: p.position,
      team: p.team,
      injury_status: p.injury_status,
    };
  }

  if (Object.keys(slim).length < 5000) {
    throw new Error("Suspiciously small player list; refusing to overwrite");
  }

  await fs.writeFile("players.json", JSON.stringify(slim));
  console.log(`Saved players.json (${Object.keys(slim).length} players)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
