# Quiz Night

> **Der Abend läuft komplett offline: WLAN darf aus sein, Internet wird nicht gebraucht.**
> Alles läuft auf **einem** Laptop. Beamer-Fenster und Gamemaster-Fenster werden beide dort geöffnet. Kein anderes Gerät im Netzwerk, keine Handys. Der Server ist nur über `localhost` erreichbar. Internet braucht man einmalig für `git clone` und `npm install`.

Lokale Gameshow-Website für den Quiz-Abend am 18.12.2026. Ein Beamer zeigt die Show, der Gamemaster steuert sie vom Laptop aus.

---

## Schnellstart auf dem Laptop

### Einmalig: einrichten

1. **Node.js installieren.** Auf <https://nodejs.org> die Version **LTS** herunterladen und installieren (Standard-Einstellungen genügen).
   Prüfen im Terminal (Mac: „Terminal“, Windows: „PowerShell“):
   ```
   node --version
   ```
   Es muss eine Zahl ab `v22` erscheinen.
2. **Git installieren**, falls nicht vorhanden: <https://git-scm.com> (Mac: wird beim ersten `git`-Befehl automatisch angeboten).
3. **Repository klonen** (einmalig, z. B. in den Ordner „Dokumente“):
   ```
   cd ~/Documents
   git clone https://github.com/ArminCorn/Quiz-Night.git
   cd Quiz-Night
   npm install
   ```
   `npm install` braucht einmal Internet. Danach läuft alles offline.

### Am Abend: starten

1. Terminal öffnen und in den Ordner wechseln:
   ```
   cd ~/Documents/Quiz-Night
   npm start
   ```
   Im Terminal erscheinen die Adressen. Das Terminal-Fenster **offen lassen**. Schließen = Server aus.
   Der Server ist nur auf diesem Laptop erreichbar. Eine Firewall-Abfrage von Windows oder macOS erscheint deshalb normalerweise nicht. Falls doch: „Abbrechen“ ist richtig, es wird kein Netzwerkzugriff gebraucht.
2. **Bildschirm erweitern** (nicht spiegeln):
   - Windows: `Windows-Taste + P` → „Erweitern“
   - Mac: Systemeinstellungen → Displays → Beamer als „Erweiterter Bildschirm“ (nicht „Synchronisieren“)
