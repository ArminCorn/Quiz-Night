// Länderraten – Beamer-Ansicht und Gamemaster-Steuerung (läuft im Browser)
import { fitText, h, replay, setText } from '@core/dom.js';
import weltkarte from './assets/weltkarte.svg?raw';
import './format.css';

const STAGES = ['Flaggenfarben', 'Kontinent', 'Umriss', 'Tipp'];
const TEAMS = ['A', 'B'];

/** Eigene, vertrauenswürdige SVG-Dateien (vom Länder-Skript erzeugt) einsetzen. */
function setSvg(el, markup) {
  const value = markup ?? '';
  if (el._svg === value) return;
  el._svg = value;
  el.innerHTML = value;
}

const stake = (fv) => fv.punkte[Math.max(0, Math.min(3, (fv.stage || 1) - 1))];

export default {
  buzzer: true,

  lowerThird(fv) {
    if (!fv) return null;
    const land = `Land ${fv.landNr} von ${fv.landTotal}`;
    if (fv.phase === 'resolved') return `${land} · Auflösung`;
    return fv.stage >= 1 ? `${land} · Etappe ${fv.stage}` : land;
  },

  nextStep(fv, view) {
    if (!fv) return { label: 'Nächster Schritt' };
    if (fv.phase === 'answering') {
      return { label: `${view.teams[fv.answering]} antwortet`, detail: 'R = richtig, F = falsch', disabled: true };
    }
    if (fv.phase === 'resolved') {
      return fv.landNr >= fv.landTotal
        ? { label: 'Format beenden → Formatsieger', detail: 'Danach folgt der Zwischenstand.' }
        : { label: `Weiter zu Land ${fv.landNr + 1}`, detail: fv.nextName ? `„${fv.nextName}“` : null };
    }
    if (fv.stage >= 4) return { label: 'Ohne Treffer auflösen', detail: 'Niemand bekommt Punkte für dieses Land.' };
    const n = fv.stage + 1;
    return {
      label: `Etappe ${n} aufdecken: ${STAGES[n - 1]}`,
      detail: `Dann ${fv.punkte[n - 1]} Punkte im Spiel. Beide Buzzer werden freigegeben.`,
    };
  },

  shortcuts: [
    { key: 'r', action: 'correct', label: 'Richtig' },
    { key: 'f', action: 'wrong', label: 'Falsch' },
    { key: '1', buzz: 'A', label: (v) => `Buzz manuell: ${v.teams.A}` },
    { key: '2', buzz: 'B', label: (v) => `Buzz manuell: ${v.teams.B}` },
  ],

  mountScreen,
  mountHost,
};

// ================================================================ Beamer

