// Bausteine für Eingabemasken in der Gamemaster-Ansicht.
//
// Gedacht für Formate, in denen der Gamemaster Inhalte von Papierkarten
// eintippt (z. B. erfundene Antworten mit Namen/Nummer, danach Stimmen).
// Der Kern liefert hier nur allgemeine Bausteine, keine fertige Maske.
//
//   import { textField, numberField, rowsEditor } from '@core/forms.js';
//
// Regeln, die diese Bausteine einhalten (und die ein Format beachten sollte):
//  - Das Format baut die Maske EINMAL in mountHost() und aktualisiert sie in
//    update() nur über `set()`. Felder, in die gerade getippt wird, werden von
//    `set()` nie überschrieben, ein Zustandswechsel kostet also keine Eingabe.
//  - Leertaste, 1, 2, Z usw. wirken nicht, solange ein Eingabefeld Fokus hat
//    (das regelt der Kern). Auch Strg+Z bleibt im Feld das normale Rückgängig.
//  - Abgetippte, noch nicht abgeschickte Entwürfe liegen im Browser
//    (localStorage). Neuladen oder ein Fensterabsturz verliert sie nicht.
//    Der Entwurf bleibt, bis das Format `clear()` aufruft, am besten erst, wenn
//    der Zustand zeigt, dass der Server die Eingabe übernommen hat. Lehnt der
//    Server ab (api.fail), geht nichts verloren.
//  - Was der Gamemaster abschickt, geht als normale Aktion an den Server. Dort
//    wird es mit api.cleanText / api.cleanInt geprüft und gespeichert, damit
//    gelten Speichern, Wiederherstellen und Rückgängig wie bei allem anderen.
import { h } from './dom.js';

const DRAFT_PREFIX = 'qn-draft:';

function readDraft(key) {
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(DRAFT_PREFIX + key));
  } catch {
    return null;
  }
}
function writeDraft(key, value) {
  if (!key) return;
  try {
    if (value == null) localStorage.removeItem(DRAFT_PREFIX + key);
    else localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value));
  } catch {
    // Speicher blockiert → ohne Entwurf weiterarbeiten
  }
}

/** Beschriftetes Eingabefeld. type: 'text' | 'number' */
export function field({ label, type = 'text', value = '', placeholder = '', maxlength, min, max, onInput, onEnter, className = '' }) {
  const input = h('input', {
    type: type === 'number' ? 'number' : 'text',
    value: String(value ?? ''),
    placeholder,
    maxlength: type === 'text' ? (maxlength ?? 200) : null,
    min: type === 'number' ? (min ?? 0) : null,
    max: type === 'number' ? max : null,
    inputmode: type === 'number' ? 'numeric' : null,
    autocomplete: 'off',
    spellcheck: 'false',
    class: 'form-input',
  });
  if (onInput) input.addEventListener('input', () => onInput(input.value));
  if (onEnter) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        onEnter(input.value);
      }
    });
  }
  const el = h('label', { class: `form-field ${className}`.trim() }, label ? h('span', { class: 'label form-label' }, label) : null, input);
  return {
    el,
    input,
    get: () => input.value,
    /** Wert setzen, aber nicht, solange darin getippt wird. */
    set(v) {
      if (document.activeElement === input) return;
      const text = String(v ?? '');
      if (input.value !== text) input.value = text;
    },
    focus: () => input.focus(),
  };
}

export const textField = (opts) => field({ ...opts, type: 'text' });
export const numberField = (opts) => field({ ...opts, type: 'number' });

/**
 * Tabelle zum Eintippen von Zeilen (eine Zeile pro Papierkarte).
 *
 *   const editor = rowsEditor({
 *     draftKey: `${ctx.formatId}:antworten`,        // optional, rettet den Entwurf
 *     columns: [
 *       { key: 'name', label: 'Name / Nr.', type: 'text', placeholder: 'z. B. 3' },
 *       { key: 'text', label: 'Antwort', type: 'text', wide: true },
 *     ],
 *     minRows: 5,
 *     submitLabel: 'Übernehmen',
 *     onSubmit(rows) { ctx.send('saveAnswers', { rows }); },   // rows: [{ name, text }, …]
 *   });
 *   root.append(editor.el);
 *
 * Enter springt ins nächste Feld, in der letzten Spalte der letzten Zeile
 * legt Enter eine neue Zeile an. Komplett leere Zeilen werden beim Abschicken
 * ignoriert. Zahlenspalten liefern Zahlen (leer = null).
 */
