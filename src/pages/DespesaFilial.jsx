import React, { useEffect, useState, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import {
  Buildings,
  IdentificationCard,
  Storefront,
  X,
  Lightning,
  Drop,
  WifiHigh,
  Phone,
  House,
  Waves,
  Buildings as BuildingsIcon,
  Spinner,
  Plus,
  Pencil,
  Trash,
  CaretDown,
  CaretRight,
  CheckCircle,
  Warning,
  FloppyDisk,
  MagnifyingGlass,
  Paperclip,
  FileArrowUp,
  Eye,
  CalendarBlank,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import { getSupabaseAuth } from '../lib/supabase';

// Mensagem amigável para o erro clássico de RLS
const msgErroSupabase = (err) => {
  const m = err?.message || 'Erro inesperado.';
  if (err?.code === '42501' || /row-level security|violates row/i.test(m)) {
    return 'Sem permissão para alterar esta despesa. Apenas Financeiro, Admin e Owner podem editar — se o seu perfil é um desses, saia e entre de novo para atualizar a sessão.';
  }
  return m;
};

// Bucket dos contratos de aluguel (ver database/schema-despesas-fixas-filial-contrato.sql)
const STORAGE_BUCKET = 'contratos-aluguel';
// Janela de alerta: 1 mês antes do vencimento do contrato
const DIAS_ALERTA_CONTRATO = 30;
const MAX_CONTRATO_MB = 10;

// Filiais CROSBY que devem aparecer na página (ordenadas por código)
const FILIAIS_CROSBY = [
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
  { cd: 'CASA_ECOVILLE', nome: 'CASA ECOVILLE', semTotvs: true },
  { cd: 'CASA_CROSBY', nome: 'CASA CROSBY', semTotvs: true },
  { cd: 'TERRENO_PAINEL', nome: 'TERRENO PAINEL SOLAR', semTotvs: true },
];

const fmtCNPJ = (cnpj) => {
  if (!cnpj) return '—';
  const digits = String(cnpj).replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5',
  );
};

// Normaliza texto para busca (sem acento, minúsculo)
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ─── Contrato de aluguel: datas e status de vencimento ───────────
// DATE do Postgres vem como 'YYYY-MM-DD'; parse manual evita o shift de
// fuso que new Date('2026-01-05') causaria (UTC → dia anterior no Brasil).
const parseDataLocal = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const fmtData = (s) => {
  const d = parseDataLocal(s);
  return d ? d.toLocaleDateString('pt-BR') : '—';
};

// Retorna null quando não há contrato, não há data ou o vencimento ainda
// está longe. Caso contrário: { tipo: 'alerta' | 'vencido', dias }
const statusContrato = (s) => {
  const data = parseDataLocal(s);
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias < 0) return { tipo: 'vencido', dias };
  if (dias <= DIAS_ALERTA_CONTRATO) return { tipo: 'alerta', dias };
  return null;
};

const textoAlerta = (st) =>
  !st
    ? ''
    : st.tipo === 'vencido'
      ? `Contrato de aluguel vencido há ${Math.abs(st.dias)} dia(s)`
      : st.dias === 0
        ? 'Contrato de aluguel vence hoje'
        : `Contrato de aluguel vence em ${st.dias} dia(s)`;

// Mantém o status mais crítico (menos dias) entre dois
const maisCritico = (a, b) => (!a ? b : !b ? a : a.dias <= b.dias ? a : b);

// Pontinho vermelho piscando
const AlertaContratoDot = ({ status, className = '' }) => {
  if (!status) return null;
  return (
    <span
      className={`relative flex h-2.5 w-2.5 flex-shrink-0 ${className}`}
      title={textoAlerta(status)}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
    </span>
  );
};

// Skeleton de carregamento
const CardSkeleton = () => (
  <div className="bg-white rounded-xl shadow border border-gray-200 p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  </div>
);

