// Aba aberta durante um deploy do Vercel tenta carregar um chunk que já não
// existe (ou mudou de hash) e a tela fica em branco. Caso real: Niziany,
// 27/10/2026. Aqui detectamos esse tipo de erro e recarregamos a página UMA
// vez (guarda de 60 s no sessionStorage para não entrar em loop).
const CHAVE = 'hc_reload_chunk_em';

export const ehErroDeChunk = (msg) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError|Failed to load module script|Unable to preload CSS/i.test(
    String(msg || ''),
  );

export function recarregarUmaVez(motivo) {
  try {
    const ultimo = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultimo < 60000) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    /* sessionStorage indisponível: recarrega mesmo assim */
  }
  console.warn('[headcoach] recarregando após falha de carregamento:', motivo);
  window.location.reload();
  return true;
}

// Liga os ouvintes globais (chamar uma vez no main.jsx)
export function instalarRecargaDeChunk() {
  window.addEventListener('vite:preloadError', (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    recarregarUmaVez('vite:preloadError');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e?.reason?.message || e?.reason;
    if (ehErroDeChunk(msg)) recarregarUmaVez(msg);
  });
  window.addEventListener(
    'error',
    (e) => {
      const msg = e?.message || e?.error?.message;
      if (ehErroDeChunk(msg)) recarregarUmaVez(msg);
    },
    true,
  );
}