function mountScreen(root) {
  // ---- Kopfzeile: Punkte im Spiel + Buzzer-Lampen
  const stakeNum = h('span', { class: 'ld-stake-num display num' });
  const stakeEl = h('div', { class: 'ld-stake' }, stakeNum, h('span', { class: 'ld-stake-label label' }, 'Punkte im Spiel'));
  const lamps = {};
  for (const team of TEAMS) {
    lamps[team] = { el: h('div', { class: 'ld-lamp' }, h('span', { class: 'ld-lamp-dot' }), h('span', { class: 'ld-lamp-name label' }), h('span', { class: 'ld-lamp-state label' })) };
    lamps[team].name = lamps[team].el.children[1];
    lamps[team].state = lamps[team].el.children[2];
  }
  const top = h('div', { class: 'ld-top' }, stakeEl, h('div', { class: 'ld-lamps' }, lamps.A.el, lamps.B.el));

  // ---- Vier Etappen
  const cells = STAGES.map((title, i) => {
    const body = h('div', { class: 'ld-cell-body' });
    const el = h(
      'div',
      { class: 'ld-cell is-hidden', dataset: { n: String(i + 1) } },
      h('div', { class: 'ld-cell-head label' }, `${i + 1} · ${title}`),
      h('div', { class: 'ld-cell-ghost display' }, String(i + 1)),
      body,
    );
    return { el, body, shown: false, key: null };
  });
  const grid = h('div', { class: 'ld-grid' }, cells.map((c) => c.el));

  // ---- Einblendungen
  const answerName = h('span', { class: 'ld-answer-name display' });
  const answer = h('div', { class: 'ld-answer', hidden: true }, answerName, h('span', { class: 'ld-answer-label label' }, 'antwortet'));
  const flash = h('div', { class: 'ld-flash display', 'aria-hidden': 'true' }, 'Falsch');

  // ---- Auflösung
  const rvKicker = h('div', { class: 'ld-rv-kicker label' });
  const rvName = h('div', { class: 'ld-rv-name display' });
  const rvFlag = h('div', { class: 'ld-rv-flag' });
  const rvOutline = h('div', { class: 'ld-rv-outline' });
  const rvResult = h('div', { class: 'ld-rv-result label' });
  const reveal = h('div', { class: 'ld-reveal', hidden: true }, rvKicker, rvName, h('div', { class: 'ld-rv-media' }, rvFlag, rvOutline), rvResult);

  const playArea = h('div', { class: 'ld-play' }, top, grid, answer, flash);
  const el = h('div', { class: 'ld-screen' }, playArea, reveal);
  root.append(el);


  function renderCell(i, data, landNr, animate) {
    const c = cells[i];
    const key = data ? `${landNr}` : null; // Inhalt einer Etappe ändert sich innerhalb eines Landes nicht
    c.el.classList.toggle('is-hidden', !data);
    if (!data) {
      c.body.replaceChildren();
      c.key = null;
      return;
    }
    if (c.key === key) return;
    c.key = key;
    if (data.farben) {
      const n = data.farben.length;
      const size = Math.min(150, Math.floor((780 - 22 * (n - 1)) / n));
      c.body.replaceChildren(
        h('div', { class: 'ld-colors' }, data.farben.map((hex) => h('span', { class: 'ld-swatch', style: { background: hex, width: `${size}px`, height: `${size}px` } }))),
      );
    } else if (data.kontinent) {
      const map = h('div', { class: 'ld-map' });
      setSvg(map, weltkarte);
      for (const p of map.querySelectorAll('path')) p.classList.toggle('is-on', p.dataset.kontinent === data.kontinent);
      c.body.replaceChildren(h('div', { class: 'ld-continent' }, map, h('div', { class: 'ld-continent-name display' }, data.kontinent)));
    } else if (data.umriss) {
      const box = h('div', { class: 'ld-outline' });
      setSvg(box, data.umriss);
      c.body.replaceChildren(box);
    } else if (data.tipp) {
      const text = h('div', { class: 'ld-tipp' }, data.tipp);
      c.body.replaceChildren(text);
      requestAnimationFrame(() => fitText(text, { max: 52, min: 24, maxHeight: 250, step: 2 }));
    }
    if (animate) replay(c.el, 'is-revealing');
  }

  return {
    update(fv, view, { animate, prev }) {
      if (!fv) return;
      const prevFv = prev?.phase === 'play' && prev.current?.id === view.current.id ? prev.format : null;
      const sameLand = prevFv?.landNr === fv.landNr;

      const resolved = fv.phase === 'resolved';
      playArea.hidden = resolved;
      reveal.hidden = !resolved;

      // ---- Auflösung
      if (resolved) {
        setText(rvKicker, `Auflösung · Land ${fv.landNr} von ${fv.landTotal}`);
        if (rvName.textContent !== fv.name) {
          setText(rvName, fv.name);
          fitText(rvName, { max: 150, min: 60 });
          document.fonts?.ready.then(() => fitText(rvName, { max: 150, min: 60 }));
        }
        setSvg(rvFlag, fv.flagge);
        setSvg(rvOutline, fv.umriss);
        const r = fv.result;
        setText(rvResult, r ? `${view.teams[r.team]} · Etappe ${r.stage} · ${r.points} Punkte` : 'Niemand hat das Land erraten');
        rvResult.classList.toggle('is-none', !r);
        if (animate && prevFv && prevFv.phase !== 'resolved') {
          replay(rvName, 'is-revealing');
          replay(rvFlag, 'is-rising');
          replay(rvOutline, 'is-rising');
          replay(rvResult, 'is-appearing');
        }
        return;
      }

      // ---- Punkte im Spiel + Lampen
      setText(stakeNum, String(stake(fv)));
      stakeEl.classList.toggle('is-waiting', fv.stage === 0);
      const active = fv.phase === 'running' || fv.phase === 'answering';
      for (const team of TEAMS) {
        const l = lamps[team];
        setText(l.name, view.teams[team]);
        let state = 'wartet';
        let cls = 'is-closed';
        if (fv.answering === team) [state, cls] = ['antwortet', 'is-answering'];
        else if (view.buzzer.open[team]) [state, cls] = ['frei', 'is-open'];
        else if (active && fv.tried[team]) [state, cls] = ['gesperrt', 'is-tried'];
        setText(l.state, state);
        l.el.className = `ld-lamp ${cls}`;
      }

      // ---- Etappen
      fv.stages.forEach((data, i) => {
        const newlyShown = data && prevFv && sameLand && !prevFv.stages[i];
        renderCell(i, data, fv.landNr, animate && newlyShown);
      });

      // ---- Wer antwortet
      const answering = fv.phase === 'answering';
      if (answering) {
        setText(answerName, view.teams[fv.answering]);
        answer.hidden = false;
        if (animate && prevFv?.phase !== 'answering') replay(answer, 'is-entering');
      } else {
        answer.hidden = true;
      }

      // ---- Falsch (kurz einblenden)
      if (animate && prevFv?.phase === 'answering' && fv.phase === 'running' && sameLand) replay(flash, 'is-playing');
      else if (!animate) flash.classList.remove('is-playing');
    },
  };
}

