# IMPOSTER – Türkçe Parti Oyunu

3–12 kişi, tek telefon, tamamen çevrimdışı. Hesap, internet veya kurulum gerekmez.

## Nasıl başlatılır

**En kolay yol:** ZIP dosyasını bir klasöre çıkarın ve `index.html` dosyasına çift tıklayın (Chrome, Edge, Firefox, Safari).

**Telefonda:** Klasörü telefona kopyalayıp `index.html` dosyasını tarayıcıyla açın. Bazı telefonlarda dosya yöneticisi HTML dosyalarını açmaz; bu durumda bilgisayarda yerel sunucu başlatıp aynı Wi‑Fi üzerinden telefondan bağlanabilirsiniz:

```
python3 -m http.server 8000
```

Sonra telefonda `http://BILGISAYAR-IP-ADRESI:8000` adresini açın. (Windows için `baslat.bat`, macOS/Linux için `baslat.sh` dosyaları aynı komutu çalıştırır.)

## Oyun akışı
1. **Yeni Oyun** → oyuncular, imposter sayısı, mod ve kategoriler seçilir.
2. Telefon elden ele geçer: **Kelimeyi Gör** → rolünüzü görün → **Hazırım**.
3. Telefon bir kenara bırakılır. Sırayla sözlü ipucu verilir, tartışılır.
4. Biri **Tartışma Bitti**’ye dokunur; açılan seçimde **Sonuçları Göster** veya **Vazgeç** (tartışmaya dön) seçilir. Ayrı bir oylama ekranı yoktur; oylama tamamen **sözlüdür**, uygulama oy tutmaz.
5. **Sonuçları Göster** → roller ve kelimeler açıklanır. Kazananı grup belirler.
6. **Tekrar Oyna** aynı ayarlarla yeni kelime ve yeni rollerle hemen başlar.

## Veröffentlichen (GitHub Pages, Netlify usw.)
Lade den **gesamten Inhalt** des Ordners hoch (nicht den Ordner selbst): `index.html`, `style.css`, `app.js`, `logic.js`, `words.js`, `aciklamalar.js`, `de.js` (deutsche Sprachdaten), `manifest.webmanifest`, die vier `*.png`-Symbole und `.nojekyll`. Das SAMIX-Logo ist als Vektor-SVG **direkt im Code eingebettet** – es braucht keine Bilddatei und keinen Unterordner. Die Ordner `assets/` (Logo-Quelldateien) und `tests/` sind für das Spiel nicht nötig. Bei GitHub: Dateien per „Add file → Upload files“ hochladen, bis alle Dateien in der Liste stehen, dann Seite neu laden (ggf. Cache leeren).

## SAMIX
Logo: `app.js` ve `index.html` içine gömülü vektör SVG (her boyutta keskin, açık/koyu temaya göre renklenir). `assets/` içinde kaynak dosyalar bulunur: `samix-logo.svg`, `samix-logo-dark.svg`, `.png` sürümleri ve `samix-logo-original.jpg` (orijinal şablon). Açılışta SAMIX yükleme ekranı görünür ve oyun hazır olur olmaz kendiliğinden kapanır; dosya eksikse hata mesajı ve “Tekrar Dene” düğmesi çıkar.

## Kelime açıklaması (?)
Normal oyuncular rol ekranında gizli kelimenin yanındaki **?** simgesine dokunarak kısa bir açıklama görür. Imposter bu simgeyi görmez. Açıklamalar `aciklamalar.js` dosyasındadır (anahtar = kelime). Yeni kelime eklerseniz buraya da bir satır ekleyin; eklenmezse otomatik bir yedek metin gösterilir.

## Imposter-Seçimi (adil rastgele)
Her yeni turda imposter(lar) baştan ve rastgele seçilir; seçilebilen herkesin şansı eşittir. Tek kural: bir oyuncu üst üste 2 tur imposter olduysa, 3. turda dinlenir (yeterli başka oyuncu varsa). Böylece aynı kişi sürekli imposter olmaz. Yeni oyun başlatınca geçmiş sıfırlanır.

