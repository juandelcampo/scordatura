// Reloj en un Worker: el navegador no lo frena cuando la pestaña queda en segundo plano.
const CODE = `let id; onmessage = (e) => { clearInterval(id); if (e.data) id = setInterval(() => postMessage(0), e.data); };`;

export function createTicker(milliseconds: number) {
  let worker: Worker | null = null;
  return {
    start(callback: () => void) {
      worker ??= new Worker(URL.createObjectURL(new Blob([CODE], { type: 'text/javascript' })));
      worker.onmessage = callback;
      worker.postMessage(milliseconds);
    },
    stop() {
      worker?.postMessage(0);
    },
  };
}
