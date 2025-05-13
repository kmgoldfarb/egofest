// scripts/fetch-players.js
import fs from "fs/promises";

async function main() {
  console.log("Fetching players…");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const players = await res.json();
  await fs.writeFile("players.json", JSON.stringify(players, null, 2));
  console.log("Saved players.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
