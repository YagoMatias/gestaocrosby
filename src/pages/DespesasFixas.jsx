import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import centrosCusto from '../config/centrosCusto.json';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';

// ─── Mapeamento código TOTVS → categoria de despesa fixa ─────────────────────
// Fonte: despesas.json fornecido pela equipe
const CODIGO_PARA_CATEGORIA = {
  6010: 'energia', // ENERGIA ELETRICA
  6011: 'agua', // AGUA E ESGOTO
  6028: 'internet', // INTERNET
  4001: 'aluguel', // ALUGUEIS DE IMOVEIS
};

// Todos os códigos de despesas fixas a enviar para a API
const CODIGOS_DESPESAS_FIXAS = Object.keys(CODIGO_PARA_CATEGORIA).map(Number);

// Filiais fixas — não requer seleção pelo usuário
const FILIAIS_FIXAS = [
  { cd: '1', nome: 'CROSBY MATRIZ' },
  { cd: '2', nome: 'FILIAL 2' },
  { cd: '5', nome: 'FILIAL 5' },
  { cd: '55', nome: 'FILIAL 55' },
  { cd: '65', nome: 'FILIAL 65' },
  { cd: '87', nome: 'FILIAL 87' },
  { cd: '88', nome: 'FILIAL 88' },
  { cd: '90', nome: 'FILIAL 90' },
  { cd: '93', nome: 'FILIAL 93' },
  { cd: '94', nome: 'FILIAL 94' },
  { cd: '95', nome: 'CROSBY SHOPPING MIDWAY' },
  { cd: '97', nome: 'FILIAL 97' },
  { cd: '98', nome: 'FILIAL 98' },
  { cd: '99', nome: 'CROSBY BREJINHO' },
];

import {
  Funnel,
  Spinner,
  Lightning,
  Drop,
  WifiHigh,
  House,
  Buildings,
  Warning,
  CheckCircle,
  Clock,
  X,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Receipt,
  Copy,
  Question,
  PaperPlaneTilt,
} from '@phosphor-icons/react';

// ─── Tipos de Despesas Fixas ─────────────────────────────────────────────────
const TIPOS_DESPESAS_FIXAS = [
  {
    key: 'energia',
    label: 'ENERGIA',
    icon: Lightning,
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-300',
  },
  {
    key: 'agua',
    label: 'ÁGUA E ESGOTO',
    icon: Drop,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-300',
  },
  {
    key: 'internet',
    label: 'INTERNET',
    icon: WifiHigh,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-300',
  },
  {
    key: 'aluguel',
    label: 'ALUGUÉIS DE IMÓVEIS',
    icon: House,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-300',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCategoriaDespesa(codigo) {
  const codigoInt = parseInt(codigo);
  if (!isNaN(codigoInt) && codigoInt > 0) {
    return CODIGO_PARA_CATEGORIA[codigoInt] || null;
  }
  return null;
}

function criarDataSemFuso(str) {
  if (!str) return null;
  const s = str.includes('T') ? str.split('T')[0] : str;
  const [a, m, d] = s.split('-');
  return new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
}

function formatarMoeda(val) {
  if (val === null || val === undefined || val === '') return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseFloat(val) || 0);
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = s.split('-');
  return `${parts[0]}-${parts[1]}`;
}

function getNomeCentroCusto(cd_ccusto, ds_ccusto_api) {
  if (!cd_ccusto) return ds_ccusto_api || 'Sem Centro de Custo';
  const nome = centrosCusto[String(cd_ccusto)];
  return nome || ds_ccusto_api || `CC ${cd_ccusto}`;
}

