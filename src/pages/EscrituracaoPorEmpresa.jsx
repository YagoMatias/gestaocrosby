import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import ManifestacaoNav from '../components/fiscal/ManifestacaoNav';
import {
  ChartBar,
  ArrowsClockwise,
  FileArrowDown,
  Spinner,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Painel "Escrituração por empresa" — emitidas · lançadas · pendentes por
// filial, a partir das notas da Manifestação do Destinatário (SEFAZ DFe).
// Pedido da Niziany (26/10/2026): tela própria, com item de menu.
//
// Mesmas regras da Manifestação: não se escritura nota cancelada (2), denegada
// (3) nem de entrada (tpNF 0) — essas ficam "fora da fila" e não entram na
// conta. Lançada = escriturada (fatura vinculada no TOTVS).
const escrituracaoDaNota = (n) => {
  if (n.situacao === '2' || n.situacao === '3') return 'nao_aplica';
  if (n.tipo_operacao === '0') return 'nao_aplica';
  if (n.escriturada) return 'escriturada';
  if (n.status_manual === 'outros') return 'outros'; // tirada com justificativa
  return 'pendente';
};

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const rotuloMes = (ym) => {
  const [y, m] = String(ym || '').split('-');
  return y && m ? `${MESES[parseInt(m, 10) - 1]} / ${y}` : '';
};
const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
// Lista de meses de 2026-01 até o mês atual (mais recente primeiro)
const mesesDisponiveis = () => {
  const out = [];
  const hoje = new Date();
  let y = hoje.getFullYear();
  let m = hoje.getMonth() + 1;
  while (y > 2026 || (y === 2026 && m >= 1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    if (out.length > 60) break;
  }
  return out;
};
const periodoDoMes = (ym) => {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10));
  const fim = new Date(y, m, 0).getDate();
  return {
    dt_inicio: `${ym}-01`,
    dt_fim: `${ym}-${String(fim).padStart(2, '0')}`,
  };
};
const fmtDataHora = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