3. **Gamemaster-Fenster** auf dem Laptop öffnen: <http://localhost:3000/host> (am besten Chrome oder Edge).
4. **Beamer-Fenster** öffnen: im Gamemaster-Fenster oben auf **„Beamer-Fenster öffnen“** klicken (oder <http://localhost:3000/screen> in einem neuen Fenster öffnen).
5. Das Beamer-Fenster auf den Beamer-Bildschirm ziehen und **Vollbild** schalten: **Doppelklick** ins Bild (alternativ `F11`, Mac: `Ctrl + Cmd + F`).
6. **Einmal ins Beamer-Fenster klicken**, damit der Browser Sounds erlaubt. Danach zurück ins Gamemaster-Fenster klicken. Die Tasten wirken nur dort.

Tipp: Energiesparen/Bildschirmsperre am Laptop für den Abend ausschalten.

### Updates holen

```
cd ~/Documents/Quiz-Night
git pull
npm install
npm start
```

`npm start` baut die Oberfläche jedes Mal frisch, Updates sind also sofort aktiv. Der Spielstand in `data/` bleibt bei Updates erhalten.

---

## Bedienung

### Tastaturkürzel (im Gamemaster-Fenster)

| Taste        | Kategorien            | Länderraten                                   |
|--------------|-----------------------|-----------------------------------------------|
| `Leertaste`  | Nächster Schritt      | Nächste Etappe / ohne Treffer auflösen / weiter |
| `1` / `2`    | Punkt für Team A / B  | Buzz manuell für Team A / B (falls die Hardware ausfällt) |
| `R` / `F`    | –                     | Antwort richtig / falsch                      |
| `A` / `L`    | –                     | Tastatur-Buzzer Team A / B (Ersatz für die echten Buzzer, änderbar) |
| `Z`          | Rückgängig            | Rückgängig                                    |

- `Leertaste` macht immer den Schritt, der oben unter „Nächster Schritt“ steht. `Z` nimmt die letzte Aktion zurück, beliebig oft hintereinander.
- Die Legende im Gamemaster-Fenster zeigt immer die gerade gültigen Tasten. Alles geht auch per Klick.
- In Eingabefeldern und mit `Strg`/`Cmd` wirken die Kürzel nicht (`Strg + R` lädt also weiterhin neu).

### Ablauf des Abends

```
Übersicht ──Leertaste──▶ Intro (Formatname groß)
          ──Leertaste──▶ Format läuft (Bauchbinde + Formatpunkte)
          ── … ───────▶ Format endet
          ──────────────▶ Formatsieger-Screen (wer hat gewonnen, mit Formatpunkten)
          ──Leertaste──▶ Zwischenstand (Gesamtstand + Globalpunkte daneben)
          ──Leertaste──▶ Globalpunkte wandern in den Gesamtstand (Zahlen zählen hoch)
          ──Leertaste──▶ Übersicht mit Gesamtstand und „Als Nächstes“
```

- **Formatpunkte** zählt jedes Format nach seinen eigenen Regeln. Sie stehen während des Formats unten rechts auf dem Beamer.
- **Globalpunkte:** Wer ein Format mit mehr Formatpunkten gewinnt, bekommt Globalpunkte, der Verlierer 0. Bei Gleichstand bekommen beide den vollen Wert. Wie viele, steht in `config.json` unter `globalpunkte` (siehe unten). Die Werte sind noch Platzhalter (10).
- **Gesamtpunkte** sind die Summe der Globalpunkte über den Abend. Sie erscheinen im Zwischenstand und in der Übersicht.
- **Korrekturen:** Im Gamemaster-Fenster unter „Punkte“ mit `−` und `+` (Formatpunkte während eines Formats, Gesamtpunkte jederzeit).
- **Format vorzeitig beenden:** Knopf „Format beenden“ (mit Rückfrage).
- **Anderes Format starten:** In der Übersicht rechts im „Ablauf des Abends“ auf „Starten“.
- **Teamnamen:** In der Übersicht im Gamemaster-Fenster ändern (oder vorab in `config.json`).

### Format „Kategorien“

1. Leertaste: Die nächste Kategorie erscheint groß auf dem Beamer.
2. Die Teams nennen abwechselnd Begriffe. Zeit und Zugwechsel regelst du mündlich (bewusst kein Timer, keine Anzeige, wer dran ist).
3. `1` oder `2`: Das Gewinnerteam holt den Punkt. Der Beamer blendet „Team X holt den Punkt“ ein.
   Passt eine Kategorie nicht: „Ohne Punkt weiter“.
4. Leertaste: nächste Kategorie. Nach der letzten Kategorie beendet die Leertaste das Format → Formatsieger → Zwischenstand.

Das Gamemaster-Fenster zeigt die aktuelle und die **nächste** Kategorie. Der Beamer kennt die nächste nicht.

### Format „Länderraten“

Pro Land werden vier Etappen nacheinander aufgedeckt und bleiben sichtbar. Je früher ein Team das Land errät, desto mehr Formatpunkte:

| Etappe | Inhalt | Punkte |
|---|---|---|
| 1 | Flaggenfarben (gleich große Felder, nach Helligkeit sortiert, ohne Anordnung) | 100 |
| 2 | Kontinent (Name + Weltkarte, nur der Kontinent hervorgehoben) | 75 |
| 3 | Länderumriss | 55 |
| 4 | Individueller Tipp | 40 |

Kein Treffer nach Etappe 4: 0 Punkte. Falsche Antworten kosten nichts. Die Punktwerte stehen in `formats/laender/content.json` (`"punkte"`).

**Ablauf einer Runde**
1. `Leertaste`: Etappe 1 erscheint, beide Buzzer sind frei. Der Beamer zeigt, wie viele Punkte im Spiel sind.
2. Ein Team buzzert. Der Beamer zeigt es groß („Team A antwortet“), alle Buzzer sind gesperrt. Das Team antwortet mündlich.
3. Bewerten:
   - `R` richtig: Das Team bekommt die Punkte der aktuellen Etappe, dann folgt sofort die Auflösung.
   - `F` falsch: Dieses Team ist für diese Etappe gesperrt, nur das andere Team darf noch buzzern.
4. Jedes Team buzzert höchstens einmal pro Etappe. Mit `Leertaste` deckst du jederzeit die nächste Etappe auf, auch wenn niemand gebuzzert hat. Dann sind beide wieder frei. Solange ein Team antwortet, ist die Leertaste gesperrt (erst `R` oder `F`).
5. Nach Etappe 4 ohne Treffer: `Leertaste` löst ohne Punkte auf. Vorzeitig geht das mit „Ohne Treffer auflösen“.
6. **Auflösung:** Ländername groß, Flagge, Umriss und wer in welcher Etappe wie viele Punkte bekam, oder „Niemand hat das Land erraten“. `Leertaste` → nächstes Land.
7. Nach dem letzten Land: `Leertaste` → Formatsieger → Zwischenstand.

Ländername und vollständige Flagge erreichen das Beamer-Fenster **nie vor der Auflösung**. Das Gamemaster-Fenster zeigt sie die ganze Zeit, dazu alle Etappen (die nächste als Vorschau), den Buzzer-Status beider Teams und die Formatpunkte. Mit „Beispiel“ markierte Länder sind die mitgelieferten Beispiele. Unvollständige Einträge werden übersprungen und oben als Warnung aufgelistet.

### Buzzer einrichten und testen

Die Buzzer (Arcade-Knöpfe an einem USB-Encoder) erscheinen im Browser als **ein Gamepad mit mehreren Knöpfen**.

1. Encoder einstecken, Gamemaster-Fenster öffnen, oben auf **„Buzzer“** klicken.
2. Einen beliebigen Buzzer drücken. Erst danach meldet der Browser das Gerät (Schutzregel der Browser). Unter „Gamepads (live)“ leuchtet der gedrückte Knopf.
3. Bei Team A auf **„Knopf zuordnen“** klicken und den Buzzer von Team A drücken. Dasselbe für Team B.
4. Jeden Buzzer einmal drücken: Die Testlampe des richtigen Teams muss aufleuchten.
5. Optional: Tasten für den Tastatur-Ersatz ändern (Standard `A` und `L`). Belegte Tasten wie `Z`, `R`, `F`, `1`, `2` werden abgelehnt.
6. **„Fertig“** oder `Esc`.

- Die Zuordnung steht in `data/settings.json`. Sie überlebt Neustarts und „Neues Spiel“.
- Solange der Testscreen offen ist, zählen Buzzes **nicht** im Spiel.
- **Ausfall der Hardware:** Tastatur-Buzzer (`A`/`L`, z. B. auf einer zweiten Tastatur für die Teams) oder manuell durch den Gamemaster (`1`/`2`).
- Ein Buzz zählt nur, wenn das Format den Buzzer gerade freigegeben hat. Sonst wird er still ignoriert. Der erste gültige Buzz sperrt sofort alle weiteren.
- **Wo werden die Buzzer gelesen?** Im Gamemaster-Fenster, das am Abend den Fokus hat, und zusätzlich im Beamer-Fenster als Rückfallebene. Je nach Browser und Betriebssystem bekommt manchmal nur ein Fenster die Gamepad-Daten. So kommt der Buzz trotzdem an. Doppelte Meldungen ergeben nur einen Buzz. Das Beamer-Fenster darf nichts anderes steuern als buzzern.
- Drücken beide Teams im selben Abfragetakt des Browsers (etwa 16 ms), entscheidet das Los.
- Die Gamepad-API funktioniert nur auf „sicheren“ Seiten. `http://localhost` gehört dazu, deshalb bitte genau diese Adresse benutzen.

### Absturzsicherheit

- Der Spielstand wird nach **jeder** Aktion in `data/state.json` gespeichert.
- Fenster neu laden, Browser abgestürzt, Server neu gestartet: Beim Start wird der letzte Stand wiederhergestellt, inklusive Rückgängig-Verlauf.
- Fällt der Server aus, verbinden sich beide Fenster automatisch neu, sobald er wieder läuft (`npm start`).
- **„Neues Spiel“** (oben rechts im Gamemaster-Fenster) setzt alles zurück (mit Rückfrage). Die Teamnamen bleiben. Der alte Stand wird als `data/state.backup-<Datum>.json` aufgehoben.

---

## Inhalte pflegen

### Kategorien

Datei: `formats/kategorien/content.json`. Die Reihenfolge in der Datei ist die Spielreihenfolge.

```json
{
  "categories": [
    "Tiere im Zoo",
    "Obstsorten",
    { "title": "Hauptstädte Europas", "note": "Notiz nur für den Gamemaster" }
  ]
}
```

- Ein Eintrag ist entweder ein Text oder ein Objekt mit `title` und optional `note`.
- Die mitgelieferten Einträge beginnen mit „Beispiel:“ und müssen ersetzt werden.
- Änderungen greifen beim nächsten Start des Formats (kein Neustart nötig).
- Achtung JSON: Texte in `"…"`, zwischen Einträgen ein Komma, nach dem letzten keins.

### Länder (Länderraten)

**Neues Land anlegen** (einmal `npm install` vorher, danach offline):

```
npm run land -- DE
```

Das Skript erzeugt aus dem ISO-Code (zwei Buchstaben, z. B. `FR`, `JP`, `BR`) alles außer dem Tipp:
- **Flagge** `formats/laender/assets/flaggen/de.svg`
- **Umriss** `…/umrisse/de.svg` (nur Kernterritorium) und `…/umrisse/de-voll.svg` (mit allen Gebieten)
- **Eintrag** in `formats/laender/content.json` mit deutschem Namen, Kontinent-Vorschlag und Flaggenfarben. Er ersetzt den ersten `[LAND EINTRAGEN]`-Platzhalter oder wird hinten angehängt.

Danach von Hand:
1. **Tipp eintragen:** `"tipp": "[TIPP EINTRAGEN]"` ersetzen. Bis dahin wird das Land im Spiel übersprungen (Warnung im Gamemaster-Fenster).
2. **Farben prüfen:** Das Skript gibt die gefundenen Farben mit Flächenanteil aus. Es zählt die Pixel der gerenderten Flagge. Details unter 2 % (Wappen, Schrift) und Mischfarben an Kanten werden ignoriert, sehr ähnliche Töne zusammengefasst. Kleinere Farbflächen stehen als „zur Prüfung“ in der Ausgabe.
   - Gehört so eine Farbe zur Flagge (z. B. das Weiß in Brasiliens Band), entweder in `"farben"` ergänzen oder neu erzeugen mit niedrigerer Schwelle: `npm run land -- BR --min 0.8`
   - Die Reihenfolge der Farben in der JSON ist egal, der Beamer sortiert nach Helligkeit.
3. **Kontinent prüfen:** Bei Grenzfällen (z. B. Russland, Türkei) meldet das Skript, welche Kontinente noch passen. Erlaubt: `Europa`, `Asien`, `Afrika`, `Nordamerika`, `Südamerika`, `Ozeanien`.
4. **Name** bei Bedarf kürzen (z. B. „Vereinigte Staaten“ statt der amtlichen Form).

Ein Eintrag in `content.json`:

```json
{
  "iso": "JP",
  "name": "Japan",
  "kontinent": "Asien",
  "farben": ["#BC002D", "#FFFFFF"],
  "umriss": "umrisse/jp.svg",
  "flagge": "flaggen/jp.svg",
  "tipp": "Heimat von Sushi, Shinkansen und Kirschblütenfesten.",
  "nurKernterritorium": true,
  "beispiel": false
}
```

- `nurKernterritorium`: `true` zeigt nur das Kernterritorium. Weit entfernte Gebiete (mehr als 300 km vom Rest) fallen weg, z. B. bei Frankreich die Überseegebiete, bei den USA Alaska und Hawaii. `false` nimmt automatisch `…-voll.svg`. Wer die Grenze anders will: `npm run land -- NO --km 700`.
- `beispiel`: `true` markiert das Land im Gamemaster-Fenster als Beispiel.
- **Reihenfolge** in `"laender"` = Spielreihenfolge. Einträge mit `[LAND EINTRAGEN]`/`[TIPP EINTRAGEN]` oder fehlenden Dateien werden übersprungen.
- Ein Land erneut mit dem Skript erzeugen: Flagge, Umriss und Farben werden neu geschrieben. Name, Kontinent, Tipp und die Schalter bleiben.
- Die mitgelieferten Japan, Brasilien und Schweden sind Beispiele mit Beispiel-Tipps, die 7 übrigen Einträge Platzhalter.
- Die Weltkarte (`assets/weltkarte.svg`) ist fertig. `npm run weltkarte` erzeugt sie bei Bedarf neu.

### Allgemeine Einstellungen: `config.json`

```json
{
  "title": "Quiz Night",
  "subtitle": "18.12.2026",
  "teams": { "A": "Team A", "B": "Team B" },
  "formatOrder": ["kategorien", "quiz", "laender", "wavelength", "bluff", "familyfeud"],
  "globalpunkte": { "sieger": 10, "formate": {} },
  "buzzer": { "keys": { "A": "a", "B": "l" } },
  "port": 3000
}
```

- `globalpunkte.sieger`: Globalpunkte für den Formatsieger (bei Gleichstand für beide). **Platzhalter**, der echte Wert steht noch nicht fest.
- `globalpunkte.formate`: abweichender Wert für einzelne Formate, z. B. `{ "familyfeud": 20 }`.
- `buzzer.keys`: Standardtasten für den Tastatur-Ersatz. Im Buzzer-Testscreen änderbar, dort gespeicherte Tasten gehen vor.
- `teams`: Startnamen der Teams (änderbar auch im Gamemaster-Fenster).
- `formatOrder`: Reihenfolge der Formate in der Kapitelleiste. Änderungen greifen nach Neustart des Servers.
- `port`: Falls 3000 belegt ist, eine andere Zahl eintragen (die Adressen ändern sich entsprechend).

### Sounds ergänzen

Audiodateien in den Ordner `sounds/` legen. Der Dateiname ohne Endung ist der Name des Sounds:

| Datei               | Wann                                                 |
|---------------------|------------------------------------------------------|
| `formatIntro.mp3`   | Format startet (Intro-Screen)                        |
| `reveal.mp3`        | Kategorie wird aufgedeckt · Länderraten: Auflösung   |
| `roundEnd.mp3`      | Kategorien: Team holt den Rundenpunkt                |
| `buzz.mp3`          | Ein Team hat gebuzzert                               |
| `correct.mp3`       | Länderraten: richtige Antwort                        |
| `wrong.mp3`         | Länderraten: falsche Antwort                         |
| `scoreUpdate.mp3`   | Globalpunkte werden in den Gesamtstand übernommen    |

Erlaubt sind `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`, `.webm`, `.flac`. Fehlt eine Datei, passiert nichts. Neue Dateien erkennt das Beamer-Fenster beim Neuladen. Sounds spielen nur im Beamer-Fenster (nicht doppelt im Gamemaster-Fenster).

---

## Neues Format anlegen

Ein Format ist ein Ordner unter `formats/` plus ein Eintrag in `formats/index.js`. **Der Kern (`server/`, `web/`) wird nicht angefasst.**

### Ordnerstruktur

```
formats/
  index.js              ← Registry: id, Name, Farbe aller Formate
  kategorien/           ← fertiges Format als Vorlage
  meinformat/
    server.js           ← Zustandslogik (läuft im Server, reines JavaScript)
    client.js           ← Beamer-Ansicht + Gamemaster-Steuerung (läuft im Browser)
    content.json        ← Inhalte (optional)
    format.css          ← eigene Styles (optional, Klassen mit eigenem Präfix)
```

Ein Format ist **spielbar**, sobald `server.js` **und** `client.js` existieren. Ohne Ordner erscheint es nur in der Kapitelleiste („noch nicht gebaut“).

### Schnittstelle `server.js`

```js
export default {
  // Startzustand. content = Inhalt von content.json (oder null). Muss JSON-fähig sein.
  init(content, api) { return { … }; },

  // Aktionen, die die Gamemaster-Ansicht auslösen kann.
  // state darf direkt verändert werden (oder einen neuen Zustand zurückgeben).
  actions: {
    next(state, payload, api) { … },   // Sonderrolle: wird von der Leertaste ausgelöst
    meineAktion(state, payload, api) { … },
  },

  // Optional: was welche Rolle sehen darf ('screen' | 'host').
  // Standard: alle sehen den ganzen Zustand.
  view(state, role) { return { … }; },

  // Optional: ein Team hat gebuzzert (nur wenn das Format Buzzer freigegeben hat).
  // Der Kern hat da schon alle Buzzer gesperrt und den Sound „buzz“ gespielt.
  onBuzz(state, team, api) { … },
};
```

Das `api`-Objekt:

| Aufruf                    | Wirkung                                                            |
|---------------------------|--------------------------------------------------------------------|
| `api.teams`               | `{ A: 'Name', B: 'Name' }`                                         |
| `api.addPoints(team, n)`  | Formatpunkte vergeben (`team` = `'A'` oder `'B'`, `n` auch negativ) |
| `api.sound(name)`         | Sound im Beamer-Fenster abspielen (z. B. `'correct'`)              |
| `api.endFormat()`         | Format beenden → Zwischenstand                                     |
| `api.label(text)`         | Beschriftung für „Rückgängig: …“                                  |
| `api.fail(message)`       | Aktion ablehnen. Der Text erscheint als Hinweis beim Gamemaster, der Zustand bleibt unverändert. |
| `api.cleanText(wert, { max, label, allowEmpty })` | Text aus einer Eingabemaske prüfen: getrimmt, Leerraum vereinheitlicht, Länge begrenzt. Wirft bei Fehlern eine verständliche Meldung. |
| `api.cleanInt(wert, { min, max, label })` | Ganze Zahl aus einer Eingabemaske prüfen (auch `"3"` als Text), mit Grenzen. |
| `api.buzzer.open(['A','B'])` | Buzzer freigeben (beide oder nur ein Team, z. B. `['B']`). Der erste gültige Buzz sperrt automatisch alle und ruft `onBuzz` auf. |
| `api.buzzer.lock()`       | Alle Buzzer sperren (wer zuletzt gebuzzert hat, bleibt sichtbar). |
| `api.buzzer.reset()`      | Alle sperren und den letzten Buzz vergessen.                       |
| `api.buzzer.state`        | `{ open: { A, B }, winner }`                                       |

Am Formatende bekommt der Sieger (mehr Formatpunkte) automatisch die Globalpunkte aus `config.json`. Das Format muss dafür nichts tun.

### Eingabemasken für Papierkarten-Inhalte

Die Spieler benutzen keine Handys. Was sie auf Karten schreiben, tippt der Gamemaster ein. Ein Format darf dafür in `mountHost` beliebige Eingabefelder anbieten. Der Kern liefert dazu allgemeine Bausteine in `web/core/forms.js` (es gibt noch keine fertige Maske):

```js
import { textField, numberField, rowsEditor } from '@core/forms.js';

mountHost(root, { send, toast, formatId }) {
  const editor = rowsEditor({
    draftKey: `${formatId}:antworten`,      // rettet den Entwurf bei Neuladen/Absturz
    columns: [
      { key: 'name', label: 'Name / Nr.', placeholder: 'z. B. 3' },
      { key: 'text', label: 'Antwort', wide: true },
    ],
    minRows: 6,
    submitLabel: 'Antworten übernehmen',
    onSubmit: (rows) => send('saveAnswers', { rows }),   // [{ name, text }, …]
  });
  root.append(editor.el);
  return { update(fv) { /* nur anzeigen, die Felder nicht neu bauen */ } };
}
```

Und in `server.js` prüft die Aktion alles, bevor es im Zustand landet:

```js
saveAnswers(state, { rows }, api) {
  if (!Array.isArray(rows) || rows.length > 30) api.fail('Zu viele Zeilen.');
  state.answers = rows.map((r) => ({
    name: api.cleanText(r.name, { max: 40, label: 'Name' }),
    text: api.cleanText(r.text, { max: 200, label: 'Antwort' }),
  }));
  api.label('Antworten eingetragen');
},
```

Die Bausteine halten diese Regeln ein, die auch für eigene Masken gelten:
- **Maske einmal bauen, in `update()` nur nachführen.** `field.set(wert)` überschreibt nie ein Feld, in das gerade getippt wird. So kostet eine Änderung von außen (z. B. Punktekorrektur) keine Eingabe.
- **Tasten stören nicht:** Solange ein Eingabefeld den Fokus hat, sind Leertaste, `1`, `2` und `Z` ausgeschaltet. `Strg + Z` macht im Feld das normale Rückgängig.
- **Entwurf bleibt erhalten:** Abgetipptes steht im Browser (`localStorage`) und überlebt Neuladen. Er bleibt, bis das Format `editor.clear()` aufruft. Am besten erst, wenn der Zustand zeigt, dass der Server die Eingabe übernommen hat, denn `send()` meldet nur, dass abgeschickt wurde, nicht, dass der Server sie akzeptiert hat. Lehnt der Server ab (`api.fail`), erscheint die Meldung als Hinweis und der Entwurf bleibt. Mit `editor.setRows(…)` holt man gespeicherte Zeilen zum Korrigieren zurück in die Maske.
- **Abgeschicktes ist normaler Zustand:** Es geht als Aktion an den Server, wird dort geprüft, gespeichert und ist rückgängig machbar wie alles andere.
- **Abstimmen per Karten:** Das Ergebnis (z. B. Stimmen pro Antwort) tippt der Gamemaster mit `numberField` oder einer `rowsEditor`-Spalte `type: 'number'` ein.

Der Kern kümmert sich um Rückgängig, Speichern, Synchronisieren, Formatpunkte, Zwischenstand und Gesamtpunkte. Ändert eine Aktion nichts, landet sie nicht im Rückgängig-Verlauf.

### Schnittstelle `client.js`

```js
import { h, setText, fitText, replay } from '@core/dom.js';  // kleine DOM-Helfer
import './format.css';                                         // optional

export default {
  // Zusatz in der Bauchbinde: „FORMATNAME · <Text>“ (oder null)
  lowerThird(fv, view) { return 'Runde 3'; },

  // Anzeige „Nächster Schritt“ im Gamemaster-Fenster (was die Leertaste tut)
  nextStep(fv, view) { return { label: 'Frage 2 zeigen', detail: 'optional', disabled: false }; },

  // Zusätzliche Tasten. Leertaste und Z sind vom Kern belegt, A/L (änderbar) vom Tastatur-Buzzer.
  shortcuts: [
    { key: '1', action: 'point', payload: { team: 'A' }, label: (view) => `Punkt für ${view.teams.A}` },
    { key: '9', buzz: 'A', label: 'Buzz manuell Team A' },   // statt action: manueller Buzz
  ],

  // Optional: true, wenn das Format Buzzer benutzt (zeigt die Tastatur-Buzzer in der Legende)
  buzzer: true,

  // Beamer: root ist die Inhaltsfläche in der Bildmitte (Bühne 1920×1080).
  mountScreen(root, ctx) {
    return {
      update(fv, view, { animate, entering, prev }) { … },
      destroy() { … },  // optional
    };
  },

  // Gamemaster: send(aktion, payload) schickt eine Aktion an server.js,
  // toast(text) zeigt einen kurzen Hinweis, formatId ist die id des Formats.
  // Hier dürfen auch Eingabemasken stehen (siehe „Eingabemasken“ unten).
  // buzz(team) löst einen manuellen Buzz aus.
  mountHost(root, { send, buzz, toast, formatId }) {
    return { update(fv, view) { … }, destroy() { … } };
  },
};
```

- `fv` ist das, was `view(state, role)` aus `server.js` liefert. `view` ist die gemeinsame Ansicht (`teams`, `formatPoints`, `totalPoints`, `current`, `chapters`, `phase`).
- `animate` ist `true`, wenn die Änderung live durch eine Aktion kam. Bei Neuladen und Rückgängig ist es `false`, dann bitte **ohne** Animation zeichnen.
- `view.buzzer` ist `{ open: { A, B }, winner }`, damit Beamer und Gamemaster den Buzzer-Status zeigen können.
- Bauchbinde, Formatpunkte, Kapitelleiste, Intro, Formatsieger und Zwischenstand liefert der Kern automatisch.
- Die Formatfarbe steht in CSS als `var(--fc)` zur Verfügung.

### Vollständiges Beispiel: „Klassisches Quiz“ in Minimalform

Getestet: Diese drei Dateien in `formats/quiz/` legen. Der Registry-Eintrag `quiz` existiert schon. Nach `npm start` ist das Format spielbar.

`formats/quiz/content.json`
```json
{
  "questions": [
    { "q": "Beispiel: Wie viele Beine hat eine Spinne?", "a": "Acht" },
    { "q": "Beispiel: Hauptstadt von Kanada?", "a": "Ottawa" }
  ]
}
```

`formats/quiz/server.js`
```js
export default {
  init(content) {
    return { questions: content?.questions ?? [], index: -1, showAnswer: false };
  },

  actions: {
    // Leertaste: Frage zeigen → Antwort zeigen → nächste Frage → … → Format beenden
    next(s, payload, api) {
      if (s.index >= 0 && !s.showAnswer) {
        s.showAnswer = true;
        api.sound('reveal');
        api.label('Antwort gezeigt');
        return;
      }
      if (s.index + 1 >= s.questions.length) return api.endFormat();
      s.index += 1;
      s.showAnswer = false;
      api.label(`Frage ${s.index + 1}`);
    },

    // Taste 1 / 2
    point(s, { team }, api) {
      api.addPoints(team, 1);
      api.sound('correct');
      api.label(`Punkt für ${api.teams[team]}`);
    },
  },

  // Der Beamer sieht die Antwort erst, wenn sie aufgedeckt ist.
  view(s, role) {
    const q = s.questions[s.index];
    return {
      nr: s.index + 1,
      question: q?.q ?? null,
      answer: role === 'host' || s.showAnswer ? (q?.a ?? null) : null,
      showAnswer: s.showAnswer,
    };
  },
};
```

`formats/quiz/client.js`
```js
import { h, setText } from '@core/dom.js';

export default {
  lowerThird: (fv) => (fv.nr > 0 ? `Frage ${fv.nr}` : null),

  nextStep: (fv) => ({ label: fv.nr > 0 && !fv.showAnswer ? 'Antwort zeigen' : 'Nächste Frage' }),

  shortcuts: [
    { key: '1', action: 'point', payload: { team: 'A' }, label: (v) => `Punkt für ${v.teams.A}` },
    { key: '2', action: 'point', payload: { team: 'B' }, label: (v) => `Punkt für ${v.teams.B}` },
  ],

  mountScreen(root) {
    const question = h('div', { class: 'display', style: { 'font-size': '96px', 'text-align': 'center' } });
    const answer = h('div', { class: 'label', style: { 'font-size': '40px', color: 'var(--fc)' } });
    root.append(h('div', { style: { display: 'grid', gap: '40px', 'justify-items': 'center' } }, question, answer));
    return {
      update(fv) {
        setText(question, fv.question ?? '');
        setText(answer, fv.showAnswer ? fv.answer : '');
      },
    };
  },

  mountHost(root) {
    const info = h('p');
    root.append(info);
    return {
      update(fv) {
        setText(info, fv.question ? `${fv.question} → ${fv.answer}` : 'Leertaste zeigt die erste Frage.');
      },
    };
  },
};
```

### Checkliste für ein neues Format

- [ ] Eintrag in `formats/index.js` mit `id` (Kleinbuchstaben, Ziffern, `-`), `name` und `color` aus der Testbild-Palette (nur nötig, wenn die id noch nicht drinsteht).
- [ ] Ordner `formats/<id>/` mit `server.js` und `client.js` (Ordnername = id).
- [ ] `init` liefert einen JSON-fähigen Zustand (keine Funktionen, keine `Date`-Objekte, keine Klassen).
- [ ] Aktionen ändern nur `state` und benutzen `api` für Punkte, Sounds, Formatende.
- [ ] Ungültige Aktionen mit `api.fail('…')` ablehnen, eingetippte Werte mit `api.cleanText` / `api.cleanInt` prüfen.
- [ ] Geheimes (Antworten, nächste Inhalte) in `view(state, role)` nur an `'host'` geben.
- [ ] `actions.next` definieren, wenn die Leertaste etwas tun soll, und `nextStep` passend beschriften.
- [ ] Animationen nur bei `animate === true` abspielen.
- [ ] Eingabemasken einmal bauen und in `update()` nur nachführen (Bausteine aus `@core/forms.js`).
- [ ] Eigene CSS-Klassen mit Präfix (z. B. `quiz-…`), keine Farbverläufe, Glows oder Emoji.
- [ ] Beispiel-Inhalte in `content.json` klar als „Beispiel“ kennzeichnen.
- [ ] Optional: Tests in `test/` (siehe `test/kategorien.test.js`), dann `npm test`.
- [ ] `npm start`, das Format im Gamemaster-Fenster durchspielen, Neuladen und Rückgängig prüfen.

---

## Papier-Workflow für spätere Formate

Die Spieler benutzen keine Handys und kein Gerät im Netzwerk. Alles, was Spieler eingeben würden (z. B. beim Bluff-Format), läuft über Papier:

1. **Spieler schreiben auf Karten.** Zum Beispiel eine erfundene Antwort plus Name oder Nummer des Teams.
2. **Der Gamemaster sammelt die Karten ein** und tippt den Inhalt in der Gamemaster-Ansicht in eine Eingabemaske ein (Bausteine: „Eingabemasken für Papierkarten-Inhalte“ oben). Der Beamer zeigt die Antworten erst, wenn der Gamemaster sie freigibt.
3. **Abgestimmt wird mit hochgehaltenen Karten.** Der Gamemaster zählt und tippt das Ergebnis pro Antwort ein.
4. **Punkte** vergibt das Format danach über `api.addPoints` wie bei jedem anderen Format.

Beim Bauen des Bluff-Formats greifen wir das wieder auf: Eingabemaske für die Antworten, Eingabemaske für die Stimmen, Antworten gemischt auf dem Beamer.

---

## Technik

### Aufbau

```
server/
  index.js       HTTP + WebSocket (/ws), Seiten /screen /host, lauscht nur auf 127.0.0.1
  engine.js      Kernaktionen und Phasen (Übersicht, Intro, Format, Zwischenstand), Ansichten je Rolle
  store.js       Zustand, Rückgängig-Verlauf, Speichern in data/state.json
  registry.js    liest formats/index.js, lädt server.js der Formate
  settings.js    Geräte-Einstellungen (Buzzer-Zuordnung) in data/settings.json
formats/         Formate (siehe oben)
  laender/assets/  Flaggen, Umrisse, Weltkarte (vom Länder-Skript erzeugt)
scripts/         Werkzeuge: land.js (npm run land), weltkarte.js
web/
  core/          Verbindung, Sound-Modul, Buzzer-Eingang (buzzer.js), DOM-Helfer, Eingabe-Bausteine (forms.js), Format-Lader, Bühnen-Skalierung
  screen/        Beamer-Ansicht (Kapitelleiste, Bauchbinde, Punkteanzeige, Szenen)
  host/          Gamemaster-Ansicht, Buzzer-Testscreen
  styles/        Farben, Schriften
sounds/          Audiodateien (siehe sounds/README.md)
data/            gespeicherter Spielstand und Buzzer-Zuordnung (nicht im Repository)
config.json      Titel, Teamnamen, Formatreihenfolge, Globalpunkte, Buzzer-Tasten, Port
test/            automatische Tests (npm test)
```

- **Der Zustand liegt nur auf dem Server.** Die Fenster schicken Aktionen und bekommen nach jeder Änderung die passende Ansicht zurück. Der Beamer sieht keine Geheimnisse.
- **Nur das Gamemaster-Fenster darf steuern.** Eingaben der Spieler gibt es nicht: Sie schreiben auf Papierkarten, der Gamemaster tippt ein (siehe „Papier-Workflow“).
- **Nur lokal:** Der Server lauscht auf `127.0.0.1` und lehnt Anfragen mit fremdem Host- oder Origin-Header ab. Andere Geräte und andere Webseiten im Browser können ihn nicht erreichen.
- **Buzzer:** Gamepad-API (Gamemaster-Fenster, Beamer-Fenster als Rückfallebene), Tastatur-Ersatz oder manuell. Alle lösen dieselbe Kernaktion `buzz` aus. Der Server entscheidet, welcher Buzz zählt.
- **Frontend:** Vite mit Vanilla JS. Die drei Ansichten sind einfach, der Zustand liegt auf dem Server. Ein Framework brächte hier nur Ballast. Schriften (Archivo, Space Mono) kommen lokal aus `@fontsource`.

### Befehle

| Befehl          | Wirkung                                                         |
|-----------------|-----------------------------------------------------------------|
| `npm start`     | Oberfläche bauen und Server starten (für den Abend)             |
| `npm run dev`   | Entwicklungsmodus mit sofortigem Neuladen bei Code-Änderungen   |
| `npm run serve` | Nur den Server starten (ohne neu zu bauen)                      |
| `npm test`      | Automatische Tests                                              |
| `npm run land -- DE` | Land für Länderraten anlegen (Flagge, Umriss, Farben, Eintrag) |
| `npm run weltkarte`  | Weltkarte für Länderraten neu erzeugen (normalerweise nicht nötig) |

### Probleme?

| Problem                                   | Lösung                                                                 |
|-------------------------------------------|------------------------------------------------------------------------|
| „Port 3000 ist schon belegt“              | Läuft Quiz Night schon in einem anderen Terminal? Sonst `port` in `config.json` ändern. |
| Kein Ton                                  | Einmal ins Beamer-Fenster klicken. Datei in `sounds/` richtig benannt? Beamer-Fenster neu laden. |
| Tasten reagieren nicht                    | Ins Gamemaster-Fenster klicken (die Tasten wirken nur dort, nicht in Eingabefeldern). |
| Gamemaster zeigt „getrennt“               | Läuft das Terminal mit `npm start` noch? Neu starten, die Fenster verbinden sich selbst. |
| Etwas falsch geklickt                     | `Z` (Rückgängig), beliebig oft.                                        |
| `localhost` lädt nicht                    | Stattdessen <http://127.0.0.1:3000/host> und <http://127.0.0.1:3000/screen> öffnen. |
| Buzzer reagieren nicht                    | Testscreen öffnen („Buzzer“) und einen Knopf drücken. Steht dort „Kein Gamepad erkannt“: Encoder neu einstecken, Knopf drücken. Leuchtet der Knopf, aber keine Testlampe: neu zuordnen. Im Spiel zählt ein Buzz nur, wenn gerade freigegeben ist. Notfalls Tastatur-Buzzer (`A`/`L`) oder manuell (`1`/`2`). |
| Land wird übersprungen                    | Die Warnung im Gamemaster-Fenster nennt den Grund (z. B. „Tipp fehlt“). |

### Quellen und Lizenzen (Länderraten)

Alle Daten kommen aus npm-Paketen mit fester Version (`package-lock.json`). Sie werden nur von den Skripten benutzt, **nie zur Laufzeit**. Die erzeugten Dateien liegen im Repository.

| Was | Quelle | Lizenz |
|---|---|---|
| Flaggen (SVG, Farbwerte) | [`svg-country-flags`](https://www.npmjs.com/package/svg-country-flags), aus Wikimedia Commons | gemeinfrei (Public Domain) |
| Ländergrenzen, Umrisse, Weltkarte | [Natural Earth](https://www.naturalearthdata.com/) 1:10m und 1:110m über [`world-atlas`](https://www.npmjs.com/package/world-atlas) | Daten gemeinfrei, Paket ISC |
| Projektion, Geometrie | [`d3-geo`](https://www.npmjs.com/package/d3-geo), [`topojson-client`](https://www.npmjs.com/package/topojson-client) | ISC |
| Deutsche Ländernamen, ISO-Codes | [`i18n-iso-countries`](https://www.npmjs.com/package/i18n-iso-countries) | MIT |
| Kontinent-Vorschlag | [`countries-list`](https://www.npmjs.com/package/countries-list) | MIT |
| Rendern der Flaggen zum Farbenzählen | [`@resvg/resvg-wasm`](https://www.npmjs.com/package/@resvg/resvg-wasm) | MPL-2.0 |

Hinweis: Grenzen sind Darstellungen von Natural Earth und keine politische Aussage.
