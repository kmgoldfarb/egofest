// Cards are built after load, so re-apply the current theme to them
document.addEventListener("rosters:rendered", () => {
  applyTheme(htmlEl.classList.contains("dark"));
});

const btn = document.getElementById("theme-toggle");
const htmlEl = document.documentElement;
const CLASS_MAP = [
  ["team-name", "team-name--dark"],
  ["player", "player--dark"],
  ["status-injury", "status-injury--dark"],
  ["status-taxi", "status-taxi--dark"],
  ["team-stats", "team-stats--dark"],
  ["pos-DB", "pos-DB--dark"],
  ["pos-DL", "pos-DL--dark"],
  ["pos-DE", "pos-DE--dark"],
  ["pos-LB", "pos-LB--dark"],
];

function swapClasses(isDark) {
  CLASS_MAP.forEach(([light, dark]) => {
    const from = isDark ? light : dark;
    const to = isDark ? dark : light;
    document.querySelectorAll(`.${from}`).forEach((el) => {
      el.classList.replace(from, to);
    });
  });
}

function applyTheme(isDark) {
  htmlEl.classList.toggle("dark", isDark);
  swapClasses(isDark);
  btn.textContent = isDark ? "Light Mode" : "Dark Mode";
}

function toggleTheme(e) {
  e.preventDefault();
  const isNowDark = !htmlEl.classList.contains("dark");
  applyTheme(isNowDark);
  try { localStorage.setItem("theme", isNowDark ? "dark" : "light"); } catch (_) {}
}

document.addEventListener("DOMContentLoaded", () => {
  let stored = null;
  try { stored = localStorage.getItem("theme"); } catch (_) {}
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored ? stored === "dark" : prefersDark);

  btn.addEventListener("click", toggleTheme);
  btn.addEventListener("touchend", toggleTheme);
});