// ================================================================ Gamemaster

function mountHost(root, { send, buzz }) {
  const warn = h('details', { class: 'ld-h-warn' });
  const landLabel = h('div', { class: 'ld-h-label label' });
  const landName = h('div', { class: 'ld-h-name' });
  const badge = h('span', { class: 'ld-h-badge label' }, 'Beispiel');
  const flag = h('div', { class: 'ld-h-flag' });
  const outline = h('div', { class: 'ld-h-outline' });

  const stageRows = STAGES.map((title, i) => {
    const content = h('div', { class: 'ld-h-content' });
    const status = h('span', { class: 'ld-h-status label' });
    const points = h('span', { class: 'ld-h-points num' });
    const el = h('li', { class: 'ld-h-stage' }, h('span', { class: 'ld-h-n num' }, String(i + 1)), h('div', { class: 'ld-h-stage-main' }, h('div', { class: 'ld-h-stage-title' }, title, status), content), points);
    return { el, content, status, points, key: null };
  });

  const buzzState = {};
  for (const team of TEAMS) buzzState[team] = h('div', { class: 'ld-h-buzz' });

  const btnRight = h('button', { class: 'btn btn-big ld-h-right', onClick: () => send('correct') }, 'Richtig', h('kbd', {}, 'R'));
  const btnWrong = h('button', { class: 'btn btn-big ld-h-wrong', onClick: () => send('wrong') }, 'Falsch', h('kbd', {}, 'F'));
  const btnBuzzA = h('button', { class: 'btn', onClick: () => buzz('A') });
  const btnBuzzB = h('button', { class: 'btn', onClick: () => buzz('B') });
  const btnResolve = h('button', { class: 'btn btn-danger-ghost', onClick: () => send('resolve') }, 'Ohne Treffer auflösen');
  const fpLine = h('div', { class: 'ld-h-fp' });
  const results = h('ol', { class: 'ld-h-results' });
  const resultsBox = h('div', { class: 'ld-h-block' }, h('div', { class: 'ld-h-label label' }, 'Bisherige Länder'), results);

  root.append(
    warn,
    h('div', { class: 'ld-h-block ld-h-landrow' }, h('div', { class: 'ld-h-landtext' }, landLabel, h('div', { class: 'ld-h-namerow' }, landName, badge)), flag, outline),
    h('ol', { class: 'ld-h-stages' }, stageRows.map((r) => r.el)),
    h('div', { class: 'ld-h-block ld-h-buzzrow' }, h('div', { class: 'ld-h-label label' }, 'Buzzer'), buzzState.A, buzzState.B, fpLine),
    h('div', { class: 'ld-h-buttons' }, btnRight, btnWrong, btnBuzzA, btnBuzzB, btnResolve),
    resultsBox,
  );

  return {
    update(fv, view) {
      if (!fv) return;
      // Warnungen
      warn.hidden = fv.warnings.length === 0;
      if (fv.warnings.length) {
        const key = JSON.stringify(fv.warnings);
        if (warn._key !== key) {
          warn._key = key;
          const n = fv.warnings.filter((w) => w.nr).length;
          warn.replaceChildren(
            h('summary', {}, `${n} ${n === 1 ? 'Eintrag wird' : 'Einträge werden'} übersprungen (unvollständig)`),
            h(
              'ul',
              {},
              fv.warnings.map((w) => h('li', {}, w.nr ? `Nr. ${w.nr}${w.name ? ` (${w.name})` : ''}: ${w.problems.join(', ')}` : w.problems.join(', '))),
            ),
          );
        }
      }

      // Land
      setText(landLabel, `Land ${fv.landNr} von ${fv.landTotal}${fv.phase === 'resolved' ? ' · aufgelöst' : fv.stage ? ` · Etappe ${fv.stage}` : ''}`);
      setText(landName, fv.name);
      badge.hidden = !fv.beispiel;
      setSvg(flag, fv.flagge);
      setSvg(outline, fv.umriss);

      // Etappen
      stageRows.forEach((r, i) => {
        const n = i + 1;
        let status = 'verdeckt';
        let cls = '';
        if (fv.phase === 'resolved' || fv.stage > n) [status, cls] = ['aufgedeckt', 'is-done'];
        else if (fv.stage === n) [status, cls] = ['aktuell', 'is-current'];
        else if (fv.stage + 1 === n && fv.phase !== 'resolved') [status, cls] = ['als Nächstes', 'is-next'];
        setText(r.status, status);
        r.el.className = `ld-h-stage ${cls}`;
        setText(r.points, `${fv.punkte[i]}`);
        const data = fv.stages[i];
        const key = `${fv.landNr}:${i}`;
        if (r.key === key) return;
        r.key = key;
        if (data?.farben) r.content.replaceChildren(h('div', { class: 'ld-h-swatches' }, data.farben.map((c) => h('span', { class: 'ld-h-swatch', style: { background: c }, title: c }))), h('span', { class: 'ld-h-hex' }, data.farben.join('  ')));
        else if (data?.kontinent) r.content.replaceChildren(data.kontinent);
        else if (data?.umriss) {
          const box = h('div', { class: 'ld-h-mini' });
          setSvg(box, data.umriss);
          r.content.replaceChildren(box);
        } else if (data?.tipp) r.content.replaceChildren(h('span', { class: 'ld-h-tipp' }, data.tipp));
      });

      // Buzzer
      for (const team of TEAMS) {
        let text = 'gesperrt';
        let cls = '';
        if (fv.answering === team) [text, cls] = ['antwortet', 'is-answering'];
        else if (view.buzzer.open[team]) [text, cls] = ['frei', 'is-open'];
        else if ((fv.phase === 'running' || fv.phase === 'answering') && fv.tried[team]) [text, cls] = ['hat es in dieser Etappe versucht', 'is-tried'];
        buzzState[team].className = `ld-h-buzz ${cls}`;
        buzzState[team].replaceChildren(h('strong', {}, view.teams[team]), ` ${text}`);
      }
      setText(fpLine, `Formatpunkte: ${view.teams.A} ${view.formatPoints.A} : ${view.formatPoints.B} ${view.teams.B}`);

      const answering = fv.phase === 'answering';
      btnRight.disabled = btnWrong.disabled = !answering;
      btnBuzzA.replaceChildren(`Buzz ${view.teams.A}`, h('kbd', {}, '1'));
      btnBuzzB.replaceChildren(`Buzz ${view.teams.B}`, h('kbd', {}, '2'));
      btnBuzzA.disabled = !view.buzzer.open.A;
      btnBuzzB.disabled = !view.buzzer.open.B;
      btnResolve.disabled = fv.phase !== 'running';

      resultsBox.hidden = fv.results.length === 0;
      results.replaceChildren(
        ...fv.results
          .slice()
          .reverse()
          .map((r) =>
            h(
              'li',
              {},
              h('span', { class: 'num ld-h-r-nr' }, String(r.landNr)),
              h('span', {}, r.name),
              h('span', { class: 'ld-h-r-res' }, r.team ? `${view.teams[r.team]} · Etappe ${r.stage} · ${r.points}` : 'ohne Treffer'),
            ),
          ),
      );
    },
  };
}
