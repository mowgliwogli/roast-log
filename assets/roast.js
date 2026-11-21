/* Hover / touch / keyboard readout for the roast curves. The curves themselves are
   plain SVG written by build_site.py, so the page reads fine without this script. */
(function () {
  var el = document.getElementById("roast-data");
  if (!el) return;
  var D = JSON.parse(el.textContent);
  var NS = "http://www.w3.org/2000/svg";
  function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function stageAt(t) {
    for (var i = 0; i < D.stages.length; i++) if (t <= D.stages[i].end + 0.01) return D.stages[i].name;
    return "";
  }
  function nearest(t) {
    var lo = 0, hi = D.t.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (D.t[m] < t) lo = m; else hi = m; }
    return (t - D.t[lo] < D.t[hi] - t) ? lo : hi;
  }
  document.querySelectorAll("svg[data-chart]").forEach(function (svg) {
    var g = svg.dataset, fig = svg.closest("figure");
    var x0 = +g.x0, x1 = +g.x1, y0 = +g.y0, y1 = +g.y1, tmax = +g.tmax, vmin = +g.vmin, vmax = +g.vmax;
    var series = g.series.split(",");
    var W = svg.viewBox.baseVal.width;
    var tip = fig.querySelector(".tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; fig.appendChild(tip); }
    var cross = document.createElementNS(NS, "line");
    cross.setAttribute("class", "cross"); cross.setAttribute("y1", y1); cross.setAttribute("y2", y0);
    var dots = series.map(function () {
      var c = document.createElementNS(NS, "circle"); c.setAttribute("r", 5); c.setAttribute("class", "dot"); return c;
    });
    var layer = document.createElementNS(NS, "g"); layer.setAttribute("visibility", "hidden");
    layer.appendChild(cross); dots.forEach(function (c) { layer.appendChild(c); }); svg.appendChild(layer);
    var cur = -1;
    function show(i) {
      cur = i;
      var t = D.t[i], x = x0 + (x1 - x0) * t / tmax;
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      var rows = [];
      series.forEach(function (k, n) {
        var v = D[k][i];
        if (v === null || v === undefined) { dots[n].setAttribute("visibility", "hidden"); return; }
        dots[n].setAttribute("visibility", "inherit");
        dots[n].setAttribute("cx", x);
        dots[n].setAttribute("cy", y0 - (y0 - y1) * (v - vmin) / (vmax - vmin));
        rows.push([D.labels[k], k === "ror" ? v.toFixed(1) + " " + D.unit + " a minute" : Math.round(v) + D.unit]);
      });
      layer.setAttribute("visibility", "visible");
      tip.textContent = "";
      var head = document.createElement("strong");
      head.textContent = rows.length ? rows[0][1] : mmss(t);
      tip.appendChild(head);
      var lines = [];
      if (rows.length) lines.push(rows[0][0] + " at " + mmss(t));
      for (var r = 1; r < rows.length; r++) lines.push(rows[r][0] + " " + rows[r][1]);
      var st = stageAt(t); if (st) lines.push(st + " stage");
      lines.forEach(function (s) { var d = document.createElement("div"); d.textContent = s; tip.appendChild(d); });
      tip.hidden = false;
      var box = svg.getBoundingClientRect(), fb = fig.getBoundingClientRect();
      var px = box.left - fb.left + x * box.width / W, left = px + 12;
      if (left + tip.offsetWidth > fb.width) left = px - 12 - tip.offsetWidth;
      tip.style.transform = "translate(" + Math.max(0, left) + "px," + (box.top - fb.top + 8) + "px)";
    }
    function hide() { layer.setAttribute("visibility", "hidden"); tip.hidden = true; cur = -1; }
    function fromEvent(e) {
      var box = svg.getBoundingClientRect();
      var x = (e.clientX - box.left) * W / box.width;
      var t = Math.min(tmax, Math.max(0, (x - x0) / (x1 - x0) * tmax));
      show(nearest(t));
    }
    svg.addEventListener("pointermove", fromEvent);
    svg.addEventListener("pointerdown", fromEvent);
    svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hide(); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (e.key === "Escape") { hide(); return; }
      if (!step) return;
      e.preventDefault();
      var t = (cur < 0 ? (step > 0 ? 0 : tmax) : D.t[cur] + step * 10);
      show(nearest(Math.min(tmax, Math.max(0, t))));
    });
  });
})();
