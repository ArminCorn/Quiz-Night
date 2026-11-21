# Quiz Night

Lokale Gameshow-Website für den Quiz-Abend am 18.12.2026. Ein Beamer zeigt die Show, der Gamemaster steuert sie vom Laptop aus. Alles läuft offline auf dem Laptop.

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

| Taste        | Wirkung                                                                |
|--------------|------------------------------------------------------------------------|
| `Leertaste`  | Nächster Schritt (was genau passiert, steht oben unter „Nächster Schritt“) |
| `1`          | Kategorien: Punkt für Team A                                           |
| `2`          | Kategorien: Punkt für Team B                                           |
| `Z`          | Rückgängig (letzte Aktion, beliebig oft hintereinander)               |

Die Legende im Gamemaster-Fenster zeigt immer die gerade gültigen Tasten. Alles geht auch per Klick.

### Ablauf des Abends

```
Übersicht ──Leertaste──▶ Intro (Formatname groß)
          ──Leertaste──▶ Format läuft (Bauchbinde + Formatpunkte)
          ── … ───────▶ Format endet
          ──────────────▶ Zwischenstand (Formatpunkte noch daneben)
          ──Leertaste──▶ Punkte wandern in den Gesamtstand (Zahlen zählen hoch)
          ──Leertaste──▶ Übersicht mit Gesamtstand und „Als Nächstes“
```

- **Formatpunkte** laufen während eines Formats und stehen unten rechts auf dem Beamer.
- **Gesamtpunkte** sammeln sich über den Abend und erscheinen im Zwischenstand und in der Übersicht.
- **Korrekturen:** Im Gamemaster-Fenster unter „Punkte“ mit `−` und `+` (Formatpunkte während eines Formats, Gesamtpunkte jederzeit).
- **Format vorzeitig beenden:** Knopf „Format beenden“ (mit Rückfrage).
- **Anderes Format starten:** In der Übersicht rechts im „Ablauf des Abends“ auf „Starten“.
- **Teamnamen:** In der Übersicht im Gamemaster-Fenster ändern (oder vorab in `config.json`).

### Format „Kategorien“

1. Leertaste: Die nächste Kategorie erscheint groß auf dem Beamer.
2. Die Teams nennen abwechselnd Begriffe. Zeit und Zugwechsel regelst du mündlich (bewusst kein Timer, keine Anzeige, wer dran ist).
3. `1` oder `2`: Das Gewinnerteam holt den Punkt. Der Beamer blendet „Team X holt den Punkt“ ein.
   Passt eine Kategorie nicht: „Ohne Punkt weiter“.
4. Leertaste: nächste Kategorie. Nach der letzten Kategorie beendet die Leertaste das Format → Zwischenstand.

Das Gamemaster-Fenster zeigt die aktuelle und die **nächste** Kategorie. Der Beamer kennt die nächste nicht.

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

### Allgemeine Einstellungen: `config.json`

```json
{
  "title": "Quiz Night",
  "subtitle": "18.12.2026",
  "teams": { "A": "Team A", "B": "Team B" },
  "formatOrder": ["kategorien", "quiz", "laender", "wavelength", "bluff", "familyfeud"],
  "port": 3000
}
```

- `teams`: Startnamen der Teams (änderbar auch im Gamemaster-Fenster).
- `formatOrder`: Reihenfolge der Formate in der Kapitelleiste. Änderungen greifen nach Neustart des Servers.
- `port`: Falls 3000 belegt ist, eine andere Zahl eintragen (die Adressen ändern sich entsprechend).

### Sounds ergänzen

Audiodateien in den Ordner `sounds/` legen. Der Dateiname ohne Endung ist der Name des Sounds:

