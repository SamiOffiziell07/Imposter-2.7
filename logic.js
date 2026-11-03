/* IMPOSTER – Oyun mantığı (arayüzden bağımsız, test edilebilir) */
(function (root) {
  "use strict";

  var L = {};

  L.MIN_OYUNCU = 3;
  L.MAX_OYUNCU = 12;
  L.MAX_ISIM = 14;
  /* Name auf MAX_ISIM Zeichen kürzen, ohne Emojis/Surrogatpaare in der Mitte zu zerschneiden */
  L.clipName = function (n) {
    var chars = Array.from(String(n == null ? "" : n).trim());
    return chars.slice(0, L.MAX_ISIM).join("").trim();
  };

  /* ---------- Yardımcılar ---------- */
  L.norm = function (s) {
    return String(s).trim().toLocaleLowerCase("tr-TR");
  };

  L.createRng = function () {
    var c = root.crypto || (typeof require === "function" ? safeRequireCrypto() : null);
    if (c && c.getRandomValues) {
      return function () {
        var a = new Uint32Array(1);
        c.getRandomValues(a);
        return a[0] / 4294967296;
      };
    }
    return Math.random;
  };
  function safeRequireCrypto() {
    try { return require("crypto").webcrypto; } catch (e) { return null; }
  }

  L.randInt = function (n, rnd) {
    return Math.floor((rnd || Math.random)() * n);
  };

  L.shuffle = function (arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = L.randInt(i + 1, rnd);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  L.maxImposters = function (oyuncuSayisi) {
    return Math.max(1, oyuncuSayisi - 2); /* en az 2 normal oyuncu kalır */
  };

  L.namePrefix = "Oyuncu"; /* app.js setzt je nach Sprache z. B. „Spieler“ */
  L.defaultName = function (i) { return L.namePrefix + " " + (i + 1); };

  /* ---------- Ayarlar ---------- */
  L.defaultSettings = function (veri) {
    return {
      names: [1, 2, 3, 4, 5].map(function (n, i) { return L.defaultName(i); }),
      imposters: 1,
      categories: ["hayvanlar", "yiyecekler", "sporlar"],
      mixed: false,
      mode: "A",          /* A: Kelimeyi Bilmiyor, B: Benzer Kelime */
      timerOn: false,
      timerMin: 3,
      hints: false,
      sound: true,
      anim: true,
      theme: "dark"     /* dark | light | auto */
    };
  };

  /* Ayarları geçerli aralığa getirir (bozuk kayıtlara karşı) */
  L.sanitize = function (s, veri) {
    var d = L.defaultSettings(veri);
    s = s || {};
    var out = {};
    var names = Array.isArray(s.names) ? s.names.slice(0, L.MAX_OYUNCU) : d.names;
    names = names.map(function (n, i) {
      n = L.clipName(n);
      return n || L.defaultName(i);
    });
    while (names.length < L.MIN_OYUNCU) names.push(L.defaultName(names.length));
    out.names = names;
    var maxI = L.maxImposters(names.length);
    var imp = parseInt(s.imposters, 10);
    if (!(imp >= 1)) imp = 1;
    out.imposters = Math.min(imp, maxI);
    var ids = veri.KATEGORILER.map(function (k) { return k.id; });
    out.categories = (Array.isArray(s.categories) ? s.categories : d.categories)
      .filter(function (id, i, a) { return ids.indexOf(id) >= 0 && a.indexOf(id) === i; });
    out.mixed = !!s.mixed;
    out.mode = "A"; /* Benzer Kelime modu kaldırıldı; alte Speicherstände auf A */
    out.timerOn = false; /* Tartışma sayacı seçeneği kaldırıldı; eski kayıtlarda açık kalmasın */
    var tm = parseInt(s.timerMin, 10);
    out.timerMin = tm >= 1 && tm <= 15 ? tm : d.timerMin;
    out.hints = !!s.hints;
    out.sound = s.sound !== false;
    out.anim = s.anim !== false;
    out.theme = ["dark", "light", "auto"].indexOf(s.theme) >= 0 ? s.theme : d.theme;
    return out;
  };

  /* Oyunu başlatmadan önce doğrulama; hata Türkçe metin olarak döner */
  L.validate = function (s, veri) {
    var n = s.names.length;
    if (n < L.MIN_OYUNCU || n > L.MAX_OYUNCU) return "Oyuncu sayısı 3 ile 12 arasında olmalı.";
    var seen = {};
    for (var i = 0; i < n; i++) {
      var k = L.norm(s.names[i]);
      if (!k) return "Tüm oyuncuların bir ismi olmalı.";
      if (seen[k]) return "Aynı isim iki kez kullanılamaz: " + s.names[i];
      seen[k] = true;
    }
    if (s.imposters < 1) return "En az 1 imposter olmalı.";
    if (n - s.imposters < 2) return "En az iki normal oyuncu kalmalı.";
    if (!s.mixed && (!s.categories || s.categories.length === 0))
      return "Lütfen en az bir kategori seçin veya Karışık Kategoriler'i açın.";
    return null;
  };

  /* ---------- Kelime veritabanı ---------- */
  L.buildPairMap = function (veri) {
    var inDb = {};
    veri.KATEGORILER.forEach(function (k) {
      k.kelimeler.forEach(function (w) { inDb[L.norm(w)] = true; });
    });
    var map = {};
    veri.CIFTLER.forEach(function (p) {
      var a = p[0], b = p[1];
      if (L.norm(a) === L.norm(b)) return;
      if (inDb[L.norm(a)] && !map[L.norm(a)]) map[L.norm(a)] = b;
      if (inDb[L.norm(b)] && !map[L.norm(b)]) map[L.norm(b)] = a;
    });
    return map;
  };

  L.activeCategories = function (s, veri) {
    if (s.mixed) return veri.KATEGORILER.slice();
    return veri.KATEGORILER.filter(function (k) { return s.categories.indexOf(k.id) >= 0; });
  };

  L.candidates = function (s, veri) {
    var seen = {}, out = [];
    L.activeCategories(s, veri).forEach(function (k) {
      k.kelimeler.forEach(function (w) {
        var key = L.norm(w);
        if (seen[key]) return;
        seen[key] = true;
        out.push({ kelime: w, kategori: k.ad });
      });
    });
    return out;
  };

  /* ---------- Imposter-Auswahl (fair) ---------- */
  /* Jede Runde wird neu und zufällig gewählt: alle wählbaren Spieler haben dieselbe Chance.
     Einzige Ausnahme: Wer in den letzten maxStreak Runden hintereinander Imposter war,
     wird in dieser Runde ausgesetzt (sofern genug andere Spieler übrig sind).
     history: Liste früherer Runden, jeweils ein Array mit Imposter-Indizes (älteste zuerst). */
  L.MAX_STREAK = 2;
  L.pickImposters = function (n, k, history, rnd, maxStreak) {
    maxStreak = maxStreak || L.MAX_STREAK;
    history = Array.isArray(history) ? history : [];
    var eligible = [];
    for (var i = 0; i < n; i++) {
      var streak = 0;
      for (var h = history.length - 1; h >= 0; h--) {
        if (Array.isArray(history[h]) && history[h].indexOf(i) >= 0) streak++; else break;
      }
      if (streak < maxStreak) eligible.push(i);
    }
    if (eligible.length < k) { /* zu wenige Spieler übrig: Regel aufheben, alle gleich */
      eligible = [];
      for (var j = 0; j < n; j++) eligible.push(j);
    }
    return L.shuffle(eligible, rnd).slice(0, k).sort(function (a, b) { return a - b; });
  };

  /* ---------- Tur oluşturma ---------- */
  /* prevWord: önceki tur kelimesi (mümkünse tekrar edilmez) */
  L.newRound = function (s, veri, pairMap, prevWord, rnd, history) {
    rnd = rnd || Math.random;
    var all = L.candidates(s, veri);
    var mode = s.mode;
    var fellBack = false;
    var pool = all;

    if (mode === "B") {
      var withPair = all.filter(function (c) { return !!pairMap[L.norm(c.kelime)]; });
      if (withPair.length === 0) { mode = "A"; fellBack = true; }
      else pool = withPair;
    }

    var prev = prevWord ? L.norm(prevWord) : null;
    var fresh = pool.filter(function (c) { return L.norm(c.kelime) !== prev; });
    if (fresh.length > 0) pool = fresh;

    var pick = pool[L.randInt(pool.length, rnd)];
    var alt = mode === "B" ? pairMap[L.norm(pick.kelime)] : null;

    /* Rolleri rastgele dağıt */
    var n = s.names.length;
    var impIdx = L.pickImposters(n, s.imposters, history, rnd);
    var flags = [];
    for (var i = 0; i < n; i++) flags.push(impIdx.indexOf(i) >= 0);

    var players = s.names.map(function (name, idx) {
      var imp = flags[idx];
      return {
        name: name,
        imposter: imp,
        word: imp ? (mode === "B" ? alt : null) : pick.kelime
      };
    });

    return {
      word: pick.kelime,
      category: pick.kategori,
      alt: alt,
      mode: mode,
      fellBack: fellBack,
      imposterCount: s.imposters,
      imposterIdx: impIdx,
      starter: L.randInt(n, rnd),
      players: players
    };
  };

  /* Gösterim: tek bir oyuncunun gizli ekranında ne görüneceği */
  L.roleView = function (round, idx) {
    var p = round.players[idx];
    return { name: p.name, imposter: p.imposter, word: p.word, mode: round.mode };
  };

  /* ---------- Worterklärungen ---------- */
  /* Baut eine Nachschlage-Tabelle (normalisierte Schlüssel), damit Groß-/Kleinschreibung egal ist */
  L.buildExplainMap = function (table) {
    var map = {};
    if (!table) return map;
    Object.keys(table).forEach(function (k) {
      var v = table[k];
      if (typeof v === "string" && v.trim()) map[L.norm(k)] = v.trim();
    });
    return map;
  };
  /* Liefert die Erklärung oder – falls keine hinterlegt ist – eine sinnvolle Ersatzerklärung */
  L.explain = function (word, category, map) {
    var hit = map && map[L.norm(word)];
    if (hit) return hit;
    return "“" + word + "” kelimesi" + (category ? " “" + category + "” kategorisinden." : " bu turun kelimesi.") +
      " Bu kelime için henüz kısa bir açıklama eklenmedi; kategoriyi düşünerek diğerlerine ipucu vermeye çalış.";
  };

  /* ---------- Imposter-Hinweis ---------- */
  /* Liefert das kurze, indirekte Hinweiswort zum geheimen Wort (nur für den Imposter-Bildschirm) oder null */
  L.hint = function (word, map) {
    var hit = map && word != null && map[L.norm(word)];
    return hit || null;
  };

  L.formatTime = function (ms) {
    var sec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = L;
  root.ImposterLogic = L;
})(typeof window !== "undefined" ? window : globalThis);
