// Kleine DOM-Helfer für Kern und Formate (import { h } from '@core/dom.js').

/**
 * Element bauen: h('div', { class: 'x', onClick: fn }, 'Text', kind, [weitere])
 * Texte werden immer als Text eingefügt (kein HTML) – sicher für Teamnamen usw.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Text nur setzen, wenn er sich ändert (verhindert unnötiges Neuzeichnen). */
export function setText(el, value) {
  const text = String(value ?? '');
  if (el.textContent !== text) el.textContent = text;
}

/** CSS-Animation (erneut) abspielen, indem die Klasse kurz entfernt wird. */
export function replay(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // Reflow erzwingen
  el.classList.add(className);
}

/**
 * Schriftgröße so weit verkleinern, bis der Text in seine Box passt.
 * Die Box (el) braucht eine feste Breite; maxHeight begrenzt die Höhe.
 */
export function fitText(el, { max, min = 24, maxHeight, step = 4 }) {
  let size = max;
  el.style.fontSize = `${size}px`;
  const tooBig = () => el.scrollWidth > el.clientWidth + 1 || (maxHeight && el.scrollHeight > maxHeight);
  while (size > min && tooBig()) {
    size -= step;
    el.style.fontSize = `${size}px`;
  }
  return size;
}

/** Zahl von a nach b hochzählen lassen. Neuer Aufruf auf demselben Element bricht den alten ab. */
export function countUp(el, from, to, duration = 1400) {
  const token = Symbol('count');
  el._countToken = token;
  const start = performance.now();
  el.textContent = formatNumber(from);
  return new Promise((resolve) => {
    function tick(now) {
      if (el._countToken !== token) return resolve(false);
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 2);
      el.textContent = formatNumber(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
      else resolve(true);
    }
    requestAnimationFrame(tick);
  });
}

/** Laufende Hochzähl-Animation abbrechen und Wert direkt setzen. */
export function setCount(el, value) {
  el._countToken = null;
  setText(el, formatNumber(value));
}

/** Wert zwischen Teams formatieren (negative Zahlen mit echtem Minus). */
export function formatNumber(n) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}