// ─── Configuração das despesas fixas ─────────────────────────────
const DESPESAS_FIXAS = [
  {
    key: 'energia',
    label: 'Energia',
    icon: Lightning,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    match: (ds) => /energia\s*el[eé]trica/i.test(ds),
  },
  {
    key: 'agua',
    label: 'Água',
    icon: Drop,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    match: (ds) => /[áa]gua/i.test(ds),
  },
  {
    key: 'internet',
    label: 'Internet',
    icon: WifiHigh,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    match: (ds) => /internet/i.test(ds),
  },
  {
    key: 'telefone',
    label: 'Telefone',
    icon: Phone,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    match: (ds) => /telefone/i.test(ds),
  },
  {
    key: 'aluguel',
    label: 'Aluguel',
    icon: House,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    match: (ds) => /aluguel|alugu[eé]is/i.test(ds),
  },
  {
    key: 'agua_mineral',
    label: 'Água Mineral',
    icon: Waves,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    match: (ds) => /[áa]gua\s*mineral/i.test(ds),
  },
  {
    key: 'condominio',
    label: 'Condomínio',
    icon: BuildingsIcon,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    match: (ds) => /condom[ií]nio/i.test(ds),
  },
];

// ─── Formulário inline para adicionar / editar fornecedor ────────
const FORMAS_PGTO = [
  'PIX',
  'BOLETO',
  'DÉBITO AUTOMÁTICO',
  'TRANSFERÊNCIA',
  'CARTÃO DE CRÉDITO',
  'DINHEIRO',
  'OUTRO',
];

const FORM_EMPTY = {
  cd_fornecedor: '',
  nm_fornecedor: '',
  tipo_despesa: '',
  vencimento: '',
  forma_pagamento: '',
  observacao: '',
  contrato_vencimento: '',
};

// Monta o estado inicial do formulário a partir da linha do banco.
// As colunas são nullable: jogar null direto no input faz o React trocar o
// campo para não-controlado (ele aparece VAZIO mesmo com dado salvo) e depois
// quebra no .trim() do salvar. Por isso todo campo de texto vira ''.
const seedForm = (initial, tipoDespesa, cdFilial) => {
  if (!initial)
    return { ...FORM_EMPTY, tipo_despesa: tipoDespesa, cd_filial: cdFilial };
  const txt = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    ...FORM_EMPTY,
    ...initial,
    cd_fornecedor: txt(initial.cd_fornecedor),
    nm_fornecedor: txt(initial.nm_fornecedor),
    vencimento: txt(initial.vencimento),
    forma_pagamento: txt(initial.forma_pagamento),
    observacao: txt(initial.observacao),
    contrato_vencimento: txt(initial.contrato_vencimento).slice(0, 10),
  };
};

