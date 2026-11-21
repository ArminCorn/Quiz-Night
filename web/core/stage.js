// Die Beamer-Bühne ist immer 1920×1080 groß und wird passend skaliert
// (16:9, mit Rand in Nachtblau, falls das Fenster ein anderes Format hat).

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export function fitStage(stage) {
  function fit() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  window.addEventListener('resize', fit);
  fit();
}
