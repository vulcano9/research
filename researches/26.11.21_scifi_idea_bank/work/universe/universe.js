/* Ideen-Universum · Canvas-Erlebnis für 4.417 Sci-Fi-Ideen
   Keine Bibliothek, kein Netz. IIFE, "use strict". */
(function () {
  "use strict";

  var doc = document;
  var section = doc.getElementById("universum");
  if (!section) return;

  var errBox = doc.getElementById("uv-error");

  function fail(msg) {
    if (!errBox) return;
    errBox.hidden = false;
    errBox.textContent = "Das Ideen-Universum konnte nicht vollständig geladen werden: " + msg;
  }

  var dataEl = doc.getElementById("sfib-universe");
  var imgEl = doc.getElementById("sfib-images");
  if (!dataEl) { fail("Die Daten (sfib-universe) fehlen."); return; }

  var U, IMG = {};
  try { U = JSON.parse(dataEl.textContent); } catch (e) { fail("Die Daten sind kein gültiges JSON."); return; }
  try { IMG = imgEl && imgEl.textContent ? JSON.parse(imgEl.textContent) : {}; } catch (e) { IMG = {}; }

  if (!U || !Array.isArray(U.ideas) || !U.ideas.length) { fail("Keine Ideen in den Daten."); return; }

  /* ---------------------------------------------------------- Grundlagen */
  var ideas = U.ideas;
  var N = ideas.length;
  var clusters = (U.clusters || []).slice();
  var CATS = U.cats || [];
  var CATS_EN = U.catsEn || [];
  var CAT_INDEX = {};
  for (var ci = 0; ci < CATS_EN.length; ci++) CAT_INDEX[CATS_EN[ci]] = ci;

  var POS = new Float32Array(N * 2);
  for (var pi = 0; pi < N * 2; pi++) POS[pi] = (+U.pos[pi] || 0) / 10000;
  var CL = new Uint8Array(N);
  for (var cii = 0; cii < N; cii++) CL[cii] = U.cl[cii] | 0;
  var NN = new Int32Array(U.nn.length);
  for (var ni = 0; ni < U.nn.length; ni++) NN[ni] = U.nn[ni] | 0;
  var NNS = new Int32Array(U.nns.length);
  for (var nsi = 0; nsi < U.nns.length; nsi++) NNS[nsi] = U.nns[nsi] | 0;

  var B = new Uint8Array(N);
  var BA = new Uint8Array(N);
  var YR = new Int32Array(N);
  var FY = new Int32Array(N);
  var STATUS_KEY = new Array(N);
  var BA_KEY = new Array(N);
  var ID2I = new Map();
  var SEARCH = new Array(N);
  var AUTHOR_COUNT = new Map();
  var YEAR_MIN = 3000, YEAR_MAX = 1000;
  var catCount = new Array(CATS.length).fill(0);

  var STATUS_NAMES = { 0: "Nicht gebaut", 1: "Gebaut", 2: "Teilweise", 3: "Unbekannt" };
  var BA_NAMES = { 0: "", 1: "Bits", 2: "Atome", 3: "Beides" };

  function norm(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var fmt = new Intl.NumberFormat("de-DE");

  for (var i = 0; i < N; i++) {
    var d = ideas[i];
    B[i] = d.b | 0;
    BA[i] = d.ba | 0;
    YR[i] = d.y | 0;
    FY[i] = d.fyn ? (d.fyn | 0) : -1;
    if (YR[i] < YEAR_MIN) YEAR_MIN = YR[i];
    if (YR[i] > YEAR_MAX) YEAR_MAX = YR[i];
    STATUS_KEY[i] = d.b === 1 ? "Yes" : d.b === 2 ? "Partial" : d.b === 3 ? "" : "No";
    BA_KEY[i] = d.ba === 1 ? "Bits" : d.ba === 2 ? "Atoms" : d.ba === 3 ? "Both" : "";
    ID2I.set(d.id, i);
    var cats = d.c || [];
    for (var k = 0; k < cats.length; k++) if (catCount[cats[k]] != null) catCount[cats[k]]++;
    AUTHOR_COUNT.set(d.a || "", (AUTHOR_COUNT.get(d.a || "") || 0) + 1);
    var parts = [d.n, d.ne, d.d, d.de, d.nv, d.a, d.w, d.p, d.x, d.co];
    for (var q = 0; q < cats.length; q++) {
      parts.push(CATS[cats[q]] || "", CATS_EN[cats[q]] || "");
    }
    SEARCH[i] = norm(parts.join(" § "));
  }
  YEAR_MIN = 1634; YEAR_MAX = 2026;

  var TOTAL = fmt.format(N);

  /* ---------------------------------------------------------- DOM */
  function $(id) { return doc.getElementById(id); }
  var stage = $("uv-stage");
  var canvas = $("uv-canvas");
  var ctx = canvas.getContext("2d");
  var wrapEl = section;
  var controls = $("uv-controls");
  var controlsBody = $("uv-controls-body");
  var foldBtn = $("uv-fold");
  var qInput = $("uv-q");
  var suggestEl = $("uv-suggest");
  var countEl = $("uv-count");
  var statusWrap = $("uv-status");
  var baWrap = $("uv-ba");
  var catSel = $("uv-cat");
  var authorSel = $("uv-author");
  var resetBtn = $("uv-reset");
  var viewWrap = $("uv-view");
  var viewbarEl = section.querySelector(".uv-viewbar");
  var colorWrap = $("uv-color");
  var drawer = $("uv-drawer");
  var drawerScroll = $("uv-drawer-scroll");
  var drawerClose = $("uv-drawer-close");
  var playBtn = $("uv-play");
  var slider = $("uv-slider");
  var yearEl = $("uv-year");
  var timeLabel = $("uv-time-label");
  var timeCount = $("uv-tcount");
  var todayBtn = $("uv-today");
  var tools = $("uv-tools");
  var timeEl = $("uv-time");
  var bridgePanel = $("uv-bridge");
  var miniWrap = $("uv-mini");
  var miniCanvas = $("uv-mini-canvas");
  var tipEl = $("uv-tip");
  var flashYearEl = $("uv-flashyear");
  var noteEl = $("uv-note");
  var liveEl = $("uv-live");
  var coachEl = $("uv-coach");
  var galleryEl = $("uv-gallery");
  var listMode = $("uv-listmode");
  var listEl = $("uv-list");
  var listCount = $("uv-listcount");
  var sortSel = $("uv-sort");
  var moreBtn = $("uv-more");

  if (!ctx) { fail("Dein Browser kann Canvas nicht zeichnen."); return; }

  /* ---------------------------------------------------------- Zustand */
  var F = { q: "", status: [], ba: [], cat: "", author: "", from: null, to: null };
  var qWords = [];
  var mask = new Uint8Array(N);
  var yearMax = YEAR_MAX;
  var view = "galaxy";
  var colorMode = "status";
  var reduced = false;
  var stageVisible = true;
  var playing = false;
  var selected = -1;
  var selectedCluster = -1;
  var visited = [];
  var listOpen = false;
  var listLimit = 60;
  var bridge = { open: false, start: -1, target: -1, path: [], progress: 0, animating: false, animStart: 0 };
  var journey = { active: false, trail: [], timer: 0, next: -1 };
  var flashes = [];

  var cam = { cx: 0.5, cy: 0.5, z: 1 };
  var camTween = null;
  var W = 0, H = 0, DPR = 1, base = 1;
  var cur = new Float32Array(POS);
  var viewPos = { galaxy: POS, time: null, wait: null };
  var morph = null;
  var nebOld = null, nebNew = null;
  var bgCanvas = null, bgW = 0, bgH = 0;
  var clusterCentroid = { galaxy: new Float32Array(clusters.length * 2), time: new Float32Array(clusters.length * 2), wait: new Float32Array(clusters.length * 2) };
  var bandRank = {};
  var waitMax = 1;
  var ageColors = [];
  var baseR = 1.8;
  var lastFlash = 0;
  var miniDirty = true, lastMini = 0;
  var hoverIdx = -1;
  var clusterHits = [];

  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  reduced = !!(reduceMQ && reduceMQ.matches);

  /* ---------------------------------------------------------- Kamera */
  function scaleNow() { return base * cam.z; }
  function w2s(x, y) {
    var s = scaleNow();
    return [(x - cam.cx) * s + W / 2, (y - cam.cy) * s + H / 2];
  }
  function s2w(px, py) {
    var s = scaleNow();
    return [(px - W / 2) / s + cam.cx, (py - H / 2) / s + cam.cy];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function flyTo(cx, cy, z, ms, done) {
    cx = clamp(cx, -0.45, 1.45);
    cy = clamp(cy, -0.45, 1.45);
    z = clamp(z, 0.6, 40);
    if (reduced || !ms) {
      cam.cx = cx; cam.cy = cy; cam.z = z;
      camTween = null; requestDraw(); if (done) done();
      return;
    }
    camTween = { active: true, x0: cam.cx, y0: cam.cy, z0: cam.z, x1: cx, y1: cy, z1: z, t0: performance.now(), ms: ms, done: done || null };
    ensureLoop();
  }

  function fitView(ms) {
    var gc = galaxyCam();
    flyTo(gc.cx, gc.cy, gc.z, ms || 800);
  }

  /* Startkamera: Galaxie in den Bereich rechts vom Steuerpult einpassen */
  function galaxyCam() {
    var pr = plotRect();
    var bx0 = 0.02, bx1 = 0.99;
    var freeW = Math.max(160, W - 18 - pr.x);
    var needW = (bx1 - bx0) * base;
    var z = 1;
    if (needW > freeW * 0.99) z = clamp((freeW * 0.99) / needW, 0.6, 1);
    var s = base * z;
    var cx = 0.5, cy = 0.5;
    var leftEdge = W / 2 + (bx0 - cx) * s;
    if (leftEdge < pr.x + 8) cx -= (pr.x + 8 - leftEdge) / s;
    var rightEdge = W / 2 + (bx1 - cx) * s;
    if (rightEdge > W - 8) cx += (rightEdge - (W - 8)) / s;
    return { cx: cx, cy: cy, z: z };
  }

  /* Der Drawer verdeckt einen Teil der Bühne – Zielpunkt entsprechend verschieben */
  function visibleCenter() {
    if (W <= 760) return [W * 0.5, H * 0.185];
    var drawerW = Math.min(396, W * 0.36);
    return [Math.max(W * 0.3, (W - drawerW) / 2), H * 0.5];
  }
  function plotRect() {
    var sr = stage.getBoundingClientRect();
    var top = (viewbarEl || viewWrap).getBoundingClientRect().bottom - sr.top + 12;
    var bottom = timeEl.getBoundingClientRect().top - sr.top - 34;
    var left = 12;
    if (W > 760) left = controls.getBoundingClientRect().right - sr.left + 20;
    else {
      var tt = tools.getBoundingClientRect().top - sr.top;
      bottom = Math.min(bottom, tt - 10);
    }
    if (view === "wait") left += 36;
    var right = W - 18;
    return { x: left, y: top, w: Math.max(140, right - left), h: Math.max(110, bottom - top) };
  }

  function chartCam() {
    var pr = plotRect();
    var bx0 = 0.065, bx1 = 0.985, by0 = 0.20, by1 = 0.80;
    var wFit = pr.w / (bx1 - bx0);
    var scale = Math.min(view === "wait" && W <= 760 ? wFit * 1.55 : wFit, pr.h / (by1 - by0)) * 0.97;
    var z = clamp(scale / base, 0.6, 40);
    scale = base * z;
    var cx = (bx0 + bx1) / 2 - (pr.x + pr.w / 2 - W / 2) / scale;
    var cy = (by0 + by1) / 2 - (pr.y + pr.h / 2 - H / 2) / scale;
    if (W <= 760 && view === "wait") cx = bx1 - (W - 14 - W / 2) / scale;
    return { cx: cx, cy: cy, z: z };
  }

  function flyToPoint(wx, wy, z, ms) {
    var s = base * z;
    var vc = visibleCenter();
    flyTo(wx - (vc[0] - W / 2) / s, wy - (vc[1] - H / 2) / s, z, ms || 700);
  }

  /* ---------------------------------------------------------- Ansichten */
  var CLUSTER_MEMBERS = (function () {
    var out = [];
    for (var c = 0; c < clusters.length; c++) out.push([]);
    for (var i = 0; i < N; i++) {
      var cid = CL[i];
      if (out[cid]) out[cid].push(i);
    }
    return out;
  })();

  function yearToT(y) {
    if (y < 1880) return ((y - 1634) / 246) * 0.18;
    return 0.18 + ((y - 1880) / 146) * 0.82;
  }
  function hash01(i, salt) {
    var x = Math.sin((i + 1) * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildViews() {
    /* Zeitstrom */
    var order = clusters.slice().sort(function (a, b) { return (a.year - b.year) || (b.size - a.size); });
    for (var r = 0; r < order.length; r++) bandRank[order[r].id] = r;
    var bandH = 0.57 / Math.max(1, clusters.length);
    var t = new Float32Array(N * 2);
    for (var i = 0; i < N; i++) {
      var rank = bandRank[CL[i]] || 0;
      t[2 * i] = 0.075 + yearToT(YR[i]) * 0.9;
      t[2 * i + 1] = 0.22 + (rank + 0.5) * bandH + (hash01(i, 3) - 0.5) * bandH * 0.62;
    }
    viewPos.time = t;

    /* Wartezeit */
    var w = new Float32Array(N * 2);
    var maxWait = 1;
    for (var j = 0; j < N; j++) {
      if (B[j] === 1 && FY[j] >= 0) {
        var wt = FY[j] - YR[j];
        if (wt > maxWait) maxWait = wt;
      }
    }
    waitMax = Math.max(20, maxWait);
    for (var k = 0; k < N; k++) {
      var x = 0.075 + yearToT(YR[k]) * 0.9;
      if (B[k] === 1 && FY[k] >= 0) {
        var wait = Math.max(0, FY[k] - YR[k]);
        w[2 * k] = x;
        w[2 * k + 1] = 0.58 - (wait / waitMax) * 0.34;
      } else {
        w[2 * k] = x + (hash01(k, 7) - 0.5) * 0.026;
        w[2 * k + 1] = 0.662 + Math.pow(hash01(k, 11), 1.45) * 0.115;
      }
    }
    viewPos.wait = w;

    /* Schwerpunkte je Ansicht */
    Object.keys(viewPos).forEach(function (key) {
      var p = viewPos[key];
      var out = clusterCentroid[key];
      var sums = new Float32Array(clusters.length * 3);
      for (var m = 0; m < N; m++) {
        var c = CL[m];
        if (c >= clusters.length) continue;
        sums[3 * c] += p[2 * m];
        sums[3 * c + 1] += p[2 * m + 1];
        sums[3 * c + 2]++;
      }
      for (var c2 = 0; c2 < clusters.length; c2++) {
        var n = sums[3 * c2 + 2] || 1;
        out[2 * c2] = sums[3 * c2] / n;
        out[2 * c2 + 1] = sums[3 * c2 + 1] / n;
      }
    });
  }

  /* ---------------------------------------------------------- Farben */
  var SPRITES = {};
  function colorWithAlpha(color, a) {
    if (color.charAt(0) === "#") {
      var h = color.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var num = parseInt(h, 16);
      return "rgba(" + ((num >> 16) & 255) + "," + ((num >> 8) & 255) + "," + (num & 255) + "," + a + ")";
    }
    var m = color.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var parts = m[1].split(",");
      return "rgba(" + parts[0].trim() + "," + parts[1].trim() + "," + parts[2].trim() + "," + a + ")";
    }
    return color.replace(/\)\s*$/, " / " + a + ")");
  }
  function sprite(color) {
    if (SPRITES[color]) return SPRITES[color];
    var S = 64;
    var c = doc.createElement("canvas");
    c.width = S; c.height = S;
    var x = c.getContext("2d");
    var g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,255,.98)");
    g.addColorStop(0.16, colorWithAlpha(color, 0.98));
    g.addColorStop(0.34, colorWithAlpha(color, 0.5));
    g.addColorStop(0.62, colorWithAlpha(color, 0.14));
    g.addColorStop(1, colorWithAlpha(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    SPRITES[color] = c;
    return c;
  }

  function statusColor(b) {
    return b === 1 ? "#ffc766" : b === 2 ? "#ff9f4a" : b === 3 ? "#8a86a8" : "#a9c4ff";
  }
  function baColor(v) {
    return v === 1 ? "#7fa8ff" : v === 2 ? "#ffb37a" : v === 3 ? "#c9a4ff" : "#8a86a8";
  }
  function clusterHue(cid) {
    var c = clusters[cid];
    return c && typeof c.hue === "number" ? c.hue : (cid * 15) % 360;
  }
  function clusterColor(cid) {
    return "hsl(" + clusterHue(cid) + " 72% 67%)";
  }
  function ageColor(y) {
    var t = clamp((y - 1634) / (2026 - 1634), 0, 1);
    var a = [255, 179, 122], b = [205, 182, 255], c = [111, 214, 255];
    var r, g, bl;
    if (t < 0.5) {
      var u = t / 0.5;
      r = a[0] + (b[0] - a[0]) * u; g = a[1] + (b[1] - a[1]) * u; bl = a[2] + (b[2] - a[2]) * u;
    } else {
      var v = (t - 0.5) / 0.5;
      r = b[0] + (c[0] - b[0]) * v; g = b[1] + (c[1] - b[1]) * v; bl = b[2] + (c[2] - b[2]) * v;
    }
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
  }
  function ideaColor(i) {
    if (colorMode === "ba") return baColor(BA[i]);
    if (colorMode === "cluster") return clusterColor(CL[i]);
    if (colorMode === "age") return ageColor(YR[i]);
    return statusColor(effB(i));
  }
  function effB(i) {
    if (B[i] === 1 && !builtByYear(i, yearMax)) return 0;
    return B[i];
  }
  function builtByYear(i, y) {
    return B[i] === 1 && (FY[i] < 0 || FY[i] <= y);
  }

  /* ---------------------------------------------------------- Hintergrund */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function buildBackground() {
    var w = Math.max(2, Math.round(W * 1.18));
    var h = Math.max(2, Math.round(H * 1.18));
    var c = doc.createElement("canvas");
    c.width = Math.round(w * DPR);
    c.height = Math.round(h * DPR);
    var x = c.getContext("2d");
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    var g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#070c22");
    g.addColorStop(0.55, "#060a1c");
    g.addColorStop(1, "#040716");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    var rg = x.createRadialGradient(w * 0.7, h * 0.16, 0, w * 0.7, h * 0.16, Math.max(w, h) * 0.55);
    rg.addColorStop(0, "rgba(58,86,196,.17)");
    rg.addColorStop(0.6, "rgba(40,60,150,.05)");
    rg.addColorStop(1, "rgba(40,60,150,0)");
    x.fillStyle = rg;
    x.fillRect(0, 0, w, h);

    var rg2 = x.createRadialGradient(w * 0.12, h * 0.92, 0, w * 0.12, h * 0.92, Math.max(w, h) * 0.45);
    rg2.addColorStop(0, "rgba(120,72,180,.13)");
    rg2.addColorStop(1, "rgba(120,72,180,0)");
    x.fillStyle = rg2;
    x.fillRect(0, 0, w, h);

    /* Milchstraße: weiches Band */
    x.save();
    x.translate(w * 0.5, h * 0.52);
    x.rotate(-0.42);
    var band = x.createRadialGradient(0, 0, 0, 0, 0, w * 0.52);
    band.addColorStop(0, "rgba(150,180,255,.06)");
    band.addColorStop(0.5, "rgba(140,170,255,.03)");
    band.addColorStop(1, "rgba(140,170,255,0)");
    x.scale(1, 0.28);
    x.fillStyle = band;
    x.beginPath();
    x.arc(0, 0, w * 0.52, 0, Math.PI * 2);
    x.fill();
    x.restore();

    var rnd = rng(20261121);
    for (var s = 0; s < 640; s++) {
      var px = rnd() * w, py = rnd() * h;
      var r = rnd();
      var size = r > 0.985 ? 1.8 : r > 0.9 ? 1.2 : 0.8;
      var a = 0.16 + rnd() * 0.5;
      x.fillStyle = "rgba(205,220,255," + a.toFixed(2) + ")";
      x.fillRect(px, py, size, size);
    }
    for (var s2 = 0; s2 < 18; s2++) {
      var bx = rnd() * w, by = rnd() * h;
      var bg = x.createRadialGradient(bx, by, 0, bx, by, 10 + rnd() * 16);
      bg.addColorStop(0, "rgba(220,232,255,.5)");
      bg.addColorStop(0.3, "rgba(170,195,255,.14)");
      bg.addColorStop(1, "rgba(170,195,255,0)");
      x.fillStyle = bg;
      x.beginPath();
      x.arc(bx, by, 26, 0, Math.PI * 2);
      x.fill();
    }
    bgCanvas = c;
    bgW = w; bgH = h;
  }

  function buildNebula(positions) {
    var S = 1024;
    var c = doc.createElement("canvas");
    c.width = S; c.height = S;
    var x = c.getContext("2d");
    x.globalCompositeOperation = "lighter";
    for (var ci = 0; ci < clusters.length; ci++) {
      var cid = clusters[ci].id;
      var members = CLUSTER_MEMBERS[cid] || [];
      if (!members.length) continue;
      var step = Math.max(1, Math.floor(members.length / 26));
      var hue = clusterHue(cid);
      for (var m = 0; m < members.length; m += step) {
        var idx = members[m];
        var px = positions[2 * idx] * S, py = positions[2 * idx + 1] * S;
        var rad = S * (0.055 + 0.03 * hash01(idx, 5));
        var g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, "hsla(" + hue + ",70%,62%,0.075)");
        g.addColorStop(0.45, "hsla(" + hue + ",70%,58%,0.032)");
        g.addColorStop(1, "hsla(" + hue + ",70%,58%,0)");
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, rad, 0, Math.PI * 2);
        x.fill();
      }
    }
    /* weiche Kante, damit kein Rechteck sichtbar wird */
    x.globalCompositeOperation = "destination-in";
    var mask = x.createRadialGradient(S / 2, S / 2, S * 0.16, S / 2, S / 2, S * 0.53);
    mask.addColorStop(0, "rgba(255,255,255,1)");
    mask.addColorStop(0.72, "rgba(255,255,255,.92)");
    mask.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = mask;
    x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = "source-over";
    return c;
  }

  /* ---------------------------------------------------------- Größe */
  function measure() {
    var r = stage.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width));
    H = Math.max(2, Math.round(r.height));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    base = Math.min(W, H) * 0.98;
    buildBackground();
    requestDraw();
    miniDirty = true;
  }

  /* ---------------------------------------------------------- Zeichnen */
  function requestDraw() { dirty = true; ensureLoop(); }
  var dirty = true, rafId = 0, lastFlickerDraw = 0;

  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    rafId = 0;
    if (playing && playState) advancePlay(ts);
    var heavy = (morph && morph.active) || (camTween && camTween.active) || playing || journey.active || bridge.animating || flashes.length > 0;
    var flickOK = !reduced && stageVisible && !doc.hidden;
    var interval = selected >= 0 ? 34 : 46;
    var due = dirty || heavy || (flickOK && ts - lastFlickerDraw >= interval);
    if (due && (stageVisible || dirty)) {
      draw(ts);
      dirty = false;
      lastFlickerDraw = ts;
    }
    if (heavy || flickOK || dirty) ensureLoop();
  }

  var hudBoxes = [];
  function computeHudBoxes() {
    hudBoxes = [];
    var sr = stage.getBoundingClientRect();
    var ids = ["uv-controls", "uv-viewbar", "uv-time", "uv-tools", "uv-mini", "uv-drawer"];
    for (var i = 0; i < ids.length; i++) {
      var el = doc.getElementById(ids[i]);
      if (!el || el.hidden) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      hudBoxes.push({ x: r.left - sr.left - 8, y: r.top - sr.top - 8, w: r.width + 16, h: r.height + 16 });
    }
  }
  function inHud(box) {
    for (var i = 0; i < hudBoxes.length; i++) {
      var o = hudBoxes[i];
      if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) return true;
    }
    return false;
  }

  function draw(ts) {
    /* Morph fortschreiben */
    if (morph && morph.active) {
      var p = clamp((ts - morph.t0) / morph.ms, 0, 1);
      var e = easeInOutCubic(p);
      var from = morph.from, to = morph.to;
      for (var m = 0; m < N * 2; m++) cur[m] = from[m] + (to[m] - from[m]) * e;
      if (p >= 1) {
        morph.active = false;
        cur.set(to);
        finalizeView();
      }
    }
    if (camTween && camTween.active) {
      var cp = clamp((ts - camTween.t0) / camTween.ms, 0, 1);
      var ce = easeInOutCubic(cp);
      cam.cx = camTween.x0 + (camTween.x1 - camTween.x0) * ce;
      cam.cy = camTween.y0 + (camTween.y1 - camTween.y0) * ce;
      cam.z = camTween.z0 + (camTween.z1 - camTween.z0) * ce;
      if (cp >= 1) {
        camTween.active = false;
        var cb = camTween.done;
        camTween = null;
        if (cb) cb();
      }
    }
    if (bridge.animating) {
      var bp = clamp((ts - bridge.animStart) / Math.max(900, bridge.path.length * 300), 0, 1);
      bridge.progress = easeOutCubic(bp);
      if (bp >= 1) bridge.animating = false;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* Hintergrund mit Parallaxe */
    if (bgCanvas) {
      var dx = clamp(-W * 0.09 - (cam.cx - 0.5) * W * 0.07, -W * 0.18, 0);
      var dy = clamp(-H * 0.09 - (cam.cy - 0.5) * H * 0.07, -H * 0.18, 0);
      ctx.drawImage(bgCanvas, dx, dy, bgW, bgH);
    }

    var scale = scaleNow();

    var visCount = 0;
    for (var vc = 0; vc < N; vc++) if (YR[vc] <= yearMax && mask[vc]) visCount++;
    var nebScale = 0.06 + 0.94 * Math.min(1, visCount / 1200);

    /* Nebel */
    if (nebNew) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-cam.cx, -cam.cy);
      var nebMix = (view === "time" ? 0.45 : 1) * nebScale;
      if (nebOld && morph && morph.active) {
        var mp = clamp((ts - morph.t0) / morph.ms, 0, 1);
        ctx.globalAlpha = (1 - mp) * nebMix;
        ctx.drawImage(nebOld, 0, 0, 1, 1);
        ctx.globalAlpha = mp * nebMix;
      } else {
        ctx.globalAlpha = nebMix;
      }
      ctx.drawImage(nebNew, 0, 0, 1, 1);
      ctx.restore();
    }

    /* Linien: Gedankenreise, Brücke */
    drawJourneyTrail();
    drawBridgePath(ts);

    /* Sterne */
    baseR = clamp(1.55 + Math.log2(Math.max(1, cam.z)) * 0.55, 1.6, 3.2);
    var x0 = cam.cx - (W / 2) / scale - 30 / scale;
    var x1 = cam.cx + (W / 2) / scale + 30 / scale;
    var y0 = cam.cy - (H / 2) / scale - 30 / scale;
    var y1 = cam.cy + (H / 2) / scale + 30 / scale;
    var flickerOn = !reduced;
    var tphase = ts * 0.0016;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cam.cx, -cam.cy);

    for (var i = 0; i < N; i++) {
      if (YR[i] > yearMax) continue;
      var wx = cur[2 * i], wy = cur[2 * i + 1];
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      var ok = mask[i] === 1;
      var eb = ebOf(i);
      if (view === "wait" && !(B[i] === 1 && FY[i] >= 0)) {
        var seaR = (ok ? 1.5 : 1.2) / scale;
        ctx.globalAlpha = ok ? 0.5 : 0.08;
        ctx.fillStyle = ok ? (colorMode === "status" ? "#a9c4ff" : ideaColorOf(i, eb)) : "#7f8cb8";
        ctx.fillRect(wx, wy, seaR, seaR);
        continue;
      }
      var inFocus = selectedCluster < 0 || CL[i] === selectedCluster;
      if (!inFocus) { ok = false; }
      var col = ideaColorOf(i, eb);
      var r = baseR * (0.86 + hash01(i, 2) * 0.3);
      var alpha;
      if (!ok) {
        alpha = 0.075;
        r *= 0.72;
      } else {
        alpha = 0.7 + hash01(i, 4) * 0.16;
        if (eb === 1) { r *= 1.62; alpha = 1; }
        else if (eb === 2) { r *= 1.24; alpha = 0.92; }
        if (eb === 0 && B[i] === 1) alpha *= 0.62;
        if (flickerOn) alpha *= 0.84 + 0.16 * Math.sin(tphase + i * 2.399);
        if (view === "wait" && !(B[i] === 1 && FY[i] >= 0)) { alpha *= 0.3; r *= 0.78; }
        if (selected === i) { r *= 1.5; alpha = 1; }
      }
      var sp = sprite(col);
      var size = (r * 6.6) / scale;
      var half = size / 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp, wx - half, wy - half, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    computeHudBoxes();
    if (selectedCluster >= 0 && view === "galaxy") drawClusterVignette();
    drawSelection(ts);
    drawClusterLabels();
    drawIdeaLabels();
    drawAxes();
    drawFlashes(ts);
    drawYearOverlay();

    if (ts - lastMini > 200) { lastMini = ts; drawMini(); }
  }

  function ebOf(i) { return B[i] === 1 && !builtByYear(i, yearMax) ? 0 : B[i]; }

  /* Dunkle Vignette über allem außerhalb des fokussierten Sternbilds */
  function drawClusterVignette() {
    var members = CLUSTER_MEMBERS[selectedCluster] || [];
    var bx = 0, by = 0, n = 0;
    for (var m = 0; m < members.length; m++) {
      var p = w2s(cur[2 * members[m]], cur[2 * members[m] + 1]);
      if (p[0] < -240 || p[0] > W + 240 || p[1] < -240 || p[1] > H + 240) continue;
      bx += p[0]; by += p[1]; n++;
    }
    if (n) { bx /= n; by /= n; } else { bx = W / 2; by = H / 2; }
    var rad = Math.min(W, H) * 0.52;
    var g = ctx.createRadialGradient(bx, by, rad * 0.16, bx, by, rad);
    g.addColorStop(0, "rgba(6,10,28,0)");
    g.addColorStop(0.5, "rgba(6,10,28,.2)");
    g.addColorStop(1, "rgba(6,10,28,.62)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function ideaColorOf(i, eb) {
    if (colorMode === "ba") return baColor(BA[i]);
    if (colorMode === "cluster") return clusterColor(CL[i]);
    if (colorMode === "age") return ageColor(YR[i]);
    return statusColor(eb);
  }

  /* ---------------------------------------------------------- Auswahl */
  function drawSelection(ts) {
    if (selected < 0) return;
    var p = w2s(cur[2 * selected], cur[2 * selected + 1]);
    var pulse = reduced ? 0 : Math.sin(ts * 0.0038) * 0.5 + 0.5;

    /* Linien zu Nachbarn */
    ctx.save();
    ctx.lineWidth = 1;
    for (var k = 0; k < 8; k++) {
      var nb = NN[selected * 8 + k];
      if (nb == null || nb < 0 || nb >= N) continue;
      var sim = (NNS[selected * 8 + k] || 0) / 100;
      var q = w2s(cur[2 * nb], cur[2 * nb + 1]);
      ctx.strokeStyle = "rgba(255,199,102," + (0.08 + sim * 0.4).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
    ctx.restore();

    /* Ringe */
    var rr = 9 + pulse * 3;
    ctx.save();
    ctx.strokeStyle = "rgba(255,214,150,.95)";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,199,102," + (0.5 - pulse * 0.28).toFixed(2) + ")";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p[0], p[1], rr + 8 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,199,102,.18)";
    ctx.beginPath(); ctx.arc(p[0], p[1], rr + 18 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    /* Nachbarn markieren */
    ctx.save();
    for (var k2 = 0; k2 < 8; k2++) {
      var nb2 = NN[selected * 8 + k2];
      if (nb2 == null || nb2 < 0 || nb2 >= N) continue;
      if (YR[nb2] > yearMax) continue;
      var pp = w2s(cur[2 * nb2], cur[2 * nb2 + 1]);
      ctx.fillStyle = "rgba(255,199,102,.85)";
      ctx.beginPath(); ctx.arc(pp[0], pp[1], 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- Labels */
  function setSpacing(px) {
    try { ctx.letterSpacing = px + "px"; } catch (e) { /* ältere Browser */ }
  }

  function drawClusterLabels() {
    clusterHits = [];
    if (cam.z >= 1.95) return;
    var used = [];
    var items = [];
    var stickyLeft = 14;
    if (W > 760 && controls) {
      var cr0 = controls.getBoundingClientRect();
      var sr0 = stage.getBoundingClientRect();
      stickyLeft = cr0.right - sr0.left + 14;
    }
    for (var c = 0; c < clusters.length; c++) {
      var cl = clusters[c];
      var p;
      if (view === "time") {
        var bandY = w2s(0, clusterCentroid.time[2 * c + 1])[1];
        p = [W > 760 ? stickyLeft : 10, bandY];
      } else if (view === "wait") {
        continue;
      } else {
        p = w2s(clusterCentroid.galaxy[2 * c], clusterCentroid.galaxy[2 * c + 1]);
      }
      if (p[0] < -80 || p[0] > W + 80 || p[1] < -20 || p[1] > H + 20) continue;
      items.push({ c: c, x: p[0], y: p[1], size: cl.size, name: cl.name });
    }
    items.sort(function (a, b) { return b.size - a.size; });
    if (W < 620) items = items.slice(0, 9);

    ctx.save();
    ctx.font = "500 " + (W < 620 ? 10.5 : 12) + "px ui-serif, Georgia, serif";
    setSpacing(1.7);
    ctx.textBaseline = "middle";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var text = String(it.name || "Sternbild").toUpperCase();
      var wdt = ctx.measureText(text).width + 16;
      var x = view === "time" ? it.x : it.x - wdt / 2;
      var y = it.y;
      if (view !== "time") {
        if (x < 6) x = 6;
        if (x + wdt + 6 > W - 6) x = W - 6 - wdt - 6;
        if (y < 26) y = 26;
        if (y > H - 26) y = H - 26;
      }
      var box = { x: x - 6, y: y - 9, w: wdt + 6, h: 18 };
      if (box.x < 2 || box.y < 2 || box.x + box.w > W - 2 || box.y + box.h > H - 2) continue;
      var clash = inHud(box);
      for (var u = 0; u < used.length && !clash; u++) {
        var o = used[u];
        if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) { clash = true; break; }
      }
      if (clash) continue;
      used.push(box);
      ctx.fillStyle = "hsla(" + clusterHue(it.c) + ",80%,70%,.85)";
      ctx.beginPath();
      ctx.arc(x + 3, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "rgba(4,7,20,.98)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = selectedCluster >= 0 && it.c !== selectedCluster
        ? "rgba(240,245,255,.22)"
        : "rgba(240,245,255,.88)";
      if (selectedCluster >= 0 && it.c !== selectedCluster) ctx.shadowBlur = 0;
      ctx.fillText(text, x + 10, y + 0.5);
      ctx.shadowBlur = 12;
      ctx.shadowBlur = 0;
      clusterHits.push({ k: it.c, x: box.x, y: box.y, w: box.w, h: box.h });
    }
    setSpacing(0);
    ctx.restore();
  }

  function drawIdeaLabels() {
    ctx.save();
    ctx.textBaseline = "middle";
    var smallStage = W < 620;
    var rects = [];
    function collides(x, y, w, h) {
      for (var r = 0; r < rects.length; r++) {
        var o = rects[r];
        if (x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y) return true;
      }
      return false;
    }
    function trim(name) {
      return name.length > 30 ? name.slice(0, 28) + "…" : name;
    }

    var focus = [];
    if (selected >= 0) {
      var nbs = [];
      for (var k = 0; k < 8; k++) {
        var nb = NN[selected * 8 + k];
        if (nb == null || nb < 0 || nb >= N) continue;
        if (YR[nb] > yearMax) continue;
        nbs.push({ i: nb, sim: NNS[selected * 8 + k] || 0 });
      }
      nbs.sort(function (a, b) { return b.sim - a.sim; });
      focus.push({ i: selected, strong: true });
      for (var f0 = 0; f0 < nbs.length; f0++) focus.push({ i: nbs[f0].i, strong: false });
    }

    var fontFocus = "600 " + (smallStage ? 11.5 : 12.5) + "px ui-serif, Georgia, serif";
    ctx.font = fontFocus;
    for (var f = 0; f < focus.length; f++) {
      var idx = focus[f].i;
      var p = w2s(cur[2 * idx], cur[2 * idx + 1]);
      if (p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) { focus[f].skip = true; continue; }
      var nm = trim(ideas[idx].n || ideas[idx].ne);
      var w = ctx.measureText(nm).width;
      var bx = p[0] + 10, by = p[1] - 8;
      var box = { x: bx - 4, y: by - 1, w: w + 8, h: 16 };
      if (!focus[f].strong && (inHud(box) || collides(box.x, box.y, box.w, box.h))) { focus[f].skip = true; continue; }
      rects.push(box);
      focus[f].x = bx; focus[f].y = p[1] + 1; focus[f].nm = nm;
    }

    if (cam.z >= 2.2) {
      var maxLabels = smallStage ? 18 : 85;
      ctx.font = "500 " + (smallStage ? 10.5 : 11.5) + "px ui-serif, Georgia, serif";
      ctx.shadowColor = "rgba(4,7,20,.92)";
      ctx.shadowBlur = 6;
      var drawn = 0;
      for (var i = 0; i < N && drawn < maxLabels; i++) {
        if (mask[i] !== 1 || YR[i] > yearMax) continue;
        if (selectedCluster >= 0 && CL[i] !== selectedCluster) continue;
        if (B[i] !== 1 && B[i] !== 2 && cam.z < 4.2) continue;
        if (selected === i) continue;
        var q = w2s(cur[2 * i], cur[2 * i + 1]);
        if (q[0] < 6 || q[0] > W - 36 || q[1] < 24 || q[1] > H - 30) continue;
        var name = trim(ideas[i].n || ideas[i].ne);
        var w2 = ctx.measureText(name).width;
        if (q[0] + 7 + w2 > W - 4) continue;
        var bx2 = q[0] + 7, by2 = q[1] - 7;
        if (inHud({ x: bx2, y: by2, w: w2 + 4, h: 14 })) continue;
        if (collides(bx2, by2, w2 + 4, 14)) continue;
        rects.push({ x: bx2, y: by2, w: w2 + 4, h: 14 });
        ctx.fillStyle = B[i] === 1 ? "rgba(255,225,170,.74)" : "rgba(211,223,255,.56)";
        ctx.fillText(name, q[0] + 7, q[1]);
        drawn++;
      }
    }

    ctx.font = fontFocus;
    ctx.shadowColor = "rgba(4,7,20,.98)";
    ctx.shadowBlur = 9;
    for (var g = focus.length - 1; g >= 0; g--) {
      var it = focus[g];
      if (it.skip) continue;
      if (it.strong) {
        var tw = ctx.measureText(it.nm).width;
        ctx.fillStyle = "rgba(6,10,28,.62)";
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(it.x - 5, it.y - 10, tw + 10, 18, 5); ctx.fill(); }
        else ctx.fillRect(it.x - 5, it.y - 10, tw + 10, 18);
      }
      ctx.fillStyle = it.strong ? "#ffe3b3" : "rgba(220,230,255,.92)";
      ctx.fillText(it.nm, it.x, it.y);
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- Achsen */
  function drawAxes() {
    if (view !== "time" && view !== "wait") return;
    var decades = [];
    for (var y = 1640; y <= 2020; y += 10) decades.push(y);
    var p0 = w2s(0.075 + yearToT(1700) * 0.9, 0);
    var p1 = w2s(0.075 + yearToT(1800) * 0.9, 0);
    var spacing = Math.abs(p1[0] - p0[0]);
    var step = 10;
    while (spacing * (step / 10) < 46 && step < 60) step += 10;

    var yTop = view === "time" ? 0.2 : 0.24;
    var yAxis = view === "time" ? 0.8 : 0.58;
    var ySea = 0.62;
    var topY = w2s(0, yTop)[1];
    var axisY = w2s(0, yAxis)[1];
    var leftX = w2s(0.065, 0)[0];
    var rightX = w2s(0.985, 0)[0];
    var sticky = view === "wait" && W <= 760;
    var axisStart = sticky ? 46 : leftX;
    var labelX = sticky ? 40 : leftX - 7;
    var textLeft = sticky ? 8 : leftX;

    ctx.save();
    if (sticky) {
      var veil = ctx.createLinearGradient(0, 0, 116, 0);
      veil.addColorStop(0, "rgba(6,10,28,.94)");
      veil.addColorStop(0.52, "rgba(6,10,28,.8)");
      veil.addColorStop(1, "rgba(6,10,28,0)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, topY - 26, 120, H - topY + 10);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(150,175,255,.13)";
    ctx.fillStyle = "rgba(160,178,220,.55)";
    ctx.font = "500 10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (view === "time") {
      var bandH2 = 0.57 / Math.max(1, clusters.length);
      for (var b = 0; b < clusters.length; b++) {
        var by = w2s(0, 0.22 + b * bandH2)[1];
        var bh2 = bandH2 * scaleNow();
        if (b % 2 === 0) {
          ctx.fillStyle = "rgba(150,175,255,.018)";
          ctx.fillRect(leftX, by, rightX - leftX, bh2);
        }
        ctx.strokeStyle = "rgba(150,175,255,.055)";
        ctx.beginPath();
        ctx.moveTo(leftX, by);
        ctx.lineTo(rightX, by);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(160,178,220,.55)";
    }

    var lastLineX = -999;
    for (var d = 0; d < decades.length; d++) {
      var yr = decades[d];
      if (yr % step !== 0) continue;
      var sx = w2s(0.075 + yearToT(yr) * 0.9, 0)[0];
      if (sx < axisStart + 4 || sx > rightX + 1) continue;
      if (sx - lastLineX < 30) continue;
      lastLineX = sx;
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.lineTo(sx, axisY);
      ctx.stroke();
      ctx.fillText(String(yr), sx, axisY + 6);
    }
    ctx.strokeStyle = "rgba(170,195,255,.28)";
    ctx.beginPath();
    ctx.moveTo(axisStart, axisY);
    ctx.lineTo(rightX, axisY);
    ctx.stroke();

    ctx.textAlign = "left";
    if (view === "time") {
      ctx.fillStyle = "rgba(160,178,220,.55)";
      ctx.fillText("Jahr der Geschichte →", leftX, axisY + 22);
    }

    if (view === "wait") {
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      var tickStep = 50;
      var pxPerTick = (0.34 * scaleNow() * tickStep) / waitMax;
      while (pxPerTick < 21 && tickStep < 200) { tickStep += 50; pxPerTick = (0.34 * scaleNow() * tickStep) / waitMax; }
      var steps = [];
      for (var tv = 0; tv <= waitMax + 1; tv += tickStep) steps.push(tv);
      for (var s = 0; s < steps.length; s++) {
        if (steps[s] > waitMax) continue;
        var yy = 0.58 - (steps[s] / waitMax) * 0.34;
        var sy = w2s(0, yy)[1];
        if (sy < topY - 2) continue;
        ctx.strokeStyle = "rgba(150,175,255,.09)";
        ctx.beginPath();
        ctx.moveTo(axisStart, sy);
        ctx.lineTo(rightX, sy);
        ctx.stroke();
        ctx.fillStyle = "rgba(160,178,220,.55)";
        ctx.fillText(String(steps[s]), labelX, sy);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(160,178,220,.6)";
      ctx.font = "500 10px ui-monospace, Menlo, monospace";
      ctx.fillText("↑ Wartezeit in Jahren", textLeft, topY - 16);

      var seaN = 0;
      for (var m = 0; m < N; m++) if (!(B[m] === 1 && FY[m] >= 0) && mask[m] === 1 && YR[m] <= yearMax) seaN++;
      var sepY = w2s(0, ySea)[1];
      ctx.strokeStyle = "rgba(169,196,255,.18)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(axisStart, sepY);
      ctx.lineTo(rightX, sepY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(169,196,255,.62)";
      ctx.fillText("Hier warten noch " + fmt.format(seaN) + " Ideen – ohne Baujahr", textLeft + 2, sepY + 6);
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- Blitze */
  function drawFlashes(ts) {
    if (!flashes.length) return;
    var keep = [];
    ctx.save();
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var age = ts - f.t;
      if (age > 950) continue;
      keep.push(f);
      var p = w2s(cur[2 * f.i], cur[2 * f.i + 1]);
      var k = age / 950;
      var r = 7 + k * 28;
      ctx.strokeStyle = "rgba(255,214,150," + (0.85 * (1 - k)).toFixed(3) + ")";
      ctx.lineWidth = 2 * (1 - k) + 0.4;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.stroke();
      if (k < 0.78) {
        var fa = 0.95 * (1 - k / 0.78);
        ctx.fillStyle = "rgba(255,236,196," + fa.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4.2 * (1 - k) + 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (k < 0.62) {
        var gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 28);
        gg.addColorStop(0, "rgba(255,230,180," + (0.55 * (1 - k / 0.62)).toFixed(3) + ")");
        gg.addColorStop(1, "rgba(255,199,102,0)");
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    flashes = keep;
    ctx.restore();
  }

  function drawYearOverlay() {
    if (!playing) { flashYearEl.hidden = true; return; }
    flashYearEl.hidden = false;
    if (flashYearEl.textContent !== String(yearMax)) flashYearEl.textContent = String(yearMax);
  }

  /* ---------------------------------------------------------- Reise/Brücke */
  function drawJourneyTrail() {
    if (journey.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    for (var i = 1; i < journey.trail.length; i++) {
      var a = w2s(cur[2 * journey.trail[i - 1]], cur[2 * journey.trail[i - 1] + 1]);
      var b = w2s(cur[2 * journey.trail[i]], cur[2 * journey.trail[i] + 1]);
      var k = i / journey.trail.length;
      ctx.strokeStyle = "rgba(255,199,102," + (0.1 + k * 0.42).toFixed(3) + ")";
      ctx.lineWidth = 1.1 + k * 1.2;
      ctx.shadowColor = "rgba(255,199,102,.6)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      /* kleine Punkte unterwegs */
      if (i < journey.trail.length - 1) {
        ctx.fillStyle = "rgba(255,214,150,.55)";
        ctx.beginPath();
        ctx.arc(b[0], b[1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBridgePath(ts) {
    if (!bridge.path.length) return;
    var total = bridge.path.length - 1;
    if (total < 1) return;
    var shown = bridge.animating ? bridge.progress * total : total;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(127,220,255,.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(127,220,255,.8)";
    ctx.shadowBlur = 12;
    for (var i = 0; i < total; i++) {
      if (i >= shown) break;
      var a = w2s(cur[2 * bridge.path[i]], cur[2 * bridge.path[i] + 1]);
      var b = w2s(cur[2 * bridge.path[i + 1]], cur[2 * bridge.path[i + 1] + 1]);
      var local = clamp(shown - i, 0, 1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    var lastIdx = bridge.path[Math.min(bridge.path.length - 1, Math.floor(shown))];
    if (lastIdx != null) {
      var p = w2s(cur[2 * lastIdx], cur[2 * lastIdx + 1]);
      var pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(ts * 0.006);
      ctx.fillStyle = "rgba(190,240,255," + (0.5 + pulse * 0.5).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.4 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- Minikarte */
  function drawMini() {
    if (!miniCanvas || W <= 760) return;
    var cw = 140, ch = 100;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (miniCanvas.width !== Math.round(cw * dpr)) {
      miniCanvas.width = Math.round(cw * dpr);
      miniCanvas.height = Math.round(ch * dpr);
    }
    var x = miniCanvas.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, cw, ch);
    x.fillStyle = "#070b1d";
    x.fillRect(0, 0, cw, ch);

    for (var i = 0; i < N; i++) {
      if (YR[i] > yearMax) continue;
      var px = cur[2 * i] * cw;
      var py = cur[2 * i + 1] * ch;
      if (px < 0 || px > cw || py < 0 || py > ch) continue;
      x.globalAlpha = mask[i] ? 0.65 : 0.12;
      x.fillStyle = B[i] === 1 ? "#ffc766" : "#a9c4ff";
      x.fillRect(px, py, 1, 1);
    }
    x.globalAlpha = 1;
    var s = scaleNow();
    var wx0 = cam.cx - (W / 2) / s, wx1 = cam.cx + (W / 2) / s;
    var wy0 = cam.cy - (H / 2) / s, wy1 = cam.cy + (H / 2) / s;
    var rx = clamp(wx0, 0, 1) * cw, ry = clamp(wy0, 0, 1) * ch;
    var rw = clamp(wx1, 0, 1) * cw - rx, rh = clamp(wy1, 0, 1) * ch - ry;
    x.strokeStyle = "rgba(255,199,102,.9)";
    x.lineWidth = 1;
    x.strokeRect(rx + 0.5, ry + 0.5, Math.max(3, rw - 1), Math.max(3, rh - 1));
    x.fillStyle = "rgba(255,199,102,.07)";
    x.fillRect(rx, ry, Math.max(3, rw), Math.max(3, rh));
  }

  /* ---------------------------------------------------------- Treffer */
  var grid = null, GRID = 64;

  function buildGrid() {
    var counts = new Uint32Array(GRID * GRID);
    var cellsOf = new Uint32Array(N);
    var i, cx, cy;
    for (i = 0; i < N; i++) {
      cx = clamp((cur[2 * i] * GRID) | 0, 0, GRID - 1);
      cy = clamp((cur[2 * i + 1] * GRID) | 0, 0, GRID - 1);
      var cell = cy * GRID + cx;
      cellsOf[i] = cell;
      counts[cell]++;
    }
    var start = new Uint32Array(GRID * GRID + 1);
    for (i = 0; i < GRID * GRID; i++) start[i + 1] = start[i] + counts[i];
    var items = new Uint32Array(N);
    var cursor = start.slice(0, GRID * GRID);
    for (i = 0; i < N; i++) {
      var c2 = cellsOf[i];
      items[cursor[c2]++] = i;
    }
    grid = { start: start, items: items };
  }

  function pickAt(px, py) {
    /* Sternbild-Labels zuerst */
    for (var h = 0; h < clusterHits.length; h++) {
      var r = clusterHits[h];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { cluster: r.k };
    }
    if (!grid) return null;
    var wpt = s2w(px, py);
    var s = scaleNow();
    var rad = 12 / s;
    var cx0 = clamp(((wpt[0] - rad) * GRID) | 0, 0, GRID - 1);
    var cx1 = clamp(((wpt[0] + rad) * GRID) | 0, 0, GRID - 1);
    var cy0 = clamp(((wpt[1] - rad) * GRID) | 0, 0, GRID - 1);
    var cy1 = clamp(((wpt[1] + rad) * GRID) | 0, 0, GRID - 1);
    var best = -1, bestD = rad * rad;
    for (var gy = cy0; gy <= cy1; gy++) {
      for (var gx = cx0; gx <= cx1; gx++) {
        var cell = gy * GRID + gx;
        var a = grid.start[cell], b = grid.start[cell + 1];
        for (var k = a; k < b; k++) {
          var idx = grid.items[k];
          if (YR[idx] > yearMax) continue;
          var dx = cur[2 * idx] - wpt[0];
          var dy = cur[2 * idx + 1] - wpt[1];
          var dd = dx * dx + dy * dy;
          if (dd < bestD) { bestD = dd; best = idx; }
        }
      }
    }
    return best >= 0 ? { idea: best } : null;
  }

  /* ---------------------------------------------------------- Kamera-Bewegung */
  function finalizeView() {
    buildGrid();
    if (nebOld) nebOld = null;
    miniDirty = true;
    requestDraw();
  }

  function setView(v, animate) {
    if (v === view && !morph) return;
    view = v;
    var btn = viewWrap.querySelectorAll("button");
    for (var i = 0; i < btn.length; i++) btn[i].setAttribute("aria-pressed", btn[i].dataset.view === v ? "true" : "false");
    var target = viewPos[v];
    if (!target) return;
    nebOld = nebNew;
    nebNew = v === "wait" ? null : buildNebula(target);
    if (!animate || reduced) {
      cur.set(target);
      morph = null;
      if (v === "galaxy") { var gc0 = galaxyCam(); cam.cx = gc0.cx; cam.cy = gc0.cy; cam.z = gc0.z; camTween = null; }
      else { var cc0 = chartCam(); cam.cx = cc0.cx; cam.cy = cc0.cy; cam.z = cc0.z; camTween = null; }
      finalizeView();
    } else {
      morph = { active: true, from: new Float32Array(cur), to: target, t0: performance.now(), ms: 900 };
      buildGrid();
      if (v === "galaxy") { var gc1 = galaxyCam(); flyTo(gc1.cx, gc1.cy, gc1.z, 900); }
      else { var cc = chartCam(); flyTo(cc.cx, cc.cy, cc.z, 900); }
    }
    miniDirty = true;
    ensureLoop();
  }

  function setColor(mode) {
    colorMode = mode;
    var btn = colorWrap.querySelectorAll("button");
    for (var i = 0; i < btn.length; i++) btn[i].setAttribute("aria-pressed", btn[i].dataset.color === mode ? "true" : "false");
    var legend = $("uv-legend");
    if (legend) legend.innerHTML = mode === "ba"
      ? '<span><i class="uv-dot uv-dot-bits"></i>Bits</span><span><i class="uv-dot uv-dot-atoms"></i>Atome</span><span><i class="uv-dot uv-dot-both"></i>beides</span>'
      : mode === "cluster"
        ? '<span><i class="uv-dot" style="background:#7fd4ff"></i>je Sternbild eine Farbe</span>'
        : mode === "age"
          ? '<span><i class="uv-dot" style="background:#ff9f6a"></i>alt</span><span><i class="uv-dot" style="background:#7fd4ff"></i>neu</span>'
          : '<span><i class="uv-dot uv-dot-yes"></i>gebaut</span><span><i class="uv-dot uv-dot-no"></i>nicht gebaut</span><span><i class="uv-dot uv-dot-unknown"></i>unbekannt</span>';
    requestDraw();
  }

  /* ---------------------------------------------------------- Filter */
  function matches(i, skip) {
    if (skip !== "status" && F.status.length) {
      if (F.status.indexOf(STATUS_KEY[i]) < 0) return false;
    }
    if (skip !== "ba" && F.ba.length) {
      if (F.ba.indexOf(BA_KEY[i]) < 0) return false;
    }
    if (skip !== "cat" && F.cat) {
      var ci2 = CAT_INDEX[F.cat];
      if (ci2 != null && (ideas[i].c || []).indexOf(ci2) < 0) return false;
    }
    if (F.author && ideas[i].a !== F.author) return false;
    if (F.from && YR[i] < F.from) return false;
    if (F.to && YR[i] > F.to) return false;
    if (qWords.length) {
      var hay = SEARCH[i];
      for (var w = 0; w < qWords.length; w++) {
        if (hay.indexOf(qWords[w]) < 0) return false;
      }
    }
    return true;
  }

  function recomputeMask() {
    for (var i = 0; i < N; i++) mask[i] = matches(i) ? 1 : 0;
  }

  function countMatching(skip) {
    var n = 0;
    for (var i = 0; i < N; i++) if (matches(i, skip)) n++;
    return n;
  }

  function updateCounts() {
    var shown = 0;
    for (var i = 0; i < N; i++) if (mask[i]) shown++;
    countEl.innerHTML = "<b>" + fmt.format(shown) + "</b> von " + TOTAL + " Ideen";
    /* Statuszahlen: Statusfilter der eigenen Gruppe ausblenden */
    var stCount = { Yes: 0, No: 0, Partial: 0, Unknown: 0 };
    var baCount = { Bits: 0, Atoms: 0, Both: 0 };
    for (var j = 0; j < N; j++) {
      if (matches(j, "status")) {
        if (STATUS_KEY[j] === "Yes") stCount.Yes++;
        else if (STATUS_KEY[j] === "No") stCount.No++;
        else if (STATUS_KEY[j] === "Partial") stCount.Partial++;
        else stCount.Unknown++;
      }
      if (matches(j, "ba")) {
        if (BA_KEY[j] === "Bits") baCount.Bits++;
        else if (BA_KEY[j] === "Atoms") baCount.Atoms++;
        else if (BA_KEY[j] === "Both") baCount.Both++;
      }
    }
    for (var sk in stCount) {
      var el = statusWrap.querySelector('[data-cnt="' + sk + '"]');
      if (el) el.textContent = fmt.format(stCount[sk]);
    }
    for (var bk in baCount) {
      var el2 = baWrap.querySelector('[data-cnt="' + bk + '"]');
      if (el2) el2.textContent = fmt.format(baCount[bk]);
    }
    liveEl.textContent = shown === 1 ? "1 Idee passt zu den Filtern." : fmt.format(shown) + " Ideen passen zu den Filtern.";
    updateTimeCounts();
    if (listOpen) renderList(true);
  }

  function applyState(opts) {
    qWords = F.q ? norm(F.q).split(/\s+/).filter(Boolean) : [];
    listScope = null;
    recomputeMask();
    updateCounts();
    if (!opts || !opts.noHash) writeHash();
    requestDraw();
    miniDirty = true;
  }

  function syncControls() {
    qInput.value = F.q;
    var stBtns = statusWrap.querySelectorAll("[data-st]");
    for (var i = 0; i < stBtns.length; i++) {
      stBtns[i].setAttribute("aria-pressed", F.status.indexOf(stBtns[i].dataset.st) >= 0 ? "true" : "false");
    }
    var baBtns = baWrap.querySelectorAll("[data-ba]");
    for (var j = 0; j < baBtns.length; j++) {
      baBtns[j].setAttribute("aria-pressed", F.ba.indexOf(baBtns[j].dataset.ba) >= 0 ? "true" : "false");
    }
    catSel.value = F.cat || "";
    authorSel.value = F.author || "";
  }

  /* ---------------------------------------------------------- Suche */
  var qTimer = 0, sugItems = [], sugActive = -1;

  function showSuggest() {
    if (!F.q.trim()) { suggestEl.hidden = true; sugItems = []; return; }
    var res = [];
    for (var i = 0; i < N; i++) if (mask[i]) res.push(i);
    res.sort(function (a, b) { return YR[b] - YR[a] || b - a; });
    res = res.slice(0, 8);
    sugItems = res;
    sugActive = -1;
    if (!res.length) {
      suggestEl.innerHTML = '<li><div class="uv-sg-empty">Nichts gefunden. Andere Wörter versuchen?</div></li>';
      suggestEl.hidden = false;
      return;
    }
    var html = "";
    for (var k = 0; k < res.length; k++) {
      var d = ideas[res[k]];
      html += '<li><button type="button" data-idx="' + res[k] + '"><span class="uv-sg-year">' + d.y + '</span><span class="uv-sg-name">' + esc(d.n || d.ne) + "</span></button></li>";
    }
    suggestEl.innerHTML = html;
    suggestEl.hidden = false;
  }

  function moveSuggest(dir) {
    if (suggestEl.hidden || !sugItems.length) return;
    sugActive = (sugActive + dir + sugItems.length) % sugItems.length;
    var btns = suggestEl.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("uv-active", i === sugActive);
    if (btns[sugActive]) btns[sugActive].scrollIntoView({ block: "nearest" });
  }

  function pickSuggest(idx) {
    if (sugItems[idx] == null) return;
    suggestEl.hidden = true;
    var i = sugItems[idx];
    openIdeaIndex(i, true);
  }

  /* ---------------------------------------------------------- Auswahl & Drawer */
  function openIdeaIndex(i, scroll) {
    if (i == null || i < 0 || i >= N) { note("Diese Idee gibt es nicht."); return; }
    selected = i;
    selectedCluster = -1;
    var z = Math.min(Math.max(cam.z, 5.2), 9);
    var cx = cur[2 * i], cy = cur[2 * i + 1];
    if (reduced) {
      var s0 = base * z;
      var vc0 = visibleCenter();
      cam.cx = cx - (vc0[0] - W / 2) / s0;
      cam.cy = cy - (vc0[1] - H / 2) / s0;
      cam.z = z;
      camTween = null;
    } else {
      flyToPoint(cx, cy, z, 700);
    }
    pushVisited(i);
    renderIdeaDrawer(i);
    drawer.hidden = false;
    section.classList.add("uv-drawer-on");
    requestDraw();
    writeHash();
    if (scroll) scrollToSection();
    if (journey.active && journey.trail[journey.trail.length - 1] !== i) journey.trail.push(i);
  }

  function pushVisited(i) {
    if (visited[visited.length - 1] === i) return;
    visited.push(i);
    if (visited.length > 8) visited.shift();
  }

  function closeDrawer() {
    drawer.hidden = true;
    selected = -1;
    selectedCluster = -1;
    section.classList.remove("uv-drawer-on");
    writeHash();
    requestDraw();
  }

  function renderIdeaDrawer(i) {
    var d = ideas[i];
    var built = d.b === 1;
    var statusName = STATUS_NAMES[d.b | 0];
    var stCls = d.b === 1 ? "yes" : d.b === 2 ? "partial" : d.b === 3 ? "unknown" : "no";
    var baName = BA_NAMES[d.ba | 0];
    var baCls = d.ba === 1 ? "bits" : d.ba === 2 ? "atoms" : d.ba === 3 ? "both" : "";
    var cl = clusters[CL[i]];
    var cats = (d.c || []).map(function (c) { return CATS[c]; }).filter(Boolean);
    var html = "";
    html += '<p class="uv-dyear' + (built ? "" : " uv-dyear-plain") + '">' + (d.y || "–") + "</p>";
    html += '<h3 class="uv-dname">' + esc(d.n || d.ne) + "</h3>";
    if (d.ne && d.ne !== d.n) html += '<p class="uv-den">Original: ' + esc(d.ne) + "</p>";
    if (d.nv || d.a) {
      html += '<p class="uv-dfrom">' + (d.nv ? "aus <em>" + esc(d.nv) + "</em>" : "") + (d.a ? (d.nv ? " von " : "von ") + esc(d.a) : "") + "</p>";
    }
    html += '<div class="uv-badges">';
    html += '<span class="uv-badge uv-badge-' + stCls + '"><i class="uv-dot uv-dot-' + stCls + '"></i>' + statusName + "</span>";
    if (baName) html += '<span class="uv-badge uv-badge-' + baCls + '">' + baName + "</span>";
    if (cl) html += '<button type="button" class="uv-badge uv-badge-cluster" data-act="cluster" data-k="' + cl.id + '"><i style="background:hsl(' + clusterHue(cl.id) + ' 72% 67%)"></i>' + esc(cl.name) + "</button>";
    html += "</div>";
    html += '<p class="uv-desc">' + esc(d.d || "Keine Beschreibung vorhanden.") + "</p>";
    if (d.de && d.de !== d.d) {
      html += '<button type="button" class="uv-linkbtn" data-act="orig" aria-expanded="false">Original (Englisch) zeigen</button>';
      html += '<p class="uv-orig" hidden>' + esc(d.de) + "</p>";
    }

    /* Zeitlinie */
    if (built && d.y) {
      var fyn = d.fyn;
      if (typeof fyn === "number") {
        var wait = fyn - d.y;
        var bad = wait < 0;
        var frac = bad ? 0 : clamp(wait / 140, 0.04, 1);
        html += '<div class="uv-tl"><p class="uv-tl-title">Von der Geschichte zur Wirklichkeit</p>';
        html += '<div class="uv-tl-row"><b>' + d.y + '</b><span class="uv-tl-track"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></span><b>' + fyn + "</b></div>";
        html += '<p class="uv-tl-label">Geschichte <b>' + d.y + "</b> · <b>" + (bad ? "0" : wait) + " Jahre</b> Wartezeit · erstmals gebaut <b>" + fyn + "</b></p>";
        if (d.w) html += '<p class="uv-tl-label">Von wem: <b>' + esc(d.w) + "</b></p>";
        if (d.p) html += '<p class="uv-tl-label">Produkt: <b>' + esc(d.p) + "</b></p>";
        if (bad) html += '<p class="uv-warn">Das Baujahr liegt vor dem Jahr der Geschichte – vermutlich ein Datenfehler.</p>';
        html += "</div>";
      } else if (d.fy) {
        html += '<div class="uv-tl"><p class="uv-tl-title">Gebaut</p><p class="uv-tl-label">Erstmals gebaut: <b>' + esc(d.fy) + "</b></p>";
        if (d.w) html += '<p class="uv-tl-label">Von wem: <b>' + esc(d.w) + "</b></p>";
        if (d.p) html += '<p class="uv-tl-label">Produkt: <b>' + esc(d.p) + "</b></p>";
        html += "</div>";
      } else if (d.w || d.p) {
        html += '<div class="uv-tl"><p class="uv-tl-title">Gebaut</p>';
        if (d.w) html += '<p class="uv-tl-label">Von wem: <b>' + esc(d.w) + "</b></p>";
        if (d.p) html += '<p class="uv-tl-label">Produkt: <b>' + esc(d.p) + "</b></p>";
        html += "</div>";
      }
    }

    /* Fakten */
    var hasFacts = d.x || cats.length || d.co || d.tv;
    if (hasFacts) {
      html += '<dl class="uv-facts">';
      if (d.x) html += "<dt>Hinweis</dt><dd>" + esc(d.x) + "</dd>";
      if (cats.length) html += "<dt>Kategorien</dt><dd>" + cats.map(esc).join(" · ") + "</dd>";
      if (d.co) html += "<dt>Startup</dt><dd>" + esc(d.co) + "</dd>";
      if (d.tv) html += '<dt>Quelle</dt><dd><a href="http://www.technovelgy.com/ct/content.asp?Bnum=' + d.tv + '" target="_blank" rel="noopener">Technovelgy #' + d.tv + " ↗</a></dd>";
      html += "</dl>";
    }

    /* Verwandte */
    html += '<section class="uv-dsec"><h4>Verwandte Ideen</h4>';
    html += miniRelMap(i);
    html += '<ul class="uv-rellist">';
    for (var k = 0; k < 8; k++) {
      var nb = NN[i * 8 + k];
      if (nb == null || nb < 0 || nb >= N) continue;
      var sim = NNS[i * 8 + k] || 0;
      var nd = ideas[nb];
      var nCls = nd.b === 1 ? "yes" : nd.b === 2 ? "partial" : nd.b === 3 ? "unknown" : "no";
      html += '<li><button type="button" class="uv-rel" data-idea="' + nb + '">'
        + '<i class="uv-dot uv-dot-' + nCls + '"></i>'
        + '<span class="uv-rel-name">' + esc(nd.n || nd.ne) + "</span>"
        + '<span class="uv-relbar"><i style="width:' + Math.min(100, Math.max(4, sim)) + '%"></i></span>'
        + '<span class="uv-relsim">' + sim + "</span></button></li>";
    }
    html += "</ul></section>";

    /* Aktionen */
    html += '<div class="uv-actions">';
    html += '<button type="button" class="uv-btn uv-btn-gold" data-act="bridge-start">Als Start der Brücke</button>';
    html += '<button type="button" class="uv-btn" data-act="bridge-target">Als Ziel der Brücke</button>';
    if (d.tv) html += '<a class="uv-btn" href="http://www.technovelgy.com/ct/content.asp?Bnum=' + d.tv + '" target="_blank" rel="noopener">Bei Technovelgy lesen ↗</a>';
    html += '<a class="uv-btn" href="https://duckduckgo.com/?q=' + encodeURIComponent((d.ne || d.n || "") + " startup") + '" target="_blank" rel="noopener">Wer baut das heute? ↗</a>';
    html += '<button type="button" class="uv-btn uv-wide" data-act="copy">Link kopieren</button>';
    html += "</div>";

    /* Verlauf */
    html += '<div class="uv-foot"><span class="uv-foot-label">Verlauf</span>';
    for (var v = 0; v < visited.length; v++) {
      var vi = visited[v];
      html += '<button type="button" class="uv-crumb" data-idea="' + vi + '" aria-current="' + (vi === i ? "true" : "false") + '">' + esc(ideas[vi].n || ideas[vi].ne) + "</button>";
    }
    html += "</div>";
    var posInVisited = visited.indexOf(i);
    html += '<div class="uv-navrow">'
      + '<button type="button" class="uv-btn" data-act="prev"' + (posInVisited <= 0 ? " disabled" : "") + '>‹ vorherige</button>'
      + '<button type="button" class="uv-btn" data-act="next"' + (posInVisited < 0 || posInVisited >= visited.length - 1 ? " disabled" : "") + ">nächste ›</button>"
      + "</div>";

    drawerScroll.innerHTML = html;
    drawerScroll.scrollTop = 0;
  }

  function miniRelMap(i) {
    var cx = 110, cy = 54;
    var svg = '<svg class="uv-relmap" viewBox="0 0 220 120" role="img" aria-label="Nachbarschaft dieser Idee">';
    var pts = [];
    for (var k = 0; k < 8; k++) {
      var nb = NN[i * 8 + k];
      if (nb == null || nb < 0 || nb >= N) continue;
      var sim = NNS[i * 8 + k] || 0;
      var ang = (-90 + k * 45) * Math.PI / 180;
      var rad = 16 + (100 - sim) * 0.34;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.82, nb, sim]);
    }
    for (var p = 0; p < pts.length; p++) {
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pts[p][0].toFixed(1) + '" y2="' + pts[p][1].toFixed(1) + '" stroke="rgba(255,199,102,.22)" stroke-width="1"/>';
    }
    for (var q = 0; q < pts.length; q++) {
      var col = B[pts[q][2]] === 1 ? "#ffc766" : B[pts[q][2]] === 2 ? "#ff9f4a" : B[pts[q][2]] === 3 ? "#8a86a8" : "#a9c4ff";
      svg += '<circle cx="' + pts[q][0].toFixed(1) + '" cy="' + pts[q][1].toFixed(1) + '" r="3.1" fill="' + col + '"/>';
    }
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#fff2d0"/>';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="none" stroke="rgba(255,199,102,.5)" stroke-width="1"/>';
    svg += '<text x="' + cx + '" y="112" text-anchor="middle" font-size="8" fill="rgba(154,166,206,.9)" font-family="ui-monospace,monospace">Nähe = Ähnlichkeit</text>';
    svg += "</svg>";
    return svg;
  }

  function renderClusterDrawer(k) {
    var cl = null;
    for (var i = 0; i < clusters.length; i++) if (clusters[i].id === k) cl = clusters[i];
    if (!cl) return;
    selectedCluster = k;
    selected = -1;
    var members = CLUSTER_MEMBERS[k] || [];
    var builtN = 0, yearSum = 0, hasYear = 0;
    var catN = {};
    for (var m = 0; m < members.length; m++) {
      var idx = members[m];
      if (B[idx] === 1) builtN++;
      if (YR[idx]) { yearSum += YR[idx]; hasYear++; }
      var cs = ideas[idx].c || [];
      for (var c2 = 0; c2 < cs.length; c2++) catN[cs[c2]] = (catN[cs[c2]] || 0) + 1;
    }
    var pct = members.length ? Math.round((builtN / members.length) * 100) : 0;
    var avgYear = hasYear ? Math.round(yearSum / hasYear) : cl.year;
    var topCats = Object.keys(catN).map(function (key) { return [key | 0, catN[key]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    var img = IMG["cluster_" + String(k).padStart(2, "0")];

    var html = '<div class="uv-cimg">';
    html += img ? '<img src="' + img + '" alt="Sternbild ' + esc(cl.name) + '">' : '<div class="uv-gfall" style="--h:' + cl.hue + '"></div>';
    html += "</div>";
    html += '<h3 class="uv-cname">' + esc(cl.name) + "</h3>";
    if (cl.tagline) html += '<p class="uv-ctag">' + esc(cl.tagline) + "</p>";
    html += '<p class="uv-ctext">' + esc(cl.text || "Ein Sternbild im Ideen-Universum.") + "</p>";
    html += '<div class="uv-cstats"><span><b>' + fmt.format(members.length) + '</b> Ideen</span><span><b>' + pct + '%</b> gebaut</span><span>Ø <b>' + avgYear + "</b></span></div>";

    if (topCats.length) {
      html += '<div class="uv-dsec"><h4>Top-Kategorien</h4><div class="uv-bars">';
      var maxCat = topCats[0][1] || 1;
      for (var t = 0; t < topCats.length; t++) {
        var pctBar = (topCats[t][1] / maxCat) * 100;
        html += '<div class="uv-bar"><span>' + esc(CATS[topCats[t][0]] || "?") + "</span><em>" + topCats[t][1] + '</em><i><b style="width:' + pctBar.toFixed(0) + '%"></b></i></div>';
      }
      html += "</div></div>";
    }

    var core = (cl.core || []).slice(0, 10);
    if (core.length) {
      html += '<div class="uv-dsec"><h4>Leitsterne</h4><ul class="uv-corelist">';
      for (var c3 = 0; c3 < core.length; c3++) {
        var ii = core[c3];
        if (ii == null || !ideas[ii]) continue;
        html += '<li><button type="button" class="uv-core" data-idea="' + ii + '"><span>' + ideas[ii].y + "</span><b>" + esc(ideas[ii].n || ideas[ii].ne) + "</b></button></li>";
      }
      html += "</ul></div>";
    }

    html += '<div class="uv-actions">';
    html += '<button type="button" class="uv-btn uv-btn-gold uv-wide" data-act="cluster-random" data-k="' + k + '">Zufällige ungebaute Idee hier</button>';
    html += '<button type="button" class="uv-btn uv-wide" data-act="list-cluster" data-k="' + k + '">Dieses Sternbild als Liste</button>';
    html += "</div>";

    drawerScroll.innerHTML = html;
    drawerScroll.scrollTop = 0;
    drawer.hidden = false;
    section.classList.add("uv-drawer-on");
  }

  function focusCluster(k) {
    var cl = null, cidx = -1;
    for (var i = 0; i < clusters.length; i++) if (clusters[i].id === k) { cl = clusters[i]; cidx = i; }
    if (!cl) return;
    var members = CLUSTER_MEMBERS[k] || [];
    if (members.length) {
      /* 10–90-Perzentil statt Extremwerte: einzelne Ausreißer sprengen sonst den Blick */
      var xs = [], ys = [];
      for (var m = 0; m < members.length; m++) {
        xs.push(cur[2 * members[m]]);
        ys.push(cur[2 * members[m] + 1]);
      }
      xs.sort(function (a, b) { return a - b; });
      ys.sort(function (a, b) { return a - b; });
      var lo = Math.floor(xs.length * 0.1), hi = Math.max(lo, Math.ceil(xs.length * 0.9) - 1);
      var bw = Math.max(0.015, xs[hi] - xs[lo]);
      var bh = Math.max(0.015, ys[hi] - ys[lo]);
      var zc = clamp(Math.min(W * 0.72 / (bw * base), H * 0.72 / (bh * base)), 1.8, 8);
      var ccx = view === "galaxy" ? cl.cx / 10000 : xs[Math.floor(xs.length / 2)];
      var ccy = view === "galaxy" ? cl.cy / 10000 : ys[Math.floor(ys.length / 2)];
      flyToPoint(ccx, ccy, zc, 900);
    } else {
      flyTo(cl.cx / 10000, cl.cy / 10000, 2.4, 800);
    }
    renderClusterDrawer(k);
    writeHash();
    requestDraw();
  }

  /* ---------------------------------------------------------- Brücke */
  var ADJ_START = null, ADJ = null;
  function buildAdjacency() {
    var deg = new Uint32Array(N);
    var i, k, nb;
    for (i = 0; i < N; i++) {
      for (k = 0; k < 8; k++) {
        nb = NN[i * 8 + k];
        if (nb >= 0 && nb < N) { deg[i]++; deg[nb]++; }
      }
    }
    var start = new Uint32Array(N + 1);
    for (i = 0; i < N; i++) start[i + 1] = start[i] + deg[i];
    var adj = new Int32Array(start[N]);
    var cursor = new Uint32Array(start.subarray(0, N));
    for (i = 0; i < N; i++) {
      for (k = 0; k < 8; k++) {
        nb = NN[i * 8 + k];
        if (nb >= 0 && nb < N) {
          adj[cursor[i]++] = nb;
          adj[cursor[nb]++] = i;
        }
      }
    }
    ADJ_START = start;
    ADJ = adj;
  }

  function bfs(start, goal) {
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [start];
    if (!ADJ) buildAdjacency();
    var prev = new Int32Array(N).fill(-1);
    var seen = new Uint8Array(N);
    seen[start] = 1;
    var queue = [start];
    var head = 0;
    while (head < queue.length) {
      var curI = queue[head++];
      for (var e = ADJ_START[curI]; e < ADJ_START[curI + 1]; e++) {
        var nb = ADJ[e];
        if (nb == null || nb < 0 || nb >= N || seen[nb]) continue;
        seen[nb] = 1;
        prev[nb] = curI;
        if (nb === goal) {
          var path = [goal];
          var p = goal;
          while (p !== start) {
            p = prev[p];
            if (p < 0) return null;
            path.unshift(p);
          }
          return path;
        }
        queue.push(nb);
      }
    }
    return null;
  }

  function renderBridge() {
    var html = "";
    html += '<div class="uv-bhead"><h4>Brücke bauen</h4><button type="button" class="uv-bclose" data-bact="close" aria-label="Brücken-Panel schließen">×</button></div>';
    html += '<div class="uv-brows">';
    html += '<div class="uv-brow"><span>Start</span><div class="uv-bval' + (bridge.start < 0 ? " uv-empty" : "") + '">' + (bridge.start >= 0 ? esc(ideas[bridge.start].n || ideas[bridge.start].ne) : "Idee wählen …") + "</div></div>";
    html += '<div class="uv-brow"><span>Ziel</span><div class="uv-bval' + (bridge.target < 0 ? " uv-empty" : "") + '">' + (bridge.target >= 0 ? esc(ideas[bridge.target].n || ideas[bridge.target].ne) : "Idee wählen …") + "</div></div>";
    html += "</div>";
    html += '<div class="uv-bsearch"><input id="uv-bq" type="search" placeholder="Idee suchen und als Start/Ziel setzen …" autocomplete="off"><ul class="uv-bsug" id="uv-bsug" hidden></ul></div>';
    html += '<div class="uv-bactions">';
    html += '<button type="button" class="uv-btn uv-btn-gold" data-bact="build">Weg finden</button>';
    html += '<button type="button" class="uv-btn" data-bact="swap">Tauschen</button>';
    html += '<button type="button" class="uv-btn" data-bact="clear">Leeren</button>';
    html += "</div>";
    html += '<div class="uv-bresult" id="uv-bresult"></div>';
    bridgePanel.innerHTML = html;
    bridgePanel.hidden = false;
    var inp = $("uv-bq");
    var sug = $("uv-bsug");
    var timer = 0;
    inp.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = norm(inp.value).trim();
        if (!q) { sug.hidden = true; return; }
        var words = q.split(/\s+/).filter(Boolean);
        var res = [];
        for (var i = 0; i < N && res.length < 6; i++) {
          var hay = SEARCH[i], ok = true;
          for (var w = 0; w < words.length; w++) if (hay.indexOf(words[w]) < 0) { ok = false; break; }
          if (ok) res.push(i);
        }
        if (!res.length) { sug.hidden = true; return; }
        var sh = "";
        for (var r = 0; r < res.length; r++) {
          sh += '<li><button type="button" data-bidea="' + res[r] + '"><span class="uv-sg-year">' + ideas[res[r]].y + "</span>" + esc(ideas[res[r]].n || ideas[res[r]].ne) + "</button></li>";
        }
        sug.innerHTML = sh;
        sug.hidden = false;
      }, 140);
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = sug.querySelector("button");
        if (first) { e.preventDefault(); first.click(); }
      } else if (e.key === "Escape") { sug.hidden = true; }
    });
    sug.addEventListener("click", function (e) {
      var b = e.target.closest("[data-bidea]");
      if (!b) return;
      var idx = +b.dataset.bidea;
      if (bridge.start < 0 || (bridge.start >= 0 && bridge.target >= 0)) bridge.start = idx;
      else bridge.target = idx;
      sug.hidden = true;
      inp.value = "";
      bridge.path = [];
      renderBridgeResult();
      renderBridgeVals();
    });
    renderBridgeResult();
  }

  function renderBridgeVals() {
    var vals = bridgePanel.querySelectorAll(".uv-bval");
    if (vals.length >= 2) {
      vals[0].textContent = bridge.start >= 0 ? ideas[bridge.start].n : "Idee wählen …";
      vals[0].classList.toggle("uv-empty", bridge.start < 0);
      vals[1].textContent = bridge.target >= 0 ? ideas[bridge.target].n : "Idee wählen …";
      vals[1].classList.toggle("uv-empty", bridge.target < 0);
    }
  }

  function renderBridgeResult() {
    var box = $("uv-bresult");
    if (!box) return;
    if (!bridge.path.length) {
      box.innerHTML = bridge.start >= 0 && bridge.target >= 0
        ? '<p class="uv-bsum">Bereit. „Weg finden“ zeigt die kürzeste Verbindung.</p>'
        : '<p class="uv-bsum">Start und Ziel wählen: über die Knöpfe im Steckbrief oder über die Suche hier.</p>';
      return;
    }
    var s = bridge.path.length - 1;
    var html = '<p class="uv-bsum">Von <b>' + esc(ideas[bridge.path[0]].n) + "</b> zu <b>" + esc(ideas[bridge.path[bridge.path.length - 1]].n) + "</b> in <b>" + s + (s === 1 ? " Sprung" : " Sprüngen") + "</b>.</p>";
    html += '<ol class="uv-steps">';
    for (var i = 0; i < bridge.path.length; i++) {
      var d = ideas[bridge.path[i]];
      html += '<li><button type="button" class="uv-step" data-idea="' + bridge.path[i] + '"><span class="uv-step-n">' + (i + 1) + '</span><span>' + esc(d.n || d.ne) + '</span><span class="uv-step-y">' + d.y + "</span></button></li>";
    }
    html += "</ol>";
    box.innerHTML = html;
  }

  function buildBridge() {
    if (bridge.start < 0 || bridge.target < 0) { note("Bitte erst Start und Ziel wählen."); return; }
    if (bridge.start === bridge.target) { note("Start und Ziel sind dieselbe Idee."); return; }
    var path = bfs(bridge.start, bridge.target);
    if (!path) {
      bridge.path = [];
      var box = $("uv-bresult");
      if (box) box.innerHTML = '<p class="uv-bempty">Zwischen diesen beiden Ideen gibt es keinen Weg über die Nachbarschaften. Das kann passieren – die Karte ist kein durchgehendes Netz.</p>';
      bridge.animating = false;
      return;
    }
    bridge.path = path;
    bridge.progress = 0;
    bridge.animStart = performance.now();
    bridge.animating = !reduced;
    if (reduced) bridge.progress = 1;
    renderBridgeResult();
    /* Auf den Weg zoomen */
    var minX = 2, maxX = -1, minY = 2, maxY = -1;
    for (var i = 0; i < path.length; i++) {
      var x = cur[2 * path[i]], y = cur[2 * path[i] + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    var bw = Math.max(0.03, maxX - minX), bh = Math.max(0.03, maxY - minY);
    var z = clamp(Math.min(W * 0.6 / (bw * base), H * 0.55 / (bh * base)), 1.2, 16);
    flyToPoint((minX + maxX) / 2, (minY + maxY) / 2, z, 800);
    ensureLoop();
  }

  function openBridge() {
    bridge.open = true;
    section.classList.add("uv-bridge-on");
    renderBridge();
    var btn = tools.querySelector('[data-act="bridge"]');
    if (btn) btn.setAttribute("aria-pressed", "true");
    hideCoach();
  }

  function closeBridge() {
    bridge.open = false;
    section.classList.remove("uv-bridge-on");
    bridgePanel.hidden = true;
    bridge.path = [];
    var btn = tools.querySelector('[data-act="bridge"]');
    if (btn) btn.setAttribute("aria-pressed", "false");
    requestDraw();
  }

  /* ---------------------------------------------------------- Gedankenreise */
  function startJourney() {
    if (reduced) {
      if (!journey.trail.length) {
        var s0 = selected >= 0 ? selected : pickRandom(true, true);
        if (s0 == null) { note("Keine passende Idee für die Reise gefunden."); return; }
        journey.trail = [s0];
        openIdeaIndex(s0, false);
      }
      journeyStep(true);
      return;
    }
    if (journey.active) { stopJourney("Reise angehalten."); return; }
    var start = selected >= 0 ? selected : pickRandom(true, true);
    if (start == null) { note("Keine passende Idee für die Reise gefunden."); return; }
    journey.active = true;
    journey.trail = [start];
    journey.next = 0;
    openIdeaIndex(start, false);
    var btn = tools.querySelector('[data-act="journey"]');
    if (btn) { btn.setAttribute("aria-pressed", "true"); btn.lastChild.textContent = " Reise anhalten"; }
    note("Gedankenreise gestartet. Ein Klick auf die Karte beendet sie.");
    journey.timer = setInterval(function () {
      if (!journey.active) return;
      journeyStep(false);
    }, 3500);
    ensureLoop();
  }

  function journeyStep(manual) {
    if (!journey.active && !manual) return;
    var last = journey.trail[journey.trail.length - 1];
    var next = -1;
    if (last != null) {
      var bestSim = -1;
      for (var k = 0; k < 8; k++) {
        var nb = NN[last * 8 + k];
        if (nb == null || nb < 0 || nb >= N) continue;
        if (journey.trail.indexOf(nb) >= 0) continue;
        var sim = NNS[last * 8 + k] || 0;
        if (sim > bestSim) { bestSim = sim; next = nb; }
      }
      if (next < 0) {
        /* Sackgasse: Nachbar eines Nachbarn */
        for (var t = journey.trail.length - 1; t >= 0 && next < 0; t--) {
          var from = journey.trail[t];
          for (var k2 = 0; k2 < 8; k2++) {
            var nb2 = NN[from * 8 + k2];
            if (nb2 != null && nb2 >= 0 && nb2 < N && journey.trail.indexOf(nb2) < 0) { next = nb2; break; }
          }
        }
      }
    }
    if (next < 0) { stopJourney("Die Reise hat alle erreichbaren Sterne besucht."); return; }
    journey.trail.push(next);
    if (journey.trail.length > 40) journey.trail.shift();
    selected = next;
    renderIdeaDrawer(next);
    drawer.hidden = false;
    section.classList.add("uv-drawer-on");
    flyToPoint(cur[2 * next], cur[2 * next + 1], Math.max(cam.z, 3.4), 800);
    writeHash();
    requestDraw();
    if (manual) note("Nächster Stern: " + (ideas[next].n || ideas[next].ne));
  }

  function stopJourney(msg) {
    journey.active = false;
    if (journey.timer) { clearInterval(journey.timer); journey.timer = 0; }
    var btn = tools.querySelector('[data-act="journey"]');
    if (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.lastChild.textContent = reduced ? " Nächster Schritt" : " Gedankenreise";
    }
    if (msg) note(msg);
    requestDraw();
  }

  /* ---------------------------------------------------------- Zeitmaschine */
  function updateTimeCounts() {
    var written = 0, built = 0;
    for (var i = 0; i < N; i++) {
      if (YR[i] <= yearMax) {
        written++;
        if (B[i] === 1 && (FY[i] < 0 || FY[i] <= yearMax)) built++;
      }
    }
    timeCount.textContent = "geschrieben: " + fmt.format(written) + " · gebaut: " + fmt.format(built);
  }

  function setYear(y, opts) {
    y = clamp(Math.round(y), YEAR_MIN, YEAR_MAX);
    if (y === yearMax && !(opts && opts.force)) return;
    var old = yearMax;
    yearMax = y;
    slider.value = String(y);
    var pct = ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
    slider.style.setProperty("--uv-fill", pct.toFixed(2) + "%");
    slider.setAttribute("aria-valuetext", "Jahr " + y);
    yearEl.textContent = String(y);
    yearEl.classList.toggle("uv-future", y < YEAR_MAX);
    timeLabel.textContent = y >= YEAR_MAX ? "heute" : "Zeitreise";
    if (opts && opts.play && y > old) {
      for (var i = 0; i < N; i++) {
        if (B[i] === 1 && FY[i] > old && FY[i] <= y) flashes.push({ i: i, t: performance.now() });
      }
    }
    updateTimeCounts();
    requestDraw();
    miniDirty = true;
  }

  function yearToProgress(y) {
    var t = yearToT(y);
    /* Zeitanteil: vor 1880 schnell, danach langsamer */
    if (y < 1880) return ((y - 1634) / 246) * 0.22;
    return 0.22 + ((y - 1880) / 146) * 0.78;
  }
  function progressToYear(p) {
    if (p < 0.22) return 1634 + (p / 0.22) * 246;
    return 1880 + ((p - 0.22) / 0.78) * 146;
  }

  function togglePlay() {
    if (playing) { stopPlay(); return; }
    startPlay();
  }
  var playState = null;
  function startPlay() {
    playing = true;
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.textContent = "❚❚";
    playBtn.setAttribute("aria-label", "Zeitreise anhalten");
    var startYear = yearMax >= YEAR_MAX ? YEAR_MIN : yearMax;
    if (startYear !== yearMax) setYear(startYear, { force: true });
    var startP = yearToProgress(startYear);
    playState = { t0: performance.now(), startP: startP, dur: Math.max(1200, 28000 * (1 - startP)) };
    ensureLoop();
  }
  function advancePlay(ts) {
    var p = playState.startP + (1 - playState.startP) * clamp((ts - playState.t0) / playState.dur, 0, 1);
    setYear(progressToYear(p), { play: true });
    if (p >= 1) stopPlay(true);
    else ensureLoop();
  }
  function stopPlay(done) {
    playing = false;
    playState = null;
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.textContent = "▶";
    playBtn.setAttribute("aria-label", "Zeitreise abspielen");
    flashYearEl.hidden = true;
    if (done) setYear(YEAR_MAX, { force: true });
    requestDraw();
  }

  /* ---------------------------------------------------------- Zufall & Hinweise */
  function pickRandom(onlyUnbuilt, respectFilters) {
    var pool = [];
    for (var i = 0; i < N; i++) {
      if (respectFilters && !mask[i]) continue;
      if (YR[i] > yearMax) continue;
      if (onlyUnbuilt && B[i] === 1) continue;
      pool.push(i);
    }
    if (!pool.length) return null;
    return pool[(Math.random() * pool.length) | 0];
  }

  var noteTimer = 0;
  function note(msg, ms) {
    noteEl.textContent = msg;
    noteEl.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { noteEl.hidden = true; }, ms || 4200);
  }

  function hideCoach() {
    if (coachEl) coachEl.classList.add("uv-gone");
  }

  /* ---------------------------------------------------------- Galerie */
  function renderGallery() {
    var html = "";
    var sorted = clusters.slice().sort(function (a, b) { return b.size - a.size; });
    for (var i = 0; i < sorted.length; i++) {
      var cl = sorted[i];
      var img = IMG["cluster_" + String(cl.id).padStart(2, "0")];
      var members = CLUSTER_MEMBERS[cl.id] || [];
      var pct = members.length ? Math.round((cl.built || 0) * 100) : 0;
      var hue = clusterHue(cl.id);
      html += '<button type="button" class="uv-gcard" data-k="' + cl.id + '">';
      html += '<span class="uv-gimg">';
      if (img) html += '<img src="' + img + '" alt="" loading="lazy">';
      else html += '<span class="uv-gfall" style="--h:' + hue + ';background:radial-gradient(circle at 30% 30%,hsla(' + hue + ',75%,70%,.5),transparent 55%),linear-gradient(160deg,hsl(' + hue + ' 45% 18%),#070b1c 82%)"></span>';
      html += "</span>";
      html += '<span class="uv-gbody">';
      html += '<span class="uv-gname">' + esc(cl.name) + "</span>";
      if (cl.tagline) html += '<span class="uv-gtag">' + esc(cl.tagline) + "</span>";
      html += '<span class="uv-gstats">' + fmt.format(members.length) + " Ideen · " + pct + "% gebaut · Ø " + cl.year + "</span>";
      html += '<span class="uv-gbar" aria-hidden="true"><i style="width:' + pct + '%"></i><b style="width:' + (100 - pct) + '%"></b></span>';
      html += "</span></button>";
    }
    galleryEl.innerHTML = html;
  }

  /* ---------------------------------------------------------- Liste */
  var listScope = null;
  function listIndices() {
    var out = [];
    for (var i = 0; i < N; i++) {
      if (!mask[i] || YR[i] > yearMax) continue;
      if (listScope && !listScope.has(i)) continue;
      out.push(i);
    }
    var s = sortSel.value;
    if (s === "year-asc") out.sort(function (a, b) { return YR[a] - YR[b] || (ideas[a].n > ideas[b].n ? 1 : -1); });
    else if (s === "name") out.sort(function (a, b) { return (ideas[a].n || "").localeCompare(ideas[b].n || "", "de"); });
    else if (s === "wait") out.sort(function (a, b) {
      var wa = (B[a] === 1 && FY[a] >= 0) ? FY[a] - YR[a] : -1;
      var wb = (B[b] === 1 && FY[b] >= 0) ? FY[b] - YR[b] : -1;
      return wb - wa;
    });
    else out.sort(function (a, b) { return YR[b] - YR[a] || (ideas[a].n > ideas[b].n ? 1 : -1); });
    return out;
  }

  function renderList(resetLimit) {
    if (!listOpen) return;
    if (resetLimit) listLimit = 60;
    var res = listIndices();
    listCount.textContent = fmt.format(res.length) + (res.length === 1 ? " Idee · " : " Ideen · ") + Math.min(listLimit, res.length) + " angezeigt";
    if (!res.length) {
      listEl.innerHTML = '<div class="uv-empty">Keine Idee passt zu dieser Suche. Filter zurücksetzen?</div>';
      moreBtn.hidden = true;
      return;
    }
    var html = "";
    var upto = Math.min(listLimit, res.length);
    for (var n = 0; n < upto; n++) {
      var idx = res[n];
      var d = ideas[idx];
      var cl = clusters[CL[idx]];
      var cls = d.b === 1 ? "yes" : d.b === 2 ? "partial" : d.b === 3 ? "unknown" : "no";
      var stName = STATUS_NAMES[d.b | 0];
      html += '<button type="button" class="uv-card" data-idea="' + idx + '">';
      html += '<span class="uv-card-top"><span class="uv-card-year">' + d.y + '</span><span class="uv-badge uv-badge-' + cls + '">' + stName + "</span></span>";
      html += "<h4>" + esc(d.n || d.ne) + "</h4>";
      html += '<p class="uv-card-meta">' + esc([d.nv, d.a].filter(Boolean).join(" · ")) + "</p>";
      html += '<p class="uv-card-desc">' + esc(d.d || "") + "</p>";
      html += '<span class="uv-card-foot"><span class="uv-card-cat"><i class="uv-dot" style="background:hsl(' + clusterHue(cl.id) + ' 72% 67%);box-shadow:none"></i> ' + esc(cl.name) + "</span></span>";
      html += "</button>";
    }
    listEl.innerHTML = html;
    moreBtn.hidden = res.length <= listLimit;
  }

  function openList() {
    listOpen = true;
    listScope = null;
    listMode.hidden = false;
    var btn = tools.querySelector('[data-act="list"]');
    if (btn) btn.setAttribute("aria-pressed", "true");
    renderList(true);
  }
  function closeList() {
    listOpen = false;
    listMode.hidden = true;
    var btn = tools.querySelector('[data-act="list"]');
    if (btn) btn.setAttribute("aria-pressed", "false");
  }

  /* ---------------------------------------------------------- Hash */
  var writingHash = false;
  function writeHash() {
    var p = new URLSearchParams();
    if (selected >= 0) p.set("idee", ideas[selected].id);
    if (selectedCluster >= 0) p.set("sternbild", selectedCluster);
    if (F.q) p.set("q", F.q);
    if (F.status.length) p.set("st", F.status.join(","));
    if (F.ba.length) p.set("ba", F.ba.join(","));
    if (F.cat) p.set("cat", F.cat);
    if (F.author) p.set("a", F.author);
    if (F.from) p.set("from", F.from);
    if (F.to) p.set("to", F.to);
    var hash = p.toString();
    try {
      if (!hash) {
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        return;
      }
      writingHash = true;
      history.replaceState(null, "", "#" + hash);
      setTimeout(function () { writingHash = false; }, 0);
    } catch (e) {
      writingHash = false;
    }
  }

  function readHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return false;
    var p;
    try { p = new URLSearchParams(raw); } catch (e) { return false; }
    var keys = ["idee", "sternbild", "q", "st", "ba", "cat", "a", "from", "to"];
    var any = false;
    for (var k = 0; k < keys.length; k++) if (p.has(keys[k])) { any = true; break; }
    if (!any) return false;

    F.q = p.get("q") || "";
    F.status = (p.get("st") || "").split(",").filter(function (s) { return s === "Yes" || s === "No" || s === "Partial" || s === ""; });
    F.ba = (p.get("ba") || "").split(",").filter(function (s) { return s === "Bits" || s === "Atoms" || s === "Both"; });
    F.cat = p.get("cat") || "";
    F.author = p.get("a") || "";
    F.from = p.get("from") ? +p.get("from") : null;
    F.to = p.get("to") ? +p.get("to") : null;
    if (CAT_INDEX[F.cat] == null) F.cat = "";
    syncControls();
    applyState({ noHash: true });

    var ideaId = p.get("idee");
    var ck = p.get("sternbild");
    if (ideaId && ID2I.has(+ideaId)) {
      openIdeaIndex(ID2I.get(+ideaId), false);
    } else if (ck != null && ck !== "") {
      focusCluster(+ck);
    } else if (F.q || F.status.length || F.ba.length || F.cat || F.author) {
      openList();
    }
    return true;
  }

  /* ---------------------------------------------------------- Scroll */
  var scrolled = false;
  function scrollToSection() {
    try {
      section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    } catch (e) {
      section.scrollIntoView();
    }
  }

  /* ---------------------------------------------------------- Ereignisse */
  var pointers = new Map();
  var drag = { active: false, moved: 0, x: 0, y: 0, pinchD: 0, pinchZ: 1, pinchCx: 0, pinchCy: 0, startedOn: 0 };

  function localXY(e) {
    var r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0 && e.pointerType === "mouse") return;
    hideCoach();
    stopJourney("Gedankenreise angehalten.");
    var p = localXY(e);
    pointers.set(e.pointerId, p);
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      drag.active = true;
      drag.moved = 0;
      drag.x = p[0]; drag.y = p[1];
      drag.startedOn = performance.now();
      drag.pinchD = 0;
    }
    if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      drag.pinchD = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      drag.pinchZ = cam.z;
      var mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      var wm = s2w(mid[0], mid[1]);
      drag.pinchCx = wm[0]; drag.pinchCy = wm[1];
      drag.active = false;
    }
  });

  canvas.addEventListener("pointermove", function (e) {
    var p = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (drag.pinchD > 0) {
        var nz = clamp(drag.pinchZ * (d / drag.pinchD), 0.6, 40);
        cam.z = nz;
        var mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        var s = scaleNow();
        cam.cx = drag.pinchCx - (mid[0] - W / 2) / s;
        cam.cy = drag.pinchCy - (mid[1] - H / 2) / s;
        requestDraw();
        miniDirty = true;
      }
      return;
    }
    if (drag.active) {
      var dx = p[0] - drag.x, dy = p[1] - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      var s2 = scaleNow();
      cam.cx -= dx / s2;
      cam.cy -= dy / s2;
      cam.cx = clamp(cam.cx, -0.45, 1.45);
      cam.cy = clamp(cam.cy, -0.45, 1.45);
      drag.x = p[0]; drag.y = p[1];
      if (camTween) camTween = null;
      requestDraw();
      miniDirty = true;
      tipEl.classList.remove("uv-show");
      return;
    }
    if (e.pointerType === "mouse") hoverAt(p[0], p[1]);
  });

  function endPointer(e) {
    var p = localXY(e);
    var wasDrag = drag.active;
    var moved = drag.moved;
    var elapsed = performance.now() - drag.startedOn;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) drag.active = false;
    if (pointers.size === 1) {
      var pts = Array.from(pointers.values());
      drag.active = true;
      drag.x = pts[0][0]; drag.y = pts[0][1];
      drag.moved = 99;
    }
    if (!wasDrag) return;
    if (moved < 6 && elapsed < 700) {
      var hit = pickAt(p[0], p[1]);
      if (hit && hit.cluster != null) {
        focusCluster(hit.cluster);
      } else if (hit && hit.idea != null) {
        openIdeaIndex(hit.idea, false);
        hideCoach();
      } else {
        if (bridge.open) { /* Panel bleibt */ }
        else if (selected >= 0) closeDrawer();
      }
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", function (e) {
    pointers.delete(e.pointerId);
    drag.active = false;
  });

  canvas.addEventListener("pointerleave", function () {
    tipEl.classList.remove("uv-show");
    hoverIdx = -1;
    canvas.classList.remove("uv-over-star");
  });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    hideCoach();
    stopJourney();
    var p = localXY(e);
    var wpt = s2w(p[0], p[1]);
    var factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.06 : 0.0016));
    var nz = clamp(cam.z * factor, 0.6, 40);
    cam.z = nz;
    var s = scaleNow();
    cam.cx = wpt[0] - (p[0] - W / 2) / s;
    cam.cy = wpt[1] - (p[1] - H / 2) / s;
    cam.cx = clamp(cam.cx, -0.45, 1.45);
    cam.cy = clamp(cam.cy, -0.45, 1.45);
    if (camTween) camTween = null;
    requestDraw();
    miniDirty = true;
  }, { passive: false });

  canvas.addEventListener("dblclick", function (e) {
    e.preventDefault();
    var p = localXY(e);
    var wpt = s2w(p[0], p[1]);
    flyTo(wpt[0], wpt[1], clamp(cam.z * 1.9, 0.6, 40), 380);
  });

  canvas.addEventListener("keydown", function (e) {
    var s = scaleNow();
    var step = 90 / s;
    var handled = true;
    switch (e.key) {
      case "ArrowLeft": cam.cx -= step; break;
      case "ArrowRight": cam.cx += step; break;
      case "ArrowUp": cam.cy -= step; break;
      case "ArrowDown": cam.cy += step; break;
      case "+": case "=": cam.z = clamp(cam.z * 1.25, 0.6, 40); break;
      case "-": case "_": cam.z = clamp(cam.z / 1.25, 0.6, 40); break;
      case "r": case "R": surprise(); handled = true; e.preventDefault(); return;
      case "Escape": closeDrawer(); closeBridge(); handled = true; e.preventDefault(); return;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      stopJourney();
      requestDraw();
      miniDirty = true;
    }
  });

  function hoverAt(px, py) {
    var hit = pickAt(px, py);
    if (hit && hit.idea != null) {
      var i = hit.idea;
      hoverIdx = i;
      canvas.classList.add("uv-over-star");
      var d = ideas[i];
      var cls = d.b === 1 ? "yes" : d.b === 2 ? "partial" : d.b === 3 ? "unknown" : "no";
      tipEl.innerHTML = "<b>" + esc(d.n || d.ne) + '</b><div class="uv-tmeta"><span>' + d.y + '</span><i class="uv-dot uv-dot-' + cls + '"></i><span>' + STATUS_NAMES[d.b | 0] + "</span>" + (d.a ? "<span>· " + esc(d.a) + "</span>" : "") + "</div>";
      tipEl.style.left = clamp(px, 80, W - 80) + "px";
      tipEl.style.top = Math.max(46, py) + "px";
      tipEl.classList.add("uv-show");
      tipEl.hidden = false;
    } else if (hit && hit.cluster != null) {
      var cl = clusters.find(function (c) { return c.id === hit.cluster; });
      if (cl) {
        hoverIdx = -1;
        canvas.classList.add("uv-over-star");
        tipEl.innerHTML = "<b>" + esc(cl.name) + '</b><div class="uv-tmeta"><span>Sternbild</span><span>· ' + fmt.format(cl.size) + " Ideen</span></div>";
        tipEl.style.left = clamp(px, 80, W - 80) + "px";
        tipEl.style.top = Math.max(46, py) + "px";
        tipEl.classList.add("uv-show");
        tipEl.hidden = false;
      }
    } else {
      hoverIdx = -1;
      canvas.classList.remove("uv-over-star");
      tipEl.classList.remove("uv-show");
    }
  }

  /* Minikarte */
  (function () {
    var miniDrag = false;
    function miniMove(e) {
      var r = miniCanvas.getBoundingClientRect();
      var x = clamp((e.clientX - r.left) / r.width, 0, 1);
      var y = clamp((e.clientY - r.top) / r.height, 0, 1);
      cam.cx = x; cam.cy = y;
      if (camTween) camTween = null;
      requestDraw();
      miniDirty = true;
    }
    miniCanvas.addEventListener("pointerdown", function (e) {
      miniDrag = true;
      miniCanvas.setPointerCapture(e.pointerId);
      miniMove(e);
    });
    miniCanvas.addEventListener("pointermove", function (e) {
      if (miniDrag) miniMove(e);
    });
    miniCanvas.addEventListener("pointerup", function () { miniDrag = false; });
    miniCanvas.addEventListener("pointercancel", function () { miniDrag = false; });
  })();

  /* Steuerpult */
  foldBtn.addEventListener("click", function () {
    var open = foldBtn.getAttribute("aria-expanded") === "true";
    foldBtn.setAttribute("aria-expanded", open ? "false" : "true");
    controlsBody.hidden = open;
  });

  qInput.addEventListener("input", function () {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      F.q = qInput.value.trim();
      applyState();
      showSuggest();
    }, 120);
  });
  qInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && qTimer) {
      clearTimeout(qTimer);
      qTimer = 0;
      F.q = qInput.value.trim();
      applyState();
      showSuggest();
    }
    if (e.key === "ArrowDown") { e.preventDefault(); moveSuggest(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggest(-1); }
    else if (e.key === "Enter") {
      if (!suggestEl.hidden && sugActive >= 0) { e.preventDefault(); pickSuggest(sugActive); }
      else if (!suggestEl.hidden && sugItems.length) { e.preventDefault(); pickSuggest(0); }
      else {
        var first = null;
        for (var i = 0; i < N; i++) if (mask[i]) { first = i; break; }
        if (first != null) openIdeaIndex(first, true);
      }
    } else if (e.key === "Escape") { suggestEl.hidden = true; }
  });
  qInput.addEventListener("blur", function () {
    setTimeout(function () { suggestEl.hidden = true; }, 160);
  });
  suggestEl.addEventListener("mousedown", function (e) { e.preventDefault(); });
  suggestEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-idx]");
    if (b) pickSuggest(sugItems.indexOf(+b.dataset.idx));
  });

  statusWrap.addEventListener("click", function (e) {
    var b = e.target.closest("[data-st]");
    if (!b) return;
    var val = b.dataset.st;
    var at = F.status.indexOf(val);
    if (at >= 0) F.status.splice(at, 1); else F.status.push(val);
    syncControls();
    applyState();
    if (listOpen) renderList(true);
  });
  baWrap.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ba]");
    if (!b) return;
    var val = b.dataset.ba;
    var at = F.ba.indexOf(val);
    if (at >= 0) F.ba.splice(at, 1); else F.ba.push(val);
    syncControls();
    applyState();
    if (listOpen) renderList(true);
  });
  catSel.addEventListener("change", function () {
    F.cat = catSel.value;
    applyState();
    if (listOpen) renderList(true);
  });
  authorSel.addEventListener("change", function () {
    F.author = authorSel.value;
    applyState();
    if (listOpen) renderList(true);
  });
  resetBtn.addEventListener("click", function () { resetFilter(); });

  viewWrap.addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]");
    if (b) setView(b.dataset.view, true);
  });
  colorWrap.addEventListener("click", function (e) {
    var b = e.target.closest("[data-color]");
    if (b) setColor(b.dataset.color);
  });

  if (drawerClose) drawerClose.addEventListener("click", closeDrawer);

  drawerScroll.addEventListener("click", function (e) {
    var ideaBtn = e.target.closest("[data-idea]");
    if (ideaBtn) {
      openIdeaIndex(+ideaBtn.dataset.idea, false);
      return;
    }
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.dataset.act;
    if (act === "close") closeDrawer();
    else if (act === "orig") {
      var p = drawerScroll.querySelector(".uv-orig");
      if (p) {
        p.hidden = !p.hidden;
        btn.setAttribute("aria-expanded", p.hidden ? "false" : "true");
        btn.textContent = p.hidden ? "Original (Englisch) zeigen" : "Original (Englisch) ausblenden";
      }
    } else if (act === "cluster") focusCluster(+btn.dataset.k);
    else if (act === "bridge-start") {
      bridge.start = selected;
      bridge.target = -1;
      bridge.path = [];
      openBridge();
      renderBridgeResult();
      renderBridgeVals();
      note("Start gesetzt: " + (ideas[selected] ? ideas[selected].n : ""));
    } else if (act === "bridge-target") {
      bridge.target = selected;
      openBridge();
      renderBridgeResult();
      renderBridgeVals();
      note("Ziel gesetzt: " + (ideas[selected] ? ideas[selected].n : ""));
    } else if (act === "copy") {
      copyLink();
    } else if (act === "prev" || act === "next") {
      var at = visited.indexOf(selected);
      var target = act === "prev" ? visited[at - 1] : visited[at + 1];
      if (target != null) openIdeaIndex(target, false);
    } else if (act === "cluster-random") {
      randomInCluster(+btn.dataset.k);
    } else if (act === "list-cluster") {
      var k = +btn.dataset.k;
      F = { q: "", status: [], ba: [], cat: "", author: "", from: null, to: null };
      syncControls();
      listScope = new Set(CLUSTER_MEMBERS[k] || []);
      recomputeMask();
      updateCounts();
      listOpen = true;
      listMode.hidden = false;
      var listBtn = tools.querySelector('[data-act="list"]');
      if (listBtn) listBtn.setAttribute("aria-pressed", "true");
      renderList(true);
      listMode.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  });

  function copyLink() {
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        note("Link kopiert.");
      }).catch(function () { note("Kopieren nicht möglich – Link steht in der Adresszeile."); });
    } else {
      note("Kopieren nicht möglich – Link steht in der Adresszeile.");
    }
  }

  bridgePanel.addEventListener("click", function (e) {
    var close = e.target.closest("[data-bact]");
    if (close) {
      var act = close.dataset.bact;
      if (act === "close") closeBridge();
      else if (act === "build") buildBridge();
      else if (act === "swap") {
        var t = bridge.start; bridge.start = bridge.target; bridge.target = t;
        bridge.path = [];
        renderBridgeVals(); renderBridgeResult();
      } else if (act === "clear") {
        bridge.start = -1; bridge.target = -1; bridge.path = []; bridge.animating = false;
        renderBridgeVals(); renderBridgeResult(); requestDraw();
      }
      return;
    }
    var step = e.target.closest("[data-idea]");
    if (step) openIdeaIndex(+step.dataset.idea, false);
  });

  tools.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.dataset.act;
    if (act === "surprise") surprise();
    else if (act === "journey") startJourney();
    else if (act === "bridge") {
      if (bridge.open) closeBridge(); else openBridge();
    } else if (act === "overview") {
      stopJourney();
      if (view === "galaxy") fitView(700);
      else { var oc = chartCam(); flyTo(oc.cx, oc.cy, oc.z, 700); }
      hideCoach();
    } else if (act === "list") {
      if (listOpen) closeList(); else { openList(); listMode.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }
    }
  });

  function surprise() {
    var idx = pickRandom(true, true);
    if (idx == null) { note("Keine ungebaute Idee passt gerade zu den Filtern."); return; }
    openIdeaIndex(idx, false);
    note("Überraschung: " + (ideas[idx].n || ideas[idx].ne));
  }

  function randomInCluster(k) {
    var members = CLUSTER_MEMBERS[k] || [];
    var pool = members.filter(function (i) { return B[i] !== 1 && mask[i]; });
    if (!pool.length) pool = members.filter(function (i) { return B[i] !== 1; });
    if (!pool.length) { note("In diesem Sternbild ist alles gebaut."); return; }
    var idx = pool[(Math.random() * pool.length) | 0];
    openIdeaIndex(idx, false);
  }

  todayBtn.addEventListener("click", function () {
    stopPlay();
    setYear(YEAR_MAX, { force: true });
  });

  slider.addEventListener("input", function () {
    stopPlay();
    setYear(+slider.value, { force: true });
  });

  playBtn.addEventListener("click", togglePlay);

  sortSel.addEventListener("change", function () { renderList(true); });
  moreBtn.addEventListener("click", function () { listLimit += 60; renderList(false); });
  $("uv-list-close").addEventListener("click", closeList);
  listEl.addEventListener("click", function (e) {
    var card = e.target.closest("[data-idea]");
    if (!card) return;
    openIdeaIndex(+card.dataset.idea, true);
  });

  galleryEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]");
    if (b) {
      focusCluster(+b.dataset.k);
      scrollToSection();
    }
  });

  /* Resize / Sichtbarkeit */
  var ro = window.ResizeObserver ? new ResizeObserver(function () { measure(); }) : null;
  if (ro) ro.observe(stage);
  window.addEventListener("resize", function () { measure(); });

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      var en = entries[0];
      stageVisible = !!(en && en.isIntersecting);
      if (stageVisible) requestDraw();
    }, { threshold: 0.02 });
    io.observe(stage);
  }

  if (reduceMQ) {
    var onMQ = function () {
      reduced = reduceMQ.matches;
      if (reduced && journey.active) stopJourney("Bewegung ist reduziert – Reise gestoppt.");
      requestDraw();
    };
    if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onMQ);
    else if (reduceMQ.addListener) reduceMQ.addListener(onMQ);
  }

  if (window.history && history.replaceState) {
    window.addEventListener("hashchange", function () {
      if (writingHash) return;
      readHash();
    });
  }

  /* Drawer: Escape auch wenn Fokus im Drawer */
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden && section.contains(doc.activeElement)) {
      closeDrawer();
    }
  });

  /* ---------------------------------------------------------- Aufbau */
  function buildSelects() {
    var html = '<option value="">Alle Kategorien</option>';
    var order = CATS.map(function (label, i) { return { i: i, label: label, n: catCount[i] || 0 }; })
      .sort(function (a, b) { return b.n - a.n; });
    for (var i = 0; i < order.length; i++) {
      if (!order[i].n) continue;
      html += '<option value="' + esc(CATS_EN[order[i].i]) + '">' + esc(order[i].label) + " (" + fmt.format(order[i].n) + ")</option>";
    }
    catSel.innerHTML = html;

    var authors = Array.from(AUTHOR_COUNT.entries()).filter(function (e) { return e[0]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0], "de"); });
    var ah = '<option value="">Alle Autor:innen</option>';
    for (var a = 0; a < authors.length; a++) {
      ah += '<option value="' + esc(authors[a][0]) + '">' + esc(authors[a][0]) + " (" + fmt.format(authors[a][1]) + ")</option>";
    }
    authorSel.innerHTML = ah;
  }

  function initHead() {
    var head = section.querySelector(".uv-head");
    if (!head || !IMG.hero) return;
    var art = doc.createElement("div");
    art.className = "uv-heroart";
    art.setAttribute("aria-hidden", "true");
    var im = doc.createElement("img");
    im.src = IMG.hero;
    im.alt = "";
    art.appendChild(im);
    head.appendChild(art);
  }

  function boot() {
    buildViews();
    canvas.setAttribute("aria-label", "Sternenkarte mit " + fmt.format(N) + " Ideen. Ziehen verschiebt die Karte, Mausrad zoomt. Pfeiltasten verschieben, Plus und Minus zoomen, R zieht eine Zufallsidee.");
    initHead();
    buildSelects();
    if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
      foldBtn.setAttribute("aria-expanded", "false");
      controlsBody.hidden = true;
    }
    setColor("status");
    syncControls();
    measure();
    buildGrid();
    nebNew = buildNebula(POS);
    renderGallery();
    if (reduced) {
      var jb = tools.querySelector('[data-act="journey"]');
      if (jb) jb.lastChild.textContent = " Nächster Schritt";
    }
    recomputeMask();
    if (U.ph) setTimeout(function () { note("Vorschaukarte aktiv: work/data/map.json fehlt noch. Die echte Karte wird automatisch benutzt, sobald sie da ist.", 12000); }, 1200);
    setYear(YEAR_MAX, { force: true });
    updateCounts();
    setView("galaxy", false);
    cur.set(POS);
    var gcBoot = galaxyCam();
    cam.cx = gcBoot.cx; cam.cy = gcBoot.cy; cam.z = gcBoot.z;
    buildGrid();
    requestDraw();
    setColor("status");
    var hadHash = false;
    try { hadHash = readHash(); } catch (e) { hadHash = false; }
    /* Desktop: Pult startet eingeklappt auf die Suchzeile, damit die Galaxie frei steht. */
    if (!hadHash) {
      foldBtn.setAttribute("aria-expanded", "false");
      controlsBody.hidden = true;
    }
    if (hadHash) setTimeout(function () { scrollToSection(); }, 150);
    if (!hadHash) {
      setTimeout(function () { hideCoach(); }, 9000);
    }
  }

  /* ---------------------------------------------------------- API */
  function resetFilter() {
    F = { q: "", status: [], ba: [], cat: "", author: "", from: null, to: null };
    qWords = [];
    syncControls();
    applyState();
    if (listOpen) renderList(true);
    note("Filter zurückgesetzt.");
  }

  function applyFilter(obj) {
    obj = obj || {};
    F = {
      q: obj.q || "",
      status: Array.isArray(obj.status) ? obj.status.filter(function (s) { return s === "Yes" || s === "No" || s === "Partial" || s === ""; }) : [],
      ba: Array.isArray(obj.ba) ? obj.ba.filter(function (s) { return s === "Bits" || s === "Atoms" || s === "Both"; }) : [],
      cat: (function () {
        if (!obj.cat) return "";
        if (CAT_INDEX[obj.cat] != null) return obj.cat;
        var gi = CATS.indexOf(obj.cat);
        return gi >= 0 ? CATS_EN[gi] : "";
      })(),
      author: obj.author || "",
      from: obj.from ? +obj.from : null,
      to: obj.to ? +obj.to : null
    };
    syncControls();
    applyState();
    openList();
    scrollToSection();
  }

  window.SFIB_UNIVERSE = {
    openIdea: function (id) {
      var i = ID2I.get(+id);
      if (i == null) { note("Idee " + id + " gibt es nicht."); return false; }
      openIdeaIndex(i, true);
      return true;
    },
    openIdeaIndex: function (i) { openIdeaIndex(+i, true); },
    focusCluster: focusCluster,
    applyFilter: applyFilter,
    resetFilter: resetFilter,
    setView: function (v) { setView(v, true); },
    scrollIntoView: scrollToSection,
    getState: function () {
      return { selected: selected, cluster: selectedCluster, view: view, color: colorMode, year: yearMax, filter: JSON.parse(JSON.stringify(F)) };
    },
    _debug: function () {
      var pr = plotRect();
      return { pr: pr, cam: { cx: cam.cx, cy: cam.cy, z: cam.z }, base: base, W: W, H: H, scale: scaleNow(), yearMax: yearMax };
    },
    _project: function (i) {
      if (i < 0 || i >= N) return null;
      var p = w2s(cur[2 * i], cur[2 * i + 1]);
      return { x: p[0], y: p[1], name: ideas[i].n };
    },
    _pick: function (x, y) {
      var r = pickAt(x, y);
      return r ? { idea: r.idea == null ? null : r.idea, cluster: r.cluster == null ? null : r.cluster } : null;
    },
    _bench: function (n) {
      n = n || 30;
      var t = performance.now();
      for (var k = 0; k < n; k++) draw(performance.now());
      return (performance.now() - t) / n;
    },
    isReady: function () { return true; }
  };

  /* Start */
  try {
    boot();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
    if (window.console && console.error) console.error(e);
  }
})();