const FornecedorForm = ({
  cdFilial,
  tipoDespesa,
  initial,
  onSaved,
  onCancel,
}) => {
  const [form, setForm] = useState(() =>
    seedForm(initial, tipoDespesa, cdFilial),
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState(null);
  const [arquivo, setArquivo] = useState(null); // novo contrato selecionado
  const [removerContrato, setRemoverContrato] = useState(false);

  const isAluguel = tipoDespesa === 'ALUGUEL';
  // Contrato que já está salvo e não foi marcado para remoção
  const contratoAtual =
    !removerContrato && initial?.contrato_path ? initial : null;

  const set = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const selecionarArquivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (!file) return;
    const tipoOk =
      file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!tipoOk) {
      setErro('O contrato deve ser um PDF ou uma imagem.');
      return;
    }
    if (file.size > MAX_CONTRATO_MB * 1024 * 1024) {
      setErro(`Arquivo maior que ${MAX_CONTRATO_MB} MB.`);
      return;
    }
    setErro(null);
    setRemoverContrato(false);
    setArquivo(file);
  };

  // Sobe o novo arquivo (se houver) e devolve os campos de contrato do payload.
  // O arquivo antigo só é apagado depois que o novo subiu com sucesso.
  const resolverContrato = async (db) => {
    if (!isAluguel) return {};
    const campos = { contrato_vencimento: form.contrato_vencimento || null };

    if (arquivo) {
      const uid = crypto.randomUUID?.() || String(Date.now());
      const safeName = arquivo.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${cdFilial}/${uid}_${safeName}`;
      const { error: upErr } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(path, arquivo, { upsert: false, contentType: arquivo.type });
      if (upErr)
        throw new Error(`Falha ao enviar o contrato: ${upErr.message}`);
      if (initial?.contrato_path) {
        await db.storage
          .from(STORAGE_BUCKET)
          .remove([initial.contrato_path])
          .catch(() => {});
      }
      return {
        ...campos,
        contrato_path: path,
        contrato_nome: arquivo.name,
        contrato_tipo: arquivo.type,
      };
    }

    if (removerContrato && initial?.contrato_path) {
      await db.storage
        .from(STORAGE_BUCKET)
        .remove([initial.contrato_path])
        .catch(() => {});
      return {
        ...campos,
        contrato_path: null,
        contrato_nome: null,
        contrato_tipo: null,
      };
    }

    return campos;
  };

  const salvar = async () => {
    const txt = (v) => String(v ?? '').trim();
    if (!txt(form.nm_fornecedor)) {
      setErro('Nome do fornecedor é obrigatório.');
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      const db = getSupabaseAuth();
      const payload = {
        cd_filial: cdFilial,
        cd_fornecedor: txt(form.cd_fornecedor) || null,
        nm_fornecedor: txt(form.nm_fornecedor),
        tipo_despesa: tipoDespesa,
        vencimento: txt(form.vencimento) || null,
        forma_pagamento: form.forma_pagamento || null,
        observacao: txt(form.observacao) || null,
        ...(await resolverContrato(db)),
      };
      // Vencimento novo → o job volta a alertar (dedupe em
      // jobs/contrato-aluguel-vencimento.job.js)
      if (
        isAluguel &&
        initial &&
        payload.contrato_vencimento !==
          (initial.contrato_vencimento
            ? String(initial.contrato_vencimento).slice(0, 10)
            : null)
      ) {
        payload.contrato_alerta_vencimento = null;
      }
      if (initial?.id) {
        // .select() é proposital: um UPDATE barrado por RLS não retorna erro,
        // só afeta 0 linhas — sem isso a edição "some" em silêncio.
        const { data, error } = await db
          .from('despesas_fixas_filial')
          .update(payload)
          .eq('id', initial.id)
          .select('id');
        if (error) throw error;
        if (!data?.length) {
          throw Object.assign(new Error('nenhuma linha atualizada'), {
            code: '42501',
          });
        }
      } else {
        const { error } = await db
          .from('despesas_fixas_filial')
          .insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setErro(msgErroSupabase(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-lg p-3 mt-2 space-y-2 border ${
        initial
          ? 'bg-blue-50/60 border-[#000638]/30'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#000638]">
        {initial ? (
          <>
            <Pencil size={12} weight="bold" />
            Editando: {initial.nm_fornecedor}
          </>
        ) : (
          <>
            <Plus size={12} weight="bold" />
            Novo fornecedor
          </>
        )}
      </div>
      {erro && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <Warning size={13} />
          {erro}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Código Fornecedor
          </label>
          <input
            value={form.cd_fornecedor}
            onChange={set('cd_fornecedor')}
            placeholder="Ex: 001"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Nome Fornecedor *
          </label>
          <input
            value={form.nm_fornecedor}
            onChange={set('nm_fornecedor')}
            placeholder="Nome do fornecedor"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Vencimento (dia)
          </label>
          <input
            value={form.vencimento}
            onChange={set('vencimento')}
            placeholder="Ex: 10"
            maxLength={2}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Forma de Pagamento
          </label>
          <select
            value={form.forma_pagamento}
            onChange={set('forma_pagamento')}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638] bg-white"
          >
            <option value="">Selecione...</option>
            {FORMAS_PGTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isAluguel && (
        <div className="border-t border-gray-200 pt-2 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wide">
            <House size={12} weight="bold" />
            Contrato de aluguel
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
              Data de vencimento do aluguel
            </label>
            <input
              type="date"
              value={form.contrato_vencimento}
              onChange={set('contrato_vencimento')}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638]"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Um mês antes do vencimento o sistema avisa Financeiro, Admin e
              Owner.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
              Arquivo do contrato (PDF ou imagem, até {MAX_CONTRATO_MB} MB)
            </label>

            {arquivo ? (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
                <Paperclip size={13} className="text-[#000638] flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate flex-1">
                  {arquivo.name}
                </span>
                <button
                  type="button"
                  onClick={() => setArquivo(null)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                  title="Descartar arquivo selecionado"
                >
                  <X size={13} weight="bold" />
                </button>
              </div>
            ) : contratoAtual ? (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
                <Paperclip size={13} className="text-[#000638] flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate flex-1">
                  {contratoAtual.contrato_nome || 'Contrato anexado'}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoverContrato(true)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                  title="Remover contrato"
                >
                  <Trash size={13} weight="bold" />
                </button>
              </div>
            ) : null}

            <label className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#000638] hover:underline cursor-pointer">
              <FileArrowUp size={13} weight="bold" />
              {arquivo || contratoAtual ? 'Trocar arquivo' : 'Anexar contrato'}
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={selecionarArquivo}
                className="hidden"
              />
            </label>
            {removerContrato && !arquivo && initial?.contrato_path && (
              <p className="text-[10px] text-red-500 mt-0.5">
                O contrato será removido ao salvar.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
          Observação
        </label>
        <textarea
          value={form.observacao}
          onChange={set('observacao')}
          rows={2}
          placeholder="Observações adicionais..."
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#000638] resize-none"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={saving}
          className="flex items-center gap-1 bg-[#000638] hover:bg-[#001060] disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
        >
          {saving ? (
            <Spinner size={12} className="animate-spin" />
          ) : (
            <FloppyDisk size={12} weight="bold" />
          )}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

// ─── Linha de fornecedor cadastrado ──────────────────────────────
const FornecedorRow = ({ item, onEdit, onDelete }) => {
  const [abrindo, setAbrindo] = useState(false);
  const status = statusContrato(item.contrato_vencimento);

  // Bucket privado → URL assinada de curta duração
  const abrirContrato = async () => {
    if (!item.contrato_path) return;
    setAbrindo(true);
    try {
      const { data, error } = await getSupabaseAuth()
        .storage.from(STORAGE_BUCKET)
        .createSignedUrl(item.contrato_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(`Não foi possível abrir o contrato: ${err.message}`);
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs group">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
        <div>
          <span className="text-gray-400 text-[10px]">Código: </span>
          <span className="font-medium text-gray-700">
            {item.cd_fornecedor || '—'}
          </span>
        </div>
        <div className="sm:col-span-2">
          <span className="text-gray-400 text-[10px]">Fornecedor: </span>
          <span className="font-semibold text-gray-800">
            {item.nm_fornecedor}
          </span>
        </div>
        <div>
          <span className="text-gray-400 text-[10px]">Vencimento: </span>
          <span className="text-gray-700">dia {item.vencimento || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 text-[10px]">Pagamento: </span>
          <span className="text-gray-700">{item.forma_pagamento || '—'}</span>
        </div>
        {item.contrato_vencimento && (
          <div className="sm:col-span-2 flex items-center gap-1.5">
            <CalendarBlank size={12} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-400 text-[10px]">Contrato vence: </span>
            <span
              className={`font-semibold ${
                status ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {fmtData(item.contrato_vencimento)}
            </span>
            <AlertaContratoDot status={status} />
            {status && (
              <span className="text-[10px] text-red-600 font-medium">
                {status.tipo === 'vencido'
                  ? `vencido há ${Math.abs(status.dias)}d`
                  : `faltam ${status.dias}d`}
              </span>
            )}
          </div>
        )}
        {item.contrato_path && (
          <div>
            <button
              onClick={abrirContrato}
              disabled={abrindo}
              className="inline-flex items-center gap-1 text-[#000638] hover:underline disabled:opacity-50 font-semibold"
              title={item.contrato_nome || 'Ver contrato'}
            >
              {abrindo ? (
                <Spinner size={12} className="animate-spin" />
              ) : (
                <Eye size={12} weight="bold" />
              )}
              Ver contrato
            </button>
          </div>
        )}
        {item.observacao && (
          <div className="sm:col-span-3">
            <span className="text-gray-400 text-[10px]">Obs: </span>
            <span className="text-gray-600 italic">{item.observacao}</span>
          </div>
        )}
      </div>
      {/* Sempre visível: escondido no hover ninguém acha o botão de editar
          (e em touch não existe hover), então acabava-se cadastrando de novo */}
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(item)}
          className="flex items-center gap-1 text-[#000638] hover:bg-[#000638]/10 border border-[#000638]/20 px-2 py-1 rounded font-semibold transition-colors"
          title="Editar este fornecedor"
        >
          <Pencil size={13} weight="bold" />
          Editar
        </button>
        <button
          onClick={() => onDelete(item)}
          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
          title="Excluir"
        >
          <Trash size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
};

