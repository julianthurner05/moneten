# moneten – Projektspezifikation

Private Web-App für einen Freundeskreis: gemeinsame Ausgaben in Gruppen aufteilen (Splitwise-Prinzip) plus eine persönliche Monatsübersicht der eigenen Ausgaben. Läuft auf `moneten.julianthurner.com`. Sprache der Oberfläche: Deutsch (Österreich), Beträge im Format `1.234,56 €`.

Baue nur, was in dieser Datei steht. Keine zusätzlichen Features, Elemente oder Texte erfinden. Wenn etwas unklar ist: nachfragen statt annehmen.

---

## 1. Tech-Stack und Hosting

- **Cloudflare Pages** für das Frontend, **Pages Functions** (`/functions`) als API, **Cloudflare D1** als Datenbank (Binding-Name `DB`).
- **Kein Framework, kein Build-Schritt.** Vanilla HTML, CSS und JavaScript (ES-Module). Ausgabeordner ist `public/`, Build-Befehl bleibt leer.
- Deployment: GitHub-Repo ist mit Cloudflare Pages verbunden, jeder Push auf `main` deployt automatisch.
- Konfiguration in `wrangler.toml` mit `pages_build_output_dir = "public"` und einem `[[d1_databases]]`-Eintrag mit `binding = "DB"`.
- Datenbankschema über D1-Migrationen im Ordner `migrations/` (`wrangler d1 migrations apply`, lokal mit `--local`, produktiv mit `--remote`).
- Lokale Entwicklung mit `npx wrangler pages dev`.
- Alles muss im Cloudflare-Gratis-Tarif laufen.

## 2. Projektstruktur

```
public/
  index.html
  robots.txt          → Disallow: /
  _headers            → X-Robots-Tag: noindex, nofollow für alle Pfade
  manifest.webmanifest
  fonts/              → Schriftdateien (liegen schon dort, siehe Abschnitt 8)
  css/tokens.css      → alle Design-Tokens und @font-face, sonst nichts
  css/app.css         → sämtliches übrige CSS
  js/app.js           → Einstieg, Hash-Routing
  js/…                → weitere Module nach Bedarf
functions/
  api/…               → API-Endpunkte
  _middleware.js      → Session-Prüfung
migrations/
  0001_init.sql
wrangler.toml
```

Die App soll nicht in Suchmaschinen auftauchen (`robots.txt` und `_headers` wie oben).

## 3. Datenmodell (D1 / SQLite)

Alle Beträge als **ganze Cent** (`INTEGER`), nie als Kommazahl. IDs als zufällige UUIDs (`crypto.randomUUID()`). Datum als `YYYY-MM-DD`, Monate als `YYYY-MM`.

- **users**: id, username (unique, klein), display_name, password_hash, password_salt, is_admin, must_change_password, created_at
- **sessions**: id (SHA-256-Hash des Tokens, nie das Token selbst), user_id, expires_at
- **groups**: id, name, kind (`'standard'` oder `'wg'`), currency (Standard `'EUR'`), archived, created_by, created_at
- **group_members**: group_id, user_id, joined_at (Primärschlüssel aus beiden)
- **group_expenses**: id, group_id, paid_by, amount_cents, description, spent_on, split_mode (`'equal'`, `'exact'`, `'shares'`), created_by, created_at, deleted_at (Soft Delete)
- **expense_shares**: expense_id, user_id, share_cents. Die Summe muss exakt amount_cents ergeben. Rest-Cent bei gleicher Aufteilung deterministisch verteilen (z. B. nach user_id sortiert, erste Personen bekommen je 1 Cent mehr).
- **settlements** (Ausgleichszahlungen): id, group_id, from_user, to_user, amount_cents, settled_on, created_by, created_at
- **personal_categories**: id, user_id, name, counts_toward_month (Standard 1), sort_order, archived
- **personal_entries**: id, user_id, category_id, spent_on, description, amount_cents (negativ erlaubt, z. B. für Rückerstattungen), created_at
- **recurring_items**: id, user_id, kind (`'income'` oder `'fixed'`), name, amount_cents, start_month, end_month (optional)
- **user_settings**: user_id, budget_start_month, carryover_enabled (Standard 1)

Das Feld `groups.kind` ist beim Anlegen einer Gruppe wählbar (Standard oder WG) und wird als kleines Label angezeigt, in Phase 1 und 2 verhält sich aber jede Gruppe gleich. WG-Sonderfunktionen kommen später (Phase 3, nicht bauen).
Das Feld `groups.currency` wird angelegt, in Phase 1 und 2 gibt es aber nur EUR. Kein Währungsumrechnen bauen.

