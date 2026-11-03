/* IMPOSTER – Arayüz ve oyun akışı (tamamen çevrimdışı) */
(function () {
  "use strict";

  var V = window.IMPOSTER_VERI;
  var L = window.ImposterLogic;
  /* Sprache: Türkisch ist Standard; Deutsch wird über de.js geladen (siehe index.html) */
  var I18N = window.IMPOSTER_I18N || null;
  var LANG = I18N ? I18N.lang : "tr";
  var LANGKEY = "imposter_lang_v1";
  function t(key, o) {
    var r = I18N && I18N.ui[key] != null ? I18N.ui[key] : key;
    if (o) for (var k in o) r = r.split("{" + k + "}").join(o[k]);
    return r;
  }
  L.namePrefix = t("Oyuncu");
  document.documentElement.setAttribute("lang", LANG);
  var PAIRS = L.buildPairMap(V);
  var EXPL = L.buildExplainMap(window.IMPOSTER_ACIKLAMALAR);
  var HINTS = L.buildExplainMap(window.IMPOSTER_HINWEISE); /* Hinweiswörter nur für den Imposter, in der gewählten Sprache */
  var rnd = L.createRng();
  var KEY = "imposter_tr_ayarlar_v1";

  /* ---------- Durum ---------- */
  var S = loadSettings();
  var G = { screen: "menu", round: null, idx: 0, stage: "pass", prevWord: null, impHistory: [], endAt: 0, tick: null, timerDone: false };
  var RV = { el: null, t: [], done: false }; /* Enthüllungsanimation: nur Optik, ändert keinen Spielzustand */
  var $app = document.getElementById("app");
  var $toast = document.getElementById("toast");
  var $modal = document.getElementById("modal");

  function loadSettings() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    return L.sanitize(raw, V);
  }
  function saveSettings() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* özel mod vb. */ }
  }
  var mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  function applyBody() {
    document.body.classList.toggle("no-anim", !S.anim);
    document.documentElement.setAttribute("data-theme", S.theme);
    var light = S.theme === "light" || (S.theme === "auto" && mqLight && mqLight.matches);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", light ? "#f2f2f7" : "#07080d");
  }
  if (mqLight && mqLight.addEventListener) mqLight.addEventListener("change", function () { if (S.theme === "auto") applyBody(); });

  /* ---------- Yardımcılar ---------- */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* Passt die Schrift langer Wörter an die Boxbreite an (Safari/Systemschrift unterscheiden sich) – ein Wort bricht nie mitten im Wort um.
     Gemessen wird mit einem unsichtbaren Hilfselement (unabhängig von Einblend-Animationen). */
  function fitLong(root) {
    var els = (root || document).querySelectorAll(".secret, .word-box .wd, .explain h3");
    Array.prototype.forEach.call(els, function (el) {
      if (!el.clientWidth) return; /* nicht sichtbar → später */
      el.style.fontSize = ""; el.style.wordBreak = "normal"; el.style.overflowWrap = "normal"; el.style.hyphens = "manual";
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
      var avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); /* nutzbare Textbreite (ohne Platz für das ?-Symbol) */
      var widest = 0;
      el.textContent.split(/\s+/).forEach(function (tok) {
        if (!tok) return;
        var m = document.createElement("span");
        m.textContent = tok;
        m.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;padding:0;margin:0;font-family:" + cs.fontFamily + ";font-weight:" + cs.fontWeight + ";letter-spacing:" + cs.letterSpacing + ";font-size:" + fs + "px";
        document.body.appendChild(m); widest = Math.max(widest, m.offsetWidth); document.body.removeChild(m);
      });
      if (widest > avail) {
        var nfs = Math.max(15, Math.floor(fs * avail / widest));
        el.style.fontSize = nfs + "px";
        if (widest * nfs / fs > avail + 1) el.style.overflowWrap = "anywhere"; /* nur in Extremfällen (sehr schmaler Bildschirm) darf das Wort umbrechen */
      }
    });
  }
  window.addEventListener("resize", function () { fitLong(); });

  /* Initial für den Avatar: erstes Buchstaben-/Ziffern-/Emoji-Zeichen als ganzes Zeichen (kein halbes Emoji, kein „SS“ für ß) */
  function initial(name) {
    var s = String(name).trim(), m = s.match(/[\p{L}\p{N}]|\p{Extended_Pictographic}/u), ch = m ? m[0] : (Array.from(s)[0] || "?");
    var up = ch.toLocaleUpperCase(LANG === "de" ? "de-DE" : "tr-TR");
    return esc(Array.from(up).length > 1 ? ch : up);
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { $toast.classList.remove("show"); }, 2800);
  }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19V5.5"/><path d="M9 8h6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.2.6 3.5 2.6 3.5 5.7"/></svg>',
    mask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5c3 1.4 6 2 9 2s6-.6 9-2V12c0 4.4-4 8.5-9 8.5S3 16.400 3 12z"/><circle cx="8.5" cy="12" r="1.3"/><circle cx="15.5" cy="12" r="1.3"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><path d="M8 21v-7h8v7"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.600 7.100L4 20.500l1.400-4.600A8 8 0 1 1 21 12z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><path d="M12 2.5c2.800 2.700 4.200 5.900 4.200 9.500s-1.400 6.800-4.200 9.500c-2.800-2.700-4.200-5.900-4.200-9.500S9.200 5.200 12 2.500z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.200 5.200l1.400 1.400M17.400 17.400l1.400 1.400M5.200 18.800l1.400-1.400M17.400 6.600l1.400-1.400"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>'
  };

  /* SAMIX-Logo als eingebettetes Vektor-SVG: keine Bilddatei, kein Ordner, nichts, was beim Hochladen fehlen kann.
     Die Farbe kommt über currentColor (--logo-ink in style.css), Hell/Dunkel braucht daher nur ein Logo. */
  var LOGO_TPL = "<svg xmlns=\"http://www.w3.org/2000/svg\" focusable=\"false\" viewBox=\"0 0 1248 1521\" role=\"img\" aria-label=\"SAMIX\"><defs><linearGradient id=\"gA-@\" gradientUnits=\"userSpaceOnUse\" x1=\"382.59\" y1=\"321.03\" x2=\"549.78\" y2=\"461.32\"><stop offset=\"0\" stop-color=\"currentColor\"/><stop offset=\"1\" stop-color=\"currentColor\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"gB-@\" gradientUnits=\"userSpaceOnUse\" x1=\"867.41\" y1=\"1201.97\" x2=\"700.22\" y2=\"1061.68\"><stop offset=\"0\" stop-color=\"currentColor\"/><stop offset=\"1\" stop-color=\"currentColor\" stop-opacity=\"0\"/></linearGradient><clipPath id=\"cxA-@\"><path clip-rule=\"evenodd\" d=\"M0,0H1248V1521H0Z M381,696.01 L172.75,575.78 L254.03,478.92 L275.6,491.37 L275.6,488.37 L381,549.22Z\"/></clipPath><clipPath id=\"cxB-@\"><path clip-rule=\"evenodd\" d=\"M0,0H1248V1521H0Z M869,826.99 L1077.25,947.22 L995.97,1044.08 L974.4,1031.63 L974.4,1034.63 L869,973.78Z\"/></clipPath><clipPath id=\"cwA-@\"><path d=\"M381,696.01 L170.11,574.26 L253.09,475.37 L381,549.22Z\"/></clipPath><clipPath id=\"cwB-@\"><path d=\"M869,826.99 L1079.89,948.74 L996.91,1047.63 L869,973.78Z\"/></clipPath></defs><g fill=\"currentColor\"><polygon points=\"385.29,555.6 385.29,694.34 737.99,897.97 624.86,963.29 385.6,825.15 385.6,967.53 625.03,1105.77 864.71,967.4 864.71,828.66 512.01,625.03 625.14,559.71 864.4,697.85 864.4,555.47 624.97,417.23\"/><polygon clip-path=\"url(#cxA-@)\" points=\"148.93,558.03 376.73,689.55 376.73,546.75 275.6,488.37 625.04,286.61 976.98,489.8 976.98,762.74 1100.97,834.33 1100.97,418.89 625.03,144.11 148.93,418.99\"/><polygon clip-path=\"url(#cxB-@)\" points=\"1101.07,964.97 873.27,833.45 873.27,976.25 974.4,1034.63 624.96,1236.39 273.02,1033.2 273.02,760.26 149.03,688.67 149.03,1104.11 624.97,1378.89 1101.07,1104.01\"/></g><g clip-path=\"url(#cwA-@)\"><polygon fill=\"url(#gA-@)\" points=\"148.93,558.03 376.73,689.55 376.73,546.75 275.6,488.37 625.04,286.61 976.98,489.8 976.98,762.74 1100.97,834.33 1100.97,418.89 625.03,144.11 148.93,418.99\"/></g><g clip-path=\"url(#cwB-@)\"><polygon fill=\"url(#gB-@)\" points=\"1101.07,964.97 873.27,833.45 873.27,976.25 974.4,1034.63 624.96,1236.39 273.02,1033.2 273.02,760.26 149.03,688.67 149.03,1104.11 624.97,1378.89 1101.07,1104.01\"/></g></svg>";
  var logoN = 0;
  function logoSvg(cls) {
    logoN++;
    return LOGO_TPL.split("@").join("m" + logoN).replace("<svg ", '<svg class="logo-svg logo-img ' + (cls || "") + '" ');
  }
  /* ---------- Ses (Web Audio, dosyasız) ---------- */
  var ac = null;
  function audio() {
    if (!S.sound) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
    } catch (e) { ac = null; }
    return ac;
  }
  function tone(f, t0, dur, type, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    var s = a.currentTime + t0;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, s + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(a.destination);
    o.start(s); o.stop(s + dur + 0.05);
  }
  var SND = {
    click: function () { tone(520, 0, 0.07, "triangle", 0.07); },
    reveal: function () { tone(392, 0, 0.12, "sine", 0.12); tone(587, 0.09, 0.18, "sine", 0.12); },
    hide: function () { tone(440, 0, 0.1, "triangle", 0.08); tone(330, 0.08, 0.12, "triangle", 0.08); },
    start: function () { tone(392, 0, 0.14, "sine"); tone(523, 0.12, 0.14, "sine"); tone(659, 0.24, 0.26, "sine"); },
    alarm: function () { for (var i = 0; i < 3; i++) tone(880, i * 0.28, 0.18, "square", 0.08); },
    result: function () { tone(523, 0, 0.15, "sine"); tone(659, 0.12, 0.15, "sine"); tone(784, 0.24, 0.15, "sine"); tone(1047, 0.36, 0.34, "sine"); }
  };
  function sfx(n) { if (S.sound && SND[n]) SND[n](); }

  /* ---------- Gezinme ---------- */
  function mount(html, opts) {
    opts = opts || {};
    var prev = $app.querySelector(".scroll");
    var top = prev && opts.keepScroll ? prev.scrollTop : 0;
    $app.innerHTML = '<section class="screen' + (opts.still ? " still" : "") + '">' + html + "</section>";
    var sc = $app.querySelector(".scroll");
    if (sc && top) sc.scrollTop = top;
    fitLong($app);
  }
  function go(screen, opts) {
    revealCancel();
    stopTimer();
    G.screen = screen;
    render(opts);
  }
  function render(opts) {
    closeModal();
    var fn = VIEW[G.screen];
    if (fn) fn(opts || {});
  }

  var VIEW = {};

  /* ----- Ana menü ----- */
  VIEW.menu = function () {
    mount(
      '<div class="center">' +
        '<div class="logo">' + logoSvg() + '<div class="wordmark">IMPOSTER</div>' +
        '<div class="tagline">' + t("Aranızdaki sahtekârı bulun!") + '</div></div>' +
        '<div class="menu-list">' +
          '<button class="btn btn-primary big" data-act="newGame">' + ICON.play + t("Yeni Oyun") + "</button>" +
          '<button class="btn btn-glass" data-act="how">' + ICON.book + t("Nasıl Oynanır?") + "</button>" +
          '<button class="btn btn-glass" data-act="settings">' + ICON.gear + t("Ayarlar") + "</button>" +
        "</div>" +
        '<div class="chips-row"><span class="pill">' + t("3–12 oyuncu") + '</span><span class="pill">' + t("İnternetsiz") + '</span></div>' +
      "</div>" +
      '<div class="brand-foot">SAMIX · GAMES · APPS</div>'
    );
  };

  /* ----- Nasıl oynanır ----- */
  VIEW.how = function () {
    var steps = [
      ["Hazırlık", "Oyuncuları, imposter sayısını, kategorileri ve oyun modunu seçin. 3 ile 12 kişi aynı telefonla oynar."],
      ["Gizli roller", "Telefon elden ele geçer. Sıra sizdeyken Kelimeyi Gör’e dokunun. Normal oyuncular gizli kelimeyi görür; imposter’lar kelimeyi göremez, yalnızca kısa bir ipucu alır. Hazırım’a dokunmadan telefonu vermeyin."],
      ["Sözlü ipuçları", "Telefonu bir kenara bırakın. Sırayla kelimeyi doğrudan söylemeden ipucu verin. Imposter’lar kelimeyi biliyormuş gibi davranmaya çalışır. Tartışma ne zaman biterse grup karar verir."],
      ["Sözlü oylama", "Herkes şüphelendiği kişinin adını yüksek sesle söyler. Oyları grup kendisi sayar; uygulamaya oy girilmez. Beraberlikte yalnızca berabere kalanlar arasında tekrar oy verin."],
      ["Sonuç", "Tartışma Bitti’ye, ardından Sonuçları Göster’e dokunun: roller ve kelime açıklanır. Grubun doğru kişiyi bulup bulmadığına birlikte karar verirsiniz."]
    ];
    var h = '<div class="topbar"><button class="back" data-act="menu" aria-label="' + t("Geri") + '">' + ICON.back + '</button><div><h1 class="h-title">' + t("Nasıl Oynanır?") + '</h1></div></div><div class="scroll">';
    steps.forEach(function (s, i) {
      h += '<div class="card how"><div class="n">' + (i + 1) + "</div><div><b>" + t(s[0]) + "</b><p>" + t(s[1]) + "</p></div></div>";
    });
    h += '<div class="card"><div class="card-t"><span class="ic" style="--c:#bf5af2">' + ICON.mask + '</span>' + t("Oyun modları") + '</div>' +
      '<p class="note"><b class="em">' + t("Kelimeyi Bilmiyor:") + '</b> ' + t("Imposter kelimeyi görmez, yalnızca kısa bir ipucu alır.") + '</p></div>';
    h += '</div><div class="footer"><button class="btn btn-primary" data-act="newGame">' + ICON.play + t("Yeni Oyun") + "</button></div>";
    mount(h);
  };

  /* ----- Ayarlar ----- */
  function switchHtml(key, on) {
    return '<label class="switch"><input type="checkbox" data-chg="' + key + '"' + (on ? " checked" : "") + '><i></i></label>';
  }
  function segHtml(act, cur, items) {
    return '<div class="seg" role="radiogroup">' + items.map(function (it) {
      return '<button class="seg-b' + (cur === it[0] ? " on" : "") + '" role="radio" aria-checked="' + (cur === it[0]) + '" data-act="' + act + '" data-v="' + it[0] + '">' + it[1] + "</button>";
    }).join("") + "</div>";
  }
  VIEW.settings = function (opts) {
    opts = opts || {};
    mount(
      '<div class="topbar"><button class="back" data-act="menu" aria-label="' + t("Geri") + '">' + ICON.back + '</button><div><h1 class="h-title">' + t("Ayarlar") + '</h1></div></div>' +
      '<div class="scroll">' +
        '<div class="card"><div class="card-t" style="margin-bottom:12px"><span class="ic" style="--c:#5e5ce6">' + ICON.sun + '</span>' + t("Görünüm") + '</div>' +
          segHtml("theme", S.theme, [["dark", t("Koyu")], ["light", t("Açık")], ["auto", t("Otomatik")]]) +
          '<p class="note" style="margin-top:10px">' + t("Otomatik seçeneği iPhone’unuzun açık/koyu görünümünü takip eder.") + '</p></div>' +
        '<div class="card"><div class="card-t" style="margin-bottom:12px"><span class="ic" style="--c:#0a84ff">' + ICON.globe + '</span>' + t("Dil") + '</div>' +
          segHtml("lang", LANG, [["tr", "Türkçe"], ["de", "Deutsch"]]) +
          '<p class="note" style="margin-top:10px">' + t("Seçiminiz kaydedilir ve oyun yeniden başlar.") + '</p></div>' +
        '<div class="card">' +
          '<div class="opt"><div class="row"><div><div class="t">' + t("Ses efektleri") + '</div><div class="d">' + t("Dokunma, rol gösterme ve süre dolma sesleri") + '</div></div>' + switchHtml("sound", S.sound) + "</div></div>" +
          '<div class="opt"><div class="row"><div><div class="t">' + t("Animasyonlar") + '</div><div class="d">' + t("Geçiş ve hareket efektleri") + '</div></div>' + switchHtml("anim", S.anim) + "</div></div>" +
        "</div>" +
        '<div class="card about">' + logoSvg("about-logo") + '<div><div class="t">SAMIX Imposter</div><div class="d">Created by SAMI<br>' + t("Sürüm 2.0") + '</div></div></div>' +
          '<div class="card"><div class="card-t"><span class="ic" style="--c:#30d158">' + ICON.save + '</span>' + t("Kayıtlı oyun ayarları") + '</div>' +
          '<p class="note" style="margin-bottom:12px">' + t("Oyuncu isimleri, kategoriler ve diğer seçimler bu cihazda saklanır. İsterseniz hepsini başlangıç değerlerine döndürebilirsiniz.") + '</p>' +
          '<button class="btn btn-glass" data-act="resetAsk">' + ICON.redo + t("Varsayılanlara Döndür") + "</button></div>" +
      "</div>", { still: opts.still }
    );
  };

  /* ----- Kurulum ----- */
  function nextDefaultName() {
    var used = {};
    S.names.forEach(function (n) { used[L.norm(n)] = true; });
    for (var k = 1; k <= 99; k++) if (!used[L.norm(L.namePrefix + " " + k)]) return L.namePrefix + " " + k;
    return L.namePrefix + " " + (S.names.length + 1);
  }
  function catSummary() {
    var cats = S.mixed ? V.KATEGORILER : V.KATEGORILER.filter(function (k) { return S.categories.indexOf(k.id) >= 0; });
    var cnt = L.candidates(S, V).length;
    if (S.mixed) return t("<b>Karışık Kategoriler</b> açık: tüm kategoriler ({a}) · <b>{c}</b> kelime", { a: V.KATEGORILER.length, c: cnt });
    if (!cats.length) return t("Henüz kategori seçilmedi.");
    return t("<b>{n}</b> kategori seçili · <b>{c}</b> kelime", { n: cats.length, c: cnt });
  }

  VIEW.setup = function (opts) {
    var maxI = L.maxImposters(S.names.length);
    var h = '<div class="topbar"><button class="back" data-act="menu" aria-label="' + t("Geri") + '">' + ICON.back + '</button><div><h1 class="h-title">' + t("Oyun Kurulumu") + '</h1><div class="h-sub">' + t("Ayarlar otomatik kaydedilir") + '</div></div></div><div class="scroll">';

    /* Oyuncular */
    h += '<div class="card"><div class="card-h"><div class="card-t"><span class="ic" style="--c:#0a84ff">' + ICON.users + '</span>' + t("Oyuncular") + '</div>' +
      '<div class="stepper"><button class="step-btn" data-act="pl-" ' + (S.names.length <= L.MIN_OYUNCU ? "disabled" : "") + ' aria-label="' + t("Oyuncu azalt") + '">−</button>' +
      '<div class="step-val">' + S.names.length + '</div>' +
      '<button class="step-btn" data-act="pl+" ' + (S.names.length >= L.MAX_OYUNCU ? "disabled" : "") + ' aria-label="' + t("Oyuncu artır") + '">+</button></div></div>' +
      '<p class="note">' + t("3 ile 12 oyuncu. İsimlere dokunarak düzenleyebilirsiniz.") + '</p><div class="names">';
    S.names.forEach(function (n, i) {
      h += '<input class="name-in" data-name="' + i + '" value="' + esc(n) + '" maxlength="' + L.MAX_ISIM + '" autocomplete="off" autocapitalize="words" enterkeyhint="done" aria-label="' + t("{n}. oyuncu adı", { n: i + 1 }) + '">';
    });
    h += "</div></div>";

    /* Imposter sayısı */
    h += '<div class="card"><div class="card-h"><div class="card-t"><span class="ic" style="--c:#ff453a">' + ICON.eye + '</span>' + t("Imposter Sayısı") + '</div>' +
      '<div class="stepper"><button class="step-btn" data-act="im-" ' + (S.imposters <= 1 ? "disabled" : "") + ' aria-label="' + t("Imposter azalt") + '">−</button>' +
      '<div class="step-val">' + S.imposters + '</div>' +
      '<button class="step-btn" data-act="im+" ' + (S.imposters >= maxI ? "disabled" : "") + ' aria-label="' + t("Imposter artır") + '">+</button></div></div>' +
      '<p class="note">' + t("En fazla {n} imposter seçilebilir; her zaman en az iki normal oyuncu kalır.", { n: maxI }) + "</p></div>";

    /* Mod */
    h += '<div class="card"><div class="card-t" style="margin-bottom:12px"><span class="ic" style="--c:#bf5af2">' + ICON.mask + '</span>' + t("Oyun Modu") + '</div>' +
      '<button class="mode ' + (S.mode === "A" ? "on" : "") + '" data-act="mode" data-m="A"><div class="radio"></div><div><b>' + t("Kelimeyi Bilmiyor") + '</b><span>' + t("Normal oyuncular gizli kelimeyi görür. Imposter rolünü bilir ama kelimeyi görmez; yalnızca kısa bir ipucu alır.") + '</span></div></button></div>';

    /* Kategoriler */
    h += '<div class="card"><div class="card-h"><div class="card-t"><span class="ic" style="--c:#30b0c7">' + ICON.grid + '</span>' + t("Kategoriler") + '</div></div>' +
      '<div class="cat-tools"><button class="btn btn-glass small" data-act="catAll">' + t("Tümünü Seç") + '</button><button class="btn btn-glass small" data-act="catNone">' + t("Seçimi Temizle") + '</button></div>' +
      '<div class="cat-grid">' +
      '<button class="cat wide ' + (S.mixed ? "on" : "") + '" data-act="mixed"><span class="ci">🎲</span>' + t("Karışık Kategoriler") + '<span class="ck">✓</span></button>';
    V.KATEGORILER.forEach(function (k) {
      var on = S.categories.indexOf(k.id) >= 0;
      h += '<button class="cat ' + (on ? "on" : "") + (S.mixed ? " dim" : "") + '" data-act="cat" data-id="' + k.id + '" aria-pressed="' + on + '"><span class="ci">' + k.ikon + "</span><span>" + esc(k.ad) + '</span><span class="ck">✓</span></button>';
    });
    h += '</div><div class="cat-sum">' + catSummary() + "</div></div>";

    /* Seçenekler */
    h += '<div class="card"><div class="card-t" style="margin-bottom:6px"><span class="ic" style="--c:#8e8e93">' + ICON.gear + '</span>' + t("Seçenekler") + '</div>' +
      '<div class="opt"><div class="row"><div><div class="t">' + t("Ses efektleri") + '</div><div class="d">' + t("Dokunma ve süre sesleri") + '</div></div>' + switchHtml("sound", S.sound) + "</div></div>" +
      '<div class="opt"><div class="row"><div><div class="t">' + t("Animasyonlar") + '</div><div class="d">' + t("Geçiş ve hareket efektleri") + '</div></div>' + switchHtml("anim", S.anim) + "</div></div>" +
      "</div>";

    h += '</div><div class="footer"><button class="btn btn-primary big" data-act="start">' + ICON.play + t("Oyunu Başlat") + "</button></div>";
    mount(h, { keepScroll: opts.keepScroll, still: opts.keepScroll });
  };

  /* ----- Oyun başlat ----- */
  function startRound() {
    G.round = L.newRound(S, V, PAIRS, G.prevWord, rnd, G.impHistory);
    G.prevWord = G.round.word;
    G.impHistory.push(G.round.imposterIdx);
    if (G.impHistory.length > 6) G.impHistory.shift();
    G.idx = 0;
    G.stage = "pass";
    G.timerDone = false;
    go("reveal");
  }

  /* ----- Rol gösterme ----- */
  function progressDots() {
    var h = '<div class="progress">';
    for (var i = 0; i < G.round.players.length; i++) {
      h += '<span class="dot ' + (i < G.idx ? "done" : i === G.idx ? "cur" : "") + '"></span>';
    }
    return h + "</div>";
  }
  /* Imposter ohne Wort: kurzer indirekter Hinweis (Fallback: Kategorie), erscheint nie bei normalen Spielern */
  function impHintHtml() {
    var h = L.hint(G.round.word, HINTS);
    var label = h ? t("Senin ipucun") : t("Konu");
    return '<div class="note" style="margin-bottom:8px">' + label + '</div><div class="secret hint">' + esc(h || G.round.category) + "</div>";
  }
  VIEW.reveal = function () {
    var n = G.round.players.length;
    if (G.stage === "pass") {
      var p = G.round.players[G.idx];
      mount(
        '<div class="center">' + progressDots() +
          '<div class="pass-card"><div class="avatar">' + initial(p.name) + '</div><div class="lbl">' + t("Telefonu şu oyuncuya verin") + '</div><div class="nm">' + esc(p.name) + "</div>" +
          '<div class="lbl">' + (G.idx + 1) + " / " + n + "</div></div>" +
          '</div>' +
        '<div class="footer"><button class="btn btn-primary big" data-act="seeRole">' + ICON.eye + t("Kelimeyi Gör") + "</button></div>"
      );
      return;
    }
    var v = L.roleView(G.round, G.idx);
    var card;
    if (!v.imposter) {
      card = '<div class="role-card normal"><div class="role-tag">' + t("Rolün") + '</div><div class="role-title">' + t("Normal Oyuncu") + '</div>' +
        '<div class="note" style="margin-bottom:8px">' + t("Gizli kelime") + '</div><div class="secret-wrap"><div class="secret">' + esc(v.word) + '</div><button class="help-btn" data-act="explain" aria-label="' + t("Kelimenin açıklamasını göster") + '">?</button></div></div>';
    } else if (v.mode === "B") {
      card = '<div class="role-card imp"><div class="role-tag">' + t("Rolün") + '</div><div class="role-title">IMPOSTER</div>' +
        '<div class="note" style="margin-bottom:8px">' + t("Senin kelimen") + '</div><div class="secret">' + esc(v.word) + "</div>" +
        '<p class="note" style="margin-top:14px">' + t("Diğerlerinin kelimesi farklı! Dikkatli dinle ve fark ettirme.") + '</p></div>';
    } else {
      card = '<div class="role-card imp"><div class="role-tag">' + t("Rolün") + '</div><div class="role-title">IMPOSTER</div>' +
        impHintHtml() + '</div>';
    }
    mount(
      '<div class="center">' + progressDots() + card + "</div>" +
      '<div class="footer"><button class="btn btn-green big" data-act="ready">' + ICON.check + t("Hazırım") + "</button></div>"
    );
  };

  /* ----- Tartışma ----- */
  function stopTimer() { if (G.tick) { clearInterval(G.tick); G.tick = null; } }
  function updateTimer() {
    var el = document.getElementById("tm");
    if (!el) { stopTimer(); return; }
    var left = G.endAt - Date.now();
    el.textContent = L.formatTime(left);
    el.classList.toggle("low", left <= 30000 && left > 0);
    if (left <= 0) {
      el.classList.remove("low"); el.classList.add("end");
      var m = document.getElementById("tmmsg");
      if (m) m.textContent = t("Süre doldu! Hazırsanız tartışmayı bitirin.");
      stopTimer();
      if (!G.timerDone) {
        G.timerDone = true; sfx("alarm");
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* yoksay */ }
      }
    }
  }
  function startDiscussion() {
    G.timerDone = false;
    G.endAt = Date.now() + S.timerMin * 60000;
    sfx("start");
    go("discussion");
  }
  VIEW.discussion = function () {
    var starter = G.round.players[G.round.starter].name;
    var imp = G.round.imposterCount;
    mount(
      '<div class="center"><div class="big-icon" style="--c1:#64d2ff;--c2:#0a84ff">' + ICON.chat + '</div><h1 class="h-title">' + t("Tartışma") + '</h1>' +
        (S.timerOn ? '<div class="timer" id="tm">' + L.formatTime(G.endAt - Date.now()) + '</div><div class="note" id="tmmsg">' + t("Süre sayılıyor…") + '</div>' : "") +
        '<div class="starter" style="margin-top:18px;text-align:center"><div style="margin-bottom:4px">' + t("İlk ipucunu veren") + '</div><b style="font-size:34px;line-height:1.15;display:block">' + esc(starter) + '</b></div>' +
        '<div class="pill" style="font-size:15px;padding:8px 16px;margin-top:18px">' + t("{n} imposter", { n: imp }) + "</div></div>" +
      '<div class="footer"><button class="btn btn-primary big" data-act="discEnd">' + ICON.check + t("Tartışma Bitti") + "</button>" +
      '<button class="btn btn-ghost" data-act="exitAsk">' + t("Oyundan Çık") + '</button></div>'
    );
    if (S.timerOn) { updateTimer(); if (G.endAt > Date.now()) G.tick = setInterval(updateTimer, 250); }
  };

  /* ----- Enthüllungsanimation (Overlay; der Impostor kommt ausschließlich aus G.round, nichts wird verändert) ----- */
  function revealClear() {
    RV.t.forEach(clearTimeout); RV.t = [];
    window.removeEventListener("resize", revealFit);
    RV.done = false;
  }
  function revealCancel() {
    revealClear();
    if (RV.el) { if (RV.el.parentNode) RV.el.parentNode.removeChild(RV.el); RV.el = null; }
  }
  function revealFit() { /* Namen immer vollständig und ohne Umbruch in die Breite einpassen */
    if (!RV.el) return;
    var box = RV.el.querySelector(".rv-stage"), names = RV.el.querySelectorAll(".rv-name");
    for (var i = 0; i < names.length; i++) {
      var n = names[i]; n.style.fontSize = "";
      var size = parseFloat(getComputedStyle(n).fontSize);
      while (n.offsetWidth > box.clientWidth && size > 16) { size -= 2; n.style.fontSize = size + "px"; }
    }
  }
  function revealFinish() {
    var el = RV.el; if (!el || !RV.done) return;
    RV.el = null; revealClear();
    go("results"); /* bisheriger Ablauf: jetzt erst folgt der Ergebnis-Bildschirm */
    el.classList.add("out");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
  }
  function revealStart() {
    if (RV.el) return; /* Mehrfachtippen startet nichts doppelt */
    var names = G.round.players.filter(function (p) { return p.imposter; }).map(function (p) { return p.name; });
    if (!names.length) { sfx("result"); go("results"); return; }
    var el = document.createElement("div");
    el.className = "rv"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = '<div class="rv-glow"></div><div class="rv-flash"></div><div class="rv-stage">' +
      '<div class="rv-q">' + t("Imposter Kim?") + '</div><div class="rv-num">3</div><div class="rv-num">2</div><div class="rv-num">1</div>' +
      '<div class="rv-res"><div class="rv-tag">' + t("IMPOSTOR") + '</div><div class="rv-names"></div></div></div>' +
      '<div class="rv-hint"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></div>';
    var list = el.querySelector(".rv-names");
    list.style.setProperty("--fs", names.length === 1 ? "clamp(40px, min(15vw, 18vh), 76px)" : names.length <= 3 ? "clamp(30px, min(11vw, 12vh), 54px)" : "clamp(24px, min(8vw, 8vh), 38px)");
    names.forEach(function (nm, i) {
      var d = document.createElement("div"); d.className = "rv-name"; d.textContent = nm; d.style.setProperty("--i", i); list.appendChild(d);
    });
    document.body.appendChild(el); RV.el = el; RV.done = false;
    var q = el.querySelector(".rv-q"), nums = el.querySelectorAll(".rv-num"), flash = el.querySelector(".rv-flash");
    function at(ms, fn) { RV.t.push(setTimeout(function () { if (RV.el === el) fn(); }, ms)); }
    function flip(node, from, to) { node.classList.remove(from); node.classList.add(to); }
    void el.offsetWidth; el.classList.add("on"); /* Phase 1: sanfter Übergang ins Dunkle */
    revealFit(); window.addEventListener("resize", revealFit);
    at(450, function () { q.classList.add("in"); });                       /* Phase 2: „Imposter Kim?“ */
    at(1700, function () { flip(q, "in", "out"); });
    for (var i = 0; i < 3; i++) (function (k) {                            /* Phase 3: 3 · 2 · 1 */
      at(2000 + k * 500, function () { nums[k].classList.add("in"); });
      at(2380 + k * 500, function () { flip(nums[k], "in", "out"); });
    })(i);
    at(3500, function () { flash.classList.add("pulse"); RV.t.push(setTimeout(function () { flash.classList.remove("pulse"); }, 130)); }); /* Phase 4: Lichtimpuls */
    at(3560, function () { el.classList.add("res"); });                    /* „IMPOSTOR“ */
    at(3900, function () { el.classList.add("name"); sfx("result"); });    /* Name */
    at(4500, function () { RV.done = true; el.classList.add("done"); });   /* Phase 5: erst jetzt per Tippen fortsetzen */
    el.addEventListener("click", revealFinish);
  }

  /* ----- Sonuçlar ----- */
  VIEW.results = function () {
    var r = G.round;
    var h = '<div class="scroll"><div style="text-align:center;padding:6px 0 14px"><h1 class="h-title">' + t("Sonuçlar") + '</h1><div class="h-sub">' + t("Roller ve kelime açıklandı") + '</div></div>';

    h += '<div class="card word-box"><div class="lb">' + t("Gizli Kelime") + '</div><div class="wd">' + esc(r.word) + '</div><div class="cat-l">' + t("Kategori: ") + esc(r.category) + "</div></div>";
    if (r.mode === "B") {
      h += '<div class="card word-box"><div class="lb">' + t("Imposter Kelimesi") + '</div><div class="wd alt">' + esc(r.alt) + "</div></div>";
    }

    h += '<div class="card"><div class="card-t" style="margin-bottom:12px"><span class="ic" style="--c:#bf5af2">' + ICON.mask + '</span>' + t("Roller") + '</div><div class="plist">';
    r.players.forEach(function (p, i) {
      var sub = p.imposter ? (r.mode === "B" ? t("Kelimesi: ") + esc(p.word) : t("Kelimeyi görmedi")) : t("Kelimesi: ") + esc(p.word);
      h += '<div class="pl ' + (p.imposter ? "imp" : "nor") + '" style="animation-delay:' + (i * 60) + 'ms"><div class="av">' + initial(p.name) + "</div>" +
        '<div><div class="pn">' + esc(p.name) + '</div><div class="pw">' + sub + "</div></div>" +
        '<span class="badge ' + (p.imposter ? "imp" : "nor") + '">' + (p.imposter ? t("Imposter") : t("Normal")) + "</span></div>";
    });
    h += "</div></div>";

    h += '<div class="footer"><button class="btn btn-primary big" data-act="replay">' + ICON.redo + t("Tekrar Oyna") + "</button>" +
      '<button class="btn btn-glass" data-act="menu">' + ICON.home + t("Ana Menüye Dön") + "</button></div>";
    mount(h);
  };

  /* ---------- Sprache ---------- */
  function trErr(err) { /* Meldungen aus logic.js (Türkisch) in die aktive Sprache übersetzen */
    var dup = "Aynı isim iki kez kullanılamaz: ";
    if (err.indexOf(dup) === 0) return t(dup) + err.slice(dup.length);
    return t(err);
  }
  function explainText(word, category) {
    var hit = EXPL[L.norm(word)];
    if (hit) return hit;
    return category ? t("“{w}” kelimesi “{c}” kategorisinden. Bu kelime için henüz kısa bir açıklama eklenmedi; kategoriyi düşünerek diğerlerine ipucu vermeye çalış.", { w: word, c: category })
      : t("“{w}” kelimesi bu turun kelimesi. Bu kelime için henüz kısa bir açıklama eklenmedi; kategoriyi düşünerek diğerlerine ipucu vermeye çalış.", { w: word });
  }
  function setLanguage(next) {
    if (next !== "tr" && next !== "de") return;
    if (next === LANG) return;
    /* Standardnamen („Oyuncu 1“ ↔ „Spieler 1“) in die neue Sprache übernehmen; eigene Namen bleiben unverändert */
    var from = LANG === "de" ? "Spieler" : "Oyuncu", to = next === "de" ? "Spieler" : "Oyuncu";
    S.names = S.names.map(function (n) {
      var m = String(n).match(/^(?:Oyuncu|Spieler) (\d+)$/);
      return m ? to + " " + m[1] : n;
    });
    saveSettings();
    try { localStorage.setItem(LANGKEY, next); } catch (e) { /* ohne Speicher: Sprache gilt nur bis zum Neustart */ }
    sfx("click");
    setTimeout(function () { location.reload(); }, 120); /* automatischer Neustart, damit alles komplett in der neuen Sprache erscheint */
  }

  /* ---------- Modal ---------- */
  /* Alle Dialoge nutzen dasselbe iOS-Bottom-Sheet (Griffleiste, große Hauptaktion, schlichtes „Abbrechen“) */
  function openModal(title, text, buttons) {
    var b = buttons.map(function (x, i) {
      var cls = i === 0 ? x.cls + " big" : x.cls.replace("btn-glass", "btn-plain");
      return '<button class="btn ' + cls + '" data-act="' + x.act + '">' + x.label + "</button>";
    }).join("");
    $modal.classList.add("sheet");
    $modal.innerHTML = '<div class="box confirm" role="dialog" aria-modal="true"><div class="sheet-grab" aria-hidden="true"></div><h3>' + title + "</h3><p>" + text + '</p><div class="btns">' + b + "</div></div>";
    $modal.classList.remove("hidden");
    fitLong($modal);
  }
  function openExplain(word, text) {
    $modal.classList.add("sheet");
    $modal.innerHTML = '<div class="box confirm explain" role="dialog" aria-modal="true"><div class="sheet-grab" aria-hidden="true"></div><div class="ex-head"><span class="ex-q">?</span><div><div class="ex-tag">' + t("Kelime açıklaması") + '</div><h3>' + esc(word) + '</h3></div></div>' +
      '<p>' + esc(text) + '</p><div class="btns"><button class="btn btn-primary big" data-act="closeModal">' + t("Anladım") + '</button></div></div>';
    $modal.classList.remove("hidden");
    fitLong($modal);
  }
  /* Auswahl nach „Tartışma Bitti“: Ergebnisse anzeigen oder zurück zur Diskussion (Timer läuft im Hintergrund weiter) */
  function openDiscEnd() {
    $modal.classList.add("sheet");
    $modal.innerHTML = '<div class="box confirm" role="dialog" aria-modal="true" aria-label="' + esc(t("Tartışma bitti mi?")) + '"><div class="sheet-grab" aria-hidden="true"></div>' +
      '<div class="sheet-ic" aria-hidden="true">' + ICON.list + '</div>' +
      '<h3>' + t("Tartışma bitti mi?") + '</h3>' +
      '<p>' + t("Oylamayı sözlü yapın, sonra sonuçları gösterin.") + '</p>' +
      '<div class="btns"><button class="btn btn-primary big" data-act="showResults">' + t("Sonuçları Göster") + '</button>' +
      '<button class="btn btn-plain" data-act="closeModal">' + t("Vazgeç") + '</button></div></div>';
    $modal.classList.remove("hidden");
    fitLong($modal);
  }
  function closeModal() { $modal.classList.add("hidden"); $modal.classList.remove("sheet"); $modal.innerHTML = ""; }

  /* ---------- Olaylar ---------- */
  var LOCKED = { seeRole: 1, ready: 1, discEnd: 1, showResults: 1, replay: 1, start: 1 };
  var lockUntil = 0;

  function act(name, el) {
    if (LOCKED[name]) {
      if (Date.now() < lockUntil) return;
      lockUntil = Date.now() + 450; /* çift dokunuşla yanlışlıkla sonraki ekranı açmayı engeller */
    }
    switch (name) {
      case "menu": sfx("click"); G.round = null; closeModal(); go("menu"); break;
      case "how": sfx("click"); go("how"); break;
      case "settings": sfx("click"); go("settings"); break;
      case "newGame": sfx("click"); go("setup"); break;

      case "pl+":
        if (S.names.length < L.MAX_OYUNCU) { S.names.push(nextDefaultName()); saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); }
        break;
      case "pl-":
        if (S.names.length > L.MIN_OYUNCU) {
          S.names.pop();
          S.imposters = Math.min(S.imposters, L.maxImposters(S.names.length));
          saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true });
        }
        break;
      case "im+": if (S.imposters < L.maxImposters(S.names.length)) { S.imposters++; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); } break;
      case "im-": if (S.imposters > 1) { S.imposters--; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); } break;
      case "tm+": if (S.timerMin < 15) { S.timerMin++; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); } break;
      case "tm-": if (S.timerMin > 1) { S.timerMin--; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); } break;
      case "mode": S.mode = el.getAttribute("data-m") === "B" ? "B" : "A"; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); break;
      case "cat":
        var id = el.getAttribute("data-id"), i = S.categories.indexOf(id);
        if (S.mixed) { S.mixed = false; if (S.categories.indexOf(id) < 0) S.categories.push(id); }
        else if (i >= 0) S.categories.splice(i, 1); else S.categories.push(id);
        saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); break;
      case "catAll": S.mixed = false; S.categories = V.KATEGORILER.map(function (k) { return k.id; }); saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); break;
      case "catNone": S.mixed = false; S.categories = []; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); break;
      case "mixed": S.mixed = !S.mixed; saveSettings(); sfx("click"); VIEW.setup({ keepScroll: true }); break;

      case "start":
        S.names = S.names.map(function (n, k) { n = L.clipName(n); return n || L.defaultName(k); });
        var err = L.validate(S, V);
        if (err) { toast(trErr(err)); lockUntil = 0; return; }
        saveSettings(); G.prevWord = null; G.impHistory = []; sfx("start"); startRound(); break;

      case "seeRole": G.stage = "show"; sfx("reveal"); render(); break;
      case "ready":
        sfx("hide"); G.idx++; G.stage = "pass";
        if (G.idx >= G.round.players.length) startDiscussion(); else render(); /* nach dem letzten Spieler startet die Diskussion automatisch */
        break;
      case "discEnd": sfx("click"); openDiscEnd(); break; /* Abstimmung ist Teil der Diskussionsrunde: erst Auswahl, keine eigene Phase */
      case "showResults": closeModal(); revealStart(); break;
      case "replay": sfx("start"); startRound(); break; /* ayarlar korunur, yeni kelime ve roller */

      case "exitAsk":
        openModal(t("Oyundan çıkılsın mı?"), t("Mevcut tur sona erer ve ana menüye dönersiniz."),
          [{ label: t("Ana Menüye Dön"), cls: "btn-danger", act: "menu" }, { label: t("Vazgeç"), cls: "btn-glass", act: "closeModal" }]);
        break;
      case "resetAsk":
        openModal(t("Ayarlar sıfırlansın mı?"), t("Oyuncu isimleri, kategoriler ve diğer seçimler başlangıç değerlerine döner."),
          [{ label: t("Sıfırla"), cls: "btn-danger", act: "resetDo" }, { label: t("Vazgeç"), cls: "btn-glass", act: "closeModal" }]);
        break;
      case "resetDo":
        S = L.sanitize(null, V); saveSettings(); applyBody(); closeModal(); toast(t("Ayarlar sıfırlandı.")); $toast.style.background = "rgba(46,230,166,.95)"; $toast.style.color = "#04261d";
        setTimeout(function () { $toast.style.background = ""; $toast.style.color = ""; }, 3000);
        VIEW.settings(); break;
      case "lang": setLanguage(el.getAttribute("data-v")); break;
      case "theme":
        var tv = el.getAttribute("data-v");
        S.theme = ["dark", "light", "auto"].indexOf(tv) >= 0 ? tv : "dark";
        saveSettings(); applyBody(); sfx("click"); VIEW.settings({ still: true }); break;
      case "explain":
        /* Nur für normale Spieler auf deren Rollen-Bildschirm – nie für den Imposter */
        var epl = G.round && G.round.players[G.idx];
        if (!epl || epl.imposter || !epl.word || G.screen !== "reveal" || G.stage !== "show") return;
        sfx("click"); openExplain(epl.word, explainText(epl.word, G.round.category)); break;
      case "closeModal": closeModal(); break;
    }
  }

  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    act(el.getAttribute("data-act"), el);
  }
  $app.addEventListener("click", onClick);
  $modal.addEventListener("click", function (e) {
    if (e.target === $modal) { closeModal(); return; }
    onClick(e);
  });

  /* Anahtarlar */
  $app.addEventListener("change", function (e) {
    var k = e.target.getAttribute && e.target.getAttribute("data-chg");
    if (!k) return;
    S[k] = !!e.target.checked;
    saveSettings();
    if (k === "anim") applyBody();
    if (k === "sound" && S.sound) sfx("click");
    if (k === "timerOn" && G.screen === "setup") VIEW.setup({ keepScroll: true });
  });

  /* İsim alanları (yeniden çizim yapmadan) */
  $app.addEventListener("input", function (e) {
    var i = e.target.getAttribute && e.target.getAttribute("data-name");
    if (i === null || i === undefined) return;
    S.names[parseInt(i, 10)] = e.target.value;
  });
  $app.addEventListener("focusout", function (e) {
    var i = e.target.getAttribute && e.target.getAttribute("data-name");
    if (i === null || i === undefined) return;
    var idx = parseInt(i, 10);
    var v = L.clipName(e.target.value);
    S.names[idx] = v || L.defaultName(idx);
    e.target.value = S.names[idx];
    saveSettings();
  });
  $app.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.getAttribute && e.target.getAttribute("data-name") !== null) e.target.blur();
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$modal.classList.contains("hidden")) closeModal(); });

  /* Rol ekranı açıkken uygulama arka plana giderse rolü hemen gizle */
  function hideIfAway() {
    if (G.screen === "reveal" && G.stage === "show") { G.stage = "pass"; render(); }
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) hideIfAway(); });
  window.addEventListener("pagehide", hideIfAway);

  /* Başlat */
  applyBody();
  render();

  /* Ladebildschirm beenden, sobald das Hauptmenü samt Logo bereit ist (kein künstliches Warten) */
  (function signalReady() {
    var imgs = Array.prototype.slice.call($app.querySelectorAll("img")), left = imgs.length, fired = false;
    function fire() { if (fired) return; fired = true; if (window.__samixReady) window.__samixReady(); }
    if (!left) { fire(); return; }
    imgs.forEach(function (im) {
      function one() { left--; if (left <= 0) fire(); }
      if (im.complete) one(); else { im.addEventListener("load", one); im.addEventListener("error", one); }
    });
    setTimeout(fire, 3000); /* Sicherheitsnetz: nie wegen eines Bildes hängen bleiben */
  })();

  /* Test/hata ayıklama için küçük ve zararsız bir erişim noktası */
  window.__IMPOSTER__ = { get state() { return { S: S, G: G }; }, act: act, render: render };
})();