// ─── Nó da árvore (categoria de despesa) ─────────────────────────
const CategoriaNode = ({ cat, cdFilial, fornecedores, onRefresh }) => {
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState(null); // item sendo editado
  const [excluindo, setExcluindo] = useState(null);

  const Icon = cat.icon;
  const itens = fornecedores.filter(
    (f) => f.tipo_despesa === cat.key.toUpperCase(),
  );

  // Status de contrato mais próximo do vencimento dentro da categoria
  const alerta = itens.reduce(
    (acc, it) => maisCritico(acc, statusContrato(it.contrato_vencimento)),
    null,
  );

  const handleDelete = async (item) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    setExcluindo(item.id);
    const db = getSupabaseAuth();
    // .select() pelo mesmo motivo do update: RLS barra sem devolver erro
    const { data, error } = await db
      .from('despesas_fixas_filial')
      .delete()
      .eq('id', item.id)
      .select('id');
    if (error || !data?.length) {
      window.alert(
        `Não foi possível excluir: ${msgErroSupabase(error || { code: '42501' })}`,
      );
    } else if (item.contrato_path) {
      await db.storage
        .from(STORAGE_BUCKET)
        .remove([item.contrato_path])
        .catch(() => {});
    }
    setExcluindo(null);
    onRefresh();
  };

  return (
    <div className={`rounded-xl border ${cat.border} overflow-hidden`}>
      {/* Header clicável */}
      <button
        onClick={() => {
          setAberto((v) => !v);
          setAdicionando(false);
          setEditando(null);
        }}
        className={`w-full flex items-center gap-2 px-4 py-2.5 ${cat.bg} hover:brightness-95 transition-all`}
      >
        {aberto ? (
          <CaretDown size={14} weight="bold" className={cat.color} />
        ) : (
          <CaretRight size={14} weight="bold" className={cat.color} />
        )}
        <Icon size={16} weight="bold" className={cat.color} />
        <span
          className={`text-xs font-bold ${cat.color} uppercase tracking-wide flex-1 text-left`}
        >
          {cat.label}
        </span>
        <AlertaContratoDot status={alerta} className="mr-1" />
        <span className="text-[10px] text-gray-500 mr-1">
          {itens.length} fornecedor{itens.length !== 1 ? 'es' : ''}
        </span>
      </button>

      {/* Conteúdo expandido */}
      {aberto && (
        <div className="p-3 space-y-2 bg-white">
          {itens.length === 0 && !adicionando && (
            <p className="text-xs text-gray-400 italic py-1">
              Nenhum fornecedor cadastrado.
            </p>
          )}

          {itens.map((item) =>
            editando?.id === item.id ? (
              <FornecedorForm
                key={item.id}
                cdFilial={cdFilial}
                tipoDespesa={cat.key.toUpperCase()}
                initial={editando}
                onSaved={() => {
                  setEditando(null);
                  onRefresh();
                }}
                onCancel={() => setEditando(null)}
              />
            ) : (
              <FornecedorRow
                key={item.id}
                item={item}
                onEdit={setEditando}
                onDelete={
                  excluindo === item.id ? () => {} : () => handleDelete(item)
                }
              />
            ),
          )}

          {adicionando && (
            <FornecedorForm
              cdFilial={cdFilial}
              tipoDespesa={cat.key.toUpperCase()}
              initial={null}
              onSaved={() => {
                setAdicionando(false);
                onRefresh();
              }}
              onCancel={() => setAdicionando(false)}
            />
          )}

          {!adicionando && !editando && (
            <button
              onClick={() => setAdicionando(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold ${cat.color} hover:underline mt-1`}
            >
              <Plus size={13} weight="bold" />
              Adicionar fornecedor
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Modal de Despesas Fixas ──────────────────────────────────────
const ModalDespesas = ({ filial, onClose, onDadosAlterados }) => {
  const [loadingForn, setLoadingForn] = useState(true);
  const [fornecedores, setFornecedores] = useState([]);
  const [erroForn, setErroForn] = useState(null);

  const carregarFornecedores = useCallback(async () => {
    setLoadingForn(true);
    const { data, error } = await getSupabaseAuth()
      .from('despesas_fixas_filial')
      .select('*')
      .eq('cd_filial', filial.cd)
      .order('tipo_despesa')
      .order('nm_fornecedor');
    if (error) setErroForn(error.message);
    else {
      setErroForn(null);
      setFornecedores(data || []);
    }
    setLoadingForn(false);
    onDadosAlterados?.();
  }, [filial.cd, onDadosAlterados]);

  useEffect(() => {
    carregarFornecedores();
  }, [carregarFornecedores]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-200 bg-[#000638] rounded-t-2xl">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Storefront size={20} weight="bold" className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-white/70 uppercase tracking-wide">
              FILIAL {filial.cd} — Despesas Fixas
            </div>
            <h2 className="text-sm font-bold text-white truncate">
              {filial.grupoEmpresa || filial.nome}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Infos da loja */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">
              Razão Social{' '}
            </span>
            <span className="text-gray-800 font-medium">
              {filial.razaoSocial || '—'}
            </span>
          </div>
          <div>
            <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">
              CNPJ{' '}
            </span>
            <span className="text-gray-800 font-mono">
              {fmtCNPJ(filial.cnpj)}
            </span>
          </div>
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-4">
          {erroForn && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              <Warning size={13} />
              Erro ao carregar fornecedores: {erroForn}
            </div>
          )}
          {loadingForn ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Spinner size={24} className="animate-spin mr-2" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {DESPESAS_FIXAS.map((cat) => (
                <CategoriaNode
                  key={cat.key}
                  cat={cat}
                  cdFilial={filial.cd}
                  fornecedores={fornecedores}
                  onRefresh={carregarFornecedores}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-400">
            <CheckCircle size={12} />
            Os dados são salvos automaticamente no banco de dados.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Card de filial (clicável) ────────────────────────────────────
const FilialCard = ({ filial, alerta, onClick }) => {
  const { cd, nome, cnpj, razaoSocial, fantasyName, grupoEmpresa, status } =
    filial;

  return (
    <button
      onClick={() => onClick(filial)}
      className={`relative bg-white rounded-xl shadow border transition-all text-left w-full group ${
        alerta
          ? 'border-red-300 hover:border-red-400 hover:shadow-md'
          : 'border-gray-200 hover:shadow-md hover:border-[#000638]/40'
      }`}
    >
      {/* Alerta de contrato de aluguel a vencer */}
      {alerta && (
        <AlertaContratoDot status={alerta} className="absolute top-2 right-2" />
      )}

      {/* Cabeçalho do card */}
      <div className="flex items-center gap-3 p-5 border-b border-gray-100">
        <div className="w-11 h-11 rounded-full bg-[#000638] flex items-center justify-center flex-shrink-0 group-hover:bg-[#001060] transition-colors">
          <Storefront size={22} weight="bold" className="text-white" />
        </div>
        <div className="min-w-0">
          <span className="inline-block text-[10px] font-bold text-[#000638] bg-blue-50 border border-[#000638]/20 px-2 py-0.5 rounded-full mb-1">
            {status === 'manual' ? 'IMÓVEL' : `FILIAL ${cd}`}
          </span>
          <h3 className="text-sm font-bold text-[#000638] truncate">
            {grupoEmpresa || nome}
          </h3>
        </div>
        {status === 'ok' && (
          <span className="ml-auto text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
            Ativo
          </span>
        )}
        {status === 'manual' && (
          <span className="ml-auto text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
            Manual
          </span>
        )}
      </div>

      {/* Dados */}
      <div className="p-5 space-y-3">
        {/* Razão Social */}
        <div className="flex items-start gap-2">
          <IdentificationCard
            size={16}
            className="text-[#000638]/60 mt-0.5 flex-shrink-0"
          />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
              Razão Social
            </p>
            <p className="text-xs font-medium text-gray-800 leading-snug">
              {razaoSocial || '—'}
            </p>
            {fantasyName && fantasyName !== razaoSocial && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                Nome fantasia: {fantasyName}
              </p>
            )}
          </div>
        </div>

        {/* CNPJ */}
        <div className="flex items-start gap-2">
          <Buildings
            size={16}
            className="text-[#000638]/60 mt-0.5 flex-shrink-0"
          />
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
              CNPJ
            </p>
            <p className="text-xs font-mono font-medium text-gray-800">
              {fmtCNPJ(cnpj)}
            </p>
          </div>
        </div>

        {/* Alerta de contrato / indicador de clique */}
        {alerta ? (
          <div className="pt-1 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-semibold text-red-600">
            <Warning size={11} weight="bold" />
            {textoAlerta(alerta)}
          </div>
        ) : (
          <div className="pt-1 border-t border-gray-100 flex items-center gap-1 text-[10px] text-gray-400 group-hover:text-[#000638] transition-colors">
            <Lightning size={11} />
            Clique para ver despesas fixas
          </div>
        )}
      </div>
    </button>
  );
};

const DespesaFilial = () => {
  const [filiais, setFiliais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [filialSelecionada, setFilialSelecionada] = useState(null);
  const [busca, setBusca] = useState('');
  // cd_filial → status do contrato mais próximo de vencer
  const [alertas, setAlertas] = useState({});

  // Contratos de aluguel de todas as filiais, para o pontinho nos cards
  const carregarAlertas = useCallback(async () => {
    const { data, error } = await getSupabaseAuth()
      .from('despesas_fixas_filial')
      .select('cd_filial, contrato_vencimento')
      .eq('tipo_despesa', 'ALUGUEL')
      .not('contrato_vencimento', 'is', null);
    if (error) {
      console.error('[despesa-filial] alertas de contrato:', error.message);
      return;
    }
    const mapa = {};
    (data || []).forEach((r) => {
      const st = statusContrato(r.contrato_vencimento);
      if (st) mapa[r.cd_filial] = maisCritico(mapa[r.cd_filial], st);
    });
    setAlertas(mapa);
  }, []);

  useEffect(() => {
    carregarAlertas();
  }, [carregarAlertas]);

  useEffect(() => {
    const buscar = async () => {
      setLoading(true);
      setErro(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
        const result = await response.json();

        let empresasArray = [];
        if (result.success && result.data) {
          if (result.data.data && Array.isArray(result.data.data)) {
            empresasArray = result.data.data;
          } else if (Array.isArray(result.data)) {
            empresasArray = result.data;
          }
        }

        // Montar as filiais cruzando com os dados da API
        const dados = FILIAIS_CROSBY.map((filial) => {
          if (filial.semTotvs) {
            return {
              cd: filial.cd,
              nome: filial.nome,
              cnpj: null,
              razaoSocial: null,
              fantasyName: null,
              grupoEmpresa: null,
              status: 'manual',
            };
          }
          const apiItem = empresasArray.find(
            (e) => String(e.cd_empresa) === String(filial.cd),
          );
          return {
            cd: filial.cd,
            nome: filial.nome,
            cnpj: apiItem?.cnpj ?? null,
            razaoSocial: apiItem?.personName ?? null,
            fantasyName: apiItem?.fantasyName ?? null,
            grupoEmpresa: apiItem?.nm_grupoempresa ?? null,
            status: apiItem ? 'ok' : 'sem-dados',
          };
        });

        setFiliais(dados);
      } catch (err) {
        setErro(err.message || 'Erro ao carregar dados das filiais.');
      } finally {
        setLoading(false);
      }
    };

    buscar();
  }, []);

  // Busca por código, nome, grupo, razão social, fantasia ou CNPJ
  const termo = norm(busca.trim());
  const digitos = busca.replace(/\D/g, '');
  const filiaisFiltradas = !termo
    ? filiais
    : filiais.filter((f) => {
        const campos = [
          f.cd,
          f.nome,
          f.grupoEmpresa,
          f.razaoSocial,
          f.fantasyName,
        ];
        if (campos.some((v) => norm(v).includes(termo))) return true;
        return (
          digitos.length > 0 &&
          String(f.cnpj || '')
            .replace(/\D/g, '')
            .includes(digitos)
        );
      });

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <PageTitle
        title="Controle de Filiais"
        subtitle="Visão consolidada das filiais CROSBY com dados cadastrais"
        icon={Buildings}
      />

      {erro && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Filtro de filial */}
      <div className="mb-4 flex items-center gap-2 max-w-xl mx-auto">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={15}
            weight="bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#000638]/50"
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar filial por código, nome, razão social ou CNPJ..."
            className="w-full border border-[#000638]/20 rounded-lg pl-9 pr-8 py-2 text-xs bg-white text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Limpar busca"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
        <span className="text-[11px] text-gray-500 whitespace-nowrap">
          {loading
            ? '—'
            : `${filiaisFiltradas.length} de ${filiais.length} filiais`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? FILIAIS_CROSBY.map((f) => <CardSkeleton key={f.cd} />)
          : filiaisFiltradas.map((f) => (
              <FilialCard
                key={f.cd}
                filial={f}
                alerta={alertas[f.cd]}
                onClick={setFilialSelecionada}
              />
            ))}
      </div>

      {!loading && filiaisFiltradas.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          Nenhuma filial encontrada para “{busca}”.
        </div>
      )}

      {filialSelecionada && (
        <ModalDespesas
          filial={filialSelecionada}
          onClose={() => setFilialSelecionada(null)}
          onDadosAlterados={carregarAlertas}
        />
      )}
    </div>
  );
};

export default DespesaFilial;
