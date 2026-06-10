import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Funnel,
  Spinner,
  Factory,
  Warning,
  X,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Receipt,
  PaperPlaneTilt,
  Package,
  Wrench,
  Scissors,
  Buildings,
  UploadSimple,
  FileArrowDown,
  FloppyDisk,
  CheckCircle,
  TShirt,
  FilePdf,
  FileXls,
  Phone,
  WhatsappLogo,
} from '@phosphor-icons/react';

const STORAGE_BUCKET = 'despesas-industria';

// ─── Mapeamento código TOTVS → categoria de despesa de indústria ────────────
const CODIGO_PARA_CATEGORIA = {
  1001: 'aviamentos',
  1002: 'materia_prima',
  1003: 'produto_pronto',
  1005: 'servico_industrializacao',
};

const CODIGOS_DESPESAS_INDUSTRIA = Object.keys(CODIGO_PARA_CATEGORIA).map(
  Number,
);

// Filiais fixas — mesmo conjunto da página de despesas fixas
const FILIAIS_FIXAS = [
  { cd: '1', nome: 'FILIAL 1' },
  { cd: '2', nome: 'FILIAL 2' },
  { cd: '5', nome: 'FILIAL 5' },
  { cd: '6', nome: 'FILIAL 6' },
  { cd: '11', nome: 'FILIAL 11' },
  { cd: '55', nome: 'FILIAL 55' },
  { cd: '65', nome: 'FILIAL 65' },
  { cd: '75', nome: 'FILIAL 75' },
  { cd: '85', nome: 'FILIAL 85' },
  { cd: '87', nome: 'FILIAL 87' },
  { cd: '88', nome: 'FILIAL 88' },
  { cd: '89', nome: 'FILIAL 89' },
  { cd: '90', nome: 'FILIAL 90' },
  { cd: '91', nome: 'FILIAL 91' },
  { cd: '92', nome: 'FILIAL 92' },
  { cd: '93', nome: 'FILIAL 93' },
  { cd: '94', nome: 'FILIAL 94' },
  { cd: '95', nome: 'FILIAL 95' },
  { cd: '96', nome: 'FILIAL 96' },
  { cd: '97', nome: 'FILIAL 97' },
  { cd: '99', nome: 'FILIAL 99' },
];