function gerarMeses(inicio, fim) {
  const nomes = [
    'JAN',
    'FEV',
    'MAR',
    'ABR',
    'MAI',
    'JUN',
    'JUL',
    'AGO',
    'SET',
    'OUT',
    'NOV',
    'DEZ',
  ];
  const meses = [];
  const [ai, mi] = inicio.split('-').map(Number);
  const [af, mf] = fim.split('-').map(Number);
  let ano = ai,
    mes = mi;
  while (ano < af || (ano === af && mes <= mf)) {
    meses.push({
      key: `${ano}-${String(mes).padStart(2, '0')}`,
      label: `${nomes[mes - 1]}/${String(ano).slice(-2)}`,
    });
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return meses;
}

// ─── Status de cada célula ───────────────────────────────────────────────────
// Duplicidade = 2+ emissões (dt_emissao) no mesmo mês-calendário para o mesmo CC+tipo
// retorna: 'nao_lancado' | 'pago' | 'atrasado' | 'a_vencer' | 'duplicidade'
function getStatusCelula(itens) {
  if (!itens || itens.length === 0) return 'nao_lancado';

  if (itens.length > 1) {
    // Contar quantos itens foram emitidos em cada mês-calendário
    const contPorEmissao = {};
    for (const item of itens) {
      const mk = getMonthKey(item.dt_emissao);
      if (mk) contPorEmissao[mk] = (contPorEmissao[mk] || 0) + 1;
    }
    // Se algum mês de emissão tiver 2+ lançamentos → duplicidade
    const temDuplica = Object.values(contPorEmissao).some((c) => c > 1);
    if (temDuplica) {
      const todosPagos = itens.every((i) => !!i.dt_liq);
      return todosPagos ? 'duplicidade_pago' : 'duplicidade';
    }
  }

  // Status do pior caso entre todos os itens da célula
  let todosPagos = true;
  let temAtrasado = false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  for (const item of itens) {
    if (!item.dt_liq) {
      todosPagos = false;
      const venc = criarDataSemFuso(item.dt_vencimento);
      if (venc && venc < hoje) temAtrasado = true;
    }
  }
  if (todosPagos) return 'pago';
  if (temAtrasado) return 'atrasado';
  return 'a_vencer';
}

const STATUS_CONFIG = {
  nao_lancado: {
    label: 'Não Lançado',
    icon: Question,
    cellBg: 'bg-gray-50',
    textColor: 'text-gray-400',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-500',
    border: 'border-gray-200',
  },
  pago: {
    label: 'Pago',
    icon: CheckCircle,
    cellBg: 'bg-green-50',
    textColor: 'text-green-700',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    border: 'border-green-200',
  },
  atrasado: {
    label: 'Atrasado',
    icon: Warning,
    cellBg: 'bg-red-50',
    textColor: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    border: 'border-red-200',
  },
  a_vencer: {
    label: 'A Vencer',
    icon: Clock,
    cellBg: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    badgeBg: 'bg-yellow-100',
    badgeText: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  duplicidade: {
    label: 'Duplicidade',
    icon: Copy,
    cellBg: 'bg-orange-50',
    textColor: 'text-orange-700',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    border: 'border-orange-200',
  },
  duplicidade_pago: {
    label: 'Pago (Dupl.)',
    icon: CheckCircle,
    cellBg: 'bg-green-50',
    textColor: 'text-green-700',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    border: 'border-green-200',
  },
};

// ─── Modal de detalhes da célula ──────────────────────────────────────────────
const ModalCelula = ({ celula, onClose }) => {
  const { user } = useAuth?.() || { user: null };
  const [enviando, setEnviando] = useState(false);
  const [msgEnvio, setMsgEnvio] = useState(null);
  const [itensLiberados, setItensLiberados] = useState(new Set());

  if (!celula) return null;
  const { itens, despesaLabel, mesLabel, ccNome, status } = celula;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.nao_lancado;
  const StatusIcon = cfg.icon;

  // Apenas itens em aberto (sem dt_liq) podem ser liberados para pagamento
  const itensLiberaveis = itens.filter(
    (i) => !i.dt_liq && !itensLiberados.has(itemKey(i)),
  );
  const podeLiberar = itensLiberaveis.length > 0;

  function itemKey(i) {
    return `${i.cd_empresa || ''}|${i.nr_duplicata || ''}|${i.nr_parcela || ''}|${i.cd_fornecedor || ''}`;
  }

  const handleLiberar = async () => {
    if (!podeLiberar) return;
    if (
      !window.confirm(
        `Enviar ${itensLiberaveis.length} título(s) para Liberação de Pagamento?`,
      )
    )
      return;

    const toDate = (d) => {
      if (!d) return null;
      const s = String(d).split('T')[0];
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };

    setEnviando(true);
    setMsgEnvio(null);
    try {
      // Verificar duplicatas já enviadas (chave: nr_duplicata + cd_empresa + nr_parcela + cd_fornecedor)
      const chaves = itensLiberaveis
        .filter((i) => i.nr_duplicata && i.cd_empresa)
        .map((i) => ({
          nr_duplicata: String(i.nr_duplicata),
          cd_empresa: parseInt(i.cd_empresa),
          nr_parcela: i.nr_parcela ? String(i.nr_parcela) : null,
          cd_fornecedor: i.cd_fornecedor ? String(i.cd_fornecedor) : null,
        }));

      if (chaves.length > 0) {
        const { data: jaExistentes } = await supabase
          .from('pagamentos_liberacao')
          .select('nr_duplicata, cd_empresa, nr_parcela, status, cd_fornecedor')
          .in(
            'nr_duplicata',
            chaves.map((c) => c.nr_duplicata),
          )
          .not('status', 'eq', 'CANCELADO');

        if (jaExistentes && jaExistentes.length > 0) {
          const conflitos = jaExistentes.filter((ex) =>
            chaves.some(
              (c) =>
                c.nr_duplicata === ex.nr_duplicata &&
                c.cd_fornecedor === ex.cd_fornecedor &&
                c.cd_empresa === ex.cd_empresa &&
                (c.nr_parcela || null) === (ex.nr_parcela || null),
            ),
          );
          if (conflitos.length > 0) {
            const msgs = conflitos
              .map(
                (c) =>
                  `Fornecedor ${c.cd_fornecedor} • Duplicata ${c.nr_duplicata}${c.nr_parcela ? `/${c.nr_parcela}` : ''} — já enviada (${c.status})`,
              )
              .join('\n');
            alert(
              `⚠️ Envio bloqueado!\n\nAs seguintes duplicatas já foram enviadas para Liberação de Pagamento:\n\n${msgs}`,
            );
            setEnviando(false);
            return;
          }
        }
      }

      const registros = itensLiberaveis.map((item) => ({
        cd_empresa: item.cd_empresa ? parseInt(item.cd_empresa) : null,
        nm_empresa: item.nm_empresa || null,
        nr_duplicata: item.nr_duplicata ? String(item.nr_duplicata) : null,
        nr_parcela: item.nr_parcela ? String(item.nr_parcela) : null,
        nr_portador: item.nr_portador ? String(item.nr_portador) : null,
        cd_fornecedor: item.cd_fornecedor ? String(item.cd_fornecedor) : null,
        nm_fornecedor: item.nm_fornecedor || null,
        cd_despesaitem: item.cd_despesaitem
          ? String(item.cd_despesaitem)
          : null,
        ds_despesaitem: item.ds_despesaitem || null,
        cd_ccusto: item.cd_ccusto ? String(item.cd_ccusto) : null,
        dt_emissao: toDate(item.dt_emissao),
        dt_vencimento: toDate(item.dt_vencimento),
        vl_duplicata: parseFloat(item.vl_duplicata || 0),
        status: 'PENDENTE',
        enviado_por: user?.email || null,
        dados_completos: item,
      }));

      const { error } = await supabase
        .from('pagamentos_liberacao')
        .insert(registros);
      if (error) throw error;

      setItensLiberados(
        (prev) => new Set([...prev, ...itensLiberaveis.map(itemKey)]),
      );
      setMsgEnvio({
        tipo: 'ok',
        texto: `${registros.length} título(s) enviado(s) com sucesso!`,
      });
    } catch (err) {
      setMsgEnvio({
        tipo: 'erro',
        texto: 'Erro ao enviar: ' + (err.message || err),
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {ccNome}
            </p>
            <h3 className="font-bold text-[#000638] text-base">
              {despesaLabel} — {mesLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status badge */}
        <div className={`px-5 py-3 flex items-center gap-2 ${cfg.cellBg}`}>
          <StatusIcon size={16} className={cfg.textColor} weight="bold" />
          <span className={`text-sm font-semibold ${cfg.textColor}`}>
            {cfg.label}
          </span>
          {itens.length > 1 && (
            <span className="ml-auto text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-semibold">
              {itens.length} lançamentos
            </span>
          )}
        </div>

        {/* Itens */}
        <div className="p-5 max-h-96 overflow-y-auto space-y-3">
          {itens.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhum lançamento encontrado para este mês.
            </p>
          ) : (
            itens.map((item, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-1.5"
              >
                <div className="flex justify-between">
                  <span className="font-semibold text-sm text-[#000638]">
                    {formatarMoeda(item.vl_duplicata)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.dt_liq ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                  >
                    {item.dt_liq ? 'PAGO' : 'EM ABERTO'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-gray-500">
                  <span>Fornecedor:</span>
                  <span className="font-medium text-gray-700 truncate">
                    {item.nm_fornecedor || '—'}
                  </span>
                  <span>Duplicata:</span>
                  <span className="font-medium text-gray-700">
                    {item.nr_duplicata || '—'}
                    {item.nr_parcela ? `/${item.nr_parcela}` : ''}
                  </span>
                  <span>Vencimento:</span>
                  <span className="font-medium text-gray-700">
                    {item.dt_vencimento
                      ? criarDataSemFuso(
                          item.dt_vencimento,
                        )?.toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                  {item.dt_liq && (
                    <>
                      <span>Pagamento:</span>
                      <span className="font-medium text-green-700">
                        {criarDataSemFuso(item.dt_liq)?.toLocaleDateString(
                          'pt-BR',
                        )}
                      </span>
                    </>
                  )}
                  <span>Despesa:</span>
                  <span className="font-medium text-gray-700">
                    {item.ds_despesaitem || '—'}
                  </span>
                  <span>Empresa:</span>
                  <span className="font-medium text-gray-700">
                    {item.nm_empresa || item.cd_empresa || '—'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {msgEnvio && (
          <div
            className={`mx-5 mb-2 px-3 py-2 rounded-lg text-xs font-medium ${
              msgEnvio.tipo === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {msgEnvio.texto}
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center gap-2">
          {podeLiberar ? (
            <button
              onClick={handleLiberar}
              disabled={enviando}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition"
            >
              {enviando ? (
                <Spinner size={13} className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={13} weight="bold" />
              )}
              Liberar para Pagamento ({itensLiberaveis.length})
            </button>
          ) : (
            <span className="text-xs text-gray-400 italic">
              {itens.length === 0
                ? ''
                : itensLiberados.size > 0
                  ? 'Todos os títulos foram enviados.'
                  : 'Nenhum título em aberto para liberar.'}
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#000638] text-white text-sm rounded-lg hover:opacity-90 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Célula da tabela ─────────────────────────────────────────────────────────
const CelulaFluxo = React.memo(({ itens, onClick }) => {
  const status = getStatusCelula(itens);
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const total = itens.reduce(
    (s, i) => s + (parseFloat(i.vl_duplicata) || 0),
    0,
  );

  if (status === 'nao_lancado') {
    return (
      <td
        className="border border-gray-100 text-center px-2 py-2 cursor-pointer hover:bg-gray-100 transition"
        onClick={onClick}
      >
        <span className="text-gray-300 text-lg">—</span>
      </td>
    );
  }

  return (
    <td
      className={`border border-gray-100 px-2 py-1.5 cursor-pointer transition hover:opacity-80 ${cfg.cellBg}`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-xs font-bold ${cfg.textColor}`}>
          {formatarMoeda(total)}
        </span>
        <span
          className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${cfg.badgeBg} ${cfg.badgeText}`}
        >
          <StatusIcon size={9} weight="bold" />
          {cfg.label}
          {(status === 'duplicidade' || status === 'duplicidade_pago') && (
            <span className="ml-0.5">({itens.length}x)</span>
          )}
        </span>
      </div>
    </td>
  );
});
CelulaFluxo.displayName = 'CelulaFluxo';

// ─── Componente Principal ─────────────────────────────────────────────────────
const DespesasFixas = () => {
  const apiClient = useApiClient();

  // ─── Estados de filtro ───
  const [modoData, setModoData] = useState('vencimento');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacao, setSituacao] = useState('N');
  const [previsao, setPrevisao] = useState('TODOS');
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS');

  // ─── Estados de dados ───
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState(null);

  // ─── Estado de UI ───
  const [ccExpandidos, setCcExpandidos] = useState(new Set());
  const [modalCelula, setModalCelula] = useState(null);

  // ─── Datas padrão (últimos 6 meses) ───
  useEffect(() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  }, []);

  // ─── Buscar dados ────────────────────────────────────────────────────────────
  const buscarDados = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setLoading(true);
    setErro(null);
    try {
      const codigosEmpresas = FILIAIS_FIXAS.map((f) => parseInt(f.cd));

      const payload = {
        dt_inicio: dataInicio,
        dt_fim: dataFim,
        branches: codigosEmpresas,
        modo: modoData,
        situacao: situacao || 'N',
        previsao: previsao === 'PREVISÃO' ? 'PREVISAO' : previsao || 'TODOS',
        filtroPagamento,
        expenseCodeList: CODIGOS_DESPESAS_FIXAS,
      };

      const result = await apiClient.totvs.accountsPayableSearch(payload);

      let dadosArray = [];
      if (result && typeof result === 'object') {
        if (Array.isArray(result.data)) dadosArray = result.data;
        else if (result.data && Array.isArray(result.data.data))
          dadosArray = result.data.data;
        else if (result.metadata && Array.isArray(result.metadata.data))
          dadosArray = result.metadata.data;
      }

      // Mapa empresa
      const empresaMap = {};
      FILIAIS_FIXAS.forEach((f) => {
        empresaMap[String(f.cd)] = f.nome;
      });

      // DEBUG temporário: inspecionar primeiros itens
      if (dadosArray.length > 0) {
        const sample = dadosArray.slice(0, 3).map((i) => ({
          cd_despesaitem: i.cd_despesaitem,
          ds_despesaitem: i.ds_despesaitem,
          cd_ccusto: i.cd_ccusto,
          nm_fornecedor: i.nm_fornecedor,
        }));
        console.log(
          '🔬 DEBUG primeiros 3 itens (cd_despesaitem/ds_despesaitem):',
          sample,
        );
      }

      // Processar — filtrar por código/descrição de despesa fixa
      const processados = dadosArray
        .map((item) => ({
          ...item,
          nm_empresa: empresaMap[String(item.cd_empresa)] || '',
          _categoria: getCategoriaDespesa(
            item.cd_despesaitem,
            item.ds_despesaitem,
          ),
        }))
        .filter((item) => item._categoria !== null);

      console.log(
        `🔍 Itens após filtro de categoria: ${processados.length} de ${dadosArray.length}`,
      );

      setDados(processados);
      setDadosCarregados(true);

      // Expandir todos os CCs por padrão
      const ccs = new Set(processados.map((i) => String(i.cd_ccusto || '0')));
      setCcExpandidos(ccs);
    } catch (err) {
      setErro(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
    }
  }, [
    dataInicio,
    dataFim,
    modoData,
    situacao,
    previsao,
    filtroPagamento,
    apiClient,
  ]);

  const handleFiltrar = useCallback(
    (e) => {
      e.preventDefault();
      buscarDados();
    },
    [buscarDados],
  );

  // ─── Gerar meses da coluna baseado na data de referência do modo ─────────────
  const meses = useMemo(() => {
    if (!dataInicio || !dataFim) return [];
    return gerarMeses(dataInicio, dataFim);
  }, [dataInicio, dataFim]);

  // ─── Chave de mês para cada item segundo modoData ────────────────────────────
  function getItemMonthKey(item) {
    let dateStr = null;
    if (modoData === 'vencimento') dateStr = item.dt_vencimento;
    else if (modoData === 'emissao') dateStr = item.dt_emissao;
    else if (modoData === 'liquidacao') dateStr = item.dt_liq;
    return dateStr ? getMonthKey(dateStr) : null;
  }

  // ─── Dados agrupados: CC → Despesa → Mês → [itens] ──────────────────────────
  const dadosAgrupados = useMemo(() => {
    // Map: ccKey → { cd_ccusto, ds_ccusto, despesas: { despKey → { mesKey → [itens] } } }
    const mapa = new Map();

    for (const item of dados) {
      const ccKey = String(item.cd_ccusto || '0');
      const despKey = item._categoria;
      const mesKey = getItemMonthKey(item);
      if (!mesKey) continue;

      if (!mapa.has(ccKey)) {
        mapa.set(ccKey, {
          cd_ccusto: item.cd_ccusto,
          ds_ccusto: getNomeCentroCusto(item.cd_ccusto, item.ds_ccusto),
          despesas: new Map(),
        });
      }
      const cc = mapa.get(ccKey);

      if (!cc.despesas.has(despKey)) {
        cc.despesas.set(despKey, new Map());
      }
      const despMes = cc.despesas.get(despKey);

      if (!despMes.has(mesKey)) {
        despMes.set(mesKey, []);
      }
      despMes.get(mesKey).push(item);
    }

    // Converter para array ordenado por cd_ccusto
    return Array.from(mapa.entries())
      .sort((a, b) => {
        const na = parseInt(a[0]) || 0;
        const nb = parseInt(b[0]) || 0;
        return na - nb;
      })
      .map(([ccKey, ccData]) => ({
        ccKey,
        cd_ccusto: ccData.cd_ccusto,
        ds_ccusto: ccData.ds_ccusto,
        linhas: TIPOS_DESPESAS_FIXAS.filter((t) =>
          ccData.despesas.has(t.key),
        ).map((tipo) => ({
          tipo,
          porMes: ccData.despesas.get(tipo.key),
        })),
      }));
  }, [dados, modoData]);

  // ─── Resumo geral ────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    let totalValor = 0;
    let totalPago = 0;
    let totalAtrasado = 0;
    let totalAVencer = 0;
    let totalDuplicas = 0;
    let totalNaoLancado = 0;
    let contCelulas = 0;

    for (const cc of dadosAgrupados) {
      for (const linha of cc.linhas) {
        for (const mes of meses) {
          contCelulas++;
          const itens = linha.porMes.get(mes.key) || [];
          const status = getStatusCelula(itens);
          const valor = itens.reduce(
            (s, i) => s + (parseFloat(i.vl_duplicata) || 0),
            0,
          );
          totalValor += valor;
          if (status === 'pago') totalPago += valor;
          else if (status === 'atrasado') totalAtrasado += valor;
          else if (status === 'a_vencer') totalAVencer += valor;
          else if (status === 'duplicidade') totalDuplicas++;
          else if (status === 'nao_lancado') totalNaoLancado++;
        }
      }
    }

    return {
      totalValor,
      totalPago,
      totalAtrasado,
      totalAVencer,
      totalDuplicas,
      totalNaoLancado,
      contCelulas,
    };
  }, [dadosAgrupados, meses]);

  const toggleCC = useCallback((ccKey) => {
    setCcExpandidos((prev) => {
      const n = new Set(prev);
      n.has(ccKey) ? n.delete(ccKey) : n.add(ccKey);
      return n;
    });
  }, []);

  const abrirModalCelula = useCallback((itens, despesa, mes, ccNome) => {
    const status = getStatusCelula(itens);
    setModalCelula({
      itens,
      despesaLabel: despesa.label,
      mesLabel: mes.label,
      ccNome,
      status,
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-full px-4 pt-6">
        <PageTitle
          title="Despesas Fixas"
          subtitle="Acompanhe energia, água, internet, telefone, condomínio e aluguéis por centro de custo e mês"
          icon={Receipt}
          iconColor="text-red-600"
        />

        {/* ─── Filtros ─────────────────────────────────────────────────── */}
        <form
          onSubmit={handleFiltrar}
          className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Funnel size={16} weight="bold" className="text-[#000638]" />
            <span className="font-bold text-[#000638] text-sm">Filtros</span>
          </div>
          {/* Linha 1: Tipo Data | Data Início | Data Fim */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Tipo de Data
              </label>
              <select
                value={modoData}
                onChange={(e) => setModoData(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="vencimento">VENCIMENTO</option>
                <option value="emissao">EMISSÃO</option>
                <option value="liquidacao">PAGAMENTO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
          </div>

          {/* Linha 2: Situação | Previsão | Pagamento | Botão */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="N">NORMAIS</option>
                <option value="C">CANCELADAS</option>
                <option value="T">TODAS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Previsão
              </label>
              <select
                value={previsao}
                onChange={(e) => setPrevisao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="TODOS">TODOS</option>
                <option value="PREVISÃO">PREVISÃO</option>
                <option value="REAL">REAL</option>
                <option value="CONSIGNADO">CONSIGNADO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Pagamento
              </label>
              <select
                value={filtroPagamento}
                onChange={(e) => setFiltroPagamento(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="TODOS">TODOS</option>
                <option value="PAGO">PAGOS</option>
                <option value="NAO_PAGO">NÃO PAGOS</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#000638] text-white text-xs font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition disabled:opacity-60"
              >
                {loading ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <MagnifyingGlass size={14} weight="bold" />
                )}
                {loading ? 'Carregando...' : 'Filtrar'}
              </button>
            </div>
          </div>
        </form>

        {/* ─── Legenda de status ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <span
                key={key}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${cfg.badgeBg} ${cfg.badgeText} font-medium border ${cfg.border}`}
              >
                <Icon size={11} weight="bold" />
                {cfg.label}
              </span>
            );
          })}
        </div>

        {/* ─── Cards de resumo ─────────────────────────────────────────── */}
        {dadosCarregados && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                Total
              </p>
              <p className="text-base font-bold text-[#000638]">
                {formatarMoeda(resumo.totalValor)}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-green-600 uppercase tracking-wide mb-1">
                Pago
              </p>
              <p className="text-base font-bold text-green-700">
                {formatarMoeda(resumo.totalPago)}
              </p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-red-600 uppercase tracking-wide mb-1">
                Atrasado
              </p>
              <p className="text-base font-bold text-red-700">
                {formatarMoeda(resumo.totalAtrasado)}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-yellow-600 uppercase tracking-wide mb-1">
                A Vencer
              </p>
              <p className="text-base font-bold text-yellow-700">
                {formatarMoeda(resumo.totalAVencer)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl border border-orange-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-orange-600 uppercase tracking-wide mb-1">
                Duplicidades
              </p>
              <p className="text-base font-bold text-orange-700">
                {resumo.totalDuplicas} célula(s)
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-3 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                Não Lançados
              </p>
              <p className="text-base font-bold text-gray-600">
                {resumo.totalNaoLancado} célula(s)
              </p>
            </div>
          </div>
        )}

        {/* ─── Erro ────────────────────────────────────────────────────── */}
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
            <Warning size={16} weight="bold" />
            {erro}
          </div>
        )}

        {/* ─── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Spinner size={36} className="animate-spin mb-3 text-[#000638]" />
            <p className="text-sm">Carregando despesas fixas...</p>
          </div>
        )}

        {/* ─── Tabela vazia ────────────────────────────────────────────── */}
        {!loading && dadosCarregados && dadosAgrupados.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Receipt size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Nenhuma despesa fixa encontrada para o período selecionado.
            </p>
            <p className="text-xs mt-1">
              Categorias mapeadas: Energia, Água/Esgoto, Internet, Telefone,
              Condomínio, Aluguéis
            </p>
          </div>
        )}

        {/* ─── Tabela de Fluxo de Caixa ────────────────────────────────── */}
        {!loading && dadosAgrupados.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                {/* Cabeçalho */}
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-[#000638] z-10 min-w-[200px]">
                      CENTRO DE CUSTO / DESPESA
                    </th>
                    {meses.map((mes) => (
                      <th
                        key={mes.key}
                        className="text-center px-3 py-3 font-semibold min-w-[110px]"
                      >
                        {mes.label}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold min-w-[110px] bg-[#000838]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosAgrupados.map((cc, ccIdx) => {
                    const expandido = ccExpandidos.has(cc.ccKey);
                    // Total da linha do CC
                    const totalCC = cc.linhas.reduce((soma, linha) => {
                      for (const mes of meses) {
                        const itens = linha.porMes.get(mes.key) || [];
                        soma += itens.reduce(
                          (s, i) => s + (parseFloat(i.vl_duplicata) || 0),
                          0,
                        );
                      }
                      return soma;
                    }, 0);

                    return (
                      <React.Fragment key={cc.ccKey}>
                        {/* Linha separadora / header do CC */}
                        <tr
                          className="bg-gray-100 border-t-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition select-none"
                          onClick={() => toggleCC(cc.ccKey)}
                        >
                          <td
                            className="px-4 py-2.5 sticky left-0 bg-gray-100 z-10 font-bold text-[#000638] flex items-center gap-2"
                            style={{ minWidth: 200 }}
                          >
                            {expandido ? (
                              <CaretDown size={13} weight="bold" />
                            ) : (
                              <CaretRight size={13} weight="bold" />
                            )}
                            <Buildings size={14} className="text-gray-500" />
                            <span>
                              {cc.cd_ccusto ? `${cc.cd_ccusto} — ` : ''}
                              {cc.ds_ccusto || `CC ${cc.ccKey}`}
                            </span>
                            <span className="ml-2 text-[10px] text-gray-500 font-normal">
                              ({cc.linhas.length} despesa
                              {cc.linhas.length !== 1 ? 's' : ''})
                            </span>
                          </td>
                          {meses.map((mes) => {
                            // Total do CC neste mês
                            const totalMes = cc.linhas.reduce((soma, linha) => {
                              const itens = linha.porMes.get(mes.key) || [];
                              return (
                                soma +
                                itens.reduce(
                                  (s, i) =>
                                    s + (parseFloat(i.vl_duplicata) || 0),
                                  0,
                                )
                              );
                            }, 0);
                            return (
                              <td
                                key={mes.key}
                                className="text-center px-2 py-2 text-gray-600 font-semibold border border-gray-200"
                              >
                                {totalMes > 0 ? (
                                  formatarMoeda(totalMes)
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-2 py-2 font-bold text-[#000638] border border-gray-200 bg-gray-50">
                            {formatarMoeda(totalCC)}
                          </td>
                        </tr>

                        {/* Linhas de despesas do CC */}
                        {expandido &&
                          cc.linhas.map((linha, lIdx) => {
                            const { tipo, porMes } = linha;
                            const TipoIcon = tipo.icon;
                            const totalLinha = meses.reduce((soma, mes) => {
                              const itens = porMes.get(mes.key) || [];
                              return (
                                soma +
                                itens.reduce(
                                  (s, i) =>
                                    s + (parseFloat(i.vl_duplicata) || 0),
                                  0,
                                )
                              );
                            }, 0);

                            return (
                              <tr
                                key={tipo.key}
                                className={`border-b border-gray-100 ${lIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                              >
                                {/* Coluna despesa */}
                                <td
                                  className={`px-4 py-2 sticky left-0 z-10 border-r border-gray-200 ${lIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                                  style={{ minWidth: 200 }}
                                >
                                  <div
                                    className={`flex items-center gap-2 px-2 py-1 rounded-md ${tipo.bgClass} ${tipo.borderClass} border`}
                                  >
                                    <TipoIcon
                                      size={13}
                                      weight="bold"
                                      className={tipo.colorClass}
                                    />
                                    <span
                                      className={`font-semibold ${tipo.colorClass}`}
                                    >
                                      {tipo.label}
                                    </span>
                                  </div>
                                </td>

                                {/* Células por mês */}
                                {meses.map((mes) => {
                                  const itens = porMes.get(mes.key) || [];
                                  return (
                                    <CelulaFluxo
                                      key={mes.key}
                                      itens={itens}
                                      onClick={() =>
                                        abrirModalCelula(
                                          itens,
                                          tipo,
                                          mes,
                                          cc.ds_ccusto || `CC ${cc.ccKey}`,
                                        )
                                      }
                                    />
                                  );
                                })}

                                {/* Coluna total da linha */}
                                <td className="text-center px-2 py-1.5 font-bold text-[#000638] border border-gray-100 bg-gray-50">
                                  {totalLinha > 0 ? (
                                    formatarMoeda(totalLinha)
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}

                  {/* Linha de totais gerais */}
                  <tr className="bg-[#000638]/5 border-t-2 border-[#000638]/30">
                    <td className="px-4 py-3 font-bold text-[#000638] sticky left-0 bg-[#000638]/5 z-10 uppercase text-xs tracking-wide">
                      TOTAL GERAL
                    </td>
                    {meses.map((mes) => {
                      const totalMes = dados.reduce((soma, item) => {
                        const mesItem = getItemMonthKey(item);
                        if (mesItem === mes.key)
                          soma += parseFloat(item.vl_duplicata) || 0;
                        return soma;
                      }, 0);
                      return (
                        <td
                          key={mes.key}
                          className="text-center px-2 py-3 font-bold text-[#000638] border border-gray-200"
                        >
                          {totalMes > 0 ? (
                            formatarMoeda(totalMes)
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-3 font-bold text-[#000638] border border-gray-200 bg-gray-100">
                      {formatarMoeda(resumo.totalValor)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Tela inicial ─────────────────────────────────────────────── */}
        {!loading && !dadosCarregados && (
          <div className="text-center py-20 text-gray-400">
            <Receipt size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-1">
              Selecione os filtros para visualizar as despesas fixas
            </p>
            <p className="text-sm">
              Serão exibidas: Energia, Água/Esgoto, Internet, Telefone,
              Condomínio e Aluguéis
            </p>
          </div>
        )}
      </div>

      {/* ─── Modal de detalhes ─────────────────────────────────────────── */}
      {modalCelula && (
        <ModalCelula
          celula={modalCelula}
          onClose={() => setModalCelula(null)}
        />
      )}
    </div>
  );
};

export default DespesasFixas;
