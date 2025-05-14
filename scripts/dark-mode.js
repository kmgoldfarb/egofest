document.addEventListener("rosters:rendered", () => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark);
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

// swap each element’s class from→to
function swapClasses(isDark) {
  CLASS_MAP.forEach(([light, dark]) => {
    // when dark: replace light→dark; when light: replace dark→light
    const from = isDark ? light : dark;
    const to = isDark ? dark : light;
    document.querySelectorAll(`.${from}`).forEach((el) => {
      el.classList.replace(from, to);
    });
  });
}

// apply the theme: set html class + swap your mapped classes + update the button
function applyTheme(isDark) {
  htmlEl.classList.toggle("dark", isDark);
  swapClasses(isDark);
  btn.textContent = isDark ? "Light Mode" : "Dark Mode";
}

document.addEventListener("DOMContentLoaded", () => {
  // 1) on load, pick up the OS/browser preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark);

  // 2) listen for system changes (optional)
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => applyTheme(e.matches));

  // 3) user toggle
  btn.addEventListener("click", () => {
    // flip whatever the current state is
    const isNowDark = !htmlEl.classList.contains("dark");
    applyTheme(isNowDark);
  });
});
