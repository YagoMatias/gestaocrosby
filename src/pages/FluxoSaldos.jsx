import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config/constants';
import { Money, ArrowsClockwise, CircleNotch, HandCoins, FloppyDisk } from '@phosphor-icons/react';

const BASE = `${API_BASE_URL}/api/fluxo-saldos`;
const brl = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FluxoSaldos = () => {
  const { user } = useAuth();
  const quem = user?.email || user?.nome || 'HeadCoach';

  const [dia, setDia] = useState(new Date().toISOString().slice(0, 10));
  const [dados, setDados] = useState(null);
  const [sangrias, setSangrias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [edit, setEdit] = useState({}); // cd_empresa -> valor digitado do saldo contado
  const [salvando, setSalvando] = useState(null);
  const [pedindo, setPedindo] = useState(null);
  const [puxandoVendas, setPuxandoVendas] = useState(false);
  const [detalhe, setDetalhe] = useState({}); // cd_empresa -> { carregando, notas }
  const [vendasPuxadas, setVendasPuxadas] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [rs, rg] = await Promise.all([
        fetch(`${BASE}/?dia=${dia}`),
        fetch(`${BASE}/sangrias?dias=45`),
      ]);
      if (!rs.ok) throw new Error(`saldos HTTP ${rs.status}`);
      setDados(await rs.json());
      setSangrias(rg.ok ? await rg.json() : []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [dia]);

  useEffect(() => {
    carregar();
    setVendasPuxadas(false);
    setDetalhe({});
  }, [carregar]);

  // Puxa o dinheiro do dia das NFC-e (lento na 1ª vez; cacheado por nota).
  const puxarVendas = async () => {
    setPuxandoVendas(true);
    setErro(null);
    try {
      const r = await fetch(`${BASE}/?dia=${dia}&vendas=1`);
      if (!r.ok) throw new Error(`vendas HTTP ${r.status}`);
      setDados(await r.json());
      setVendasPuxadas(true);
    } catch (e) {
      setErro(`Não consegui puxar as vendas do dia: ${e.message}`);
    } finally {
      setPuxandoVendas(false);
    }
  };

  const verNotas = async (loja) => {
    if (detalhe[loja.cd_empresa]?.notas) {
      setDetalhe((p) => ({ ...p, [loja.cd_empresa]: undefined }));
      return;
    }
    setDetalhe((p) => ({ ...p, [loja.cd_empresa]: { carregando: true } }));
    try {
      const r = await fetch(`${BASE}/dia-detalhe?loja=${loja.cd_empresa}&dia=${dia}`);
      const j = await r.json();
      setDetalhe((p) => ({ ...p, [loja.cd_empresa]: { notas: j.detalhe || [], qtd: j.qtd_notas, dinheiro: j.dinheiro } }));
    } catch (e) {
      setDetalhe((p) => ({ ...p, [loja.cd_empresa]: { erro: e.message } }));
    }
  };

  const salvarPartida = async (loja) => {
    const valor = parseFloat(String(edit[loja.cd_empresa]).replace(',', '.'));
    if (!Number.isFinite(valor)) {
      setErro('Informe um valor numérico para o saldo contado.');
      return;
    }
    setSalvando(loja.cd_empresa);
    try {
      const r = await fetch(`${BASE}/partida`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cd_empresa: loja.cd_empresa, saldo: valor, contado_em: dia, user_nome: quem }),
      });
      if (!r.ok) throw new Error(`partida HTTP ${r.status}`);
      setEdit((p) => ({ ...p, [loja.cd_empresa]: undefined }));
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(null);
    }
  };

  const solicitarSangria = async (loja) => {
    if (!loja.sangria_disponivel || loja.sangria_disponivel <= 0) return;
    if (
      !window.confirm(
        `Solicitar sangria de ${brl(loja.sangria_disponivel)} da loja ${loja.loja}?\nFica na loja: ${brl(loja.fica_na_loja)} (fundo de caixa).`,
      )
    )
      return;
    setPedindo(loja.cd_empresa);
    try {
      const r = await fetch(`${BASE}/sangrias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cd_empresa: loja.cd_empresa,
          valor: loja.sangria_disponivel,
          data: dia,
          solicitado_por: quem,
          observacao: `Saldo em caixa ${brl(loja.saldo_em_caixa)}; fica ${brl(loja.fica_na_loja)}.`,
        }),
      });
      if (!r.ok) throw new Error(`sangria HTTP ${r.status}`);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setPedindo(null);
    }
  };

  const mudarStatus = async (id, status) => {
    try {
      await fetch(`${BASE}/sangrias/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, aprovado_por: quem }),
      });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const lojas = dados?.lojas || [];
  const totalSangria = useMemo(
    () => lojas.reduce((a, l) => a + (Number(l.sangria_disponivel) || 0), 0),
    [lojas],
  );

  const badgeStatus = (s) => {
    const cor =
      s === 'aprovada' ? 'bg-emerald-100 text-emerald-700'
      : s === 'depositada' ? 'bg-blue-100 text-blue-700'
      : s === 'rejeitada' || s === 'cancelada' ? 'bg-gray-200 text-gray-600'
      : 'bg-amber-100 text-amber-700';
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cor}`}>{s}</span>;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <PageTitle
        title="Fluxo de Saldos"
        subtitle="Saldo em dinheiro por loja, cálculo de sangria e pedido de retirada"
        icon={Money}
        iconColor="text-emerald-600"
      />

      <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        O <b>saldo em caixa</b> = <b>saldo contado</b> (que você informa por loja) + <b>dinheiro do dia</b>
        (vendas em dinheiro das NFC-e). Clique em <b>"Puxar vendas do dia"</b> para calcular o dinheiro do
        dia (demora um pouco na 1ª vez; depois fica em cache). A <b>sangria</b> e o <b>pedido de retirada</b>
        usam esse saldo.
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Dia</label>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="border border-[#000638]/30 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
          />
        </div>
        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 font-bold text-xs uppercase tracking-wide shadow-md h-8"
        >
          {loading ? <CircleNotch size={16} className="animate-spin" /> : <ArrowsClockwise size={16} />}
          Atualizar
        </button>
        <button
          type="button"
          onClick={puxarVendas}
          disabled={puxandoVendas}
          title="Calcula o dinheiro do dia das NFC-e por loja (demora um pouco na 1ª vez)"
          className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-bold text-xs uppercase tracking-wide shadow-md h-8"
        >
          {puxandoVendas ? <CircleNotch size={16} className="animate-spin" /> : <Money size={16} />}
          {vendasPuxadas ? 'Recalcular vendas' : 'Puxar vendas do dia'}
        </button>
        {puxandoVendas && <span className="text-xs text-amber-700">Puxando vendas (pode levar alguns minutos)…</span>}
        <div className="ml-auto text-xs text-gray-600">
          Sangria disponível (total): <b className="text-emerald-700">{brl(totalSangria)}</b>
        </div>
      </div>

      {erro && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{erro}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#000638] text-white">
            <tr>
              <th className="text-left px-3 py-2">Loja</th>
              <th className="text-right px-3 py-2">Saldo contado</th>
              <th className="text-right px-3 py-2">Dinheiro do dia</th>
              <th className="text-right px-3 py-2">Saldo em caixa</th>
              <th className="text-right px-3 py-2">Sangria disponível</th>
              <th className="text-right px-3 py-2">Fica na loja</th>
              <th className="text-center px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {lojas.map((l) => {
              const emEdicao = edit[l.cd_empresa] !== undefined;
              const det = detalhe[l.cd_empresa];
              return (
              <React.Fragment key={l.cd_empresa}>
                <tr className="border-t border-gray-100 hover:bg-[#f8f9fb]">
                  <td className="px-3 py-2 font-medium text-[#000638]">
                    <button type="button" onClick={() => verNotas(l)} className="hover:underline text-left" title="Ver as vendas em dinheiro do dia">
                      {l.loja} <span className="text-gray-400 text-xs">({l.cd_empresa})</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={l.saldo_partida != null ? String(l.saldo_partida) : '—'}
                        value={emEdicao ? edit[l.cd_empresa] : (l.saldo_partida ?? '')}
                        onChange={(e) => setEdit((p) => ({ ...p, [l.cd_empresa]: e.target.value }))}
                        className="w-24 border border-gray-300 rounded px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]"
                      />
                      <button
                        type="button"
                        title="Salvar saldo contado"
                        onClick={() => salvarPartida(l)}
                        disabled={salvando === l.cd_empresa || !emEdicao}
                        className="text-[#000638] hover:text-[#fe0000] disabled:opacity-30"
                      >
                        {salvando === l.cd_empresa ? <CircleNotch size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                      </button>
                    </div>
                    {l.contado_em && <div className="text-[10px] text-gray-400">contado {l.contado_em}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">{l.dinheiro_dia == null ? 'pendente' : brl(l.dinheiro_dia)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{brl(l.saldo_em_caixa)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{brl(l.sangria_disponivel)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{brl(l.fica_na_loja)}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => solicitarSangria(l)}
                      disabled={pedindo === l.cd_empresa || !l.sangria_disponivel || l.sangria_disponivel <= 0}
                      className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-40 text-xs font-bold"
                    >
                      {pedindo === l.cd_empresa ? <CircleNotch size={14} className="animate-spin" /> : <HandCoins size={14} />}
                      Solicitar sangria
                    </button>
                  </td>
                </tr>
                {det && (
                  <tr className="bg-[#f8f9fb]">
                    <td colSpan={7} className="px-4 py-2">
                      {det.carregando && <span className="text-xs text-gray-500">Carregando vendas em dinheiro…</span>}
                      {det.erro && <span className="text-xs text-red-600">Erro: {det.erro}</span>}
                      {det.notas && (
                        <div className="text-xs">
                          <div className="font-semibold text-[#000638] mb-1">
                            Vendas em dinheiro de {l.loja} em {dados?.dia}: {det.qtd} nota(s), total {brl(det.dinheiro)}
                          </div>
                          {det.notas.length ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {det.notas.map((n) => (
                                <span key={n.accessKey} className="text-gray-600">
                                  NF {n.invoiceCode}: <b>{brl(n.dinheiro)}</b>{n.troco ? ` (troco ${brl(n.troco)})` : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">Nenhuma venda em dinheiro no dia.</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
            {!lojas.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  {loading ? 'Carregando…' : 'Sem lojas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 mb-2 text-sm font-bold text-[#000638]">Pedidos de sangria (últimos 45 dias)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-[#000638]">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Loja</th>
              <th className="text-right px-3 py-2">Valor</th>
              <th className="text-left px-3 py-2">Solicitado por</th>
              <th className="text-center px-3 py-2">Status</th>
              <th className="text-center px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {sangrias.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{s.data}</td>
                <td className="px-3 py-2">{s.loja_nome || s.cd_empresa}</td>
                <td className="px-3 py-2 text-right font-semibold">{brl(s.valor)}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{s.solicitado_por || '—'}</td>
                <td className="px-3 py-2 text-center">{badgeStatus(s.status)}</td>
                <td className="px-3 py-2 text-center">
                  {s.status === 'solicitada' && (
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => mudarStatus(s.id, 'aprovada')} className="text-emerald-700 hover:underline text-xs font-semibold">Aprovar</button>
                      <span className="text-gray-300">·</span>
                      <button type="button" onClick={() => mudarStatus(s.id, 'rejeitada')} className="text-gray-500 hover:underline text-xs">Rejeitar</button>
                    </div>
                  )}
                  {s.status === 'aprovada' && (
                    <button type="button" onClick={() => mudarStatus(s.id, 'depositada')} className="text-blue-700 hover:underline text-xs font-semibold">Marcar depositada</button>
                  )}
                </td>
              </tr>
            ))}
            {!sangrias.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">Nenhum pedido ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FluxoSaldos;
