// Kategorien – Beamer-Ansicht und Gamemaster-Steuerung (läuft im Browser)
import { fitText, h, replay, setText } from '@core/dom.js';
import './format.css';

export default {
  // Zusatz in der Bauchbinde: „KATEGORIEN · Runde 3“
  lowerThird(fv) {
    return fv && fv.round >= 1 ? `Runde ${fv.round}` : null;
  },

  // Was passiert bei Leertaste? (Anzeige in der Gamemaster-Ansicht)
  nextStep(fv, view) {
    if (!fv) return { label: 'Nächster Schritt' };
    if (fv.stage === 'show') {
      return {
        label: `Runde ${fv.round} läuft – wer holt den Punkt?`,
        detail: `Taste 1 = ${view.teams.A}, Taste 2 = ${view.teams.B}`,
        disabled: true,
      };
    }
    if (fv.next) return { label: `Kategorie ${fv.round + 1} von ${fv.total} aufdecken`, detail: `„${fv.next}“` };
    return { label: 'Format beenden und zum Zwischenstand', detail: 'Alle Kategorien sind gespielt.' };
  },

  // Zusätzliche Tasten (Leertaste und Z stellt der Kern bereit)
  shortcuts: [
    { key: '1', action: 'roundWin', payload: { team: 'A' }, label: (v) => `Punkt für ${v.teams.A}` },
    { key: '2', action: 'roundWin', payload: { team: 'B' }, label: (v) => `Punkt für ${v.teams.B}` },
  ],

  mountScreen,
  mountHost,
};

// ================================================================ Beamer

function mountScreen(root) {
  const kicker = h('div', { class: 'kat-kicker label' }, h('span', { class: 'kat-kicker-bar' }), 'Kategorie');
  const title = h('div', { class: 'kat-title display' });
  const result = h('div', { class: 'kat-result label' });
  const waiting = h('div', { class: 'kat-waiting label' }, 'Die erste Kategorie folgt');
  const card = h('div', { class: 'kat-card' }, kicker, title, result);
  const bannerText = h('span', { class: 'kat-banner-text display' });
  const banner = h('div', { class: 'kat-banner', 'aria-hidden': 'true' }, bannerText);
  const el = h('div', { class: 'kat-screen' }, waiting, card, banner);
  root.append(el);

  let shown = null; // "Runde|Titel" der angezeigten Kategorie
  const fit = () => fitText(title, { max: 168, min: 56, maxHeight: 520 });
  document.fonts?.ready.then(() => shown && fit());

  return {
    update(fv, view, { animate, prev }) {
      if (!fv) return;
      const prevFv = prev?.phase === 'play' && prev.current?.id === view.current.id ? prev.format : null;

      const hasCategory = fv.round >= 1 && fv.title;
      waiting.hidden = Boolean(hasCategory);
      card.hidden = !hasCategory;
      if (!hasCategory) {
        shown = null;
        banner.classList.remove('is-playing');
        return;
      }

      // Neue Kategorie aufgedeckt
      const key = `${fv.round}|${fv.title}`;
      if (key !== shown) {
        shown = key;
        setText(title, fv.title);
        fit();
        if (animate) {
          replay(kicker, 'is-revealing');
          replay(title, 'is-revealing');
        }
      }

      // Runde entschieden
      const won = fv.stage === 'won';
      card.classList.toggle('is-decided', won);
      const justDecided = animate && won && prevFv?.stage === 'show' && prevFv.round === fv.round;

      if (won) {
        setText(result, fv.winner ? `Punkt für ${view.teams[fv.winner]}` : 'Ohne Punkt');
        result.classList.remove('is-placeholder');
        result.classList.toggle('is-delayed', justDecided && Boolean(fv.winner));
        if (justDecided) replay(result, 'is-appearing');
      } else {
        // Platz bleibt reserviert, damit der Titel beim Entscheiden nicht springt
        setText(result, '–');
        result.classList.add('is-placeholder');
        result.classList.remove('is-appearing');
      }

      if (justDecided && fv.winner) {
        setText(bannerText, `${view.teams[fv.winner]} holt den Punkt`);
        fitText(bannerText, { max: 96, min: 40 });
        replay(banner, 'is-playing');
      } else if (!won) {
        banner.classList.remove('is-playing');
      }
    },
  };
}

