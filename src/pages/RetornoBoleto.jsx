// Retorno Boleto — boletos emitidos na Pagar.me (Envio de Remessa) e a
// situação de cada um: em aberto, vencido, pago, cancelado. Os pagos são
// baixados no TOTVS automaticamente pelo backend (job a cada 30 min);
// "Atualizar retorno" força a consulta à Pagar.me e a baixa na hora.
// "Baixa em massa na Pagar.me" cancela boletos pendentes lá (cliente pagou por
// outro meio, renegociou...): cola uma lista de clientes ou faturas, confere o
// que seria cancelado e confirma. O título no TOTVS não muda.
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
  Prohibit,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { useAuth } from '../components/AuthContext';

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

  // ── baixa em massa na Pagar.me ──
  const { user } = useAuth();
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [baixaTipo, setBaixaTipo] = useState('clientes'); // 'clientes' | 'faturas'
  const [baixaLista, setBaixaLista] = useState('');
  const [baixaMotivo, setBaixaMotivo] = useState('');
  const [baixaConferencia, setBaixaConferencia] = useState(null); // resposta de confirmar=false
  const [baixaResultado, setBaixaResultado] = useState(null); // resposta de confirmar=true
  const [baixaErro, setBaixaErro] = useState('');
  const [baixaCarregando, setBaixaCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());

  // "1234", "1234/2", "5-1234-2" (empresa-fatura-parcela), separados por
  // linha, vírgula, ponto e vírgula ou espaço
  const listaParseada = useMemo(() => {
    const tokens = baixaLista
      .split(/[\n,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (baixaTipo === 'clientes') {
      return { clientes: [...new Set(tokens.map((t) => parseInt(t, 10)).filter((n) => n > 0))], faturas: [] };
    }
    const faturas = [];
    for (const t of tokens) {
      const m3 = t.match(/^(\d+)-(\d+)-(\d+)$/);
      const m2 = t.match(/^(\d+)\/(\d+)$/);
      const m1 = t.match(/^(\d+)$/);
      if (m3) faturas.push({ cd_empresa: +m3[1], nr_fatura: +m3[2], nr_parcela: +m3[3] });
      else if (m2) faturas.push({ nr_fatura: +m2[1], nr_parcela: +m2[2] });
      else if (m1) faturas.push({ nr_fatura: +m1[1] });
    }
    return { clientes: [], faturas };
  }, [baixaLista, baixaTipo]);

  const chamarBaixa = async (body) => {
    const resp = await fetch(`${TotvsURL}remessa-boletos/baixar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, usuario: user?.name || user?.email || '' }),
    });
    const json = await resp.json();
    if (!resp.ok || json.success === false) {
      throw new Error(json.message || `HTTP ${resp.status}`);
    }
    return json.data || {};
  };

  const criterio = () => {
    if (selecionados.size) return { ids: [...selecionados] };
    return listaParseada;
  };

  const conferirBaixa = async () => {
    setBaixaErro('');
    setBaixaResultado(null);
    setBaixaConferencia(null);
    const c = criterio();
    if (!c.ids?.length && !c.clientes?.length && !c.faturas?.length) {
      setBaixaErro('Selecione boletos na tabela ou cole uma lista de clientes/faturas.');
      return;
    }
    setBaixaCarregando(true);
    try {
      setBaixaConferencia(await chamarBaixa({ ...c, confirmar: false }));
    } catch (e) {
      setBaixaErro(`Erro na conferência: ${e.message}`);
    } finally {
      setBaixaCarregando(false);
    }
  };

  const confirmarBaixa = async () => {
    if (!baixaConferencia?.qtd) return;
    const ok = window.confirm(
      `Cancelar ${baixaConferencia.qtd} boleto(s) na Pagar.me (${fmtBRL(baixaConferencia.valor)})?\n` +
        'Os clientes não conseguirão mais pagar esses boletos. Os títulos no TOTVS continuam em aberto.',
    );
    if (!ok) return;
    setBaixaErro('');
    setBaixaCarregando(true);
    try {
      // cancela exatamente o que foi conferido (ids), mesmo que a lista tenha mudado
      const r = await chamarBaixa({
        ids: baixaConferencia.itens.map((i) => i.id),
        confirmar: true,
        motivo: baixaMotivo,
      });
      setBaixaResultado(r);
      setBaixaConferencia(null);
      setSelecionados(new Set());
      setAviso(
        `${r.qtd} boleto(s) baixado(s) na Pagar.me (${fmtBRL(r.valor)})` +
          (r.erros?.length ? `, ${r.erros.length} com erro` : '') +
          '.',
      );
      await carregar();
    } catch (e) {
      setBaixaErro(`Erro ao baixar: ${e.message}`);
    } finally {
      setBaixaCarregando(false);
    }
  };

  const alternarSelecao = (id) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 items-center">
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
            className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60 lg:mt-4"
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

      {/* Baixa em massa na Pagar.me */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 mb-3">
        <button
          type="button"
          onClick={() => setBaixaAberta((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-[#000638]">
            <Prohibit size={16} weight="bold" className="text-red-600" />
            Baixa em massa na Pagar.me
            {selecionados.size > 0 && (
              <span className="ml-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px]">
                {selecionados.size} selecionado(s) na tabela
              </span>
            )}
          </span>
          {baixaAberta ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>
        {baixaAberta && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mt-2">
              Cancela na Pagar.me os boletos <b>pendentes</b> (em aberto ou vencidos) dos
              clientes ou faturas informados — o cliente não consegue mais pagar o boleto.
              O título no TOTVS <b>não</b> muda. Marque os boletos na tabela abaixo ou cole
              uma lista; depois clique em <b>Conferir</b> e, se estiver certo, em{' '}
              <b>Confirmar baixa</b>.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-2 mt-2 items-start">
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Lista de</label>
                <select
                  value={baixaTipo}
                  onChange={(e) => setBaixaTipo(e.target.value)}
                  disabled={selecionados.size > 0}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
                >
                  <option value="clientes">Códigos de cliente</option>
                  <option value="faturas">Números de fatura</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  {baixaTipo === 'clientes'
                    ? 'Um código por linha (ou separados por vírgula). Pega todos os boletos pendentes do cliente.'
                    : 'Uma fatura por linha: 1234 (todas as parcelas), 1234/2 (parcela) ou 5-1234-2 (empresa-fatura-parcela).'}
                </p>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Lista {selecionados.size > 0 && '(ignorada: usando os marcados na tabela)'}
                </label>
                <textarea
                  value={baixaLista}
                  onChange={(e) => setBaixaLista(e.target.value)}
                  disabled={selecionados.size > 0}
                  rows={4}
                  placeholder={baixaTipo === 'clientes' ? '12345\n67890' : '123456\n123457/2'}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs font-mono disabled:bg-gray-50"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Motivo (opcional)</label>
                <input
                  type="text"
                  value={baixaMotivo}
                  onChange={(e) => setBaixaMotivo(e.target.value)}
                  maxLength={200}
                  placeholder="Ex.: pago por PIX, renegociado, fatura cancelada"
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
                />
              </div>
              <div className="flex flex-col gap-2 lg:mt-4">
                <button
                  onClick={conferirBaixa}
                  disabled={baixaCarregando || tabelaAusente}
                  className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-50"
                >
                  {baixaCarregando && !baixaConferencia ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <MagnifyingGlass size={14} weight="bold" />
                  )}
                  Conferir
                </button>
                <button
                  onClick={confirmarBaixa}
                  disabled={baixaCarregando || !baixaConferencia?.qtd}
                  className="flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  {baixaCarregando && baixaConferencia ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <Prohibit size={14} weight="bold" />
                  )}
                  Confirmar baixa
                </button>
              </div>
            </div>
            {baixaErro && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                <Warning size={14} weight="fill" /> {baixaErro}
              </div>
            )}
            {baixaConferencia && (
              <div className="mt-2 border border-gray-200 rounded-lg p-2">
                <div className="text-xs font-semibold text-[#000638]">
                  {baixaConferencia.qtd} boleto(s) pendente(s) de {baixaConferencia.clientes} cliente(s),{' '}
                  {fmtBRL(baixaConferencia.valor)} — serão cancelados na Pagar.me ao confirmar.
                </div>
                {(baixaConferencia.naoEncontrados?.clientes?.length > 0 ||
                  baixaConferencia.naoEncontrados?.faturas?.length > 0) && (
                  <div className="text-[11px] text-amber-700 mt-1">
                    Sem boleto pendente:{' '}
                    {[
                      ...(baixaConferencia.naoEncontrados.clientes || []).map((c) => `cliente ${c}`),
                      ...(baixaConferencia.naoEncontrados.faturas || []).map((f) => `fatura ${f}`),
                    ].join(', ')}
                  </div>
                )}
                {baixaConferencia.qtd > 0 && (
                  <div className="overflow-x-auto max-h-60 overflow-y-auto mt-2">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-2 py-1 text-left">Empresa</th>
                          <th className="px-2 py-1 text-left">Cliente</th>
                          <th className="px-2 py-1 text-left">Fatura</th>
                          <th className="px-2 py-1 text-left">Vencimento</th>
                          <th className="px-2 py-1 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baixaConferencia.itens.map((i) => (
                          <tr key={i.id} className="border-b border-gray-100">
                            <td className="px-2 py-1">{i.cd_empresa}</td>
                            <td className="px-2 py-1">
                              {i.cd_cliente} - {i.nm_cliente || '—'}
                            </td>
                            <td className="px-2 py-1">
                              {i.nr_fatura}/{i.nr_parcela}
                            </td>
                            <td className="px-2 py-1">{fmtData(i.dt_vencimento)}</td>
                            <td className="px-2 py-1 text-right">{fmtBRL(i.vl_fatura)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {baixaResultado && (
              <div className="mt-2 text-xs">
                <div className="flex items-center gap-1.5 text-green-700 font-semibold">
                  <CheckCircle size={14} weight="fill" />
                  {baixaResultado.qtd} boleto(s) cancelado(s) na Pagar.me ({fmtBRL(baixaResultado.valor)}).
                </div>
                {baixaResultado.erros?.length > 0 && (
                  <ul className="mt-1 text-red-600 list-disc pl-5">
                    {baixaResultado.erros.map((e) => (
                      <li key={e.id}>
                        {e.fatura}: {e.erro}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                <th className="px-2 py-2 text-center" title="Marcar para baixa na Pagar.me">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os pendentes visíveis"
                    checked={
                      visiveis.some((b) => b.situacao === 'aberto' || b.situacao === 'vencido') &&
                      visiveis
                        .filter((b) => b.situacao === 'aberto' || b.situacao === 'vencido')
                        .every((b) => selecionados.has(b.id))
                    }
                    onChange={(e) => {
                      const pend = visiveis.filter(
                        (b) => b.situacao === 'aberto' || b.situacao === 'vencido',
                      );
                      setSelecionados((prev) => {
                        const n = new Set(prev);
                        for (const b of pend) {
                          if (e.target.checked) n.add(b.id);
                          else n.delete(b.id);
                        }
                        return n;
                      });
                    }}
                  />
                </th>
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
                  <td colSpan={12} className="px-2 py-16 text-center text-gray-500">
                    {loading
                      ? 'Carregando...'
                      : boletos.length === 0
                        ? 'Nenhum boleto no período. Ajuste empresa, período e status e clique em Buscar.'
                        : 'Nenhum boleto no filtro.'}
                  </td>
                </tr>
              )}
              {visiveis.map((b) => {
                const sit = SITUACOES[b.situacao] || { label: b.status, cls: 'bg-gray-100' };
                const bx = BAIXAS[b.baixa_status];
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      selecionados.has(b.id) ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      {(b.situacao === 'aberto' || b.situacao === 'vencido') && (
                        <input
                          type="checkbox"
                          aria-label="Marcar para baixa na Pagar.me"
                          checked={selecionados.has(b.id)}
                          onChange={() => alternarSelecao(b.id)}
                        />
                      )}
                    </td>
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
