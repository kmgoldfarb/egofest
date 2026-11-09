// Small shared helpers for the analytics page.
window.U = (function () {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const median = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const sd = (a) => {
    if (a.length < 2) return null;
    const m = avg(a);
    return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1));
  };
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? "–" : n.toFixed(d));
  const signed = (n, d = 1) => (n == null ? "–" : (n > 0 ? "+" : "") + n.toFixed(d));
  const short = (s, n = 14) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  // cells may be plain values or {t: text, cls: className, title: tooltip}
  function table(headers, rows) {
    const t = el("table", "dyn-table");
    const hr = el("tr");
    headers.forEach((h) => hr.append(el("th", null, h)));
    const th = el("thead");
    th.append(hr);
    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      r.forEach((c) => {
        const o = typeof c === "object" && c !== null ? c : { t: c };
        const td = el("td", o.cls, o.t == null ? "–" : String(o.t));
        if (o.title) td.title = o.title;
        tr.append(td);
      });
      tb.append(tr);
    });
    t.append(th, tb);
    const wrap = el("div", "table-scroll");
    wrap.append(t);
    return wrap;
  }

  const cbs = [];
  new MutationObserver(() => cbs.forEach((f) => f())).observe(document.documentElement, {
    attributes: true, attributeFilter: ["class"],
  });
  const onTheme = (f) => cbs.push(f);
  const visible = (name) => { const p = document.getElementById("tab-" + name); return !!p && !p.hidden; };

  // Lazily run a renderer the first time its tab is shown; re-run on theme change.
  function lazyTab(name, render) {
    let started = false;
    const run = () => Promise.resolve(render()).catch((e) => console.error(e));
    document.addEventListener("tab:show", (e) => {
      if (e.detail === name && !started) { started = true; run(); }
    });
    onTheme(() => { if (started && visible(name)) run(); });
  }

  return { el, css, avg, median, sd, fmt, signed, short, table, onTheme, visible, lazyTab };
})();