export default function EscrituracaoPorEmpresa() {
  const [mes, setMes] = useState(mesAtual());
  const [periodo, setPeriodo] = useState(periodoDoMes(mesAtual()));
  const [empresas, setEmpresas] = useState([]);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [carregadoEm, setCarregadoEm] = useState(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/sefaz/dfe/empresas`);
        const json = await r.json();
        if (json.success && Array.isArray(json.data)) setEmpresas(json.data);
      } catch (e) {
        console.error('Erro ao carregar empresas:', e);
      }
    };
    carregar();
  }, []);

  const nomePorCodigo = useMemo(() => {
    const m = {};
    empresas.forEach((e) => {
      if (e.codigo) m[e.codigo] = e.nome;
    });
    return m;
  }, [empresas]);

  const buscar = async () => {
    if (!periodo.dt_inicio || !periodo.dt_fim) return;
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      params.set('startDate', periodo.dt_inicio);
      params.set('endDate', periodo.dt_fim);
      params.set('limit', '20000');
      const r = await fetch(`${API_BASE_URL}/api/sefaz/dfe/notas?${params}`);
      const json = await r.json();
      if (!r.ok || !json.success) {
        throw new Error(json.message || json.error || `HTTP ${r.status}`);
      }
      setDados(Array.isArray(json.data) ? json.data : []);
      setCarregadoEm(new Date());
    } catch (e) {
      setErro(e.message || 'Erro ao buscar as notas');
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  // Carrega ao abrir e sempre que o período mudar
  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.dt_inicio, periodo.dt_fim]);

  const escolherMes = (ym) => {
    setMes(ym);
    if (ym) setPeriodo(periodoDoMes(ym));
  };
  const editarData = (campo, valor) => {
    setMes(''); // período personalizado
    setPeriodo((p) => ({ ...p, [campo]: valor }));
  };

  const painel = useMemo(() => {
    const m = new Map();
    let ultimaAtualizacao = null;
    for (const item of dados) {
      const cod = item.empresa_codigo ?? '--';
      if (!m.has(cod)) {
        m.set(cod, {
          codigo: cod,
          nome: item.empresa_nome || nomePorCodigo[cod] || '',
          emitidas: 0,
          lancadas: 0,
          pendentes: 0,
          outros: 0,
          foraFila: 0,
        });
      }
      const l = m.get(cod);
      const esc = escrituracaoDaNota(item);
      if (esc === 'escriturada') {
        l.lancadas += 1;
        l.emitidas += 1;
      } else if (esc === 'pendente') {
        l.pendentes += 1;
        l.emitidas += 1;
      } else if (esc === 'outros') {
        l.outros += 1;
      } else {
        l.foraFila += 1;
      }
      if (item.atualizado_em && (!ultimaAtualizacao || item.atualizado_em > ultimaAtualizacao)) {
        ultimaAtualizacao = item.atualizado_em;
      }
    }
    const linhas = [...m.values()]
      .map((l) => ({ ...l, pct: l.emitidas ? (l.lancadas / l.emitidas) * 100 : 0 }))
      .sort((a, b) => b.emitidas - a.emitidas || Number(a.codigo) - Number(b.codigo));
    const total = linhas.reduce(
      (t, l) => ({
        emitidas: t.emitidas + l.emitidas,
        lancadas: t.lancadas + l.lancadas,
        pendentes: t.pendentes + l.pendentes,
        outros: t.outros + l.outros,
        foraFila: t.foraFila + l.foraFila,
      }),
      { emitidas: 0, lancadas: 0, pendentes: 0, outros: 0, foraFila: 0 },
    );
    total.pct = total.emitidas ? (total.lancadas / total.emitidas) * 100 : 0;
    return { linhas, total, ultimaAtualizacao };
  }, [dados, nomePorCodigo]);

  const exportarExcel = () => {
    const linhas = painel.linhas.map((l) => ({
      Empresa: `${l.codigo} ${l.nome}`.trim(),
      Emitidas: l.emitidas,
      Lançadas: l.lancadas,
      Pendentes: l.pendentes,
      Outros: l.outros,
      '% Lançadas': Number(l.pct.toFixed(1)),
      'Fora da fila': l.foraFila,
    }));
    linhas.push({
      Empresa: 'TOTAL',
      Emitidas: painel.total.emitidas,
      Lançadas: painel.total.lancadas,
      Pendentes: painel.total.pendentes,
      Outros: painel.total.outros,
      '% Lançadas': Number(painel.total.pct.toFixed(1)),
      'Fora da fila': painel.total.foraFila,
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Por empresa');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const nome = mes ? mes : `${periodo.dt_inicio}_${periodo.dt_fim}`;
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `escrituracao-por-empresa-${nome}.xlsx`,
    );
  };

  const corPct = (pct) =>
    pct >= 99.5 ? 'text-green-700' : pct > 0 ? 'text-amber-600' : 'text-red-600';

  const tituloPeriodo = mes
    ? rotuloMes(mes)
    : `${periodo.dt_inicio.split('-').reverse().join('/')} a ${periodo.dt_fim.split('-').reverse().join('/')}`;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pt-4 pb-8 flex flex-col gap-4">
      <PageTitle
        title="Manifestação do Destinatário — Painel"
        subtitle="Notas emitidas contra os CNPJs · lançadas × pendentes por empresa"
        icon={ChartBar}
        iconColor="text-amber-600"
      />
      <ManifestacaoNav ativo="painel" />

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
            Mês
          </label>
          <select
            value={mes}
            onChange={(e) => escolherMes(e.target.value)}
            className="border border-[#000638]/30 rounded-lg px-2 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
          >
            {!mes && <option value="">Período personalizado</option>}
            {mesesDisponiveis().map((ym) => (
              <option key={ym} value={ym}>
                {rotuloMes(ym)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
            Emissão - Início
          </label>
          <input
            type="date"
            value={periodo.dt_inicio}
            onChange={(e) => editarData('dt_inicio', e.target.value)}
            className="border border-[#000638]/30 rounded-lg px-2 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] mb-0 w-auto"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
            Emissão - Fim
          </label>
          <input
            type="date"
            value={periodo.dt_fim}
            onChange={(e) => editarData('dt_fim', e.target.value)}
            className="border border-[#000638]/30 rounded-lg px-2 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] mb-0 w-auto"
          />
        </div>
        <button
          type="button"
          onClick={buscar}
          disabled={loading}
          className="inline-flex items-center gap-1.5 bg-[#000638] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#000638]/90 disabled:opacity-60"
        >
          {loading ? (
            <Spinner size={14} className="animate-spin" />
          ) : (
            <ArrowsClockwise size={14} weight="bold" />
          )}
          Atualizar
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            disabled={painel.linhas.length === 0}
            className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <FileArrowDown size={14} weight="bold" /> Baixar Excel
          </button>
        </div>
        <div className="w-full text-[10px] text-gray-400">
          {carregadoEm && `Consultado às ${carregadoEm.toLocaleTimeString('pt-BR')}`}
          {painel.ultimaAtualizacao &&
            ` · última atualização das notas: ${fmtDataHora(painel.ultimaAtualizacao)}`}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">
          {erro}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
          <div className="text-xs font-bold text-blue-700 mb-1">Emitidas</div>
          <div className="text-lg font-extrabold text-blue-600">{painel.total.emitidas}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
          <div className="text-xs font-bold text-teal-700 mb-1">Lançadas</div>
          <div className="text-lg font-extrabold text-teal-600">{painel.total.lancadas}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
          <div className="text-xs font-bold text-red-700 mb-1">Pendentes</div>
          <div className="text-lg font-extrabold text-red-600">{painel.total.pendentes}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
          <div className="text-xs font-bold text-gray-700 mb-1">% Lançadas</div>
          <div className={`text-lg font-extrabold ${corPct(painel.total.pct)}`}>
            {painel.total.pct.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Tabela por empresa */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10">
        <div className="p-3 border-b border-[#000638]/10 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#000638] font-barlow">
            Controle — {tituloPeriodo}
          </h2>
          <span className="text-[10px] text-gray-500">
            {painel.linhas.length} empresa{painel.linhas.length === 1 ? '' : 's'} · {dados.length} notas no período
          </span>
        </div>
        {loading && dados.length === 0 ? (
          <div className="flex justify-center items-center py-12 text-xs text-gray-500">
            <Spinner size={18} className="animate-spin mr-2" /> Carregando notas…
          </div>
        ) : painel.linhas.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            Nenhuma nota no período. Confira o mês ou sincronize a SEFAZ na Manifestação do Destinatário.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Empresa</th>
                  <th className="px-3 py-2 text-right">Emitidas</th>
                  <th className="px-3 py-2 text-right">Lançadas</th>
                  <th className="px-3 py-2 text-right">Pendentes</th>
                  <th className="px-3 py-2 text-right" title="Tiradas de Pendentes com justificativa">Outros</th>
                  <th className="px-3 py-2 text-right">% Lançadas</th>
                </tr>
              </thead>
              <tbody>
                {painel.linhas.map((l) => (
                  <tr key={l.codigo} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-[#000638]">
                      {l.codigo} {l.nome}
                      {l.foraFila > 0 && (
                        <span className="ml-1 text-[9px] text-gray-400 font-normal">
                          +{l.foraFila} fora da fila
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{l.emitidas}</td>
                    <td className="px-3 py-2 text-right font-semibold text-teal-700">{l.lancadas}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${l.pendentes > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {l.pendentes}
                    </td>
                    <td className={`px-3 py-2 text-right ${l.outros > 0 ? 'text-slate-700 font-semibold' : 'text-gray-300'}`}>
                      {l.outros}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${corPct(l.pct)}`}>
                      {l.pct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-[#000638]">
                  <td className="px-3 py-2">
                    Total ({painel.linhas.length} empresa{painel.linhas.length === 1 ? '' : 's'})
                    {painel.total.foraFila > 0 && (
                      <span className="ml-1 text-[9px] text-gray-400 font-normal">
                        +{painel.total.foraFila} fora da fila
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{painel.total.emitidas}</td>
                  <td className="px-3 py-2 text-right text-teal-700">{painel.total.lancadas}</td>
                  <td className={`px-3 py-2 text-right ${painel.total.pendentes > 0 ? 'text-red-600' : ''}`}>
                    {painel.total.pendentes}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{painel.total.outros}</td>
                  <td className={`px-3 py-2 text-right ${corPct(painel.total.pct)}`}>
                    {painel.total.pct.toFixed(0)}%
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100">
              Emitidas = lançadas + pendentes. Lançada = nota escriturada (com fatura no TOTVS, via "Importar Escrituradas"). Outros = tiradas de Pendentes com justificativa (não contam como lançadas). Notas canceladas, denegadas e de entrada não entram na conta ("fora da fila").
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