export function rowsEditor({ columns, draftKey, minRows = 3, submitLabel = 'Übernehmen', onSubmit }) {
  const body = h('div', { class: 'rows-body' });
  const rows = []; // [{ el, inputs: { key: input } }]

  const head = h('div', { class: 'rows-row rows-head' }, columns.map((c) => h('span', { class: `label${c.wide ? ' is-wide' : ''}` }, c.label)), h('span'));

  function snapshot() {
    return rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, r.inputs[c.key].value])));
  }
  function save() {
    const data = snapshot();
    const empty = data.every((r) => Object.values(r).every((v) => v === ''));
    writeDraft(draftKey, empty ? null : data);
  }

  function addRow(values = {}) {
    const inputs = {};
    const cells = columns.map((c) => {
      const input = h('input', {
        type: c.type === 'number' ? 'number' : 'text',
        class: `form-input${c.wide ? ' is-wide' : ''}`,
        placeholder: c.placeholder ?? '',
        maxlength: c.type === 'number' ? null : (c.maxlength ?? 200),
        min: c.type === 'number' ? (c.min ?? 0) : null,
        max: c.type === 'number' ? c.max : null,
        inputmode: c.type === 'number' ? 'numeric' : null,
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-label': c.label,
        value: String(values[c.key] ?? ''),
      });
      inputs[c.key] = input;
      input.addEventListener('input', save);
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        const flat = rows.flatMap((r) => columns.map((col) => r.inputs[col.key]));
        const next = flat[flat.indexOf(input) + 1];
        if (next) next.focus();
        else {
          addRow();
          rows.at(-1).inputs[columns[0].key].focus();
        }
      });
      return input;
    });
    const remove = h('button', { class: 'btn btn-small', type: 'button', title: 'Zeile entfernen', onClick: () => removeRow(row) }, '×');
    const el = h('div', { class: 'rows-row' }, cells, remove);
    const row = { el, inputs };
    rows.push(row);
    body.append(el);
    return row;
  }

  function removeRow(row) {
    if (rows.length <= 1) {
      for (const input of Object.values(row.inputs)) input.value = '';
    } else {
      rows.splice(rows.indexOf(row), 1);
      row.el.remove();
    }
    save();
  }

  function fill(data) {
    rows.length = 0;
    body.replaceChildren();
    for (const values of data) addRow(values);
    while (rows.length < minRows) addRow();
  }

  function submit() {
    const out = [];
    for (const r of rows) {
      const item = {};
      let any = false;
      for (const c of columns) {
        const raw = r.inputs[c.key].value.trim();
        if (raw !== '') any = true;
        item[c.key] = c.type === 'number' ? (raw === '' ? null : Number(raw)) : raw;
      }
      if (any) out.push(item);
    }
    if (out.length === 0) return false;
    onSubmit(out);
    return true;
  }

  const addBtn = h('button', { class: 'btn btn-small', type: 'button', onClick: () => addRow() }, 'Zeile hinzufügen');
  const submitBtn = h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, submitLabel);
  const el = h('div', { class: 'rows-editor' }, head, body, h('div', { class: 'rows-actions' }, addBtn, submitBtn));

  fill(readDraft(draftKey) ?? []);

  return {
    el,
    /** Zeilen abschicken (wie der Knopf). Gibt false zurück, wenn alles leer ist. */
    submit,
    /** Eingaben und gespeicherten Entwurf löschen (z. B. nach erfolgreichem Speichern). */
    clear() {
      fill([]);
      writeDraft(draftKey, null);
    },
    /** Zeilen von außen setzen (z. B. zum Korrigieren bereits gespeicherter Eingaben). */
    setRows: (data) => {
      fill(data);
      save();
    },
    get: snapshot,
  };
}
