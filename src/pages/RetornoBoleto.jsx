// Retorno Boleto — boletos emitidos na Pagar.me (Envio de Remessa) e a
// situação de cada um: em aberto, vencido, pago, cancelado. Os pagos são
// baixados no TOTVS automaticamente pelo backend (job a cada 30 min);
// "Atualizar retorno" força a consulta à Pagar.me e a baixa na hora.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  MagnifyingGlass,
  Spinner,
  Warning,
  CheckCircle,
  ArrowsClockwise,
  Copy,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';

const iso = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

function fmtBRL(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s) {
  if (!s) return '—';
  if (String(s).length > 10) return new Date(s).toLocaleDateString('pt-BR');
  const [a, m, d] = String(s).split('-');
  return d ? `${d}/${m}/${a}` : s;
}

const SITUACOES = {
  aberto: { label: 'Em aberto', cls: 'bg-blue-100 text-blue-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  pago: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-200 text-gray-700' },
  falhou: { label: 'Não emitido', cls: 'bg-amber-100 text-amber-800' },
};

const BAIXAS = {
  processada: { label: 'Baixada no TOTVS', cls: 'text-green-700' },
  processando: { label: 'Baixando...', cls: 'text-blue-700' },
  erro: { label: 'Erro na baixa', cls: 'text-red-600' },
  pendente: { label: 'Aguardando baixa', cls: 'text-amber-600' },
};