## 4. Rechenlogik

### Gruppen-Salden
Pro Person in einer Gruppe:
`Saldo = Summe(bezahlte Ausgaben) − Summe(eigene Anteile) + Summe(geleistete Ausgleichszahlungen) − Summe(erhaltene Ausgleichszahlungen)`
Positiv heißt: die anderen schulden dir etwas. Gelöschte Ausgaben (`deleted_at`) zählen nicht.

### Ausgleichsvorschläge
Schulden auf möglichst wenige Überweisungen reduzieren: wiederholt größten Gläubiger mit größtem Schuldner verrechnen, bis alle Salden 0 sind. Ein Klick auf einen Vorschlag legt nach Bestätigung eine Ausgleichszahlung an.

### Persönliche Monatsübersicht
Für einen Monat `m`:
- **Einnahmen(m)** = Summe aller `recurring_items` mit kind `'income'`, die in `m` aktiv sind
- **Fixkosten(m)** = dasselbe für kind `'fixed'`
- **Variable Ausgaben(m)** = Summe der `personal_entries` in `m` aus Kategorien mit `counts_toward_month = 1` **plus** die eigenen Anteile (`expense_shares`) an Gruppenausgaben mit `spent_on` in `m`
- **Übertrag(m)** = Übrig(m−1), wenn `carryover_enabled` und `m` nach `budget_start_month` liegt, sonst 0
- **Budget(m)** = Einnahmen(m) + Übertrag(m)
- **Ausgaben(m)** = Fixkosten(m) + Variable Ausgaben(m)
- **Übrig(m)** = Budget(m) − Ausgaben(m)

Ausgleichszahlungen zählen **nicht** als Ausgabe (sind nur Geldbewegungen). Wer für die Gruppe 120 € vorstreckt und davon 30 € Anteil hat, sieht in seiner Übersicht nur die 30 €.

Zusätzlich: Durchschnitt pro Kategorie über alle Monate seit `budget_start_month` bis zum aktuellen Monat. Kategorien mit `counts_toward_month = 0` erscheinen gesondert mit eigener Summe, zählen aber nicht in Budget und Ausgaben.

Die Logik entspricht einer bestehenden Excel-Vorlage des Nutzers (Budget des Folgemonats = Einnahmen + Übrig des Vormonats; Ausgaben = variable Ausgaben + Fixkosten). Zum Testen: Einnahmen 1.754,00 €, Fixkosten 724,00 €, variable Ausgaben im Startmonat 954,65 € → Ausgaben 1.678,65 €, Übrig 75,35 €, Budget im Folgemonat 1.829,35 €.

## 5. Accounts und Sicherheit

Bewusst einfach, aber nicht fahrlässig:

- **Keine offene Registrierung.** Wenn die Tabelle `users` leer ist, zeigt die App einmalig eine Setup-Seite zum Anlegen des Admin-Accounts. Danach ist diese Seite dauerhaft gesperrt.
- Der Admin legt weitere Accounts an (Benutzername, Anzeigename, Startpasswort). Beim ersten Login muss das Passwort geändert werden. Der Admin kann Passwörter zurücksetzen.
- Passwort-Hashing mit PBKDF2-SHA-256 über Web Crypto (`crypto.subtle`), 16-Byte-Salt pro User. Iterationen so hoch wie in Workers erlaubt, aber prüfen, ob der Login im Gratis-Tarif das CPU-Limit pro Aufruf reißt. Falls ja: melden und Iterationszahl gemeinsam festlegen, nicht still reduzieren.
- Session-Cookie `moneten_session`: HttpOnly, Secure, SameSite=Lax, 30 Tage gültig. Logout löscht die Session in der DB.
- Jede API-Anfrage prüft die Session (`_middleware.js`). Gruppen-Endpunkte prüfen zusätzlich die Mitgliedschaft. Persönliche Daten sind ausschließlich für den eigenen User lesbar und schreibbar.
- Alle SQL-Abfragen mit gebundenen Parametern, nie String-Verkettung.
- Nutzereingaben im Frontend nur über `textContent` ausgeben, nie über `innerHTML`.

## 6. Bildschirme und Funktionen

