// Nach jedem Format, in zwei Schritten:
//  1. Formatsieger-Screen: wer hat das Format gewonnen (Formatpunkte)?
//  2. Zwischenstand: Gesamtstand vorher + Globalpunkte als „+N“. Leertaste
//     übernimmt: die „+N“ wandern hoch, die Zahlen zählen hoch, danach
//     erscheint, wer insgesamt führt.
import { countUp, fitText, formatNumber, h, replay, setCount, setText } from '../core/dom.js';

const TEAMS = ['A', 'B'];
const COUNT_DELAY = 450;
const COUNT_DURATION = 1700;

const testbars = () => h('div', { class: 'testbars summary-bars', 'aria-hidden': 'true' }, Array.from({ length: 7 }, () => h('span')));

export function createSummaryScene() {
  // ---------------------------------------------- Schritt 1: Formatsieger
  const rKicker = h('div', { class: 'summary-kicker label' }, h('span', { class: 'summary-swatch' }), h('span', { class: 'r-kicker-text' }));
  const rTitle = h('h1', { class: 'result-title display' });
  const rCols = {};
  for (const team of TEAMS) {
    rCols[team] = { name: h('div', { class: 'result-name display' }), points: h('div', { class: 'result-points display num' }) };
  }
  const rNote = h('div', { class: 'result-note label' });
  const resultEl = h(
    'div',
    { class: 'summary-step summary-result' },
    h('div', { class: 'summary-head' }, rKicker, rTitle),
    h(
      'div',
      { class: 'result-teams' },
      h('div', { class: 'result-team' }, rCols.A.name, rCols.A.points),
      h('div', { class: 'summary-sep display' }, ':'),
      h('div', { class: 'result-team' }, rCols.B.name, rCols.B.points),
    ),
    rNote,
  );

  // ---------------------------------------------- Schritt 2: Zwischenstand
  const kicker = h('div', { class: 'summary-kicker label' }, h('span', { class: 'summary-swatch' }), h('span', { class: 's-kicker-text' }));
  const leader = h('div', { class: 'summary-leader label' });
  const cols = {};
  for (const team of TEAMS) {
    cols[team] = {
      name: h('div', { class: 'summary-name display' }),
      total: h('div', { class: 'summary-total display num' }),
      add: h('div', { class: 'summary-add label' }),
    };
  }
  const column = (team) => h('div', { class: 'summary-team' }, cols[team].name, cols[team].total, cols[team].add);
  const standingsEl = h(
    'div',
    { class: 'summary-step summary-standings' },
    h('div', { class: 'summary-head' }, kicker, h('h1', { class: 'summary-title display' }, 'Zwischenstand'), testbars()),
    h('div', { class: 'summary-teams' }, column('A'), h('div', { class: 'summary-sep display' }, ':'), column('B')),
    leader,
  );

  const el = h('div', { class: 'scene scene-summary' }, resultEl, standingsEl);

  let timers = [];
  let shownApplied = null;
  let shownStep = null;

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function leaderText(view) {
    const { A, B } = view.totalPoints;
    if (A === B) return 'Gleichstand';
    const team = A > B ? 'A' : 'B';
    const diff = Math.abs(A - B);
    return `${view.teams[team]} führt mit ${diff} ${diff === 1 ? 'Punkt' : 'Punkten'}`;
  }

  function updateResult(view, s, animate) {
    setText(rKicker.lastChild, `${s.formatName} · Ergebnis`);
    const title = s.winner ? `${view.teams[s.winner]} gewinnt` : 'Gleichstand';
    if (rTitle.textContent !== title) {
      setText(rTitle, title);
      fitText(rTitle, { max: 150, min: 60 });
      document.fonts?.ready.then(() => fitText(rTitle, { max: 150, min: 60 }));
    }
    for (const team of TEAMS) {
      setText(rCols[team].name, view.teams[team]);
      setText(rCols[team].points, formatNumber(s.formatPoints[team]));
      rCols[team].points.classList.toggle('is-winner', s.winner === team);
    }
    const value = Math.max(s.add.A, s.add.B);
    setText(rNote, s.winner ? `+${value} Globalpunkte für ${view.teams[s.winner]}` : `+${value} Globalpunkte für beide Teams`);
    if (animate) {
      replay(rTitle, 'is-revealing');
      for (const team of TEAMS) replay(rCols[team].points, 'is-rising');
      replay(rNote, 'is-appearing');
    }
  }

  function updateStandings(view, s, animate) {
    setText(kicker.lastChild, `nach ${s.formatName}`);
    for (const team of TEAMS) {
      setText(cols[team].name, view.teams[team]);
      setText(cols[team].add, `+${formatNumber(s.add[team])} Globalpunkte`);
      cols[team].add.classList.toggle('is-zero', s.add[team] === 0);
    }
    setText(leader, leaderText(view));

    if (s.applied === shownApplied) {
      // Nur Namen/Korrekturen geändert – Zahlen direkt setzen, falls keine Animation läuft
      if (!timers.length) for (const team of TEAMS) setCount(cols[team].total, s.applied ? view.totalPoints[team] : s.before[team]);
      return;
    }
    shownApplied = s.applied;
    clearTimers();

    if (!s.applied) {
      el.classList.remove('is-applied', 'is-applying');
      for (const team of TEAMS) {
        setCount(cols[team].total, s.before[team]);
        cols[team].add.classList.remove('is-flying');
      }
      return;
    }
    if (!animate) {
      el.classList.add('is-applied');
      el.classList.remove('is-applying');
      for (const team of TEAMS) setCount(cols[team].total, view.totalPoints[team]);
      return;
    }

    el.classList.add('is-applying');
    for (const team of TEAMS) {
      const col = cols[team];
      setCount(col.total, s.before[team]);
      if (s.add[team] !== 0) replay(col.add, 'is-flying');
      timers.push(
        setTimeout(() => {
          countUp(col.total, s.before[team], view.totalPoints[team], COUNT_DURATION).then((done) => {
            if (done && s.add[team] !== 0) replay(col.total, 'is-landed');
          });
        }, COUNT_DELAY),
      );
    }
    timers.push(
      setTimeout(() => {
        timers = [];
        el.classList.remove('is-applying');
        el.classList.add('is-applied');
        replay(leader, 'is-appearing');
      }, COUNT_DELAY + COUNT_DURATION + 150),
    );
  }

  return {
    el,
    update(view, { animate }) {
      const s = view.summary;
      if (!s) return;
      el.style.setProperty('--fc', view.chapters.find((c) => c.id === s.formatId)?.color ?? 'var(--paper)');
      const step = s.step === 'result' ? 'result' : 'standings';
      const stepChanged = step !== shownStep;
      resultEl.hidden = step !== 'result';
      standingsEl.hidden = step !== 'standings';
      if (step === 'result') {
        updateResult(view, s, animate && stepChanged);
      } else {
        if (stepChanged && animate) replay(standingsEl, 'scene-in');
        updateStandings(view, s, animate);
      }
      shownStep = step;
    },
    destroy() {
      clearTimers();
      for (const team of TEAMS) cols[team].total._countToken = null;
    },
  };
}
