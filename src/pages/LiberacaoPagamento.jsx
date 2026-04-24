import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthContext';
import PageTitle from '../components/ui/PageTitle';
import {
  CurrencyDollar,
  CheckCircle,
  Warning,
  Spinner,
  FloppyDisk,
  Trash,
  Funnel,
  Receipt,
  Clock,
  XCircle,
  Stamp,
  Bank,
  FileXls,
  Info,
  ChatCircleText,
  Wallet,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';

const BANCOS = [
  'SICREDI CROSBY',
  'SICREDI FÁBIO',
  'STONE',
  'ITAU FLAVIO',
  'CAIXA IRMAOS',
];

const FORMAS_PAGAMENTO = [
  { value: 'PIX', label: 'PIX', detalheLabel: 'Chave PIX', campo: 'chave_pix' },
  {
    value: 'BOLETO',
    label: 'Boleto',
    detalheLabel: 'Código de Barras',
    campo: 'codigo_barras',
  },
  {
    value: 'DEBITO',
    label: 'Débito',
    detalheLabel: 'Link de Pagamento',
    campo: 'link_pagamento',
  },
  {
    value: 'CREDITO',
    label: 'Crédito',
    detalheLabel: 'Link de Pagamento',
    campo: 'link_pagamento',
  },
];

const STATUS_CONFIG = {
  PENDENTE: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Clock,
  },
  APROVADO: {
    label: 'Aprovado',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: CheckCircle,
  },
  PAGO: {
    label: 'Pago',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle,
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
  },
};

const fmtBRL = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const BANCOS_SALDO = [
  'SICREDI CROSBY',
  'SICREDI FÁBIO',
  'STONE',
  'ITAU FLAVIO',
  'CAIXA IRMAOS',
];