### Phase 1: Grundgerüst, Accounts, Gruppen
1. Design-System (Abschnitt 7 und 8) mit Tokens, Schrift, Kopfzeile, Hell/Dunkel-Umschaltung.
2. Setup-Seite (nur bei leerer DB), Login, Passwort ändern, Logout.
3. Admin-Bereich: User anlegen, Passwort zurücksetzen.
4. Gruppen-Übersicht als Karten-Raster: pro Gruppe Name, Anzahl Mitglieder und groß der eigene Saldo. Umschaltbar zwischen Raster- und Listenansicht. Archivierte Gruppen per Filter einblendbar.
5. Gruppe anlegen (Name, Art Standard/WG, Mitglieder aus den bestehenden Usern), Mitglieder hinzufügen, Gruppe archivieren (nur wenn alle Salden 0).
6. Gruppendetail: Liste der Ausgaben und Ausgleichszahlungen, nach Datum absteigend, mit Monatsfilter. Salden aller Mitglieder. Ausgleichsvorschläge.
7. Ausgabe erfassen und bearbeiten: Betrag, Beschreibung, Datum, wer hat bezahlt, wer ist beteiligt, Aufteilung gleich, nach exakten Beträgen oder nach Anteilen. Löschen als Soft Delete mit Bestätigung.

**Nach Phase 1 anhalten, Ergebnis zusammenfassen und auf Freigabe warten.**

### Phase 2: Persönliche Monatsübersicht
1. Monatsansicht als Startseite nach dem Login: Monat wechseln (zurück, vor, aktueller Monat).
2. Große Kennzahlen: Budget, Ausgaben, Übrig.
3. Kategorien als Karten-Raster mit Summe des Monats groß dargestellt, Klick öffnet die Einträge der Kategorie als Liste.
4. Block mit den eigenen Anteilen aus Gruppen, gegliedert nach Gruppe, mit Link zur Gruppe.
5. Eintrag erfassen, bearbeiten, löschen.
6. Einstellungen: Kategorien verwalten, wiederkehrende Einnahmen und Fixkosten verwalten, Startmonat und Übertrag an/aus.
7. Durchschnittswerte pro Kategorie.

**Nach Phase 2 anhalten, Ergebnis zusammenfassen und auf Freigabe warten.**

### Phase 3: WG-Funktionen
Noch nicht bauen. Wird später spezifiziert.

## 7. Design

Eigenständige, ruhige Gestaltung. Das Grundgefühl von fontshare.com bleibt (viel Weißraum, große Zahlen, kleine fette Metazeilen, reduzierte Bedienelemente), aber nicht als 1:1-Kopie – Flächen, Radien und Bedienelemente orientieren sich eher am Cloudflare-Dashboard und an der Claude-App.

**Farben** – helle Graustufen, kein Gelb, keine Buntfarben:
- Seitenhintergrund `#F5F5F3` (helles, minimal warmes Grau)
- Flächen (Karten, Panels, Listen) `#FFFFFF`
- Text `#1A1A18`
- Linien `#E3E3E0`
- Sekundärtext und inaktive Elemente `#6E6E66`
- Dunkelmodus passend abgeleitet: Hintergrund `#131312`, Flächen `#1C1C1A`, Text `#ECECE8`, Linien `#2A2A27`, Sekundär `#8D8D84`. Umschaltbar über zwei kleine Icons (Kreis und halb gefüllter Kreis), Wahl in `localStorage` merken, Standard folgt `prefers-color-scheme`.

**Erlaubt sind:** dezente Rundungen (Karten/Panels/Buttons ~8px, kleine Elemente ~6px), ein leichter Schatten nur für schwebende Panels, ein halbtransparenter Scrim hinter Panels. **Weiterhin tabu:** Buntfarben, Farbakzente, Verläufe, dekorative Schatten auf Karten oder Listen.

**Aufbau-Prinzipien:**
- Struktur durch Flächen auf grauem Grund plus 1px-Linien und Weißraum.
- **Kopfzeile:** links die Wortmarke „moneten" groß und fett, auf dem Seitenhintergrund mit Haarlinie unten. Navigation als Tabs: **Monat**, **Gruppen**, **Konto** – der aktive Tab dunkel gefüllt mit invertiertem Text und Rundung, darunter klein eine Zahl (bei Gruppen die Anzahl aktiver Gruppen). Rechts in Sekundärfarbe der Gesamtsaldo über alle Gruppen, z. B. „Du bekommst 42,50 €" oder „Alles ausgeglichen".
- **Werkzeugleiste:** Text-Bedienelemente für Umschalter und Filter (inaktiv Sekundär-, aktiv Textfarbe), Dropdowns mit kleinem Dreieck. Primäre Aktionen („+ Ausgabe", „Speichern") als kompakte, dunkel gefüllte Buttons mit Rundung; sekundäre Aktionen als Textlinks.
- **Große Zahl links** über Listen und Rastern, daneben Umschalter Liste/Raster und Sortierung als Textlinks.
- **Karten-Raster:** weiße Karten mit 1px-Rahmen, Rundung und Abstand zueinander (kein zusammenhängendes Haarlinien-Raster). Oben eine Metazeile klein, fett, in Sekundärfarbe (Name links, Zusatzinfos rechts). Darunter der Betrag in sehr großer Schrift, unten eine kleine Fußzeile. Hover und Fokus: Rahmen wechselt auf Textfarbe, Metazeile ebenso.
- **Listen:** in einer weißen Fläche mit Rahmen und Rundung, Zeilen durch Haarlinien getrennt. Kleines Label in Sekundärfarbe oben, darunter großer Text, rechts Betrag oder Aktion.
- **Panels und Formulare:** weiße Panels mit Rahmen, Rundung und leichtem Schatten über einem Scrim. Beschriftung über dem Feld, Eingabefelder als Kästen mit 1px-Rahmen und kleiner Rundung.
- **Mobil zuerst mitdenken:** Die Freunde nutzen die App vor allem am Handy. Auf schmalen Bildschirmen: Wortmarke plus Menü-Icon (zwei Linien), Navigation als volle Liste, Karten einspaltig, große Zahlen skalieren über `clamp()`-Tokens. Safe-Area-Abstände für iPhones berücksichtigen. Die App soll als Web-App auf den Homescreen gelegt werden können (Manifest, Icons).