// ================================================================ Gamemaster

function mountHost(root, { send }) {
  const roundLabel = h('div', { class: 'kat-h-label label' });
  const current = h('div', { class: 'kat-h-current' });
  const note = h('div', { class: 'kat-h-note' });
  const status = h('div', { class: 'kat-h-status' });

  const btnA = h('button', { class: 'btn btn-big kat-h-team', onClick: () => send('roundWin', { team: 'A' }) });
  const btnB = h('button', { class: 'btn btn-big kat-h-team', onClick: () => send('roundWin', { team: 'B' }) });
  const btnSkip = h('button', { class: 'btn kat-h-skip', onClick: () => send('skip') }, 'Ohne Punkt weiter');

  const nextTitle = h('div', { class: 'kat-h-next' });
  const nextNote = h('div', { class: 'kat-h-note' });
  const results = h('ol', { class: 'kat-h-results' });
  const resultsBox = h('div', { class: 'kat-h-block' }, h('div', { class: 'kat-h-label label' }, 'Bisherige Runden'), results);

  root.append(
    h('div', { class: 'kat-h-block kat-h-now' }, roundLabel, current, note, status),
    h('div', { class: 'kat-h-buttons' }, btnA, btnB, btnSkip),
    h('div', { class: 'kat-h-block' }, h('div', { class: 'kat-h-label label' }, 'Als Nächstes'), nextTitle, nextNote),
    resultsBox,
  );

  return {
    update(fv, view) {
      if (!fv) return;
      const running = fv.stage === 'show';

      setText(roundLabel, fv.round >= 1 ? `Aktuell · Runde ${fv.round} von ${fv.total}` : `Aktuell · ${fv.total} Kategorien bereit`);
      setText(current, fv.title ?? 'Noch keine Kategorie aufgedeckt');
      current.classList.toggle('is-empty', !fv.title);
      setText(note, fv.note ?? '');
      note.hidden = !fv.note;

      let statusText = 'Leertaste deckt die erste Kategorie auf.';
      if (running) statusText = 'Runde läuft. Wer etwas doppelt nennt oder zu lange braucht, verliert.';
      else if (fv.stage === 'won') statusText = fv.winner ? `Punkt für ${view.teams[fv.winner]}.` : 'Runde ohne Punkt beendet.';
      setText(status, statusText);
      status.classList.toggle('is-running', running);

      btnA.replaceChildren(`Punkt für ${view.teams.A}`, h('kbd', {}, '1'));
      btnB.replaceChildren(`Punkt für ${view.teams.B}`, h('kbd', {}, '2'));
      btnA.disabled = btnB.disabled = btnSkip.disabled = !running;

      setText(nextTitle, fv.next ?? 'Keine weitere Kategorie – Leertaste beendet das Format.');
      nextTitle.classList.toggle('is-empty', !fv.next);
      setText(nextNote, fv.nextNote ?? '');
      nextNote.hidden = !fv.nextNote;

      resultsBox.hidden = fv.results.length === 0;
      results.replaceChildren(
        ...fv.results
          .slice()
          .reverse()
          .map((r) =>
            h(
              'li',
              {},
              h('span', { class: 'kat-h-r-round num' }, String(r.round)),
              h('span', { class: 'kat-h-r-title' }, r.title),
              h('span', { class: 'kat-h-r-winner' }, r.winner ? view.teams[r.winner] : 'ohne Punkt'),
            ),
          ),
      );
    },
  };
}
