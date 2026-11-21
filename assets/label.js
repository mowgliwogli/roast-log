/* Draws the bag label (QR code + roast details) at 300 dpi for Brother QL label printers.
   Needs qrcode.js (qrcode-generator, MIT licence) loaded first. */
(function () {
  var cfg = JSON.parse(document.getElementById("label-data").textContent);
  var SIZES = [
    { id: "29x90", name: "29 × 90 mm (DK-1201 address labels)", w: 90, h: 29 },
    { id: "29x62", name: "29 × 62 mm (DK-1209 small address labels)", w: 62, h: 29 },
    { id: "62x100", name: "62 × 100 mm (DK-1202, or 62 mm roll cut at 100 mm)", w: 100, h: 62 },
    { id: "62x50", name: "62 × 50 mm (62 mm roll cut at 50 mm)", w: 62, h: 50 }
  ];
  var DPI = 300, MM = DPI / 25.4;
  var sel = document.getElementById("label-size"), img = document.getElementById("label-img");
  var save = document.getElementById("label-save"), urlOut = document.getElementById("qr-url");
  var pageRule = document.createElement("style"); document.head.appendChild(pageRule);
  var url = cfg.url || new URL("../", location.href.replace(/index\.html$/, "")).href;
  urlOut.textContent = url;
  if (!cfg.url && !/github\.io$/.test(location.hostname) && document.getElementById("preview-note")) {
    document.getElementById("preview-note").hidden = false;
  }
  SIZES.forEach(function (s) { var o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
  try { var last = localStorage.getItem("label-size"); if (last) sel.value = last; } catch (e) {}
  if (location.hash.length > 1) sel.value = location.hash.slice(1);
  if (!sel.value) sel.value = SIZES[0].id;

  function wrap(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = "";
    words.forEach(function (w) {
      var t = line ? line + " " + w : w;
      if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines;
  }
  function draw() {
    var s = SIZES.filter(function (x) { return x.id === sel.value; })[0] || SIZES[0];
    var W = Math.round(s.w * MM), H = Math.round(s.h * MM), m = Math.round((s.h < 40 ? 1.5 : 3) * MM);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic";
    // QR code, whole-pixel modules so the thermal head prints crisp squares
    var qr = qrcode(0, "M"); qr.addData(url); qr.make();
    var n = qr.getModuleCount(), quiet = 2;
    var side = Math.min(H - 2 * m, Math.round(W * 0.48));
    var px = Math.max(1, Math.floor(side / (n + 2 * quiet)));
    var qrSize = px * (n + 2 * quiet), qx = m, qy = Math.round((H - qrSize) / 2);
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++)
      if (qr.isDark(r, q)) ctx.fillRect(qx + (q + quiet) * px, qy + (r + quiet) * px, px, px);
    // text block
    var tx = qx + qrSize + Math.round(2 * MM), tw = W - tx - m, top = m, bottom = H - m;
    var small = Math.round((s.h < 40 ? 2.5 : 3.4) * MM), gap = Math.round(small * 0.45);
    var details = [cfg.date, cfg.batch + (cfg.level ? ", " + cfg.level : "")];
    var foot = cfg.foot;
    ctx.font = "500 " + small + "px Archivo, Arial, sans-serif";
    var detailLines = [];
    details.forEach(function (d) { wrap(ctx, d, tw).forEach(function (l) { detailLines.push(l); }); });
    var footLines = foot ? wrap(ctx, foot, tw) : [];
    var fixed = (detailLines.length + footLines.length) * (small + gap) + gap * 2;
    var maxLines = s.h < 40 ? 2 : 4, size = Math.round((s.h < 40 ? 6.2 : 9) * MM), lines;
    for (; size > small; size -= 2) {
      ctx.font = "800 condensed " + size + "px Archivo, Arial Narrow, Arial, sans-serif";
      lines = wrap(ctx, cfg.name, tw);
      var fits = lines.every(function (l) { return ctx.measureText(l).width <= tw; });
      if (fits && lines.length <= maxLines && lines.length * size * 1.02 + fixed <= bottom - top) break;
    }
    var y = top;
    lines.forEach(function (l) { y += size * 0.9; ctx.fillText(l, tx, y); y += size * 0.12; });
    y += gap * 2;
    ctx.font = "500 " + small + "px Archivo, Arial, sans-serif";
    detailLines.forEach(function (l) { y += small; ctx.fillText(l, tx, y); y += gap; });
    var fy = bottom - (footLines.length - 1) * (small + gap);
    if (fy - small > y) footLines.forEach(function (l) { ctx.fillText(l, tx, fy); fy += small + gap; });
    // hand the picture to the page
    var data = c.toDataURL("image/png");
    img.src = data; img.width = W; img.height = H;
    img.alt = "Label for " + cfg.name + ", " + cfg.date + ", with a QR code that opens " + url;
    img.style.setProperty("--label-w", s.w + "mm"); img.style.setProperty("--label-h", s.h + "mm");
    img.style.setProperty("--screen-w", Math.round(s.w * 6) + "px");
    pageRule.textContent = "@page { size: " + s.w + "mm " + s.h + "mm; margin: 0; }";
    save.href = data; save.download = cfg.file + "-" + s.id + ".png";
    try { localStorage.setItem("label-size", s.id); } catch (e) {}
  }
  sel.addEventListener("change", draw);
  document.getElementById("label-print").addEventListener("click", function () { window.print(); });
  var ready = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load("800 condensed 40px Archivo"), document.fonts.load("500 20px Archivo")])
    : Promise.resolve();
  ready.then(draw, draw);
})();