// ─── Tipos / categorias ──────────────────────────────────────────────────────
const TIPOS_DESPESAS_INDUSTRIA = [
  {
    key: 'aviamentos',
    codigo: 1001,
    label: 'AVIAMENTOS',
    icon: Scissors,
    colorClass: 'text-purple-700',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-300',
    headerBg: 'bg-purple-600',
  },
  {
    key: 'materia_prima',
    codigo: 1002,
    label: 'COMPRA DE MATÉRIA PRIMA',
    icon: Package,
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-300',
    headerBg: 'bg-blue-600',
  },
  {
    key: 'produto_pronto',
    codigo: 1003,
    label: 'COMPRA DE PRODUTO PRONTO',
    icon: TShirt,
    colorClass: 'text-pink-700',
    bgClass: 'bg-pink-50',
    borderClass: 'border-pink-300',
    headerBg: 'bg-pink-600',
  },
  {
    key: 'servico_industrializacao',
    codigo: 1005,
    label: 'SERVIÇO DE INDUSTRIALIZAÇÃO',
    icon: Wrench,
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-300',
    headerBg: 'bg-orange-600',
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

function formatarData(str) {
  const d = criarDataSemFuso(str);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

// ─── Modal de detalhes do fornecedor ─────────────────────────────────────────
const ModalFornecedor = ({ info, onClose }) => {
  const { user } = useAuth?.() || { user: null };
  const [enviando, setEnviando] = useState(false);
  const [msgEnvio, setMsgEnvio] = useState(null);
  const [itensLiberados, setItensLiberados] = useState(new Set());

  if (!info) return null;
  const { itens, fornecedorNome, categoriaLabel } = info;

  function itemKey(i) {
    return `${i.cd_empresa || ''}|${i.nr_duplicata || ''}|${i.nr_parcela || ''}|${i.cd_fornecedor || ''}`;
  }

  const itensLiberaveis = itens.filter(
    (i) => !i.dt_liq && !itensLiberados.has(itemKey(i)),
  );
  const podeLiberar = itensLiberaveis.length > 0;

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

  const totalAberto = itens
    .filter((i) => !i.dt_liq)
    .reduce((s, i) => s + (parseFloat(i.vl_duplicata) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {categoriaLabel}
            </p>
            <h3 className="font-bold text-[#000638] text-base">
              {fornecedorNome}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {itens.length} duplicata(s) — Total em aberto:{' '}
              <span className="font-semibold text-[#000638]">
                {formatarMoeda(totalAberto)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-2">Duplicata</th>
                <th className="py-2 px-2">Empresa</th>
                <th className="py-2 px-2">Emissão</th>
                <th className="py-2 px-2">Vencimento</th>
                <th className="py-2 px-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 px-2 font-medium text-gray-700">
                    {item.nr_duplicata || '—'}
                    {item.nr_parcela ? `/${item.nr_parcela}` : ''}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {item.nm_empresa || item.cd_empresa || '—'}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {formatarData(item.dt_emissao)}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {formatarData(item.dt_vencimento)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-[#000638]">
                    {formatarMoeda(item.vl_duplicata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {itensLiberados.size > 0
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

// ─── Componente Principal ─────────────────────────────────────────────────────
const DespesasIndustria = () => {
  const apiClient = useApiClient();
  const { user } = useAuth?.() || { user: null };

  // ─── Estados de filtro ───
  const [modoData, setModoData] = useState('vencimento');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [situacao, setSituacao] = useState('N');
  const [previsao, setPrevisao] = useState('TODOS');
  // Apenas "EM ABERTO" por padrão
  const [filtroPagamento, setFiltroPagamento] = useState('NAO_PAGO');

  // ─── Estados de dados ───
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState(null);

  // ─── Estado de UI ───
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(
    new Set(TIPOS_DESPESAS_INDUSTRIA.map((t) => t.key)),
  );
  const [modalFornecedor, setModalFornecedor] = useState(null);
  const [modalInfoFornecedor, setModalInfoFornecedor] = useState(null); // { fornecedor, tipo }
  const [fornecedorDetalhes, setFornecedorDetalhes] = useState(null); // { loading, data, error }
  // Busca client-side por nome de fornecedor
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  // Filtro de status checado
  const [filtroChecado, setFiltroChecado] = useState('todos');
  // Mapa de valores reais persistidos: `${cd_fornecedor}|${categoria_codigo}` -> registro
  const [valoresMap, setValoresMap] = useState(new Map());

  // ─── Datas padrão (últimos 12 meses) ───
  useEffect(() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1);
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
        expenseCodeList: CODIGOS_DESPESAS_INDUSTRIA,
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

      const empresaMap = {};
      FILIAIS_FIXAS.forEach((f) => {
        empresaMap[String(f.cd)] = f.nome;
      });

      const processados = dadosArray
        .map((item) => ({
          ...item,
          nm_empresa:
            empresaMap[String(item.cd_empresa)] || item.nm_empresa || '',
          _categoria: getCategoriaDespesa(item.cd_despesaitem),
        }))
        .filter((item) => item._categoria !== null)
        // Garantir apenas EM ABERTO
        .filter((item) => !item.dt_liq);

      setDados(processados);
      setDadosCarregados(true);

      // Carregar valores reais já lançados para os fornecedores/categorias presentes
      try {
        const chaves = new Set();
        for (const it of processados) {
          if (it.cd_fornecedor) {
            chaves.add(
              `${String(it.cd_fornecedor)}|${parseInt(it.cd_despesaitem)}`,
            );
          }
        }
        if (chaves.size > 0) {
          const cds = Array.from(
            new Set(
              processados.map((i) => String(i.cd_fornecedor)).filter(Boolean),
            ),
          );
          const { data: valores } = await supabase
            .from('despesas_industria_pagamentos')
            .select('*')
            .in('cd_fornecedor', cds);
          const mapa = new Map();
          (valores || []).forEach((v) => {
            mapa.set(`${v.cd_fornecedor}|${v.categoria_codigo}`, v);
          });
          setValoresMap(mapa);
        } else {
          setValoresMap(new Map());
        }
      } catch (e) {
        console.warn('Não foi possível carregar valores reais:', e);
      }
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

  // ─── Agrupamento: Categoria → Fornecedor → [itens] ───────────────────────────
  const dadosAgrupados = useMemo(() => {
    const mapa = new Map();

    for (const item of dados) {
      const catKey = item._categoria;
      const fornecedorKey = String(item.cd_fornecedor || 'sem_fornecedor');
      const fornecedorNome =
        item.nm_fornecedor || `Fornecedor ${item.cd_fornecedor || '—'}`;

      if (!mapa.has(catKey)) {
        mapa.set(catKey, new Map());
      }
      const catMap = mapa.get(catKey);
      if (!catMap.has(fornecedorKey)) {
        catMap.set(fornecedorKey, {
          cd_fornecedor: item.cd_fornecedor,
          nm_fornecedor: fornecedorNome,
          itens: [],
        });
      }
      catMap.get(fornecedorKey).itens.push(item);
    }

    const termo = (buscaFornecedor || '').trim().toLowerCase();

    // Converter para array ordenado conforme TIPOS_DESPESAS_INDUSTRIA
    return TIPOS_DESPESAS_INDUSTRIA.map((tipo) => {
      const catMap = mapa.get(tipo.key);
      if (!catMap || catMap.size === 0) {
        return { tipo, fornecedores: [], totalCategoria: 0 };
      }
      let fornecedores = Array.from(catMap.values())
        .map((f) => {
          const total = f.itens.reduce(
            (s, i) => s + (parseFloat(i.vl_duplicata) || 0),
            0,
          );
          // Usar valor_real se existir, senão usar total original
          const chave = `${f.cd_fornecedor}|${tipo.codigo}`;
          const registro = valoresMap.get(chave);
          const totalEfetivo =
            registro?.valor_real != null
              ? parseFloat(registro.valor_real)
              : total;
          // ordenar itens por vencimento
          const itensOrdenados = [...f.itens].sort((a, b) => {
            const da = a.dt_vencimento || '';
            const db = b.dt_vencimento || '';
            return da.localeCompare(db);
          });
          return { ...f, itens: itensOrdenados, total, totalEfetivo };
        })
        .sort((a, b) => b.totalEfetivo - a.totalEfetivo);

      // Aplicar busca client-side por nome/código do fornecedor
      if (termo) {
        fornecedores = fornecedores.filter((f) => {
          const nome = String(f.nm_fornecedor || '').toLowerCase();
          const codigo = String(f.cd_fornecedor || '').toLowerCase();
          return nome.includes(termo) || codigo.includes(termo);
        });
      }

      const totalCategoria = fornecedores.reduce(
        (s, f) => s + f.totalEfetivo,
        0,
      );
      return { tipo, fornecedores, totalCategoria };
    });
  }, [dados, buscaFornecedor, valoresMap]);

  // ─── Resumo ──────────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const porCategoria = {};
    let total = 0;
    let totalDuplicatas = 0;
    for (const grupo of dadosAgrupados) {
      porCategoria[grupo.tipo.key] = grupo.totalCategoria;
      total += grupo.totalCategoria;
      totalDuplicatas += grupo.fornecedores.reduce(
        (s, f) => s + f.itens.length,
        0,
      );
    }
    return { total, totalDuplicatas, porCategoria };
  }, [dadosAgrupados]);

  // ─── Contadores de checado ───────────────────────────────────────────────────
  const contadoresChecado = useMemo(() => {
    let ok = 0;
    let naoOk = 0;
    for (const grupo of dadosAgrupados) {
      for (const f of grupo.fornecedores) {
        const chave = `${f.cd_fornecedor}|${grupo.tipo.codigo}`;
        const checado = valoresMap.get(chave)?.checado ?? false;
        if (checado) ok++;
        else naoOk++;
      }
    }
    return { ok, naoOk };
  }, [dadosAgrupados, valoresMap]);

  const toggleCategoria = useCallback((key) => {
    setCategoriasExpandidas((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }, []);

  // ─── Fetch detalhes do fornecedor ao abrir modal de info ─────────────────────
  useEffect(() => {
    if (!modalInfoFornecedor) {
      setFornecedorDetalhes(null);
      return;
    }
    const { fornecedor } = modalInfoFornecedor;
    if (!fornecedor?.cd_fornecedor) return;
    let cancelled = false;
    setFornecedorDetalhes({ loading: true });
    apiClient.totvs
      .supplierDetails(fornecedor.cd_fornecedor)
      .then((resp) => {
        if (cancelled) return;
        setFornecedorDetalhes({
          loading: false,
          data: resp?.data || resp || null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setFornecedorDetalhes({
          loading: false,
          error: err?.message || 'Erro ao buscar informações',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [modalInfoFornecedor]);

  // ─── Salvar valor real / comprovante para fornecedor+categoria ───────────────
  const salvarValorReal = useCallback(
    async ({ fornecedor, tipo, valorReal, file }) => {
      if (!fornecedor?.cd_fornecedor) {
        throw new Error('Fornecedor sem código.');
      }
      const cdFornecedor = String(fornecedor.cd_fornecedor);
      const categoriaCodigo = tipo.codigo;
      const chave = `${cdFornecedor}|${categoriaCodigo}`;
      const existente = valoresMap.get(chave);

      let comprovante_path = existente?.comprovante_path || null;
      let comprovante_nome = existente?.comprovante_nome || null;
      let comprovante_tipo = existente?.comprovante_tipo || null;

      if (file) {
        // Validar tipo
        const tipoOk =
          file.type.startsWith('image/') || file.type === 'application/pdf';
        if (!tipoOk) {
          throw new Error('Apenas imagens ou PDF são permitidos.');
        }
        // Remover anterior, se houver
        if (existente?.comprovante_path) {
          try {
            await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([existente.comprovante_path]);
          } catch {}
        }
        const uid = crypto.randomUUID?.() || String(Date.now());
        const safeName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${categoriaCodigo}/${cdFornecedor}/${uid}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        comprovante_path = path;
        comprovante_nome = file.name;
        comprovante_tipo = file.type;
      }

      const payload = {
        cd_fornecedor: cdFornecedor,
        nm_fornecedor: fornecedor.nm_fornecedor || null,
        categoria_codigo: categoriaCodigo,
        valor_real:
          valorReal === '' || valorReal === null || valorReal === undefined
            ? null
            : parseFloat(valorReal),
        dt_atualizacao: new Date().toISOString(),
        updated_by: user?.email || null,
        updated_at: new Date().toISOString(),
        comprovante_path,
        comprovante_nome,
        comprovante_tipo,
        // Preservar checado existente ao salvar valor
        checado: existente?.checado ?? false,
      };

      const { data, error } = await supabase
        .from('despesas_industria_pagamentos')
        .upsert(payload, { onConflict: 'cd_fornecedor,categoria_codigo' })
        .select()
        .single();
      if (error) throw error;

      setValoresMap((prev) => {
        const n = new Map(prev);
        n.set(chave, data);
        return n;
      });
      return data;
    },
    [valoresMap, user],
  );

  const toggleChecado = useCallback(
    async ({ fornecedor, tipo }) => {
      const cdFornecedor = String(fornecedor.cd_fornecedor);
      const categoriaCodigo = tipo.codigo;
      const chave = `${cdFornecedor}|${categoriaCodigo}`;
      const existente = valoresMap.get(chave);
      const novoChecado = !(existente?.checado ?? false);

      const payload = {
        cd_fornecedor: cdFornecedor,
        nm_fornecedor: fornecedor.nm_fornecedor || null,
        categoria_codigo: categoriaCodigo,
        checado: novoChecado,
        updated_by: user?.email || null,
        updated_at: new Date().toISOString(),
        valor_real: existente?.valor_real ?? null,
        dt_atualizacao: existente?.dt_atualizacao ?? new Date().toISOString(),
        comprovante_path: existente?.comprovante_path ?? null,
        comprovante_nome: existente?.comprovante_nome ?? null,
        comprovante_tipo: existente?.comprovante_tipo ?? null,
      };

      const { data, error } = await supabase
        .from('despesas_industria_pagamentos')
        .upsert(payload, { onConflict: 'cd_fornecedor,categoria_codigo' })
        .select()
        .single();
      if (error) throw error;

      setValoresMap((prev) => {
        const n = new Map(prev);
        n.set(chave, data);
        return n;
      });
    },
    [valoresMap, user],
  );

  const baixarComprovante = useCallback(async (registro) => {
    if (!registro?.comprovante_path) return;
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(registro.comprovante_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = registro.comprovante_nome || 'comprovante';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao baixar comprovante: ' + (err.message || err));
    }
  }, []);

  // ─── Exportar Excel ─────────────────────────────────────────────────────────
  const exportarExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    for (const grupo of dadosAgrupados) {
      if (grupo.fornecedores.length === 0) continue;
      const rows = [];
      for (const forn of grupo.fornecedores) {
        const chave = `${forn.cd_fornecedor}|${grupo.tipo.codigo}`;
        const registro = valoresMap.get(chave);
        const valorReal = registro?.valor_real ?? null;
        rows.push({
          Fornecedor: forn.nm_fornecedor,
          'Cód. Fornecedor': forn.cd_fornecedor,
          'Valor Total (Em Aberto)': forn.total,
          'Valor Real': valorReal,
          'Nr Duplicata': '',
          Vencimento: '',
          'Valor Duplicata': '',
        });
        for (const item of forn.itens) {
          rows.push({
            Fornecedor: '',
            'Cód. Fornecedor': '',
            'Valor Total (Em Aberto)': '',
            'Valor Real': '',
            'Nr Duplicata': item.nr_duplicata || item.nr_parcela || '',
            Vencimento: item.dt_vencimento
              ? item.dt_vencimento.split('T')[0]
              : '',
            'Valor Duplicata': parseFloat(item.vl_duplicata) || 0,
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      // Larguras das colunas
      ws['!cols'] = [
        { wch: 40 },
        { wch: 16 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
      ];
      const sheetName = grupo.tipo.label.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `despesas-industria-${date}.xlsx`);
  }, [dadosAgrupados, valoresMap]);

  // ─── Exportar PDF ────────────────────────────────────────────────────────────
  const exportarPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas de Indústria', 14, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Período: ${dataInicio} a ${dataFim}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      14,
      20,
    );

    let startY = 26;
    for (const grupo of dadosAgrupados) {
      if (grupo.fornecedores.length === 0) continue;
      const tableData = grupo.fornecedores.map((forn) => {
        const chave = `${forn.cd_fornecedor}|${grupo.tipo.codigo}`;
        const registro = valoresMap.get(chave);
        const duplicatasStr = forn.itens
          .map(
            (i) =>
              `${i.nr_duplicata || i.nr_parcela || '—'} (${formatarMoeda(i.vl_duplicata)})`,
          )
          .join('\n');
        return [
          forn.nm_fornecedor,
          String(forn.cd_fornecedor || ''),
          forn.itens.length,
          formatarMoeda(forn.total),
          registro?.valor_real != null
            ? formatarMoeda(registro.valor_real)
            : '—',
          duplicatasStr,
        ];
      });

      autoTable(doc, {
        startY,
        head: [
          [
            {
              content: grupo.tipo.label,
              colSpan: 6,
              styles: {
                halign: 'left',
                fontStyle: 'bold',
                fillColor: [30, 30, 80],
              },
            },
          ],
          [
            'Fornecedor',
            'Cód.',
            'Dupl.',
            'Valor Total',
            'Valor Real',
            'Duplicatas',
          ],
        ],
        body: tableData,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: { fillColor: [0, 6, 56], textColor: 255, fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 18 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 'auto' },
        },
        rowPageBreak: 'auto',
      });
      startY = doc.lastAutoTable.finalY + 8;
      if (startY > 185) {
        doc.addPage();
        startY = 14;
      }
    }
    const date = new Date().toISOString().split('T')[0];
    doc.save(`despesas-industria-${date}.pdf`);
  }, [dadosAgrupados, valoresMap, dataInicio, dataFim]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <PageTitle
          title="Despesas de Indústria"
          subtitle="Acompanhe aviamentos, matéria prima e serviço de industrialização em aberto"
          icon={Factory}
          iconColor="text-orange-600"
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
                <option value="NAO_PAGO">EM ABERTO</option>
                <option value="PAGO">PAGOS</option>
                <option value="TODOS">TODOS</option>
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

        {/* ─── Busca por fornecedor (client-side) ──────────────────────── */}
        {dadosCarregados && (
          <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2">
            <MagnifyingGlass
              size={14}
              weight="bold"
              className="text-[#000638]"
            />
            <input
              type="text"
              value={buscaFornecedor}
              onChange={(e) => setBuscaFornecedor(e.target.value)}
              placeholder="Buscar fornecedor por nome ou código..."
              className="flex-1 min-w-[160px] border border-[#000638]/20 rounded-lg px-3 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
            />
            {buscaFornecedor && (
              <button
                type="button"
                onClick={() => setBuscaFornecedor('')}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Limpar
              </button>
            )}

            {/* ── Filtro de checado ── */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setFiltroChecado('todos')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  filtroChecado === 'todos'
                    ? 'bg-[#000638] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Todos ({contadoresChecado.ok + contadoresChecado.naoOk})
              </button>
              <button
                type="button"
                onClick={() => setFiltroChecado('ok')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  filtroChecado === 'ok'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-700 hover:bg-green-50'
                }`}
              >
                <CheckCircle size={11} weight="fill" />
                OK ({contadoresChecado.ok})
              </button>
              <button
                type="button"
                onClick={() => setFiltroChecado('nao_ok')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  filtroChecado === 'nao_ok'
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="w-2.5 h-2.5 border border-current rounded-sm inline-block" />
                Não checado ({contadoresChecado.naoOk})
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={exportarExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <FileXls size={13} weight="bold" />
                Excel
              </button>
              <button
                type="button"
                onClick={exportarPDF}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <FilePdf size={13} weight="bold" />
                PDF
              </button>
            </div>
          </div>
        )}

        {/* ─── Cards de resumo ─────────────────────────────────────────── */}
        {dadosCarregados && (
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[140px]">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">
                Total em Aberto
              </p>
              <p className="text-sm font-bold text-[#000638] leading-tight">
                {formatarMoeda(resumo.total)}
              </p>
              <p className="text-[9px] text-gray-400">
                {resumo.totalDuplicatas} dupl.
              </p>
            </div>
            {TIPOS_DESPESAS_INDUSTRIA.map((tipo) => {
              const Icon = tipo.icon;
              return (
                <div
                  key={tipo.key}
                  className={`rounded-lg border shadow-sm px-4 py-2 flex flex-col justify-center min-w-[140px] ${tipo.bgClass} ${tipo.borderClass}`}
                >
                  <p
                    className={`text-[9px] uppercase tracking-wide flex items-center gap-1 ${tipo.colorClass}`}
                  >
                    <Icon size={9} weight="bold" />
                    {tipo.label}
                  </p>
                  <p
                    className={`text-sm font-bold leading-tight ${tipo.colorClass}`}
                  >
                    {formatarMoeda(resumo.porCategoria[tipo.key] || 0)}
                  </p>
                </div>
              );
            })}
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
            <p className="text-sm">Carregando despesas de indústria...</p>
          </div>
        )}

        {/* ─── Vazio ───────────────────────────────────────────────────── */}
        {!loading &&
          dadosCarregados &&
          dadosAgrupados.every((g) => g.fornecedores.length === 0) && (
            <div className="text-center py-20 text-gray-400">
              <Factory size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Nenhuma despesa de indústria em aberto encontrada para o período
                selecionado.
              </p>
            </div>
          )}

        {/* ─── Listagem por categoria ──────────────────────────────────── */}
        {!loading &&
          dadosCarregados &&
          dadosAgrupados.map((grupo) => {
            // Aplicar filtro de checado
            const fornecedoresFiltrados =
              filtroChecado === 'todos'
                ? grupo.fornecedores
                : grupo.fornecedores.filter((f) => {
                    const chave = `${f.cd_fornecedor}|${grupo.tipo.codigo}`;
                    const checado = valoresMap.get(chave)?.checado ?? false;
                    return filtroChecado === 'ok' ? checado : !checado;
                  });
            if (fornecedoresFiltrados.length === 0) return null;
            const expandido = categoriasExpandidas.has(grupo.tipo.key);
            const TipoIcon = grupo.tipo.icon;

            return (
              <div
                key={grupo.tipo.key}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4"
              >
                <button
                  type="button"
                  onClick={() => toggleCategoria(grupo.tipo.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-white ${grupo.tipo.headerBg} hover:opacity-95 transition`}
                >
                  <div className="flex items-center gap-2">
                    {expandido ? (
                      <CaretDown size={14} weight="bold" />
                    ) : (
                      <CaretRight size={14} weight="bold" />
                    )}
                    <TipoIcon size={16} weight="bold" />
                    <span className="font-bold text-sm tracking-wide">
                      {grupo.tipo.label}
                    </span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                      {fornecedoresFiltrados.length} fornecedor(es)
                    </span>
                  </div>
                  <span className="font-bold text-sm">
                    {formatarMoeda(grupo.totalCategoria)}
                  </span>
                </button>

                {expandido && (
                  <div>
                    {/* Header de colunas */}
                    <div
                      className="hidden lg:grid bg-gray-100 border-t border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                      style={{
                        gridTemplateColumns: '3fr 1.5fr 1.5fr 1.5fr 2fr auto',
                      }}
                    >
                      <div className="px-4 py-2 border-r border-gray-200">
                        Fornecedor
                      </div>
                      <div className="px-4 py-2 border-r border-gray-200 text-right">
                        Em Aberto
                      </div>
                      <div className="px-4 py-2 border-r border-gray-200 text-right">
                        Valor Real
                      </div>
                      <div className="px-4 py-2 border-r border-gray-200">
                        Atualização
                      </div>
                      <div className="px-4 py-2 border-r border-gray-200">
                        Comprovante
                      </div>
                      <div className="px-4 py-2 min-w-[140px]">Ações</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {fornecedoresFiltrados.map((forn) => (
                        <FornecedorItem
                          key={forn.cd_fornecedor}
                          fornecedor={forn}
                          tipo={grupo.tipo}
                          registroValor={valoresMap.get(
                            `${forn.cd_fornecedor}|${grupo.tipo.codigo}`,
                          )}
                          onSalvar={(payload) =>
                            salvarValorReal({
                              fornecedor: forn,
                              tipo: grupo.tipo,
                              ...payload,
                            })
                          }
                          onToggleChecado={() =>
                            toggleChecado({
                              fornecedor: forn,
                              tipo: grupo.tipo,
                            })
                          }
                          onBaixarComprovante={baixarComprovante}
                          onAbrirModal={() =>
                            setModalFornecedor({
                              itens: forn.itens,
                              fornecedorNome: forn.nm_fornecedor,
                              categoriaLabel: grupo.tipo.label,
                            })
                          }
                          onAbrirInfo={() => {
                            setModalInfoFornecedor({
                              fornecedor: forn,
                              tipo: grupo.tipo,
                            });
                            setFornecedorDetalhes({ loading: true });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* ─── Tela inicial ─────────────────────────────────────────────── */}
        {!loading && !dadosCarregados && (
          <div className="text-center py-20 text-gray-400">
            <Factory size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-1">
              Selecione os filtros para visualizar as despesas de indústria
            </p>
            <p className="text-sm">
              Categorias: Aviamentos, Matéria Prima e Serviço de
              Industrialização
            </p>
          </div>
        )}
      </div>

      {/* ─── Modal de detalhes ─────────────────────────────────────────── */}
      {modalFornecedor && (
        <ModalFornecedor
          info={modalFornecedor}
          onClose={() => setModalFornecedor(null)}
        />
      )}

      {/* ─── Modal de info do fornecedor (telefone / WA) ───────────────── */}
      {modalInfoFornecedor && (
        <ModalInfoFornecedor
          fornecedor={modalInfoFornecedor.fornecedor}
          tipo={modalInfoFornecedor.tipo}
          detalhes={fornecedorDetalhes}
          valoresMap={valoresMap}
          onFechar={() => {
            setModalInfoFornecedor(null);
            setFornecedorDetalhes(null);
          }}
        />
      )}
    </div>
  );
};

// ─── Modal de Informações do Fornecedor ──────────────────────────────────────
const ModalInfoFornecedor = ({
  fornecedor,
  tipo,
  detalhes,
  valoresMap,
  onFechar,
}) => {
  const chave = `${fornecedor.cd_fornecedor}|${tipo.codigo}`;
  const registro = valoresMap?.get(chave);
  const cnpj = fornecedor.itens?.[0]?.nr_cpfcnpj_fornecedor || '';

  const formatCnpj = (v) => {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 14)
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11)
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return v;
  };

  const phones = detalhes?.data?.phones || [];
  const defaultPhone = phones.find((p) => p.isDefault) || phones[0] || null;
  const phoneDigits = defaultPhone?.full || '';
  const waLink = phoneDigits ? `https://wa.me/55${phoneDigits}` : null;

  const formatPhone = (p) => {
    if (!p) return '';
    const d = p.full || '';
    if (d.length === 11)
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10)
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d || `(${p.ddd}) ${p.number}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${tipo.headerBg} rounded-t-2xl px-5 py-4 flex items-start justify-between`}
        >
          <div className="flex items-center gap-3">
            <Buildings
              size={22}
              weight="fill"
              className="text-white shrink-0 mt-0.5"
            />
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                {fornecedor.nm_fornecedor}
              </h2>
              {fornecedor.cd_fornecedor && (
                <p className="text-white/70 text-xs mt-0.5">
                  Cód. {fornecedor.cd_fornecedor}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-white/70 hover:text-white transition ml-3 mt-0.5"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* CNPJ */}
          {cnpj && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-14 shrink-0">CNPJ</span>
              <span className="text-sm font-mono font-semibold text-gray-800">
                {formatCnpj(cnpj)}
              </span>
            </div>
          )}

          {/* Categoria */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-14 shrink-0">
              Categoria
            </span>
            <span className={`text-xs font-semibold ${tipo.colorClass}`}>
              {tipo.label}
            </span>
          </div>

          {/* Totais */}
          <div className="flex gap-4 bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                Em Aberto
              </div>
              <div className={`text-sm font-bold ${tipo.colorClass}`}>
                {formatarMoeda(fornecedor.total)}
              </div>
            </div>
            {registro?.valor_real != null && (
              <div className="flex-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Valor Real
                </div>
                <div className="text-sm font-bold text-gray-700">
                  {formatarMoeda(registro.valor_real)}
                </div>
              </div>
            )}
          </div>

          {/* Telefone */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">
              Telefone de contato
            </div>
            {detalhes?.loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Spinner size={15} className="animate-spin" />
                <span>Buscando dados...</span>
              </div>
            ) : detalhes?.error ? (
              <p className="text-xs text-red-500">{detalhes.error}</p>
            ) : defaultPhone ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-2 flex-1">
                  <Phone size={15} className="text-gray-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">
                    {formatPhone(defaultPhone)}
                  </span>
                </div>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-2 text-sm font-semibold transition shrink-0"
                    title="Abrir conversa no WhatsApp"
                  >
                    <WhatsappLogo size={16} weight="fill" />
                    WhatsApp
                  </a>
                )}
              </div>
            ) : detalhes?.data ? (
              <p className="text-xs text-gray-400 italic">
                Telefone não cadastrado
              </p>
            ) : null}

            {/* Demais telefones */}
            {phones.length > 1 && (
              <div className="mt-2 space-y-1">
                {phones.slice(1).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-gray-500"
                  >
                    <Phone size={12} className="shrink-0" />
                    <span>{formatPhone(p)}</span>
                    {p.type && (
                      <span className="text-gray-400">({p.type})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={onFechar}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Item de fornecedor (expandível com duplicatas) ──────────────────────────
const FornecedorItem = ({
  fornecedor,
  tipo,
  registroValor,
  onSalvar,
  onToggleChecado,
  onBaixarComprovante,
  onAbrirModal,
  onAbrirInfo,
}) => {
  const [expandido, setExpandido] = useState(false);
  const TipoIcon = tipo.icon;
  const [toggling, setToggling] = useState(false);

  const checado = registroValor?.checado ?? false;

  const handleToggleChecado = async (e) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      await onToggleChecado?.();
    } catch (err) {
      alert('Erro ao atualizar: ' + (err.message || err));
    } finally {
      setToggling(false);
    }
  };

  const [valorReal, setValorReal] = useState(
    registroValor?.valor_real != null ? String(registroValor.valor_real) : '',
  );
  // Se já tem valor salvo, começa em modo exibição; senão, modo edição
  const [editandoValor, setEditandoValor] = useState(
    registroValor?.valor_real == null,
  );
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msgOk, setMsgOk] = useState(false);
  const fileInputRef = React.useRef(null);
  const inputValorRef = React.useRef(null);

  // Sincronizar quando o registro muda externamente
  useEffect(() => {
    setValorReal(
      registroValor?.valor_real != null ? String(registroValor.valor_real) : '',
    );
    setEditandoValor(registroValor?.valor_real == null);
  }, [registroValor?.valor_real]);

  const handleArquivo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivoSelecionado(f);
  };

  const handleSalvar = async (e) => {
    e?.stopPropagation();
    setSalvando(true);
    setMsgOk(false);
    try {
      await onSalvar({ valorReal, file: arquivoSelecionado });
      setArquivoSelecionado(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMsgOk(true);
      // Voltar para modo exibição após salvar
      if (valorReal !== '') setEditandoValor(false);
      setTimeout(() => setMsgOk(false), 2000);
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || err));
    } finally {
      setSalvando(false);
    }
  };

  const dtAtualizacao = registroValor?.dt_atualizacao
    ? new Date(registroValor.dt_atualizacao).toLocaleString('pt-BR')
    : '—';

  const valorRealNum = parseFloat(valorReal) || 0;
  const diff = valorRealNum - fornecedor.total;

  return (
    <div>
      <div
        className="hidden lg:grid items-center hover:bg-gray-50/60 transition border-gray-100"
        style={{ gridTemplateColumns: '3fr 1.5fr 1.5fr 1.5fr 2fr auto' }}
      >
        {/* ── Fornecedor ───────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-4 py-3 min-w-0 cursor-pointer border-r border-gray-200 self-stretch"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? (
            <CaretDown
              size={12}
              weight="bold"
              className="text-gray-400 shrink-0"
            />
          ) : (
            <CaretRight
              size={12}
              weight="bold"
              className="text-gray-400 shrink-0"
            />
          )}
          <Buildings size={13} className={`${tipo.colorClass} shrink-0`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-semibold text-sm text-[#000638] truncate hover:underline cursor-pointer"
                title="Ver informações do fornecedor"
                onClick={(e) => {
                  e.stopPropagation();
                  onAbrirInfo?.();
                }}
              >
                {fornecedor.nm_fornecedor}
              </span>
              {/* Badge de check — clicável, independente do expand */}
              <button
                type="button"
                onClick={handleToggleChecado}
                disabled={toggling}
                title={checado ? 'Marcar como não checado' : 'Marcar como OK'}
                className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                  checado
                    ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {toggling ? (
                  <Spinner size={10} className="animate-spin" />
                ) : checado ? (
                  <CheckCircle size={11} weight="fill" />
                ) : (
                  <span className="w-2.5 h-2.5 border border-gray-400 rounded-sm inline-block" />
                )}
                {checado ? 'OK' : ''}
              </button>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {fornecedor.cd_fornecedor
                ? `Cód. ${fornecedor.cd_fornecedor} · `
                : ''}
              {fornecedor.itens.length} duplicata
              {fornecedor.itens.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* ── Em Aberto ────────────────────────────────── */}
        <div className="px-4 py-3 text-right border-r border-gray-200 self-stretch flex flex-col justify-center">
          <div className={`font-bold text-sm ${tipo.colorClass}`}>
            {formatarMoeda(fornecedor.total)}
          </div>
        </div>

        {/* ── Valor Real ───────────────────────────────── */}
        <div className="px-4 py-3 border-r border-gray-200 self-stretch flex flex-col justify-center">
          {editandoValor ? (
            <>
              <input
                ref={inputValorRef}
                type="number"
                step="0.01"
                min="0"
                value={valorReal}
                onChange={(e) => setValorReal(e.target.value)}
                placeholder="0,00"
                autoFocus
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#000638]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    if (registroValor?.valor_real != null)
                      setEditandoValor(false);
                  }
                }}
              />
              {valorReal !== '' && (
                <div
                  className={`text-[10px] mt-1 text-right font-medium ${
                    diff < 0
                      ? 'text-green-600'
                      : diff > 0
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }`}
                >
                  Δ {formatarMoeda(diff)}
                </div>
              )}
            </>
          ) : (
            <div
              className="text-right cursor-pointer group"
              title="Clique para editar"
              onClick={(e) => {
                e.stopPropagation();
                setEditandoValor(true);
                setTimeout(() => inputValorRef.current?.focus(), 50);
              }}
            >
              <div className="font-bold text-sm text-green-600 group-hover:opacity-80 transition">
                {formatarMoeda(parseFloat(valorReal) || 0)}
              </div>
              {valorReal !== '' && (
                <div
                  className={`text-[10px] mt-0.5 font-medium ${
                    diff < 0
                      ? 'text-green-600'
                      : diff > 0
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }`}
                >
                  Δ {formatarMoeda(diff)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Atualização ──────────────────────────────── */}
        <div className="px-4 py-3 border-r border-gray-200 self-stretch flex flex-col justify-center">
          <div className="text-[11px] text-gray-700 leading-snug">
            {dtAtualizacao}
          </div>
          {registroValor?.updated_by && (
            <div className="text-[10px] text-gray-400 truncate mt-0.5">
              {registroValor.updated_by}
            </div>
          )}
        </div>

        {/* ── Comprovante ──────────────────────────────── */}
        <div className="px-4 py-3 border-r border-gray-200 self-stretch flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleArquivo}
            onClick={(e) => e.stopPropagation()}
            className="hidden"
            id={`file-${tipo.codigo}-${fornecedor.cd_fornecedor}`}
          />
          <label
            htmlFor={`file-${tipo.codigo}-${fornecedor.cd_fornecedor}`}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 cursor-pointer border border-gray-200 truncate max-w-[120px]"
            onClick={(e) => e.stopPropagation()}
            title={
              arquivoSelecionado?.name ||
              registroValor?.comprovante_nome ||
              'Selecionar comprovante'
            }
          >
            <UploadSimple size={11} weight="bold" className="shrink-0" />
            <span className="truncate">
              {arquivoSelecionado
                ? arquivoSelecionado.name
                : (registroValor?.comprovante_nome ?? 'Anexar')}
            </span>
          </label>
          {registroValor?.comprovante_path && !arquivoSelecionado && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBaixarComprovante?.(registroValor);
              }}
              className="text-[10px] p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shrink-0"
              title={`Baixar: ${registroValor.comprovante_nome}`}
            >
              <FileArrowDown size={12} weight="bold" />
            </button>
          )}
        </div>

        {/* ── Ações ────────────────────────────────────── */}
        <div className="px-4 py-3 self-stretch flex items-center gap-1.5 min-w-[140px]">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-md bg-[#000638] text-white hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
          >
            {salvando ? (
              <Spinner size={11} className="animate-spin" />
            ) : msgOk ? (
              <CheckCircle size={11} weight="bold" />
            ) : (
              <FloppyDisk size={11} weight="bold" />
            )}
            {msgOk ? 'Salvo' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAbrirModal();
            }}
            className="text-[10px] px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-[#000638] border border-gray-200 whitespace-nowrap"
          >
            Detalhes
          </button>
        </div>
      </div>

      {expandido && (
        <div className="bg-gray-50/50 px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1.5 px-2 font-medium">Duplicata</th>
                <th className="py-1.5 px-2 font-medium">Empresa</th>
                <th className="py-1.5 px-2 font-medium">Emissão</th>
                <th className="py-1.5 px-2 font-medium">Vencimento</th>
                <th className="py-1.5 px-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {fornecedor.itens.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 last:border-0 hover:bg-white"
                >
                  <td className="py-1 px-2 font-medium text-gray-700">
                    {item.nr_duplicata || '—'}
                    {item.nr_parcela ? `/${item.nr_parcela}` : ''}
                  </td>
                  <td className="py-1 px-2 text-gray-700">
                    {item.nm_empresa || item.cd_empresa || '—'}
                  </td>
                  <td className="py-1 px-2 text-gray-700">
                    {formatarData(item.dt_emissao)}
                  </td>
                  <td className="py-1 px-2 text-gray-700">
                    {formatarData(item.dt_vencimento)}
                  </td>
                  <td className="py-1 px-2 text-right font-semibold text-[#000638]">
                    {formatarMoeda(item.vl_duplicata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DespesasIndustria;
