// Kategorien – Zustandslogik (läuft auf dem Server)
//
// Ablauf: Kategorie aufdecken → Teams nennen abwechselnd Begriffe (mündlich,
// kein Timer) → Gamemaster wählt das Gewinnerteam → nächste Kategorie.
//
// Zustand:
//   items   – [{ title, note }] aus content.json, feste Reihenfolge
//   index   – aktuelle Kategorie (-1 = noch keine aufgedeckt)
//   stage   – 'idle' (vor der ersten) | 'show' (Runde läuft) | 'won' (Runde entschieden)
//   winner  – 'A' | 'B' | null (null = ohne Punkt übersprungen)
//   results – [{ round, title, winner }]

export default {
  init(content, api) {
    const raw = Array.isArray(content?.categories) ? content.categories : [];
    const items = raw
      .map((entry) =>
        typeof entry === 'string'
          ? { title: entry.trim(), note: null }
          : { title: String(entry?.title ?? '').trim(), note: entry?.note ? String(entry.note) : null },
      )
      .filter((item) => item.title);
    if (items.length === 0) api.fail('Keine Kategorien gefunden – bitte formats/kategorien/content.json füllen.');
    return { items, index: -1, stage: 'idle', winner: null, results: [] };
  },

  actions: {
    // Leertaste: nächste Kategorie aufdecken – oder Format beenden, wenn keine mehr übrig ist.
    next(fs, payload, api) {
      if (fs.stage === 'show') {
        api.fail('Erst die Runde entscheiden: 1 oder 2 – oder „Ohne Punkt weiter“.');
      }
      if (fs.index + 1 >= fs.items.length) {
        api.endFormat();
        return;
      }
      fs.index += 1;
      fs.stage = 'show';
      fs.winner = null;
      api.sound('reveal');
      api.label(`Kategorie ${fs.index + 1} aufgedeckt`);
    },

    // Taste 1 / 2: Team holt den Rundenpunkt.
    roundWin(fs, { team }, api) {
      if (fs.stage !== 'show') api.fail('Gerade läuft keine Runde – erst eine Kategorie aufdecken.');
      if (team !== 'A' && team !== 'B') api.fail('Unbekanntes Team.');
      fs.stage = 'won';
      fs.winner = team;
      fs.results.push({ round: fs.index + 1, title: fs.items[fs.index].title, winner: team });
      api.addPoints(team, 1);
      api.sound('roundEnd');
      api.label(`Punkt für ${api.teams[team]}`);
    },

    // Kategorie ohne Punkt abschließen (z. B. wenn sie nicht funktioniert).
    skip(fs, payload, api) {
      if (fs.stage !== 'show') api.fail('Gerade läuft keine Runde.');
      fs.stage = 'won';
      fs.winner = null;
      fs.results.push({ round: fs.index + 1, title: fs.items[fs.index].title, winner: null });
      api.label(`Kategorie ${fs.index + 1} ohne Punkt`);
    },
  },

  // Der Beamer bekommt nur die aktuelle Kategorie – die nächste bleibt geheim.
  view(fs, role) {
    const current = fs.items[fs.index] ?? null;
    const base = {
      round: fs.index + 1,
      total: fs.items.length,
      stage: fs.stage,
      winner: fs.winner,
      title: current?.title ?? null,
    };
    if (role !== 'host') return base;
    const next = fs.items[fs.index + 1] ?? null;
    return { ...base, note: current?.note ?? null, next: next?.title ?? null, nextNote: next?.note ?? null, results: fs.results };
  },
};
