// fetch com prazo máximo para as chamadas que dependem da SEFAZ (emitir,
// consultar, cancelar, testar status). Sem isso, qualquer travamento do
// backend ou da SEFAZ deixa o botão girando para sempre.
export const SEFAZ_TIMEOUT_MS = 90000;

export async function fetchSefaz(url, options = {}, timeoutMs = SEFAZ_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    let j = null;
    try {
      j = await r.json();
    } catch {
      throw new Error(`Resposta inválida do servidor (HTTP ${r.status})`);
    }
    return { r, j };
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(
        `A SEFAZ não respondeu em ${Math.round(timeoutMs / 1000)}s. A operação pode ter sido concluída — use "Consultar SEFAZ" para verificar antes de tentar de novo.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