| Datei               | Wann                                                 |
|---------------------|------------------------------------------------------|
| `formatIntro.mp3`   | Format startet (Intro-Screen)                        |
| `reveal.mp3`        | Kategorie wird aufgedeckt                            |
| `roundEnd.mp3`      | Team holt den Rundenpunkt                            |
| `scoreUpdate.mp3`   | Zwischenstand wird übernommen                        |
| `correct.mp3`, `wrong.mp3` | reserviert für spätere Formate                |

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

  // Optional: was welche Rolle sehen darf ('screen' | 'host' | 'play').
  // Standard: alle sehen den ganzen Zustand.
  view(state, role) { return { … }; },
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

  // Zusätzliche Tasten. Leertaste und Z sind vom Kern belegt.
  shortcuts: [
    { key: '1', action: 'point', payload: { team: 'A' }, label: (view) => `Punkt für ${view.teams.A}` },
  ],

  // Beamer: root ist die Inhaltsfläche in der Bildmitte (Bühne 1920×1080).
  mountScreen(root, ctx) {
    return {
      update(fv, view, { animate, entering, prev }) { … },
      destroy() { … },  // optional
    };
  },

  // Gamemaster: send(aktion, payload) schickt eine Aktion an server.js
  mountHost(root, { send }) {
    return { update(fv, view) { … }, destroy() { … } };
  },
};
```

- `fv` ist das, was `view(state, role)` aus `server.js` liefert. `view` ist die gemeinsame Ansicht (`teams`, `formatPoints`, `totalPoints`, `current`, `chapters`, `phase`).
- `animate` ist `true`, wenn die Änderung live durch eine Aktion kam. Bei Neuladen und Rückgängig ist es `false`, dann bitte **ohne** Animation zeichnen.
- Bauchbinde, Formatpunkte, Kapitelleiste, Intro und Zwischenstand liefert der Kern automatisch.
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
- [ ] Ungültige Aktionen mit `api.fail('…')` ablehnen.
- [ ] Geheimes (Antworten, nächste Inhalte) in `view(state, role)` nur an `'host'` geben.
- [ ] `actions.next` definieren, wenn die Leertaste etwas tun soll, und `nextStep` passend beschriften.
- [ ] Animationen nur bei `animate === true` abspielen.
- [ ] Eigene CSS-Klassen mit Präfix (z. B. `quiz-…`), keine Farbverläufe, Glows oder Emoji.
- [ ] Beispiel-Inhalte in `content.json` klar als „Beispiel“ kennzeichnen.
- [ ] Optional: Tests in `test/` (siehe `test/kategorien.test.js`), dann `npm test`.
- [ ] `npm start`, das Format im Gamemaster-Fenster durchspielen, Neuladen und Rückgängig prüfen.

---

## Technik

### Aufbau

```
server/
  index.js       HTTP + WebSocket (/ws), Seiten /screen /host /play, lauscht auf 0.0.0.0
  engine.js      Kernaktionen und Phasen (Übersicht, Intro, Format, Zwischenstand), Ansichten je Rolle
  store.js       Zustand, Rückgängig-Verlauf, Speichern in data/state.json
  registry.js    liest formats/index.js, lädt server.js der Formate
formats/         Formate (siehe oben)
web/
  core/          Verbindung, Sound-Modul, DOM-Helfer, Format-Lader, Bühnen-Skalierung
  screen/        Beamer-Ansicht (Kapitelleiste, Bauchbinde, Punkteanzeige, Szenen)
  host/          Gamemaster-Ansicht
  play/          Platzhalter für Spieler-Handys („Kommt bald“)
  styles/        Farben, Schriften
sounds/          Audiodateien (siehe sounds/README.md)
data/            gespeicherter Spielstand (nicht im Repository)
config.json      Titel, Teamnamen, Formatreihenfolge, Port
test/            automatische Tests (npm test)
```

- **Der Zustand liegt nur auf dem Server.** Die Fenster schicken Aktionen und bekommen nach jeder Änderung die passende Ansicht zurück. Der Beamer sieht keine Geheimnisse.
- **Nur das Gamemaster-Fenster darf steuern.** Spätere Handy-Aktionen (Bluff) kommen als eigene Rolle `play` dazu.
- **Buzzer (später):** Die Gamepad-API im Gamemaster-Fenster löst dieselben Aktionen aus wie die Tasten.
- **Frontend:** Vite mit Vanilla JS. Die drei Ansichten sind einfach, der Zustand liegt auf dem Server. Ein Framework brächte hier nur Ballast. Schriften (Archivo, Space Mono) kommen lokal aus `@fontsource`.

### Befehle

| Befehl          | Wirkung                                                         |
|-----------------|-----------------------------------------------------------------|
| `npm start`     | Oberfläche bauen und Server starten (für den Abend)             |
| `npm run dev`   | Entwicklungsmodus mit sofortigem Neuladen bei Code-Änderungen   |
| `npm run serve` | Nur den Server starten (ohne neu zu bauen)                      |
| `npm test`      | Automatische Tests                                              |

### Probleme?

| Problem                                   | Lösung                                                                 |
|-------------------------------------------|------------------------------------------------------------------------|
| „Port 3000 ist schon belegt“              | Läuft Quiz Night schon in einem anderen Terminal? Sonst `port` in `config.json` ändern. |
| Kein Ton                                  | Einmal ins Beamer-Fenster klicken. Datei in `sounds/` richtig benannt? Beamer-Fenster neu laden. |
| Tasten reagieren nicht                    | Ins Gamemaster-Fenster klicken (die Tasten wirken nur dort, nicht in Eingabefeldern). |
| Gamemaster zeigt „getrennt“               | Läuft das Terminal mit `npm start` noch? Neu starten, die Fenster verbinden sich selbst. |
| Etwas falsch geklickt                     | `Z` (Rückgängig), beliebig oft.                                        |
| Handys erreichen den Laptop nicht (später) | Gleiches WLAN? Die beim Start angezeigte `http://192.168.…`-Adresse verwenden. Ggf. Firewall-Abfrage beim ersten Start erlauben. |