export default function RetornoBoleto() {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [modo, setModo] = useState('vencimento');
  const [dataInicio, setDataInicio] = useState(iso(-30));
  const [dataFim, setDataFim] = useState(iso(60));
  const [situacao, setSituacao] = useState('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const [boletos, setBoletos] = useState([]);
  const [copiado, setCopiado] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({ modo, dt_inicio: dataInicio, dt_fim: dataFim });
      if (empresasSelecionadas.length) {
        params.append('branches', empresasSelecionadas.map((e) => e.cd_empresa).join(','));
      }
      const resp = await fetch(`${TotvsURL}remessa-boletos/boletos?${params}`);
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      setBoletos(json.data?.items || []);
      setTabelaAusente(Boolean(json.data?.tabelaAusente));
    } catch (e) {
      setErro(`Erro ao carregar boletos: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sincronizar = async () => {
    setSincronizando(true);
    setErro('');
    setAviso('');
    try {
      const resp = await fetch(`${TotvsURL}remessa-boletos/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentarErros: true }),
      });
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      const r = json.data || {};
      setAviso(
        `${r.consultados || 0} boleto(s) consultado(s) na Pagar.me: ${r.pagos || 0} pago(s), ` +
          `${r.cancelados || 0} cancelado(s), ${r.baixados || 0} baixa(s) no TOTVS` +
          (r.errosBaixa ? `, ${r.errosBaixa} erro(s) de baixa` : '') +
          (r.errosConsulta ? `, ${r.errosConsulta} sem resposta da Pagar.me` : '') +
          '.',
      );
      await carregar();
    } catch (e) {
      setErro(`Erro ao atualizar retorno: ${e.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const copiar = async (b) => {
    try {
      await navigator.clipboard.writeText(b.linha_digitavel);
      setCopiado(b.id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  const contagem = useMemo(() => {
    const c = {};
    for (const b of boletos) {
      c[b.situacao] = c[b.situacao] || { qtd: 0, valor: 0 };
      c[b.situacao].qtd++;
      c[b.situacao].valor += Number(b.vl_fatura || 0);
    }
    return c;
  }, [boletos]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return boletos.filter(
      (b) =>
        (situacao === 'todos' || b.situacao === situacao) &&
        (!q ||
          [b.nm_cliente, b.nr_documento, b.cd_cliente, b.nr_fatura, b.nosso_numero]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [boletos, situacao, busca]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Retorno Boleto"
        subtitle="Boletos emitidos na Pagar.me, situação de cada um e baixa automática dos pagos"
        icon={Barcode}
        iconColor="text-green-600"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 items-end">
          <div className="lg:col-span-2">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Período por</label>
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            >
              <option value="vencimento">Vencimento</option>
              <option value="emissao">Emissão do boleto</option>
              <option value="pagamento">Pagamento</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">De</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Até</label>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Status</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            >
              <option value="todos">Todos</option>
              {Object.entries(SITUACOES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={14} weight="bold" />
            )}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {erro && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <Warning size={14} weight="fill" /> {erro}
          </div>
        )}
        {aviso && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle size={14} weight="fill" /> {aviso}
          </div>
        )}
        {tabelaAusente && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <Warning size={14} weight="fill" /> A tabela pagarme_boletos ainda não existe no Supabase
            — rode a migration.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {['aberto', 'vencido', 'pago', 'cancelado'].map((k) => (
          <button
            key={k}
            onClick={() => setSituacao(situacao === k ? 'todos' : k)}
            className={`text-left bg-white rounded-lg border p-3 ${
              situacao === k ? 'border-[#000638] ring-1 ring-[#000638]' : 'border-gray-200'
            }`}
          >
            <div className="text-[11px] text-gray-500">{SITUACOES[k].label}</div>
            <div className="text-lg font-bold text-[#000638]">
              {contagem[k]?.qtd || 0}{' '}
              <span className="text-xs font-semibold text-gray-500">
                {fmtBRL(contagem[k]?.valor || 0)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-2 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por cliente, CPF/CNPJ ou nº da fatura"
            className="border border-gray-300 rounded-lg px-2 py-1.5 w-full sm:w-80 text-xs"
          />
          <button
            onClick={sincronizar}
            disabled={sincronizando || tabelaAusente}
            title="Consulta a Pagar.me agora e baixa no TOTVS os boletos pagos"
            className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {sincronizando ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={14} weight="bold" />
            )}
            {sincronizando ? 'Atualizando...' : 'Atualizar retorno'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#000638] text-white">
              <tr>
                <th className="px-2 py-2 text-left">Empresa</th>
                <th className="px-2 py-2 text-left">Cliente</th>
                <th className="px-2 py-2 text-left">Fatura</th>
                <th className="px-2 py-2 text-left">Emissão boleto</th>
                <th className="px-2 py-2 text-left">Vencimento</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Pago em</th>
                <th className="px-2 py-2 text-right">Valor pago</th>
                <th className="px-2 py-2 text-left">Baixa TOTVS</th>
                <th className="px-2 py-2 text-left">Boleto</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 py-6 text-center text-gray-500">
                    {loading ? 'Carregando...' : 'Nenhum boleto no filtro.'}
                  </td>
                </tr>
              )}
              {visiveis.map((b) => {
                const sit = SITUACOES[b.situacao] || { label: b.status, cls: 'bg-gray-100' };
                const bx = BAIXAS[b.baixa_status];
                return (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 whitespace-nowrap">{b.cd_empresa}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-gray-500">{b.cd_cliente} - </span>
                      <span className="font-semibold text-[#000638]">{b.nm_cliente || '—'}</span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.nr_fatura}/{b.nr_parcela}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.created_at)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.dt_vencimento)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                      {fmtBRL(b.vl_fatura)}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`inline-block font-semibold rounded px-1.5 py-0.5 ${sit.cls}`}
                        title={b.erro || ''}
                      >
                        {sit.label}
                      </span>
                      {b.situacao !== 'falhou' && !b.carteira_ok && (
                        <span
                          className="ml-1 text-amber-600"
                          title={`Carteira não mudou para Simples no TOTVS: ${b.carteira_erro || 'não processado'}`}
                        >
                          <Warning size={13} weight="fill" className="inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.dt_pagamento)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmtBRL(b.vl_pago)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.situacao === 'pago' && bx ? (
                        <span className={`font-semibold ${bx.cls}`} title={b.baixa_erro || ''}>
                          {bx.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.boleto_url ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={b.boleto_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir boleto"
                            className="text-[#000638] hover:text-[#fe0000]"
                          >
                            <ArrowSquareOut size={15} weight="bold" />
                          </a>
                          <button
                            onClick={() => copiar(b)}
                            title="Copiar linha digitável"
                            className="text-[#000638] hover:text-[#fe0000]"
                          >
                            {copiado === b.id ? (
                              <CheckCircle size={15} weight="fill" className="text-green-700" />
                            ) : (
                              <Copy size={15} weight="bold" />
                            )}
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