// ─── Modal de Saldo Bancário ──────────────────────────
const ModalSaldoBancario = ({ onClose, onSaved, userEmail }) => {
  const [valores, setValores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('saldo_bancario').select('*');
      const map = {};
      (data || []).forEach((r) => {
        map[r.banco] = r.valor;
      });
      setValores(map);
      setLoading(false);
    };
    load();
  }, []);

  const total = BANCOS_SALDO.reduce(
    (s, b) => s + parseFloat(valores[b] || 0),
    0,
  );

  const handleSalvar = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const rows = BANCOS_SALDO.map((banco) => ({
      banco,
      valor: parseFloat(valores[banco] || 0),
      updated_at: now,
      updated_by: userEmail || null,
    }));
    const { error } = await supabase
      .from('saldo_bancario')
      .upsert(rows, { onConflict: 'banco' });
    setSaving(false);
    if (error) {
      alert('Erro ao salvar: ' + error.message);
      return;
    }
    onSaved(rows);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
            <Wallet size={16} weight="bold" className="text-teal-600" />
            Saldo Bancário
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {BANCOS_SALDO.map((banco) => (
              <div key={banco} className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-700 w-36 shrink-0 flex items-center gap-1">
                  <Bank size={11} className="text-[#000638]" />
                  {banco}
                </label>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valores[banco] ?? ''}
                    onChange={(e) =>
                      setValores((p) => ({ ...p, [banco]: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs pl-7 focus:ring-1 focus:ring-teal-500"
                    placeholder="0,00"
                  />
                </div>
                <span className="text-xs font-semibold text-teal-700 w-24 text-right">
                  {fmtBRL(parseFloat(valores[banco] || 0))}
                </span>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Total
              </span>
              <span className="text-base font-bold text-teal-700">
                {fmtBRL(total)}
              </span>
            </div>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving || loading}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            {saving ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <FloppyDisk size={12} weight="bold" />
            )}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal de detalhes do pagamento ──────────────────
const ModalInfoPagamento = ({ item, onClose }) => {
  const formaCfg = FORMAS_PAGAMENTO.find(
    (f) => f.value === item.forma_pagamento,
  );
  const detalhe = item.chave_pix || item.codigo_barras || item.link_pagamento;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-gray-800">
            Detalhes do Pagamento
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <XCircle size={18} weight="bold" />
          </button>
        </div>
        <div className="space-y-3">
          {item.banco_pagamento && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">
                Banco
              </p>
              <p className="text-sm text-gray-800 font-semibold flex items-center gap-1">
                <Bank size={13} className="text-[#000638]" />
                {item.banco_pagamento}
              </p>
            </div>
          )}
          {item.forma_pagamento && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">
                Forma de Pagamento
              </p>
              <span className="inline-block text-xs px-2 py-0.5 rounded bg-[#000638] text-white font-semibold">
                {formaCfg?.label || item.forma_pagamento}
              </span>
            </div>
          )}
          {detalhe && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">
                {formaCfg?.detalheLabel || 'Detalhe'}
              </p>
              <p className="text-xs text-gray-800 font-mono break-all bg-gray-50 rounded p-2 border border-gray-100">
                {detalhe}
              </p>
            </div>
          )}
          {item.observacao && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">
                Observação
              </p>
              <p className="text-sm text-gray-700 italic">{item.observacao}</p>
            </div>
          )}
          {!item.banco_pagamento &&
            !item.forma_pagamento &&
            !detalhe &&
            !item.observacao && (
              <p className="text-sm text-gray-400 text-center py-2">
                Nenhum detalhe registrado.
              </p>
            )}
        </div>
        {item.pago_em && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              Pago em {fmtDateTime(item.pago_em)}
              {item.pago_por ? ` · ${item.pago_por}` : ''}
            </p>
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-[#000638] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#001060] transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

// ─── Linha da tabela ──────────────────────────────────
const LinhaTitulo = React.memo(
  ({
    item,
    isAdmin,
    selecionado,
    onToggleSelect,
    onSalvar,
    onExcluir,
    onAprovar,
    onMarcarPago,
    onAbrirModal,
  }) => {
    const [forma, setForma] = useState(item.forma_pagamento || '');
    const [banco, setBanco] = useState(item.banco_pagamento || '');
    const [detalhe, setDetalhe] = useState(
      item.chave_pix || item.codigo_barras || item.link_pagamento || '',
    );
    const [obs, setObs] = useState(item.observacao || '');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const formaCfg = FORMAS_PAGAMENTO.find((f) => f.value === forma);
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDENTE;
    const StatusIcon = statusCfg.icon;

    const marcarDirty = () => setDirty(true);

    const handleSalvar = async () => {
      setSaving(true);
      const patch = {
        banco_pagamento: banco || null,
        forma_pagamento: forma || null,
        chave_pix: null,
        codigo_barras: null,
        link_pagamento: null,
        observacao: obs || null,
      };
      if (formaCfg) patch[formaCfg.campo] = detalhe || null;

      await onSalvar(item.id, patch);
      setDirty(false);
      setSaving(false);
    };

    const podeEditar = item.status !== 'PAGO' && item.status !== 'CANCELADO';

    // Datas de auditoria por status
    const linhasAuditoria = [
      { label: 'Inclusão', value: fmtDateTime(item.created_at) },
      item.aprovado_em && {
        label: 'Aprovado',
        value: `${fmtDateTime(item.aprovado_em)} · ${item.aprovado_por || ''}`,
      },
      item.pago_em && {
        label: 'Pago',
        value: `${fmtDateTime(item.pago_em)} · ${item.pago_por || ''}`,
      },
      item.cancelado_em && {
        label: 'Cancelado',
        value: `${fmtDateTime(item.cancelado_em)} · ${item.cancelado_por || ''}`,
      },
    ].filter(Boolean);

    return (
      <tr
        className={`border-b border-gray-100 ${selecionado ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      >
        <td className="px-2 py-2 text-center">
          {isAdmin &&
            (item.status === 'PENDENTE' || item.status === 'APROVADO') && (
              <input
                type="checkbox"
                checked={selecionado}
                onChange={() => onToggleSelect(item.id)}
                className="w-4 h-4 accent-[#000638]"
              />
            )}
        </td>
        <td className="px-2 py-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.color}`}
          >
            <StatusIcon size={11} weight="bold" />
            {statusCfg.label}
          </span>
        </td>
        <td className="px-2 py-2 text-xs">
          <div className="font-mono text-gray-700">
            {fmtDate(item.dt_vencimento)}
          </div>
          <div className="mt-1 space-y-0.5">
            {linhasAuditoria.map((a) => (
              <div
                key={a.label}
                className="text-[9px] text-gray-400 leading-tight"
              >
                <span className="font-semibold text-gray-500">{a.label}:</span>{' '}
                {a.value}
              </div>
            ))}
          </div>
        </td>
        <td className="px-2 py-2 text-xs font-semibold text-green-700">
          {fmtBRL(item.vl_duplicata)}
        </td>
        <td className="px-2 py-2 text-xs">
          <div
            className="font-medium text-gray-800 truncate max-w-[180px]"
            title={item.nm_fornecedor}
          >
            {item.nm_fornecedor || '—'}
          </div>
          <div className="text-[10px] text-gray-500">
            Cód. {item.cd_fornecedor || '—'}
          </div>
        </td>
        <td
          className="px-2 py-2 text-xs text-gray-700 truncate max-w-[160px]"
          title={item.ds_despesaitem}
        >
          {item.ds_despesaitem || '—'}
        </td>
        <td className="px-2 py-2 text-xs text-gray-700">
          {item.nr_duplicata || '—'}
          {item.nr_parcela ? `/${item.nr_parcela}` : ''}
        </td>
        <td className="px-2 py-2">
          {podeEditar ? (
            <>
              <select
                value={banco}
                onChange={(e) => {
                  setBanco(e.target.value);
                  marcarDirty();
                }}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#000638] mb-1"
              >
                <option value="">— Banco —</option>
                {BANCOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={forma}
                onChange={(e) => {
                  setForma(e.target.value);
                  setDetalhe('');
                  marcarDirty();
                }}
                className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#000638]"
              >
                <option value="">— Forma —</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="space-y-0.5">
              {item.banco_pagamento && (
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                  <Bank size={11} className="text-[#000638]" />
                  {item.banco_pagamento}
                </div>
              )}
              {item.forma_pagamento && (
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                  {FORMAS_PAGAMENTO.find(
                    (f) => f.value === item.forma_pagamento,
                  )?.label || item.forma_pagamento}
                </span>
              )}
              {!item.banco_pagamento && !item.forma_pagamento && (
                <span className="text-[10px] text-gray-400">—</span>
              )}
            </div>
          )}
        </td>
        <td className="px-2 py-2">
          {podeEditar ? (
            <input
              value={detalhe}
              disabled={!formaCfg}
              onChange={(e) => {
                setDetalhe(e.target.value);
                marcarDirty();
              }}
              placeholder={
                formaCfg ? formaCfg.detalheLabel : 'Selecione a forma'
              }
              className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs disabled:bg-gray-100 focus:ring-1 focus:ring-[#000638]"
            />
          ) : (
            <div>
              {item.chave_pix || item.codigo_barras || item.link_pagamento ? (
                <button
                  onClick={() => onAbrirModal(item)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Info size={10} weight="bold" />
                  Detalhe
                </button>
              ) : (
                <span className="text-gray-400 text-xs">—</span>
              )}
            </div>
          )}
        </td>
        <td className="px-2 py-2">
          {podeEditar ? (
            <input
              value={obs}
              onChange={(e) => {
                setObs(e.target.value);
                marcarDirty();
              }}
              placeholder="Observação"
              className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-[#000638]"
            />
          ) : (
            <div>
              {item.observacao ? (
                <button
                  onClick={() => onAbrirModal(item)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <ChatCircleText size={10} weight="bold" />
                  Obs
                </button>
              ) : (
                <span className="text-gray-400 text-xs">—</span>
              )}
            </div>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1 justify-end">
            {podeEditar && (
              <button
                onClick={handleSalvar}
                disabled={saving || !dirty}
                className="flex items-center gap-1 bg-[#000638] hover:bg-[#001060] disabled:opacity-40 text-white text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                title="Salvar alterações"
              >
                {saving ? (
                  <Spinner size={10} className="animate-spin" />
                ) : (
                  <FloppyDisk size={10} weight="bold" />
                )}
              </button>
            )}
            {isAdmin && item.status === 'PENDENTE' && (
              <button
                onClick={() => {
                  const extra = {
                    banco_pagamento: banco || null,
                    forma_pagamento: forma || null,
                    chave_pix: null,
                    codigo_barras: null,
                    link_pagamento: null,
                    observacao: obs || null,
                  };
                  if (formaCfg) extra[formaCfg.campo] = detalhe || null;
                  onAprovar(item.id, extra);
                }}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                title="Aprovar título"
              >
                <Stamp size={10} weight="bold" />
                APROVAR
              </button>
            )}
            {isAdmin && item.status === 'APROVADO' && (
              <button
                onClick={() => {
                  const extra = {
                    banco_pagamento: banco || null,
                    forma_pagamento: forma || null,
                    chave_pix: null,
                    codigo_barras: null,
                    link_pagamento: null,
                    observacao: obs || null,
                  };
                  if (formaCfg) extra[formaCfg.campo] = detalhe || null;
                  onMarcarPago(item.id, extra);
                }}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
                title="Marcar como pago"
              >
                <CheckCircle size={10} weight="bold" />
                PAGAR
              </button>
            )}
            {isAdmin &&
              item.status !== 'PAGO' &&
              item.status !== 'CANCELADO' && (
                <button
                  onClick={() => onExcluir(item.id)}
                  className="text-red-500 hover:text-red-700 p-1 rounded"
                  title="Excluir"
                >
                  <Trash size={12} weight="bold" />
                </button>
              )}
          </div>
        </td>
      </tr>
    );
  },
);
LinhaTitulo.displayName = 'LinhaTitulo';

// ─── Página principal ──────────────────────────────────
const LiberacaoPagamento = () => {
  const { user, hasAnyRole } = useAuth() || {};
  const isAdmin = hasAnyRole?.(['owner', 'admin']) || false;

  const [titulos, setTitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [selecionados, setSelecionados] = useState(new Set());
  const [processando, setProcessando] = useState(false);
  const [processandoId, setProcessandoId] = useState(null);
  const [modalItem, setModalItem] = useState(null);
  // Saldo bancário
  const [saldos, setSaldos] = useState([]);
  const [showModalSaldo, setShowModalSaldo] = useState(false);
  // Filtros extras (PAGO)
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroBancoFiltro, setFiltroBancoFiltro] = useState('');
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from('pagamentos_liberacao')
      .select('*')
      .order('dt_vencimento', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) setErro(error.message);
    else setTitulos(data || []);
    setLoading(false);
  }, []);

  const carregarSaldos = useCallback(async () => {
    const { data } = await supabase.from('saldo_bancario').select('*');
    setSaldos(data || []);
  }, []);

  useEffect(() => {
    carregar();
    carregarSaldos();
  }, [carregar, carregarSaldos]);

  const titulosFiltrados = useMemo(() => {
    let lista =
      filtroStatus === 'TODOS'
        ? titulos
        : titulos.filter((t) => t.status === filtroStatus);
    if (filtroFornecedor.trim()) {
      const q = filtroFornecedor.toLowerCase();
      lista = lista.filter((t) =>
        (t.nm_fornecedor || '').toLowerCase().includes(q),
      );
    }
    if (filtroBancoFiltro) {
      lista = lista.filter((t) => t.banco_pagamento === filtroBancoFiltro);
    }
    if (filtroValorMin !== '') {
      lista = lista.filter(
        (t) => parseFloat(t.vl_duplicata || 0) >= parseFloat(filtroValorMin),
      );
    }
    if (filtroValorMax !== '') {
      lista = lista.filter(
        (t) => parseFloat(t.vl_duplicata || 0) <= parseFloat(filtroValorMax),
      );
    }
    return lista;
  }, [
    titulos,
    filtroStatus,
    filtroFornecedor,
    filtroBancoFiltro,
    filtroValorMin,
    filtroValorMax,
  ]);

  const { totalSaldo, bancosSaldoCount } = useMemo(
    () => ({
      totalSaldo: saldos.reduce((s, r) => s + parseFloat(r.valor || 0), 0),
      bancosSaldoCount: saldos.filter((r) => parseFloat(r.valor || 0) > 0)
        .length,
    }),
    [saldos],
  );

  const temFiltroExtra =
    filtroFornecedor || filtroBancoFiltro || filtroValorMin || filtroValorMax;

  const resumo = useMemo(() => {
    const agg = {
      PENDENTE: 0,
      APROVADO: 0,
      PAGO: 0,
      CANCELADO: 0,
      total: 0,
      valor: 0,
    };
    titulos.forEach((t) => {
      agg[t.status] = (agg[t.status] || 0) + 1;
      agg.total++;
      if (t.status !== 'CANCELADO')
        agg.valor += parseFloat(t.vl_duplicata || 0);
    });
    return agg;
  }, [titulos]);

  const valorSelecionado = useMemo(() => {
    let v = 0;
    selecionados.forEach((id) => {
      const t = titulos.find((x) => x.id === id);
      if (t) v += parseFloat(t.vl_duplicata || 0);
    });
    return v;
  }, [selecionados, titulos]);

  const toggleSelect = useCallback((id) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const selecionarTodosVisiveis = () => {
    const selecionaveis = titulosFiltrados.filter(
      (t) => t.status === 'PENDENTE' || t.status === 'APROVADO',
    );
    if (selecionados.size === selecionaveis.length && selecionaveis.length > 0)
      setSelecionados(new Set());
    else setSelecionados(new Set(selecionaveis.map((t) => t.id)));
  };

  const salvarTitulo = useCallback(async (id, patch) => {
    const { error } = await supabase
      .from('pagamentos_liberacao')
      .update(patch)
      .eq('id', id);
    if (error) alert('Erro ao salvar: ' + error.message);
    else {
      setTitulos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    }
  }, []);

  const excluirTitulo = useCallback(async (id) => {
    if (!window.confirm('Confirmar exclusão deste título?')) return;
    const { error } = await supabase
      .from('pagamentos_liberacao')
      .delete()
      .eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else {
      setTitulos((prev) => prev.filter((t) => t.id !== id));
      setSelecionados((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const aprovarTitulo = useCallback(
    async (id, extraData = {}) => {
      if (!window.confirm('Confirmar aprovação deste título?')) return;
      setProcessandoId(id);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('pagamentos_liberacao')
        .update({
          status: 'APROVADO',
          aprovado_por: user?.email || null,
          aprovado_em: now,
          ...extraData,
        })
        .eq('id', id);
      setProcessandoId(null);
      if (error) alert('Erro ao aprovar: ' + error.message);
      else
        setTitulos((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'APROVADO',
                  aprovado_por: user?.email,
                  aprovado_em: now,
                  ...extraData,
                }
              : t,
          ),
        );
    },
    [user],
  );

  const aprovarSelecionados = useCallback(async () => {
    if (selecionados.size === 0) {
      alert('Selecione pelo menos um título.');
      return;
    }
    if (
      !window.confirm(`Confirmar aprovação de ${selecionados.size} título(s)?`)
    )
      return;
    setProcessando(true);
    const ids = Array.from(selecionados);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('pagamentos_liberacao')
      .update({
        status: 'APROVADO',
        aprovado_por: user?.email || null,
        aprovado_em: now,
      })
      .in('id', ids);
    setProcessando(false);
    if (error) {
      alert('Erro ao aprovar: ' + error.message);
      return;
    }
    setSelecionados(new Set());
    setTitulos((prev) =>
      prev.map((t) =>
        ids.includes(t.id)
          ? {
              ...t,
              status: 'APROVADO',
              aprovado_por: user?.email,
              aprovado_em: now,
            }
          : t,
      ),
    );
  }, [selecionados, user]);

  const pagarSelecionados = useCallback(async () => {
    const ids = Array.from(selecionados).filter((id) => {
      const t = titulos.find((x) => x.id === id);
      return t?.status === 'APROVADO';
    });
    if (ids.length === 0) {
      alert('Nenhum título APROVADO selecionado.');
      return;
    }
    const valorTotal = ids.reduce((acc, id) => {
      const t = titulos.find((x) => x.id === id);
      return acc + parseFloat(t?.vl_duplicata || 0);
    }, 0);
    if (
      !window.confirm(
        `Confirmar pagamento de ${ids.length} título(s) — Total: ${fmtBRL(valorTotal)}?`,
      )
    )
      return;
    setProcessando(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('pagamentos_liberacao')
      .update({ status: 'PAGO', pago_por: user?.email || null, pago_em: now })
      .in('id', ids);
    setProcessando(false);
    if (error) {
      alert('Erro ao marcar como pago: ' + error.message);
      return;
    }
    setSelecionados(new Set());
    setTitulos((prev) =>
      prev.map((t) =>
        ids.includes(t.id)
          ? { ...t, status: 'PAGO', pago_por: user?.email, pago_em: now }
          : t,
      ),
    );
  }, [selecionados, titulos, user]);

  const marcarPagoTitulo = useCallback(
    async (id, extraData = {}) => {
      if (!window.confirm('Confirmar pagamento deste título?')) return;
      setProcessandoId(id);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('pagamentos_liberacao')
        .update({
          status: 'PAGO',
          pago_por: user?.email || null,
          pago_em: now,
          ...extraData,
        })
        .eq('id', id);
      setProcessandoId(null);
      if (error) alert('Erro ao marcar como pago: ' + error.message);
      else
        setTitulos((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'PAGO',
                  pago_por: user?.email,
                  pago_em: now,
                  ...extraData,
                }
              : t,
          ),
        );
    },
    [user],
  );

  const exportarExcel = useCallback(() => {
    const rows = titulosFiltrados.map((t) => ({
      Status: t.status,
      Empresa: t.nm_empresa || '',
      Fornecedor: t.nm_fornecedor || '',
      'Cód. Fornecedor': t.cd_fornecedor || '',
      Duplicata: t.nr_duplicata || '',
      Parcela: t.nr_parcela || '',
      Vencimento: fmtDate(t.dt_vencimento),
      Valor: parseFloat(t.vl_duplicata || 0),
      Despesa: t.ds_despesaitem || '',
      'C. Custo': t.cd_ccusto || '',
      Banco: t.banco_pagamento || '',
      'Forma Pgto': t.forma_pagamento || '',
      'Detalhe Pgto': t.chave_pix || t.codigo_barras || t.link_pagamento || '',
      Observação: t.observacao || '',
      'Enviado por': t.enviado_por || '',
      'Enviado em': t.enviado_em ? fmtDateTime(t.enviado_em) : '',
      'Aprovado por': t.aprovado_por || '',
      'Aprovado em': t.aprovado_em ? fmtDateTime(t.aprovado_em) : '',
      'Pago por': t.pago_por || '',
      'Pago em': t.pago_em ? fmtDateTime(t.pago_em) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    XLSX.writeFile(
      wb,
      `liberacao-pagamento-${filtroStatus.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }, [titulosFiltrados, filtroStatus]);

  const CardStat = ({ label, value, cor, Icon, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] bg-white rounded-xl shadow border ${cor} p-3 text-left hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} weight="bold" />
        <span className="text-[10px] font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </button>
  );

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <PageTitle
        title="Liberação de Pagamento"
        subtitle="Aprove e registre os pagamentos dos títulos enviados de Contas a Pagar"
        icon={CurrencyDollar}
        iconColor="text-[#000638]"
      />

      {/* Cards de resumo */}
      <div className="flex flex-wrap gap-3 mb-4">
        <CardStat
          label="Pendentes"
          value={resumo.PENDENTE}
          cor="border-yellow-200 text-yellow-700"
          Icon={Clock}
          onClick={() => setFiltroStatus('PENDENTE')}
        />
        <CardStat
          label="Aprovados"
          value={resumo.APROVADO}
          cor="border-blue-200 text-blue-700"
          Icon={CheckCircle}
          onClick={() => setFiltroStatus('APROVADO')}
        />
        <CardStat
          label="Pagos"
          value={resumo.PAGO}
          cor="border-green-200 text-green-700"
          Icon={CheckCircle}
          onClick={() => setFiltroStatus('PAGO')}
        />
        <CardStat
          label="Cancelados"
          value={resumo.CANCELADO}
          cor="border-red-200 text-red-700"
          Icon={XCircle}
          onClick={() => setFiltroStatus('CANCELADO')}
        />
        <div className="flex-1 min-w-[180px] bg-[#000638] text-white rounded-xl shadow p-3">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={16} weight="bold" />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Valor Total (ativos)
            </span>
          </div>
          <div className="text-lg font-bold">{fmtBRL(resumo.valor)}</div>
        </div>
      </div>

      {/* Card Saldo Bancário + Cards de seleção */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Saldo Bancário */}
        <button
          onClick={() => setShowModalSaldo(true)}
          className="flex-1 min-w-[260px] bg-white rounded-xl shadow border border-teal-200 p-4 text-left hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-teal-50 rounded-lg group-hover:bg-teal-100 transition-colors">
              <Wallet size={20} weight="bold" className="text-teal-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-0.5">
                Saldo Bancário
                <span className="ml-2 text-gray-400 font-normal normal-case">
                  · {bancosSaldoCount} banco(s)
                </span>
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {fmtBRL(totalSaldo)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANCOS_SALDO.map((b) => {
              const s = saldos.find((r) => r.banco === b);
              const v = parseFloat(s?.valor || 0);
              return (
                <span
                  key={b}
                  className={`inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full border font-semibold ${
                    v > 0
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  <Bank size={8} />
                  {b}: {fmtBRL(v)}
                </span>
              );
            })}
          </div>
        </button>

        {/* Títulos selecionados */}
        <div className="flex-1 min-w-[200px] bg-white rounded-xl shadow border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Receipt size={18} weight="bold" className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-0.5">
                Títulos Selecionados
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {fmtBRL(valorSelecionado)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">
            {selecionados.size} título(s) marcado(s)
          </p>
        </div>

        {/* Saldo após pagamento */}
        <div
          className={`flex-1 min-w-[200px] rounded-xl shadow border p-4 ${
            totalSaldo - valorSelecionado >= 0
              ? 'bg-white border-green-200'
              : 'bg-red-50 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`p-2 rounded-lg ${
                totalSaldo - valorSelecionado >= 0
                  ? 'bg-green-50'
                  : 'bg-red-100'
              }`}
            >
              <CurrencyDollar
                size={18}
                weight="bold"
                className={
                  totalSaldo - valorSelecionado >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              />
            </div>
            <div>
              <p
                className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${
                  totalSaldo - valorSelecionado >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                Saldo após pagamento
              </p>
              <p
                className={`text-2xl font-bold ${
                  totalSaldo - valorSelecionado >= 0
                    ? 'text-gray-800'
                    : 'text-red-700'
                }`}
              >
                {fmtBRL(totalSaldo - valorSelecionado)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 font-medium">
            Saldo Bancário − Selecionados
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Funnel size={14} className="text-[#000638]" />
          <span className="text-xs font-semibold text-gray-600 mr-1">
            Status:
          </span>
          {['TODOS', 'PENDENTE', 'APROVADO', 'PAGO', 'CANCELADO'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                filtroStatus === s
                  ? 'bg-[#000638] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={exportarExcel}
          disabled={titulosFiltrados.length === 0}
          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
        >
          <FileXls size={14} weight="bold" />
          Exportar Excel
        </button>

        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selecionarTodosVisiveis}
              className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded font-semibold"
            >
              {selecionados.size > 0 ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
            {selecionados.size > 0 && (
              <>
                <span className="text-xs text-gray-500">
                  {selecionados.size} selecionado(s)
                </span>
                {Array.from(selecionados).some(
                  (id) =>
                    titulos.find((t) => t.id === id)?.status === 'PENDENTE',
                ) && (
                  <button
                    onClick={aprovarSelecionados}
                    disabled={processando}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                  >
                    {processando ? (
                      <Spinner size={12} className="animate-spin" />
                    ) : (
                      <Stamp size={12} weight="bold" />
                    )}
                    APROVAR SELECIONADOS
                  </button>
                )}
                {Array.from(selecionados).some(
                  (id) =>
                    titulos.find((t) => t.id === id)?.status === 'APROVADO',
                ) && (
                  <button
                    onClick={pagarSelecionados}
                    disabled={processando}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                  >
                    {processando ? (
                      <Spinner size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle size={12} weight="bold" />
                    )}
                    PAGAR SELECIONADOS
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filtros extras */}
      <div className="bg-white rounded-xl shadow border border-gray-200 px-3 py-2.5 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
          <MagnifyingGlass size={13} />
          Filtrar:
        </div>
        <input
          type="text"
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
          placeholder="Fornecedor..."
          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#000638] w-44"
        />
        <select
          value={filtroBancoFiltro}
          onChange={(e) => setFiltroBancoFiltro(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#000638] bg-white"
        >
          <option value="">Todos os bancos</option>
          {BANCOS_SALDO.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">R$ mín</span>
          <input
            type="number"
            value={filtroValorMin}
            onChange={(e) => setFiltroValorMin(e.target.value)}
            placeholder="0"
            min="0"
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#000638] w-24"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">máx</span>
          <input
            type="number"
            value={filtroValorMax}
            onChange={(e) => setFiltroValorMax(e.target.value)}
            placeholder="∞"
            min="0"
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#000638] w-24"
          />
        </div>
        {temFiltroExtra && (
          <button
            onClick={() => {
              setFiltroFornecedor('');
              setFiltroBancoFiltro('');
              setFiltroValorMin('');
              setFiltroValorMax('');
            }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold ml-1"
          >
            <X size={12} weight="bold" /> Limpar
          </button>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {titulosFiltrados.length} registro(s)
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Spinner size={20} className="animate-spin mr-2" />
            Carregando...
          </div>
        ) : erro ? (
          <div className="p-5 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center gap-2">
            <Warning size={16} />
            {erro}
          </div>
        ) : titulosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Nenhum título encontrado com este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#000638] text-white">
                <tr>
                  <th className="px-2 py-2 text-center text-[10px] font-bold uppercase w-10">
                    Sel.
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Vencimento / Histórico
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Valor
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Fornecedor
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Despesa
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Duplicata
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase w-40">
                    Banco / Forma Pgto
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Detalhe Pgto
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-bold uppercase">
                    Observação
                  </th>
                  <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {titulosFiltrados.map((item) => (
                  <LinhaTitulo
                    key={item.id}
                    item={item}
                    isAdmin={isAdmin}
                    selecionado={selecionados.has(item.id)}
                    onToggleSelect={toggleSelect}
                    onSalvar={salvarTitulo}
                    onExcluir={excluirTitulo}
                    onAprovar={aprovarTitulo}
                    onMarcarPago={marcarPagoTitulo}
                    onAbrirModal={setModalItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalItem && (
        <ModalInfoPagamento
          item={modalItem}
          onClose={() => setModalItem(null)}
        />
      )}

      {showModalSaldo && (
        <ModalSaldoBancario
          onClose={() => setShowModalSaldo(false)}
          onSaved={(rows) => setSaldos(rows)}
          userEmail={user?.email}
        />
      )}

      <p className="mt-3 text-[10px] text-gray-400 flex items-center gap-1">
        <CheckCircle size={11} />
        As alterações de banco / forma de pagamento / observações são salvas
        individualmente ao clicar no ícone de disquete.
        {isAdmin
          ? ' Admin/Owner pode Aprovar (PENDENTE→APROVADO) e Pagar (APROVADO→PAGO) por linha.'
          : ' Somente Admin/Owner pode aprovar e marcar como pago.'}
      </p>
    </div>
  );
};

export default LiberacaoPagamento;
