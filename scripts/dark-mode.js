document.addEventListener("rosters:rendered", () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark);
});

function toggleTheme(e) {
  e.preventDefault();
  const isNowDark = !htmlEl.classList.contains("dark");
  applyTheme(isNowDark);
}

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

document.addEventListener("DOMContentLoaded", () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => applyTheme(e.matches));

  btn.addEventListener("click", () => {
    const isNowDark = !htmlEl.classList.contains("dark");
    applyTheme(isNowDark);
  });
});
