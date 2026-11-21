// Zwischenstand nach einem Format (einfache Fassung, Animation folgt).
import { formatNumber, h, setText } from '../core/dom.js';

export function createSummaryScene() {
  const title = h('h1', { class: 'summary-title display' }, 'Zwischenstand');
  const kicker = h('div', { class: 'summary-kicker label' });
  const cols = ['A', 'B'].map(() => ({
    name: h('div', { class: 'summary-name display' }),
    total: h('div', { class: 'summary-total display num' }),
    add: h('div', { class: 'summary-add label' }),
  }));
  const el = h(
    'div',
    { class: 'scene scene-summary' },
    kicker,
    title,
    h(
      'div',
      { class: 'summary-teams' },
      cols.map((c) => h('div', { class: 'summary-team' }, c.name, c.total, c.add)),
    ),
  );

  return {
    el,
    update(view) {
      const s = view.summary;
      setText(kicker, `nach ${s.formatName}`);
      ['A', 'B'].forEach((team, i) => {
        const c = cols[i];
        setText(c.name, view.teams[team]);
        setText(c.total, formatNumber(s.applied ? view.totalPoints[team] : s.before[team]));
        setText(c.add, s.applied ? '' : `+${s.add[team]} aus ${s.formatName}`);
      });
    },
  };
}
