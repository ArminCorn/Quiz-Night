// Feste Bausteine der Beamer-Ansicht: Kapitelleiste, Bauchbinde, Punkteanzeige.
import { formatNumber, h, replay, setText } from '../core/dom.js';

/** Kapitelleiste oben: alle Formate, klein und zurückgenommen. */
export function createChapters() {
  const el = h('div', { class: 'chapters', 'aria-hidden': 'true' });
  const items = new Map();

  return {
    el,
    update(view) {
      const ids = view.chapters.map((c) => c.id).join('|');
      if (el.dataset.ids !== ids) {
        el.dataset.ids = ids;
        el.replaceChildren();
        items.clear();
        view.chapters.forEach((chapter, i) => {
          const item = h(
            'div',
            { class: 'chapter' },
            h('span', { class: 'chapter-name' }, `${String(i + 1).padStart(2, '0')} ${chapter.name}`),
            h('span', { class: 'chapter-bar' }),
          );
          items.set(chapter.id, item);
          el.append(item);
        });
      }
      for (const chapter of view.chapters) {
        const item = items.get(chapter.id);
        item.style.setProperty('--c', chapter.color);
        item.classList.toggle('is-active', chapter.active);
        item.classList.toggle('is-done', chapter.done && !chapter.active);
      }
    },
  };
}

/** Bauchbinde unten links: Formatname + Zusatz (z. B. „Runde 3“). */
export function createLowerThird() {
  const name = h('span', { class: 'lt-name display' });
  const sub = h('span', { class: 'lt-sub label' });
  const subBox = h('div', { class: 'lt-info' }, sub);
  const el = h('div', { class: 'lower-third' }, h('div', { class: 'lt-tab' }, name), subBox);

  return {
    el,
    update(view, subText, { entrance = false, animate = false } = {}) {
      el.style.setProperty('--fc', view.current.color);
      setText(name, view.current.name);
      const text = subText ?? '';
      const changed = sub.textContent !== text;
      setText(sub, text);
      subBox.hidden = !text;
      if (entrance) replay(el, 'is-entering');
      else if (changed && animate && text) replay(subBox, 'is-ticking');
    },
  };
}

/** Formatpunkte unten rechts: „TEAM A 2 : 1 TEAM B“ */
export function createScorebug() {
  const nameA = h('span', { class: 'sb-name' });
  const nameB = h('span', { class: 'sb-name' });
  const numA = h('span', { class: 'sb-num display num' });
  const numB = h('span', { class: 'sb-num display num' });
  const el = h('div', { class: 'scorebug' }, nameA, numA, h('span', { class: 'sb-sep' }, ':'), numB, nameB);

  return {
    el,
    update(view, { animate = false } = {}) {
      setText(nameA, view.teams.A);
      setText(nameB, view.teams.B);
      for (const [team, num] of [['A', numA], ['B', numB]]) {
        const value = formatNumber(view.formatPoints[team]);
        if (num.textContent !== value) {
          const hadValue = num.textContent !== '';
          setText(num, value);
          if (animate && hadValue) replay(num, 'is-bumped');
        }
      }
    },
  };
}
