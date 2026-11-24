// WebSocket-Verbindung zum Server, mit automatischem Wiederverbinden.
//
// Der Server schickt nach jeder Änderung den kompletten Stand (view) für die
// jeweilige Rolle. Die Fenster halten selbst keinen Spielzustand.

export function connect(role, { onState, onError, onStatus, onSettings } = {}) {
  let ws = null;
  let attempt = 0;

  function open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.addEventListener('open', () => {
      attempt = 0;
      ws.send(JSON.stringify({ t: 'hello', role }));
      onStatus?.(true);
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.t === 'state') onState?.(msg);
      else if (msg.t === 'settings') onSettings?.(msg);
      else if (msg.t === 'error') onError?.(msg.message);
    });

    ws.addEventListener('close', () => {
      onStatus?.(false);
      const delay = Math.min(250 * 2 ** attempt, 3000);
      attempt += 1;
      setTimeout(open, delay);
    });
  }

  open();

  return {
    /** Rohe Nachricht schicken (z. B. { t: 'settings', … }). */
    raw(message) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
      }
      onError?.('Keine Verbindung zum Server.');
      return false;
    },
    /** Aktion an den Server schicken. scope: 'core' | 'format' */
    send(scope, name, payload = {}) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: 'action', scope, name, payload }));
        return true;
      }
      onError?.('Keine Verbindung zum Server.');
      return false;
    },
  };
}