## Görünüm
Ayarlar → Görünüm: **Koyu** (varsayılan), **Açık** veya **Otomatik** (iPhone ayarını izler). iPhone’da Safari’de “Ana Ekrana Ekle” ile tam ekran uygulama gibi açılır.

## Dil / Sprache
Ayarlar → Dil: **Türkçe** (varsayılan) veya **Deutsch**. Seçim kaydedilir ve oyun otomatik olarak yeniden başlar; sonraki açılışlarda da geçerli kalır (tarayıcıda `imposter_lang_v1`).
Einstellungen → Sprache: **Türkçe** (Standard) oder **Deutsch**. Die Auswahl wird gespeichert, das Spiel startet automatisch neu und bleibt bei späteren Starts in dieser Sprache.

Deutsche Daten: `de.js` enthält alle 1231 Wörter in 15 Kategorien, die Erklärungen hinter dem **?** und alle Oberflächentexte auf Deutsch. Die Datei wird nur geladen, wenn Deutsch gewählt ist, und ersetzt dann die türkischen Daten (`words.js`, `aciklamalar.js`). Türkische Texte im Code (`app.js`) dienen als Schlüssel der Übersetzungstabelle `IMPOSTER_I18N.ui` in `de.js`. Weitere Sprachen: neue Datei nach dem Muster von `de.js` anlegen und in `index.html` sowie `setLanguage` in `app.js` eintragen.

## Imposter-Hinweis / Imposter ipucu
Der Imposter sieht auf seinem Rollen-Bildschirm ein kurzes, indirektes Hinweiswort zum geheimen Wort (z. B. „Gefüllt mit Reis“), in der gewählten Sprache. Normale Spieler sehen ihn nie. Die Hinweise stehen in `words.js` (Türkçe) und `de.js` (Deutsch) als `IMPOSTER_HINWEISE` (Schlüssel = geheimes Wort, alle 1231 Wörter abgedeckt). Neues Wort → neuen Hinweis ergänzen; fehlt er, erscheint ersatzweise die Kategorie. Test: `python3 tests/test_imposter_hinweis.py .`

## Modlar
- **Kelimeyi Bilmiyor:** Imposter kelimeyi görmez, yalnızca kısa bir ipucu alır.
- **Benzer Kelime:** Imposter yakın ama farklı bir kelime alır (örn. Kedi–Köpek, İftar–Sahur). Seçili kategorilerde uygun çift yoksa otomatik olarak ilk moda geçilir.

## Dosyalar
`index.html`, `style.css`, `app.js` (arayüz), `logic.js` (oyun mantığı), `aciklamalar.js` (kelime açıklamaları), `assets/` (logo ve simgeler), `manifest.webmanifest`, `words.js` (1231 kelime, 15 kategori, benzer kelime çiftleri), `de.js` (Almanca dil verisi). `tests/` klasörü isteğe bağlı otomatik testleri içerir (`node tests/test_logic.js`, `python3 tests/test_ui.py index.html`, `python3 tests/test_samix.py .`, `node tests/test_de_data.js`, `python3 tests/test_sprachwechsel.py .`, `python3 tests/test_sprache.py .`).

Ayarlar yalnızca bu cihazın tarayıcısında saklanır; hiçbir veri gönderilmez.


## Tests
`node tests/test_logic.js`, `node tests/test_de_data.js`, `python3 tests/test_imposter_hinweis.py .`, `python3 tests/test_diskussion_ende.py .`, `python3 tests/test_reveal.py . /tmp/shots`, `python3 tests/test_sprache.py .`, `python3 tests/test_sprachwechsel.py .`, `python3 tests/test_samix.py .`, `python3 tests/test_namen.py .`, `python3 tests/test_ui.py index.html` sowie der Rundgang `python3 tests/test_rundgang.py de dark 390 844`. Hinweis: `tests/test_wortschatz.py` ist nur für Wortlisten-Erweiterungen gedacht. Den Tartışma-Timer und Modus B gibt es im Spiel nicht mehr (Code ist nur noch als Reserve vorhanden).
