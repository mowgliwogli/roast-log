/* Compare page: put up to four roasts on one chart, every one starting at charge (time zero).
   Reads roasts.json (the list) and r/<number>/data.json (one roast), both written by build_site.py. */
(function () {
  var root = document.getElementById("compare");
  if (!root) return;
  var base = root.dataset.base, MAX = 4;
  // four line colours checked for colour-blind separation on this page's background
  var COLORS = ["#2a78d6", "#d9480f", "#0f9d6c", "#c2389a"];
  var SVG = "http://www.w3.org/2000/svg";
  var index = [], cache = {}, picked = [], showAir = false, lastWidth = 0;
  var listEl = document.getElementById("pick-list"), qEl = document.getElementById("pick-q"),
      noteEl = document.getElementById("pick-note"), out = document.getElementById("compare-out");

  function mmss(s) { s = Math.floor(s + 0.5); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function svg(name, attrs, text) {
    var e = document.createElementNS(SVG, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function h(name, cls, text) {
    var e = document.createElement(name);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function swatch(color) { var s = h("span", "swatch"); s.style.background = color; return s; }
  function short(d) { return d.batch ? "Roast " + d.batch : d.date_short; }
  function deg(v, d) { return Math.round(v) + d.unit; }
  function chosen() {
    return picked.map(function (p) { return { d: cache[p.slug], color: COLORS[p.slot] }; })
                 .filter(function (r) { return r.d; });
  }

  // ---------------------------------------------------------------- choosing roasts
  function add(slug) {
    var used = picked.map(function (p) { return p.slot; }), slot = 0;
    while (used.indexOf(slot) >= 0) slot++;
    picked.push({ slug: slug, slot: slot });            // a roast keeps its colour until it is unticked
    if (cache[slug]) return Promise.resolve();
    return fetch(base + "r/" + slug + "/data.json").then(function (r) { return r.json(); })
      .then(function (d) { cache[slug] = d; });
  }
  function remove(slug) { picked = picked.filter(function (p) { return p.slug !== slug; }); }
  function syncPicker() {
    listEl.querySelectorAll("li").forEach(function (li) {
      var p = picked.filter(function (x) { return x.slug === li.dataset.slug; })[0];
      li.querySelector("input").checked = !!p;
      li.querySelector(".swatch").style.background = p ? COLORS[p.slot] : "transparent";
    });
    var q = picked.map(function (p) { return p.slug; }).join(",");
    try { history.replaceState(null, "", q ? "?r=" + q : location.pathname); } catch (e) {}
  }
  function buildPicker() {
    index.forEach(function (x) {
      var li = h("li"), label = h("label"), box = h("input");
      li.dataset.slug = x.slug; li.dataset.words = x.words;
      box.type = "checkbox";
      box.addEventListener("change", function () {
        noteEl.hidden = true;
        if (box.checked && picked.length >= MAX) {
          box.checked = false;
          noteEl.textContent = "Four roasts at most. Untick one to add another.";
          noteEl.hidden = false;
          return;
        }
        if (box.checked) add(x.slug).then(function () { syncPicker(); draw(); });
        else { remove(x.slug); syncPicker(); draw(); }
      });
      label.appendChild(box); label.appendChild(swatch("transparent"));
      var txt = h("span");
      txt.appendChild(h("span", "pick-name", x.name));
      txt.appendChild(h("span", "pick-meta", (x.batch ? "Roast " + x.batch + ", " : "") + x.date));
      label.appendChild(txt); li.appendChild(label); listEl.appendChild(li);
    });
    qEl.addEventListener("input", function () {
      var words = qEl.value.toLowerCase().split(/\s+/).filter(Boolean);
      listEl.querySelectorAll("li").forEach(function (li) {
        var ok = words.every(function (w) { return li.dataset.words.indexOf(w) >= 0; });
        li.hidden = !ok && !li.querySelector("input").checked;
      });
    });
  }

  // ---------------------------------------------------------------- shared chart pieces
  function frame(W, H, compact, tmax, vmin, vmax, step, label) {
    var g = { W: W, H: H, x0: compact ? 40 : 54, x1: W - (compact ? 46 : 70), y0: H - 40, y1: 14, tmax: tmax, vmin: vmin, vmax: vmax };
    g.X = function (t) { return g.x0 + (g.x1 - g.x0) * t / tmax; };
    g.Y = function (v) { return g.y0 - (g.y0 - g.y1) * (v - vmin) / (vmax - vmin); };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", tabindex: "0", "aria-label": label });
    for (var v = Math.ceil(vmin / step) * step; v <= vmax; v += step) {
      if (v > vmin) s.appendChild(svg("line", { class: "grid", x1: g.x0, x2: g.x1, y1: g.Y(v), y2: g.Y(v) }));
      s.appendChild(svg("text", { x: g.x0 - 8, y: g.Y(v) + 4, "text-anchor": "end" }, v + "°"));
    }
    s.appendChild(svg("line", { class: "grid", x1: g.x0, x2: g.x1, y1: g.y0, y2: g.y0 }));
    for (var m = 0; m * 60 <= tmax; m += compact ? 2 : 1)
      s.appendChild(svg("text", { x: g.X(m * 60), y: g.y0 + 18, "text-anchor": "middle" }, m));
    s.appendChild(svg("text", { x: g.x1, y: g.y0 + 35, "text-anchor": "end" }, "minutes since the beans went in"));
    g.svg = s;
    return g;
  }
  function path(g, ts, vs, attrs) {
    var d = "", pen = false;
    for (var i = 0; i < ts.length; i++) {
      if (vs[i] == null) { pen = false; continue; }
      d += (pen ? " L" : " M") + g.X(ts[i]).toFixed(1) + "," + g.Y(vs[i]).toFixed(1);
      pen = true;
    }
    attrs.d = d.trim(); attrs.fill = "none"; attrs["stroke-linejoin"] = "round"; attrs["stroke-linecap"] = "round";
    return svg("path", attrs);
  }
  function at(d, key, t) {                       // value of one roast at time t, or null once it has finished
    if (t > d.total + 0.5) return null;
    var lo = 0, hi = d.t.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (d.t[m] < t) lo = m; else hi = m; }
    return d[key][(t - d.t[lo] < d.t[hi] - t) ? lo : hi];
  }
  function endLabels(g, rs, key) {               // short name at the end of each line, nudged apart
    var items = rs.map(function (r) {
      var i = r.d.t.length - 1;
      while (i > 0 && r.d[key][i] == null) i--;
      return { r: r, x: g.X(r.d.t[i]), y: g.Y(r.d[key][i]) };
    }).sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 15) items[i].y = items[i - 1].y + 15;
    items.forEach(function (it) {
      g.svg.appendChild(svg("text", { class: "note", x: it.x + 9, y: it.y + 4 }, it.r.d.batch || it.r.d.date_short));
    });
  }
  function hover(fig, g, rs, rows) {             // crosshair and readout for touch, mouse and arrow keys
    var tip = h("div", "tip"); tip.hidden = true; fig.appendChild(tip);
    var layer = svg("g", { visibility: "hidden" }), cross = svg("line", { class: "cross", y1: g.y1, y2: g.y0 });
    layer.appendChild(cross);
    var dots = rs.map(function (r) { var c = svg("circle", { r: 4.5, class: "dot" }); c.style.fill = r.color; layer.appendChild(c); return c; });
    g.svg.appendChild(layer);
    var cur = null;
    function show(t) {
      cur = t = Math.max(0, Math.min(g.tmax, t));
      var x = g.X(t), list = rows(t);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      tip.textContent = ""; tip.appendChild(h("strong", "", mmss(t)));
      list.forEach(function (row, n) {
        dots[n].setAttribute("visibility", row.v == null ? "hidden" : "inherit");
        if (row.v != null) { dots[n].setAttribute("cx", x); dots[n].setAttribute("cy", g.Y(row.v)); }
        var line = h("div"); line.appendChild(swatch(rs[n].color));
        line.appendChild(document.createTextNode(row.label + ": " + row.text)); tip.appendChild(line);
      });
      layer.setAttribute("visibility", "visible"); tip.hidden = false;
      var box = g.svg.getBoundingClientRect(), fb = fig.getBoundingClientRect();
      var px = box.left - fb.left + x * box.width / g.W, left = px + 12;
      if (left + tip.offsetWidth > fb.width) left = px - 12 - tip.offsetWidth;
      tip.style.transform = "translate(" + Math.max(0, left) + "px," + (box.top - fb.top + 8) + "px)";
    }
    function hide() { layer.setAttribute("visibility", "hidden"); tip.hidden = true; cur = null; }
    function ev(e) { var box = g.svg.getBoundingClientRect(); show(((e.clientX - box.left) * g.W / box.width - g.x0) / (g.x1 - g.x0) * g.tmax); }
    g.svg.addEventListener("pointermove", ev); g.svg.addEventListener("pointerdown", ev);
    g.svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hide(); });
    g.svg.addEventListener("blur", hide);
    g.svg.addEventListener("keydown", function (e) {
      if (e.key === "Escape") return hide();
      var step = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0;
      if (step) { e.preventDefault(); show(cur == null ? (step > 0 ? 0 : g.tmax) : cur + step); }
    });
  }
  function figure(g) { var f = h("figure", "curve"); f.appendChild(g.svg); return f; }

  // ---------------------------------------------------------------- the four sections
  function tempChart(rs, W, compact, tmax) {
    var lo = Infinity, hi = -Infinity;
    rs.forEach(function (r) {
      (showAir ? ["bt", "et"] : ["bt"]).forEach(function (k) {
        r.d[k].forEach(function (v) { if (v != null && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
      });
    });
    var step = rs[0].d.unit === "°F" ? 100 : 50;
    var g = frame(W, compact ? 330 : 450, compact, tmax, Math.floor((lo - 15) / 50) * 50, Math.ceil((hi + 15) / 50) * 50, step,
      "Bean temperature of " + rs.length + " roasts on one time axis, each starting when the beans went in.");
    rs.forEach(function (r) {
      if (showAir) g.svg.appendChild(path(g, r.d.t, r.d.et, { stroke: r.color, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    });
    rs.forEach(function (r) { g.svg.appendChild(path(g, r.d.t, r.d.bt, { stroke: r.color, "stroke-width": 2.5 })); });
    rs.forEach(function (r) {
      var marks = [];
      if (r.d.marks.fcs) marks.push(r.d.marks.fcs);
      marks.push([r.d.total, r.d.bt[r.d.bt.length - 1]]);
      marks.forEach(function (m, n) {
        var c = svg("circle", { class: "dot", cx: g.X(m[0]), cy: g.Y(m[1]), r: n === marks.length - 1 ? 4.5 : 5.5 });
        c.style.fill = n === marks.length - 1 ? r.color : "var(--paper)"; c.style.stroke = n === marks.length - 1 ? "var(--paper)" : r.color;
        g.svg.appendChild(c);
      });
    });
    endLabels(g, rs, "bt");
    var f = figure(g);
    hover(f, g, rs, function (t) {
      return rs.map(function (r) {
        var b = at(r.d, "bt", t), e = showAir ? at(r.d, "et", t) : null;
        return { v: b, label: short(r.d), text: b == null ? "finished" : deg(b, r.d) + (e ? ", air " + deg(e, r.d) : "") };
      });
    });
    return f;
  }
  function rorChart(rs, W, compact, tmax) {
    var hi = 10;
    rs.forEach(function (r) { r.d.ror.forEach(function (v) { if (v != null) hi = Math.max(hi, v); }); });
    hi = Math.ceil(hi / 10) * 10;
    var g = frame(W, compact ? 210 : 250, compact, tmax, 0, hi, hi <= 40 ? 10 : 20, "How fast each roast's bean temperature was rising, in degrees a minute.");
    rs.forEach(function (r) {
      g.svg.appendChild(path(g, r.d.t, r.d.ror.map(function (v) { return v == null ? null : Math.max(0, v); }), { stroke: r.color, "stroke-width": 2 }));
    });
    endLabels(g, rs, "ror");
    var f = figure(g);
    hover(f, g, rs, function (t) {
      return rs.map(function (r) {
        var v = at(r.d, "ror", t);
        return { v: v == null ? null : Math.max(0, v), label: short(r.d), text: v == null ? "no reading" : v.toFixed(1) + " " + r.d.unit + " a minute" };
      });
    });
    return f;
  }
  function stageRows(rs, W, compact, tmax) {
    var rowH = 48, H = rs.length * rowH + 44;
    var g = { x0: compact ? 40 : 54, x1: W - (compact ? 46 : 70) };
    g.X = function (t) { return g.x0 + (g.x1 - g.x0) * t / tmax; };
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "How long each roast spent drying, browning and developing, drawn on the same time axis." });
    rs.forEach(function (r, n) {
      var y = n * rowH + 14, d = r.d;
      var dot = svg("circle", { cx: g.x0 + 6, cy: y - 4, r: 6 }); dot.style.fill = r.color; s.appendChild(dot);
      s.appendChild(svg("text", { class: "note", x: g.x0 + 18, y: y }, short(d) + ", " + d.name));
      var parts = d.stages.length ? d.stages : [{ id: "none", start: 0, end: d.total }];
      parts.forEach(function (st, i) {
        var a = g.X(st.start) + (i ? 1 : 0), b = g.X(st.end) - (i < parts.length - 1 ? 1 : 0);
        var rect = svg("rect", { x: a, y: y + 8, width: Math.max(0, b - a), height: 16 });
        rect.style.fill = st.id === "none" ? "var(--rule)" : "var(--" + st.id + ")"; s.appendChild(rect);
        if (b - a > 40) {
          var t = svg("text", { x: (a + b) / 2, y: y + 20.5, "text-anchor": "middle" }, mmss(st.end - st.start));
          t.style.fill = st.id === "development" ? "var(--paper)" : "var(--ink)"; t.style.fontWeight = 600; s.appendChild(t);
        }
      });
      s.appendChild(svg("text", { x: g.X(d.total) + 8, y: y + 20.5 }, mmss(d.total)));
    });
    var y0 = rs.length * rowH + 4;
    s.appendChild(svg("line", { class: "grid", x1: g.x0, x2: g.x1, y1: y0, y2: y0 }));
    for (var m = 0; m * 60 <= tmax; m += compact ? 2 : 1) s.appendChild(svg("text", { x: g.X(m * 60), y: y0 + 18, "text-anchor": "middle" }, m));
    s.appendChild(svg("text", { x: g.x1, y: y0 + 35, "text-anchor": "end" }, "minutes since the beans went in"));
    var f = h("figure", "curve"); f.appendChild(s);
    return f;
  }
  function table(rs) {
    var wrap = h("div", "scroll"), t = h("table", "cmp"), head = h("tr");
    head.appendChild(h("th"));
    rs.forEach(function (r) {
      var th = h("th"), a = h("a", "", short(r.d));
      a.href = base + "r/" + r.d.slug + "/" + (root.dataset.explicit ? "index.html" : "");
      th.appendChild(swatch(r.color)); th.appendChild(a); head.appendChild(th);
    });
    var thead = h("thead"); thead.appendChild(head); t.appendChild(thead);
    var body = h("tbody");
    function mark(d, k) { return d.marks[k] ? mmss(d.marks[k][0]) + " at " + deg(d.marks[k][1], d) : ""; }
    var rows = [
      ["Coffee", function (d) { return d.name; }],
      ["Roasted", function (d) { return d.date; }],
      ["Beans in, beans out", function (d) { return d.green && d.roasted ? Math.round(d.green) + " g to " + Math.round(d.roasted) + " g" : ""; }],
      ["Weight lost", function (d) { return d.loss == null ? "" : d.loss.toFixed(1) + "%"; }],
      ["Time in the roaster", function (d) { return mmss(d.total); }],
      ["Coolest point", function (d) { return mark(d, "tp"); }],
      ["Drying ended", function (d) { return mark(d, "dry"); }],
      ["First crack", function (d) { return mark(d, "fcs"); }],
      ["Development", function (d) { return d.marks.fcs ? mmss(d.total - d.marks.fcs[0]) + ", " + Math.round((d.total - d.marks.fcs[0]) / d.total * 100) + "% of the roast" : ""; }],
      ["Came out at", function (d) { return deg(d.drop_bt, d); }],
      ["Roast level", function (d) { return d.level ? d.level + (d.level_est ? " (estimate)" : "") : ""; }]
    ];
    rows.forEach(function (row) {
      var tr = h("tr"); tr.appendChild(h("th", "", row[0]));
      rs.forEach(function (r) { tr.appendChild(h("td", "", row[1](r.d))); });
      body.appendChild(tr);
    });
    t.appendChild(body); wrap.appendChild(t);
    return wrap;
  }

  function draw() {
    var rs = chosen();
    out.textContent = "";
    if (!rs.length) { out.appendChild(h("p", "empty", "Tick two or more roasts above to compare them.")); return; }
    var W = Math.max(300, Math.floor(out.clientWidth)), compact = W < 620;
    lastWidth = W;
    var tmax = Math.ceil(Math.max.apply(null, rs.map(function (r) { return r.d.total; })) / 30) * 30;
    if (rs.length === 1) out.appendChild(h("p", "notice", index.length < 2
      ? "There is only one roast so far. Comparing starts with the second one."
      : "Tick at least one more roast to compare."));
    if (rs.some(function (r) { return r.d.unit !== rs[0].d.unit; }))
      out.appendChild(h("p", "notice", "These roasts were recorded in different temperature units, so their lines cannot be read against each other."));

    out.appendChild(h("h2", "", "Bean temperature"));
    var legend = h("ul", "legend");
    rs.forEach(function (r) {
      var li = h("li"); li.appendChild(swatch(r.color));
      li.appendChild(document.createTextNode(short(r.d) + ", " + r.d.name + ", " + r.d.date_short)); legend.appendChild(li);
    });
    out.appendChild(legend);
    out.appendChild(tempChart(rs, W, compact, tmax));
    var opt = h("label", "option"), box = h("input"); box.type = "checkbox"; box.checked = showAir;
    box.addEventListener("change", function () { showAir = box.checked; draw(); });
    opt.appendChild(box); opt.appendChild(document.createTextNode(" Also show air temperature (ET), as dashed lines"));
    out.appendChild(opt);
    out.appendChild(h("p", "caption", "Solid lines are bean temperature (BT). The open circle on each line is first crack and the filled circle is where the roast ended."));

    out.appendChild(h("h2", "", "How the time was spent"));
    out.appendChild(stageRows(rs, W, compact, tmax));
    var keys = h("ul", "legend");
    [["drying", "Drying"], ["browning", "Browning"], ["development", "Development, from first crack"]].forEach(function (k) {
      var li = h("li"), s = swatch("var(--" + k[0] + ")"); li.appendChild(s); li.appendChild(document.createTextNode(k[1])); keys.appendChild(li);
    });
    out.appendChild(keys);

    out.appendChild(h("h2", "", "How fast the temperature climbed"));
    out.appendChild(rorChart(rs, W, compact, tmax));
    out.appendChild(h("p", "caption", "Rate of rise: degrees a minute, measured over the previous 30 seconds."));

    out.appendChild(h("h2", "", "Side by side"));
    out.appendChild(table(rs));
  }

  fetch(base + "roasts.json").then(function (r) { return r.json(); }).then(function (list) {
    index = list;
    buildPicker();
    var want = (new URLSearchParams(location.search).get("r") || "").split(",").filter(function (s) {
      return index.some(function (x) { return x.slug === s; });
    }).slice(0, MAX);
    index.forEach(function (x) { if (want.length < 2 && want.indexOf(x.slug) < 0) want.push(x.slug); });   // fill up with the newest roasts
    return Promise.all(want.map(add));
  }).then(function () { syncPicker(); draw(); }).catch(function () {
    out.textContent = "";
    out.appendChild(h("p", "notice", "The roasts could not be loaded. Reload the page to try again."));
  });
  var timer;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { if (Math.floor(out.clientWidth) !== lastWidth) draw(); }, 150);
  });
})();
