// Simple hash-based tabs for the analytics page.
(function () {
  const buttons = [...document.querySelectorAll("[data-tab]")];
  const names = buttons.map((b) => b.dataset.tab);
  function show(name) {
    if (!names.includes(name)) name = names[0];
    buttons.forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on);
    });
    names.forEach((n) => { document.getElementById("tab-" + n).hidden = n !== name; });
    document.dispatchEvent(new CustomEvent("tab:show", { detail: name }));
  }
  buttons.forEach((b) => b.addEventListener("click", () => {
    history.replaceState(null, "", "#" + b.dataset.tab);
    show(b.dataset.tab);
  }));
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();
