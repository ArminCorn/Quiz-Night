// Beamer-Ansicht (/screen): zeigt die Show, keinerlei Bedienelemente.
//   Doppelklick  → Vollbild an/aus (alternativ F11)
//   ?preview=1   → Vorschau im Gamemaster-Fenster (ohne Ton)
import '../styles/base.css';
import './screen.css';
import { connect } from '../core/connection.js';
import { h } from '../core/dom.js';
import { initSounds, playSound } from '../core/sound.js';
import { fitStage } from '../core/stage.js';
import { createChapters } from './parts.js';
import { createScene, sceneKey } from './scenes.js';

const preview = new URLSearchParams(location.search).has('preview');
document.documentElement.classList.toggle('is-preview', preview);

start();

async function start() {
  const config = await fetch('/api/config')
    .then((r) => r.json())
    .catch(() => ({ title: 'Quiz Night' }));
  if (!preview) initSounds();

  const stage = document.getElementById('stage');
  fitStage(stage);

  const chapters = createChapters();
  const layer = h('div', { class: 'scene-layer' });
  const offline = h('div', { class: 'offline label', hidden: true }, 'Verbindung zum Server getrennt …');
  stage.append(chapters.el, layer, h('div', { class: 'scanlines', 'aria-hidden': 'true' }), offline);

  const ctx = { config, preview };
  let current = null; // { key, scene }
  let prev = null;
  let offlineTimer = null;

  connect('screen', {
    onStatus(online) {
      clearTimeout(offlineTimer);
      if (online) offline.hidden = true;
      else offlineTimer = setTimeout(() => (offline.hidden = false), 1500);
    },
    onState(msg) {
      const view = msg.view;
      const animate = Boolean(msg.animate) && prev !== null;

      if (!preview) for (const effect of msg.effects ?? []) if (effect.sound) playSound(effect.sound);

      chapters.update(view);

      const key = sceneKey(view);
      if (current?.key !== key) {
        if (current) leave(current.scene, animate);
        const scene = createScene(view, ctx);
        if (animate) scene.el.classList.add('scene-in');
        layer.append(scene.el);
        current = { key, scene };
        scene.update(view, { animate, entering: true, prev });
      } else {
        current.scene.update(view, { animate, entering: false, prev });
      }
      prev = view;
    },
  });

  function leave(scene, animate) {
    scene.destroy?.();
    if (!animate) return scene.el.remove();
    scene.el.classList.add('scene-out');
    setTimeout(() => scene.el.remove(), 350);
  }

  if (!preview) {
    document.addEventListener('dblclick', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });

    // Mauszeiger nach kurzer Zeit ausblenden
    let cursorTimer;
    const wake = () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 2000);
    };
    document.addEventListener('mousemove', wake);
    wake();
  }
}
