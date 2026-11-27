/* Draws the bag label (QR code + roast details) at 300 dpi for Brother QL label printers,
   or places it on one position of an Avery 8160 / 5160 sheet as a Letter-size PDF.
   Needs qrcode.js (qrcode-generator, MIT licence) loaded first. */
(function () {
  var cfg = JSON.parse(document.getElementById("label-data").textContent);
  var SIZES = [
    { id: "29x90", name: "29 × 90 mm (DK-1201 address labels)", w: 90, h: 29 },
    { id: "29x62", name: "29 × 62 mm (DK-1209 small address labels)", w: 62, h: 29 },
    { id: "62x100", name: "62 × 100 mm (DK-1202, or 62 mm roll cut at 100 mm)", w: 100, h: 62 },
    { id: "62x50", name: "62 × 50 mm (62 mm roll cut at 50 mm)", w: 62, h: 50 },
    { id: "avery8160", name: "Avery 8160 / 5160 sheet (1 × 2⅝ in, 30 per sheet)", w: 66.675, h: 25.4, sheet: true }
  ];
  // Avery 8160 / 5160 on US Letter, in inches: 3 columns x 10 rows
  var SHEET = { top: 0.5, left: 0.1875, w: 2.625, h: 1, colPitch: 2.75, rowPitch: 1, cols: 3, rows: 10 };
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
  var current = null, currentCanvas = null;
  function draw() {
    var s = SIZES.filter(function (x) { return x.id === sel.value; })[0] || SIZES[0];
    // sheet labels keep 2.3 mm clear of the edge, since office printers can feed a little off
    var W = Math.round(s.w * MM), H = Math.round(s.h * MM), m = Math.round((s.sheet ? 2.3 : s.h < 40 ? 1.5 : 3) * MM);
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
    current = s; currentCanvas = c;
    posBox.hidden = !s.sheet;
    printBtn.textContent = s.sheet ? "Make sheet PDF" : "Print label";
    try { localStorage.setItem("label-size", s.id); } catch (e) {}
  }

  // ---- Avery sheet: position picker ----
  var posBox = document.getElementById("sheet-pos"), grid = document.getElementById("sheet-grid");
  var posOut = document.getElementById("sheet-pos-now"), printBtn = document.getElementById("label-print");
  var pos = 1;
  try { pos = Math.min(30, Math.max(1, parseInt(localStorage.getItem("sheet-pos"), 10) || 1)); } catch (e) {}
  function setPos(p) {
    pos = p;
    Array.prototype.forEach.call(grid.children, function (b) { b.setAttribute("aria-pressed", String(+b.dataset.pos === p)); });
    posOut.textContent = "Position " + p + " (row " + (Math.floor((p - 1) / SHEET.cols) + 1) + ", " +
      ["left", "middle", "right"][(p - 1) % SHEET.cols] + ")";
    try { localStorage.setItem("sheet-pos", String(p)); } catch (e) {}
  }
  for (var i = 1; i <= SHEET.cols * SHEET.rows; i++) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = i; b.dataset.pos = i;
    b.setAttribute("aria-label", "Position " + i);
    b.addEventListener("click", function () { setPos(+this.dataset.pos); });
    grid.appendChild(b);
  }
  setPos(pos);

  // ---- Avery sheet: a one-page Letter PDF with the label placed exactly (no library needed) ----
  function sheetPdf(outlines) {
    var jpeg = atob(currentCanvas.toDataURL("image/jpeg", 0.95).split(",")[1]);
    var r = Math.floor((pos - 1) / SHEET.cols), col = (pos - 1) % SHEET.cols, PT = 72;
    var x = (SHEET.left + col * SHEET.colPitch) * PT, y = (11 - SHEET.top - (r + 1) * SHEET.rowPitch) * PT;
    var w = SHEET.w * PT, h = SHEET.h * PT, f = function (v) { return v.toFixed(2); };
    var content = "q " + [w, 0, 0, h, x, y].map(f).join(" ") + " cm /Im1 Do Q\n";
    if (outlines) {
      content += "0.5 w 0.6 G\n";
      for (var k = 0; k < SHEET.cols * SHEET.rows; k++) {
        var rr = Math.floor(k / SHEET.cols), cc = k % SHEET.cols;
        content += [(SHEET.left + cc * SHEET.colPitch) * PT, (11 - SHEET.top - (rr + 1) * SHEET.rowPitch) * PT, w, h].map(f).join(" ") + " re S\n";
      }
    }
    var objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
      "<< /Length " + content.length + " >>\nstream\n" + content + "endstream",
      "<< /Type /XObject /Subtype /Image /Width " + currentCanvas.width + " /Height " + currentCanvas.height +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n" + jpeg + "\nendstream"
    ];
    var out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n", offs = [];
    objs.forEach(function (o, n) { offs.push(out.length); out += (n + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    var xref = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offs.forEach(function (o) { out += ("000000000" + o).slice(-10) + " 00000 n \n"; });
    out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    var bytes = new Uint8Array(out.length);
    for (var j = 0; j < out.length; j++) bytes[j] = out.charCodeAt(j) & 255;
    return new Blob([bytes], { type: "application/pdf" });
  }
  function openPdf(outlines) {
    var url = URL.createObjectURL(sheetPdf(outlines));
    var name = cfg.file + "-avery8160-pos" + pos + (outlines ? "-test" : "") + ".pdf";
    var win = window.open(url, "_blank");
    if (!win) { var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  sel.addEventListener("change", draw);
  printBtn.addEventListener("click", function () {
    if (current && current.sheet) {
      openPdf(false);
      if (pos < SHEET.cols * SHEET.rows) setPos(pos + 1);   // ready for the next label on the same sheet
    } else window.print();
  });
  document.getElementById("sheet-test").addEventListener("click", function () { openPdf(true); });
  var ready = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load("800 condensed 40px Archivo"), document.fonts.load("500 20px Archivo")])
    : Promise.resolve();
  ready.then(draw, draw);
})();