## 8. Schrift

- Die Schriftdateien liegen in `public/fonts/`. Aktuell **General Sans** von Fontshare (WOFF2).
- `@font-face`-Regeln ausschließlich in `css/tokens.css`. Überall sonst nur das Token `--font-sans` verwenden.
- Die Schrift muss mit minimalem Aufwand tauschbar sein: Dateien ersetzen, `@font-face` in `tokens.css` anpassen, fertig. Keine Schriftnamen außerhalb von `tokens.css`.
- Fallback-Stack angeben (`system-ui, sans-serif`), `font-display: swap`.

## 9. Verbindliche Gestaltungs- und Code-Regeln

- **Alle Werte als Tokens** in `tokens.css`: Farben, Abstände, Schriftgrößen, Zeilenhöhen, Linienstärken, Radien, Transition-Dauern und -Kurven, Breakpoints soweit möglich. Keine harten Werte im übrigen CSS. Vor dem Anlegen eines neuen Tokens prüfen, ob ein bestehendes passt.
- **Font-Smoothing** global: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`
- **Nichts springt:** Alles, was erscheint oder verschwindet, bekommt eine weiche Transition, ebenso alles, was davon beeinflusst wird (z. B. Wrapper, deren Höhe sich ändert). Elemente erst nach Ende der Ausblend-Transition auf `display: none` setzen, beim Einblenden erst sichtbar machen, dann animieren.
- **Keine geclippten Höhenanimationen** (kein Aufklappen per `overflow: hidden`). Stattdessen sanftes Einblenden mit kleinem Versatz (Stagger) auf Zeilen. Aufbau-Animationen einfach halten, Dinge eher nacheinander als alles gleichzeitig.
- **Fokus verändert keine Rahmen:** Beim Klicken in Formularfelder oder bei Autofokus bleibt die Linie/Border unverändert. Tastatur-Fokus trotzdem sichtbar machen, aber über `outline` mit Abstand, nicht über die Border.
- **Keine ungefragten Zusatzelemente:** keine Sektions-Labels, keine Erklärtexte unter Überschriften, keine Deko-Punkte oder Akzente, die hier nicht beschrieben sind.
- **Gleiche Elemente sind eine Komponente:** Was mehrfach vorkommt (Karte, Listenzeile, Panel, Button), wird einmal definiert und überall mit identischem CSS verwendet.
- Beträge immer mit `Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })` formatieren. Eingaben mit Komma akzeptieren.

## 10. Arbeitsweise

- Nach jeder größeren Oberflächen-Änderung leichte Screenshot-Durchläufe zur Sichtprüfung machen (Desktop und Handy-Breite, hell und dunkel), z. B. mit Playwright. Keine aufwendigen Frame-Sheets.
- Rechenlogik aus Abschnitt 4 mit einfachen Tests absichern, inklusive der Excel-Testwerte und der Rest-Cent-Verteilung.
- Kleine, nachvollziehbare Commits mit deutschen Commit-Messages.
- Einrichtung, die Claude Code selbst erledigen kann, sobald der Nutzer `npx wrangler login` ausgeführt hat: D1-Datenbank anlegen (`wrangler d1 create moneten`), ID in `wrangler.toml` eintragen, Migrationen lokal und remote anwenden. Schritte, die nur der Nutzer im Browser machen kann (GitHub, Cloudflare-Dashboard), klar als Anleitung ausgeben.
