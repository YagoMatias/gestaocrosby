// Página: Tecnologia → Portal RFID (teste)
// Liga o portal Chainway UR4 (via bridge TCP no backend) e mostra ao vivo as
// etiquetas lidas: EPC, contagem de leituras, RSSI (força do sinal), antena.
// Página de TESTE — valida a leitura do portal antes da integração definitiva.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Broadcast,
  Plugs,
  PlugsConnected,
  Trash,
  Spinner,
  ArrowsClockwise,
  WifiHigh,
  Copy,
  CheckCircle,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

const fmtHora = (ts) =>
  new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// RSSI forte (peça dentro do portal) vs fraco (tag no ambiente):
// no teste real, dentro ≈ -33 dBm e ambiente ≈ -79 dBm
const rssiInfo = (rssi) => {
  if (rssi >= -50)
    return { label: 'no portal', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' };
  if (rssi >= -65)
    return { label: 'perto', cls: 'bg-amber-100 text-amber-700 ring-amber-200' };
  return { label: 'longe', cls: 'bg-gray-100 text-gray-500 ring-gray-200' };
};

const PortalRFID = () => {
  const [host, setHost] = useState(
    () => localStorage.getItem('portal_rfid_host') || '192.168.0.202',
  );
  const [status, setStatus] = useState({ status: 'desconectado' });
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState('');
  const pollRef = useRef(null);

  useEffect(() => localStorage.setItem('portal_rfid_host', host), [host]);

  const ligado = status.status === 'lendo' || status.status === 'reconectando' || status.status === 'conectando';

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/portal-rfid/tags`);
      const j = await r.json();
      if (j?.data) {
        setStatus(j.data.status);
        setTags(j.data.tags || []);
      }
    } catch {
      /* backend fora — mantém último estado */
    }
  }, []);

  // Polling de 1s enquanto a página está aberta
  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  const ligar = useCallback(async () => {
    setBusy(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/portal-rfid/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) setErro(j?.message || 'Falha ao ligar o portal');
      else setStatus(j.data);
    } catch (e) {
      setErro(`Backend indisponível: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [host]);

  const desligar = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/portal-rfid/disconnect`, {
        method: 'POST',
      });
      const j = await r.json();
      if (j?.data) setStatus(j.data);
    } catch {
      /* segue */
    } finally {
      setBusy(false);
    }
  }, []);

  const limpar = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/portal-rfid/clear`, { method: 'POST' });
      setTags([]);
    } catch {
      /* segue */
    }
  }, []);

  const copiar = useCallback(async (epc) => {
    try {
      await navigator.clipboard.writeText(epc);
      setCopiado(epc);
      setTimeout(() => setCopiado(''), 1200);
    } catch {
      /* clipboard indisponível */
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        <PageTitle
          title="Portal RFID"
          subtitle="Teste do portal Chainway UR4 — ligue o portal e passe as etiquetas"
          icon={WifiHigh}
        />

        {/* Controles */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              IP do portal
            </label>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value.trim())}
              disabled={ligado}
              className="w-44 h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <button
            onClick={ligado ? desligar : ligar}
            disabled={busy}
            className={`h-10 inline-flex items-center gap-2 px-5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
              ligado
                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100'
                : 'bg-[#000638] text-white hover:bg-[#000638]/90'
            }`}
          >
            {busy ? (
              <Spinner size={17} className="animate-spin" />
            ) : ligado ? (
              <>
                <Plugs size={17} /> Desligar portal
              </>
            ) : (
              <>
                <PlugsConnected size={17} /> Ligar portal
              </>
            )}
          </button>

          {/* Status */}
          <span
            className={`h-10 inline-flex items-center gap-2 px-4 rounded-xl text-sm font-medium ring-1 ${
              status.status === 'lendo'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : status.status === 'reconectando' || status.status === 'conectando'
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : 'bg-gray-100 text-gray-500 ring-gray-200'
            }`}
          >
            {status.status === 'lendo' ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                Lendo — {status.totalReads ?? 0} leituras
              </>
            ) : status.status === 'reconectando' ? (
              <>
                <ArrowsClockwise size={15} className="animate-spin" />
                Reconectando…
              </>
            ) : status.status === 'conectando' ? (
              'Conectando…'
            ) : (
              'Desligado'
            )}
          </span>

          <div className="flex-1" />
          <button
            onClick={limpar}
            disabled={tags.length === 0}
            className="h-10 inline-flex items-center gap-1.5 px-4 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 ring-1 ring-rose-200 disabled:opacity-40 transition-colors"
          >
            <Trash size={16} /> Limpar
          </button>
        </div>
        {(erro || status.lastError) && (
          <p className="mt-2 text-sm text-rose-600">
            {erro || `Última falha: ${status.lastError}`}
          </p>
        )}

        {/* Tags lidas */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Broadcast size={18} className="text-[#000638]" />
            <h2 className="text-sm font-semibold text-gray-700">
              Etiquetas ({tags.length})
            </h2>
          </div>
          {tags.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">
              {ligado
                ? 'Nenhuma etiqueta ainda — aproxime uma peça do portal.'
                : 'Ligue o portal para começar a ler.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-2">EPC</th>
                    <th
                      className="px-2 py-2 w-24 text-center"
                      title="Quantas vezes o portal enxergou esta mesma etiqueta (varredura contínua)"
                    >
                      Vezes vista
                    </th>
                    <th className="px-2 py-2 w-28 text-center">Sinal</th>
                    <th className="px-2 py-2 w-16 text-center">Ant.</th>
                    <th className="px-2 py-2 w-24 text-right">Última</th>
                    <th className="px-2 py-2 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tags.map((t) => {
                    const ri = rssiInfo(t.rssi);
                    return (
                      <tr key={t.epc} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2.5 font-mono font-semibold text-[#000638] break-all select-all">
                          {t.epc}
                        </td>
                        <td className="px-2 py-2.5 text-center tabular-nums text-gray-600">
                          {t.count}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${ri.cls}`}
                            title={`${t.rssi?.toFixed(1)} dBm`}
                          >
                            {ri.label} · {t.rssi?.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-gray-500">
                          {t.ant}
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs text-gray-400 tabular-nums">
                          {fmtHora(t.lastSeen)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => copiar(t.epc)}
                            className="text-gray-300 hover:text-[#000638] transition-colors"
                            title="Copiar EPC"
                          >
                            {copiado === t.epc ? (
                              <CheckCircle size={16} className="text-emerald-500" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 max-w-xl mx-auto">
          O portal lê continuamente (~17 leituras/s por tag). &quot;no
          portal&quot; = sinal forte (peça dentro do vão); &quot;longe&quot; =
          tag captada no ambiente. O backend mantém a conexão e reconecta
          sozinho se o portal cair.
        </p>
      </div>
    </div>
  );
};

export default PortalRFID;
