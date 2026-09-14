// Inadimplência BlueCred — clientes do crediário BlueCard com FATURA vencida
// no TOTVS. Mesmo modelo da Inadimplência Multimarcas: filtros (incluindo o
// FiltroEmpresa padrão), cards de resumo, "Por Situação" (≤ 60 dias vencido /
// > 60 dias inadimplente), quadro "Por Filial", e a tabela de clientes que
// abre o MODAL de faturas com as ações Baixa (solicitacoes_baixa) e
// Protestar (esteira_protesto) — mesmas regras e tabelas da MTM.
//
// Fonte: GET /api/totvs/bluecred/inadimplencia — o backend resolve quem é
// cliente BlueCred (contratos + compradores do app), lê o contas a receber e
// devolve agrupado por cliente, com portador, nome da filial e cobrança.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import FiltroEmpresa from '../components/FiltroEmpresa';
import Notification from '../components/ui/Notification';
import { useAuth } from '../components/AuthContext';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { TotvsURL } from '../config/constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  ChartBar,
  CircleNotch,
  Users,
  CurrencyDollar,
  Clock,
  Warning,
  Receipt,
  FileXls,
  WhatsappLogo,
  Copy,
  ArrowClockwise,
  X,
  PaperPlaneRight,
  Gavel,
  CheckCircle,
  Storefront,
} from '@phosphor-icons/react';

const FAIXAS = [
  { value: 'todas', label: 'Todas as faixas' },
  { value: '1-30', label: '1 a 30 dias' },
  { value: '31-60', label: '31 a 60 dias' },
  { value: '61+', label: 'Acima de 60 dias' },
];

// Regras de protesto (iguais à MTM): só portador SICREDI (748) e vencido
// há mais de 29 dias.
const PORTADOR_PROTESTO = 748;
const DIAS_MIN_PROTESTO = 29;

// Mesmas opções da solicitação de baixa da MTM
const FORMAS_PAGAMENTO = [
  { id: 'confianca', label: 'Confiança', paidType: 4 },
  { id: 'sicredi', label: 'Sicredi', paidType: 4 },
  { id: 'adiantamento', label: 'Adiantamento (PIX TOTVS)', paidType: 3 },
  { id: 'cartao_credito', label: 'Cartão de Crédito', paidType: 1 },
  { id: 'cartao_debito', label: 'Cartão de Débito', paidType: 2 },
  { id: 'credev', label: 'CREDEV', paidType: 5 },
];

const formatarMoeda = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarData = (s) => {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : s;
};

const fmtCpf = (c) => {
  const d = String(c || '').replace(/\D/g, '');
  if (d.length !== 11) return c || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const fmtTel = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
};

const linkWhats = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`;
};

const naFaixa = (dias, faixa) => {
  if (faixa === '1-30') return dias >= 1 && dias <= 30;
  if (faixa === '31-60') return dias >= 31 && dias <= 60;
  if (faixa === '61+') return dias > 60;
  return true;
};

// "Tempo de inadimplência" no formato humano da MTM
const tempoInadimplencia = (dias) => {
  if (!dias || dias <= 0) return '0 dias';
  if (dias === 1) return '1 dia';
  if (dias < 30) return `${dias} dias`;
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return meses === 1 ? '1 mês' : `${meses} meses`;
  }
  const anos = Math.floor(dias / 365);
  return anos === 1 ? '1 ano' : `${anos} anos`;
};

const diasParaVencer = (venc, hoje) => {
  if (!venc || !hoje) return null;
  return Math.round(
    (Date.parse(`${venc}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000,
  );
};

const getTipoCobranca = (tipo) => {
  const mapa = {
    0: { label: 'SIMPLES', color: 'bg-gray-100 text-gray-800' },
    1: { label: 'DESCONTADA', color: 'bg-purple-100 text-purple-800' },
    2: { label: 'VINCULADA', color: 'bg-cyan-100 text-cyan-800' },
    3: { label: 'CAUCIONADA', color: 'bg-yellow-100 text-yellow-800' },
    4: { label: 'PROTESTO', color: 'bg-red-100 text-red-800' },
  };
  return (
    mapa[tipo] || {
      label: tipo != null ? `TIPO ${tipo}` : '--',
      color: 'bg-gray-100 text-gray-600',
    }
  );
};

// Chave única do título (normaliza número — o Supabase devolve NUMERIC como string)
const chaveTitulo = (cdEmpresa, nrFat, nrParcela) =>
  `${Number(cdEmpresa)}-${Number(nrFat)}-${Number(nrParcela || 1)}`;
const chaveFatura = (f) => chaveTitulo(f.cd_empresa, f.nr_fat || f.nr_fatura, f.nr_parcela);

export default function InadimplenciaBluecred() {
  const { user } = useAuth();

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [notification, setNotification] = useState(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [faixa, setFaixa] = useState('todas');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [ordenarPor, setOrdenarPor] = useState('valor_vencido');
  const [direcao, setDirecao] = useState('desc');

  // Modal do cliente (faturas)
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [copiado, setCopiado] = useState(null);

  // Solicitação de baixa
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [faturaBaixa, setFaturaBaixa] = useState(null);
  const [comprovanteBaixa, setComprovanteBaixa] = useState(null);
  const [previewComprovante, setPreviewComprovante] = useState(null);
  const [observacaoBaixa, setObservacaoBaixa] = useState('');
  const [dataPagamentoBaixa, setDataPagamentoBaixa] = useState('');
  const [formaPagamentoBaixa, setFormaPagamentoBaixa] = useState('');
  const [dadosCartaoBaixa, setDadosCartaoBaixa] = useState({
    bandeira: '',
    autorizacao: '',
    nsu: '',
  });
  const [loadingBaixa, setLoadingBaixa] = useState(false);

  // Esteira de protesto
  const [protestos, setProtestos] = useState([]);
  const [enviandoProtesto, setEnviandoProtesto] = useState(null);

  const notificar = (type, message, ms = 4000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), ms);
  };

  // ── Dados ──────────────────────────────────────────────────────────────
  const fetchDados = useCallback(async (refresh = false) => {
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(
        `${TotvsURL}bluecred/inadimplencia${refresh ? '?refresh=1' : ''}`,
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.message || `Erro HTTP ${resp.status}`);
      setDados(json.data || null);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  // Títulos já na Esteira de Protesto: trava o botão e marca o cliente com "P"
  const carregarProtestos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('esteira_protesto')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProtestos(data || []);
    } catch (err) {
      console.error('Erro ao carregar protestos:', err);
    }
  }, []);

  useEffect(() => {
    carregarProtestos();
  }, [carregarProtestos]);

  const faturasProtestadas = useMemo(
    () => new Set(protestos.map((p) => chaveTitulo(p.cd_empresa, p.nr_fat, p.nr_parcela))),
    [protestos],
  );
  const protestosPorCliente = useMemo(() => {
    const mapa = {};
    protestos.forEach((p) => {
      const k = String(p.cd_cliente);
      if (!mapa[k]) mapa[k] = [];
      mapa[k].push(p);
    });
    return mapa;
  }, [protestos]);

  const clientes = dados?.clientes || [];
  const hoje = dados?.hoje || null;

  // ── Filtros ────────────────────────────────────────────────────────────
  // FiltroEmpresa devolve objetos { cd_empresa (string), nm_grupoempresa }.
  const codigosEmpresa = useMemo(
    () =>
      new Set(
        (empresasSelecionadas || [])
          .map((e) => Number(typeof e === 'object' ? e.cd_empresa : e))
          .filter(Number.isFinite),
      ),
    [empresasSelecionadas],
  );

  // Busca por texto, faixa (maior atraso do cliente) e empresa (qualquer
  // título VENCIDO dele naquela loja).
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, '');
    return clientes.filter((c) => {
      if (q) {
        const nome = String(c.nm_cliente || '').toLowerCase();
        const cpf = String(c.nr_cpfcnpj || '').replace(/\D/g, '');
        if (!nome.includes(q) && !(qDig && cpf.includes(qDig)) && String(c.cd_cliente) !== q) {
          return false;
        }
      }
      if (!naFaixa(c.maior_atraso_dias, faixa)) return false;
      if (codigosEmpresa.size > 0) {
        const bate = (c.titulos || []).some(
          (t) => t.situacao === 'vencido' && codigosEmpresa.has(Number(t.cd_empresa)),
        );
        if (!bate) return false;
      }
      return true;
    });
  }, [clientes, busca, faixa, codigosEmpresa]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = direcao === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[ordenarPor];
      const vb = b[ordenarPor];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR') * dir;
    });
    return arr;
  }, [filtrados, ordenarPor, direcao]);

  // Métricas do que está na tela (respeitam os filtros), no padrão da MTM
  const metricas = useMemo(() => {
    const soma = (arr, k) => arr.reduce((s, c) => s + (Number(c[k]) || 0), 0);
    const ate60 = filtrados.filter((c) => c.situacao === 'vencido');
    const acima60 = filtrados.filter((c) => c.situacao === 'inadimplente');
    return {
      totalClientes: filtrados.length,
      valorVencido: soma(filtrados, 'valor_vencido'),
      valorAVencer: soma(filtrados, 'valor_a_vencer'),
      titulos: filtrados.reduce((s, c) => s + (c.qtd_vencidas || 0), 0),
      qtdAtrasados: ate60.length,
      valorAtrasados: soma(ate60, 'valor_vencido'),
      qtdInadimplentes: acima60.length,
      valorInadimplentes: soma(acima60, 'valor_vencido'),
      // origem: NOVO = comprou pelo app BlueCard; ANTIGO = contrato do HeadCoach
      novos: filtrados.filter((c) => c.origem === 'novo').length,
      antigos: filtrados.filter((c) => c.origem === 'antigo').length,
    };
  }, [filtrados]);

  // Por filial: quantos clientes inadimplentes e quanto vencido por loja.
  // Calculado sobre o que está filtrado (busca/faixa), ignorando o filtro de
  // empresa — senão a tabela só mostraria a loja já escolhida.
  const porFilial = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, '');
    const base = clientes.filter((c) => {
      if (q) {
        const nome = String(c.nm_cliente || '').toLowerCase();
        const cpf = String(c.nr_cpfcnpj || '').replace(/\D/g, '');
        if (!nome.includes(q) && !(qDig && cpf.includes(qDig)) && String(c.cd_cliente) !== q) {
          return false;
        }
      }
      return naFaixa(c.maior_atraso_dias, faixa);
    });
    const mapa = new Map();
    for (const c of base) {
      for (const t of c.titulos || []) {
        if (t.situacao !== 'vencido') continue;
        let f = mapa.get(t.cd_empresa);
        if (!f) {
          f = {
            cd_empresa: t.cd_empresa,
            nm_empresa: t.nm_empresa || `Filial ${t.cd_empresa}`,
            clientes: new Set(),
            titulos: 0,
            valor: 0,
          };
          mapa.set(t.cd_empresa, f);
        }
        f.clientes.add(c.cd_cliente);
        f.titulos++;
        f.valor += Number(t.vl_fatura) || 0;
      }
    }
    return [...mapa.values()]
      .map((f) => ({ ...f, clientes: f.clientes.size }))
      .sort((a, b) => b.clientes - a.clientes || b.valor - a.valor);
  }, [clientes, busca, faixa]);

  const ordenarColuna = (col) => {
    if (ordenarPor === col) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setOrdenarPor(col);
      setDirecao(col === 'nm_cliente' || col === 'nr_cpfcnpj' ? 'asc' : 'desc');
    }
  };

  const filtrarPorFilial = (f) => {
    const jaSo =
      codigosEmpresa.size === 1 && codigosEmpresa.has(Number(f.cd_empresa));
    setEmpresasSelecionadas(
      jaSo ? [] : [{ cd_empresa: String(f.cd_empresa), nm_grupoempresa: f.nm_empresa }],
    );
  };

  // ── Modal do cliente ───────────────────────────────────────────────────
  const abrirModal = (cliente) => {
    setClienteSelecionado(cliente);
    setModalAberto(true);
  };
  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
  };
  const faturasVencidas = useMemo(
    () => (clienteSelecionado?.titulos || []).filter((t) => t.situacao === 'vencido'),
    [clienteSelecionado],
  );
  const faturasAVencer = useMemo(
    () => (clienteSelecionado?.titulos || []).filter((t) => t.situacao !== 'vencido'),
    [clienteSelecionado],
  );

  const copiarLinha = async (linha, chave) => {
    try {
      await navigator.clipboard.writeText(linha);
      setCopiado(chave);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard bloqueado: silencioso */
    }
  };

  // ── Protesto ───────────────────────────────────────────────────────────
  const elegibilidadeProtesto = (fatura) => {
    if (faturasProtestadas.has(chaveFatura(fatura))) {
      return { protestado: true, ok: false, motivo: 'Título já protestado' };
    }
    if (Number(fatura.cd_portador) !== PORTADOR_PROTESTO) {
      return {
        protestado: false,
        ok: false,
        motivo: `Só é possível protestar títulos do portador SICREDI (${PORTADOR_PROTESTO}). Este está em ${fatura.nm_portador || fatura.cd_portador || '—'}.`,
      };
    }
    const atraso = Number(fatura.dias_atraso) || 0;
    if (atraso <= DIAS_MIN_PROTESTO) {
      return {
        protestado: false,
        ok: false,
        motivo:
          atraso > 0
            ? `Vencido há ${atraso} dia(s) — o protesto exige mais de ${DIAS_MIN_PROTESTO} dias de atraso.`
            : `Título ainda não vencido — o protesto exige mais de ${DIAS_MIN_PROTESTO} dias de atraso.`,
      };
    }
    return { protestado: false, ok: true, motivo: '' };
  };

  const enviarParaProtesto = async (fatura) => {
    const chave = chaveFatura(fatura);
    setEnviandoProtesto(chave);
    try {
      const { error } = await supabaseAdmin.from('esteira_protesto').insert({
        cd_empresa: fatura.cd_empresa,
        cd_cliente: String(fatura.cd_cliente || clienteSelecionado?.cd_cliente || ''),
        nm_cliente: clienteSelecionado?.nm_cliente || '',
        nr_cpfcnpj: clienteSelecionado?.nr_cpfcnpj || null,
        nr_fat: fatura.nr_fat || fatura.nr_fatura,
        nr_parcela: fatura.nr_parcela || 1,
        vl_fatura: parseFloat(fatura.vl_fatura) || 0,
        vl_juros: parseFloat(fatura.vl_juros) || 0,
        dt_vencimento: fatura.dt_vencimento ? String(fatura.dt_vencimento).slice(0, 10) : null,
        dt_emissao: fatura.dt_emissao ? String(fatura.dt_emissao).slice(0, 10) : null,
        cd_portador: fatura.cd_portador || null,
        nm_portador: fatura.nm_portador || null,
        nosso_numero: fatura.nosso_numero || null,
        status: 'pendente',
        user_id: user?.id || null,
        user_nome: user?.name || 'Usuário',
        user_email: user?.email || '',
      });
      if (error) {
        // 23505 = violação da unique — a fatura já está na esteira
        if (error.code === '23505') notificar('error', 'Esta fatura já está na Esteira de Protesto.');
        else throw new Error(error.message);
      } else {
        notificar('success', 'Fatura enviada para a Esteira de Protesto!');
      }
      await carregarProtestos();
    } catch (e) {
      console.error('Erro ao enviar para protesto:', e);
      notificar('error', `Erro ao enviar para protesto: ${e.message}`, 5000);
    } finally {
      setEnviandoProtesto(null);
    }
  };

  // ── Solicitação de baixa ───────────────────────────────────────────────
  const abrirModalBaixa = (fatura) => {
    setFaturaBaixa(fatura);
    setComprovanteBaixa(null);
    setPreviewComprovante(null);
    setObservacaoBaixa('');
    setDataPagamentoBaixa('');
    setFormaPagamentoBaixa('');
    setDadosCartaoBaixa({ bandeira: '', autorizacao: '', nsu: '' });
    setModalBaixaAberto(true);
  };
  const fecharModalBaixa = () => {
    setModalBaixaAberto(false);
    setFaturaBaixa(null);
    setComprovanteBaixa(null);
    setPreviewComprovante(null);
  };
  const handleComprovante = (e) => {
    const file = e.target.files?.[0] || null;
    setComprovanteBaixa(file);
    if (file && file.type.startsWith('image/')) {
      setPreviewComprovante(URL.createObjectURL(file));
    } else {
      setPreviewComprovante(null);
    }
  };

  const handleEnviarBaixa = async () => {
    if (!faturaBaixa || !comprovanteBaixa) return notificar('error', 'Selecione o comprovante de pagamento.', 3000);
    if (!dataPagamentoBaixa) return notificar('error', 'Informe a data de pagamento.', 3000);
    if (!formaPagamentoBaixa) return notificar('error', 'Selecione a forma de pagamento.', 3000);
    const ehCartao = formaPagamentoBaixa === 'cartao_credito' || formaPagamentoBaixa === 'cartao_debito';
    if (ehCartao && (!dadosCartaoBaixa.bandeira || !dadosCartaoBaixa.autorizacao || !dadosCartaoBaixa.nsu)) {
      return notificar('error', 'Preencha todos os dados do cartão (bandeira, autorização e NSU).', 3000);
    }

    setLoadingBaixa(true);
    try {
      const fileExt = comprovanteBaixa.name.split('.').pop();
      const fileName = `${faturaBaixa.cd_empresa}_${faturaBaixa.cd_cliente}_${faturaBaixa.nr_fat || faturaBaixa.nr_fatura}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('comprovantes_baixa')
        .upload(filePath, comprovanteBaixa, { upsert: false });
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: urlData } = supabaseAdmin.storage.from('comprovantes_baixa').getPublicUrl(filePath);

      const { error: insertError } = await supabaseAdmin.from('solicitacoes_baixa').insert({
        cd_empresa: faturaBaixa.cd_empresa,
        cd_cliente: faturaBaixa.cd_cliente,
        nm_cliente: clienteSelecionado?.nm_cliente || '',
        nr_fat: faturaBaixa.nr_fat || faturaBaixa.nr_fatura,
        nr_parcela: faturaBaixa.nr_parcela || 1,
        vl_fatura: parseFloat(faturaBaixa.vl_fatura) || 0,
        vl_juros: parseFloat(faturaBaixa.vl_juros) || 0,
        dt_vencimento: faturaBaixa.dt_vencimento ? String(faturaBaixa.dt_vencimento).slice(0, 10) : null,
        dt_emissao: faturaBaixa.dt_emissao ? String(faturaBaixa.dt_emissao).slice(0, 10) : null,
        cd_portador: faturaBaixa.cd_portador || null,
        nm_portador: faturaBaixa.nm_portador || null,
        comprovante_url: urlData?.publicUrl,
        comprovante_path: filePath,
        status: 'pendente',
        user_id: user?.id || null,
        user_nome: user?.name || 'Usuário',
        user_email: user?.email || '',
        observacao: observacaoBaixa || null,
        dt_pagamento: dataPagamentoBaixa || null,
        forma_pagamento: formaPagamentoBaixa || null,
        dados_cartao: ehCartao ? dadosCartaoBaixa : null,
      });
      if (insertError) throw new Error(`Erro ao salvar: ${insertError.message}`);

      notificar('success', 'Solicitação de baixa enviada com sucesso!');
      fecharModalBaixa();
    } catch (e) {
      console.error('Erro ao enviar solicitação de baixa:', e);
      notificar('error', e.message || 'Erro ao enviar solicitação.', 5000);
    } finally {
      setLoadingBaixa(false);
    }
  };

  // ── Excel ──────────────────────────────────────────────────────────────
  const baixarExcel = () => {
    const resumo = ordenados.map((c) => ({
      'Código Cliente': c.cd_cliente,
      'Nome Cliente': c.nm_cliente,
      Origem: c.origem === 'novo' ? 'Novo (app BlueCard)' : c.origem === 'antigo' ? 'Antigo (HeadCoach)' : '',
      CPF: fmtCpf(c.nr_cpfcnpj),
      Telefone: fmtTel(c.nr_telefone),
      Filiais: (c.filiais_nomes || c.filiais || []).join(', '),
      'Títulos Vencidos': c.qtd_vencidas,
      'Maior Atraso (dias)': c.maior_atraso_dias,
      Situação: c.situacao === 'inadimplente' ? 'Inadimplente (> 60d)' : 'Vencido (≤ 60d)',
      'Valor Vencido': c.valor_vencido,
      'A Vencer': c.valor_a_vencer,
      'Total em Aberto': c.valor_total,
      Protesto: protestosPorCliente[String(c.cd_cliente)] ? 'Sim' : '',
    }));
    const titulos = ordenados.flatMap((c) =>
      (c.titulos || []).map((t) => ({
        'Código Cliente': c.cd_cliente,
        'Nome Cliente': c.nm_cliente,
        Empresa: t.nm_empresa || t.cd_empresa,
        Fatura: t.nr_fatura,
        Parcela: t.nr_parcela,
        Emissão: formatarData(t.dt_emissao),
        Vencimento: formatarData(t.dt_vencimento),
        'Dias de Atraso': t.dias_atraso,
        Situação: t.situacao === 'vencido' ? 'Vencido' : 'A vencer',
        Portador: t.nm_portador || t.cd_portador || '',
        Cobrança: getTipoCobranca(t.tp_cobranca).label,
        Valor: t.vl_fatura,
        Juros: t.vl_juros,
        Multa: t.vl_multa,
        'Linha Digitável': t.linha_digitavel || '',
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Clientes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(titulos), 'Títulos');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        porFilial.map((f) => ({
          Empresa: f.nm_empresa,
          Código: f.cd_empresa,
          'Clientes Inadimplentes': f.clientes,
          'Títulos Vencidos': f.titulos,
          'Valor Vencido': Math.round(f.valor * 100) / 100,
        })),
      ),
      'Por Filial',
    );
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `inadimplencia-bluecred-${hoje || ''}.xlsx`,
    );
  };

  // Bolinha de origem: azul = cliente novo (app BlueCard), vermelha = antigo
  // (contrato HeadCoach). Cinza = CPF sem origem conhecida (não deveria ocorrer).
  const BolinhaOrigem = ({ c }) => {
    const cor =
      c.origem === 'novo' ? 'bg-blue-500' : c.origem === 'antigo' ? 'bg-red-500' : 'bg-gray-300';
    const titulo =
      c.origem === 'novo'
        ? 'Cliente NOVO — comprou pelo app BlueCard' +
          (c.em_ambas_origens ? ' (também tem contrato antigo)' : '')
        : c.origem === 'antigo'
          ? 'Cliente ANTIGO — contrato BlueCred do HeadCoach'
          : 'Origem não identificada';
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cor}`}
        title={titulo}
        aria-label={titulo}
      />
    );
  };

  const Th = ({ col, children, align = 'left' }) => (
    <th
      className={`px-4 py-3 cursor-pointer hover:bg-gray-100 select-none text-${align}`}
      onClick={() => ordenarColuna(col)}
      title="Clique para ordenar"
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {children}
        {ordenarPor === col && <span>{direcao === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  );

  const BadgePortador = ({ f }) => (
    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium text-xs whitespace-nowrap">
      {f.nm_portador || f.cd_portador || '--'}
    </span>
  );

  const BotaoBoleto = ({ t, chave }) =>
    t.linha_digitavel ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copiarLinha(t.linha_digitavel, chave);
        }}
        className="inline-flex items-center gap-1 text-[#000638] hover:underline text-xs whitespace-nowrap"
        title={t.linha_digitavel}
      >
        <Copy size={12} />
        {copiado === chave ? 'Copiado!' : 'Linha digitável'}
      </button>
    ) : (
      <span className="text-gray-400 text-xs">sem boleto</span>
    );

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6">
      <PageTitle
        title="Inadimplência BlueCred"
        subtitle="Clientes do crediário BlueCred com faturas vencidas no TOTVS"
        icon={ChartBar}
        iconColor="text-blue-600"
      />

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados(true);
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações para análise de Inadimplência BlueCred
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Situação em {hoje ? formatarData(hoje) : 'hoje'} · faturas do crediário (tipo 1) em
            aberto e vencidas · {dados?.clientes_bluecred ?? '—'} clientes BlueCred
            {dados?.cached ? ' · dados em cache (até 10 min)' : ''}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3 mt-4">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Buscar cliente
              </label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, CPF ou código"
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Faixa de atraso
              </label>
              <select
                value={faixa}
                onChange={(e) => setFaixa(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-sm"
              >
                {FAIXAS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Filtro de empresa padrão — só faz sentido depois de carregar */}
            {dados && (
              <div>
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={setEmpresasSelecionadas}
                />
              </div>
            )}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
              >
                {loading ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <ArrowClockwise size={16} />
                    Atualizar do TOTVS
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700">Total de Clientes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-blue-600 mb-0.5">
              {metricas.totalClientes}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Clientes com fatura vencida · {metricas.titulos} título
              {metricas.titulos !== 1 ? 's' : ''}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-red-600" />
              <CardTitle className="text-sm font-bold text-red-700">Valor Vencido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-red-600 mb-0.5">
              {formatarMoeda(metricas.valorVencido)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Soma das faturas já vencidas
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-yellow-600" />
              <CardTitle className="text-sm font-bold text-yellow-700">A Vencer</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-yellow-600 mb-0.5">
              {formatarMoeda(metricas.valorAVencer)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Ainda em dia, dos mesmos clientes
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              <CardTitle className="text-sm font-bold text-blue-700">Clientes Novos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-blue-600 mb-0.5">{metricas.novos}</div>
            <CardDescription className="text-xs text-gray-500">
              Compraram pelo app BlueCard
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              <CardTitle className="text-sm font-bold text-red-700">Clientes Antigos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-red-600 mb-0.5">{metricas.antigos}</div>
            <CardDescription className="text-xs text-gray-500">
              Contrato BlueCred do HeadCoach
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Sessão Situação */}
      <div>
        <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-[#000638] rounded"></span>
          Por Situação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => setFaixa(faixa === '61+' || faixa === 'todas' ? '1-30' : 'todas')}
            title="Filtrar por até 60 dias"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">Vencidos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-yellow-600 mb-0.5">
                {metricas.qtdAtrasados} cliente{metricas.qtdAtrasados !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorAtrasados)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Até 60 dias de atraso
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={() => setFaixa(faixa === '61+' ? 'todas' : '61+')}
            title="Filtrar por acima de 60 dias"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">Inadimplentes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-red-600 mb-0.5">
                {metricas.qtdInadimplentes} cliente{metricas.qtdInadimplentes !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorInadimplentes)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Acima de 60 dias de atraso
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Por Filial */}
      {porFilial.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-[#000638] rounded"></span>
            Inadimplência por Filial
          </h3>
          <Card className="shadow-lg rounded-xl bg-white">
            <CardContent className="p-4">
              <CardDescription className="text-xs text-gray-500 mb-3">
                Clique numa loja para filtrar a lista. O cliente conta em cada loja onde tem
                fatura vencida.
              </CardDescription>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="px-4 py-3 text-left font-bold text-[#000638]">Filial</th>
                      <th className="px-4 py-3 text-center font-bold text-[#000638]">
                        Clientes Inadimplentes
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#000638]">
                        Títulos Vencidos
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-red-700">
                        Valor Vencido
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {porFilial.map((f) => {
                      const ativa =
                        codigosEmpresa.size === 1 && codigosEmpresa.has(Number(f.cd_empresa));
                      return (
                        <tr
                          key={f.cd_empresa}
                          onClick={() => filtrarPorFilial(f)}
                          className={`border-b cursor-pointer transition-colors ${
                            ativa ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                          title={ativa ? 'Clique para limpar o filtro' : 'Filtrar por esta loja'}
                        >
                          <td className="px-4 py-2 font-medium text-[#000638]">
                            <div className="flex items-center gap-2">
                              <Storefront size={14} className="text-blue-600" />
                              {f.nm_empresa}
                              <span className="text-[10px] text-gray-400 font-mono">
                                #{f.cd_empresa}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center font-bold">{f.clientes}</td>
                          <td className="px-4 py-2 text-center">{f.titulos}</td>
                          <td className="px-4 py-2 text-right font-semibold text-red-700">
                            {formatarMoeda(f.valor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <Card className="shadow-lg rounded-xl bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Lista de Clientes Inadimplentes
              </CardTitle>
            </div>
            <button
              onClick={baixarExcel}
              disabled={ordenados.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              title="Baixar em Excel (clientes, títulos e por filial)"
            >
              <FileXls size={16} weight="bold" />
              Baixar Excel
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 align-middle mr-1" />
            novo (app BlueCard) ·{' '}
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 align-middle mr-1" />
            antigo (contrato HeadCoach). Clique no cliente para ver as faturas, solicitar baixa ou
            protestar.{' '}
            {ordenados.length} de {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}{' '}
            exibido{ordenados.length !== 1 ? 's' : ''}.
          </CardDescription>
          {loading && !dados ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" text="Consultando o contas a receber..." />
            </div>
          ) : ordenados.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              {clientes.length === 0
                ? 'Nenhum cliente BlueCred com fatura vencida.'
                : 'Nenhum cliente com os filtros atuais.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <Th col="cd_cliente">Código</Th>
                    <Th col="nm_cliente">Nome Cliente</Th>
                    <Th col="nr_cpfcnpj">CPF</Th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Filiais</th>
                    <Th col="qtd_vencidas" align="right">
                      Títulos
                    </Th>
                    <Th col="maior_atraso_dias" align="right">
                      Maior Atraso
                    </Th>
                    <Th col="valor_vencido" align="right">
                      Valor Vencido
                    </Th>
                    <Th col="valor_a_vencer" align="right">
                      A Vencer
                    </Th>
                    <Th col="valor_total" align="right">
                      Total
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((c) => {
                    const whats = linkWhats(c.nr_telefone);
                    const temProtesto = Boolean(protestosPorCliente[String(c.cd_cliente)]);
                    return (
                      <tr
                        key={c.cd_cliente}
                        onClick={() => abrirModal(c)}
                        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2 font-mono text-xs">{c.cd_cliente}</td>
                        <td className="px-4 py-2 font-medium text-[#000638]">
                          <div className="flex items-center gap-2">
                            <BolinhaOrigem c={c} />
                            {c.nm_cliente}
                            {temProtesto && (
                              <span
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold"
                                title="Cliente com título na Esteira de Protesto"
                              >
                                P
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{fmtCpf(c.nr_cpfcnpj)}</td>
                        <td className="px-4 py-2">
                          {whats ? (
                            <a
                              href={whats}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-green-700 hover:underline"
                              title="Abrir WhatsApp"
                            >
                              <WhatsappLogo size={14} weight="fill" />
                              {fmtTel(c.nr_telefone)}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {(c.filiais_nomes || []).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-2 text-right">{c.qtd_vencidas}</td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              c.situacao === 'inadimplente'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {c.maior_atraso_dias} d
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-700">
                          {formatarMoeda(c.valor_vencido)}
                        </td>
                        <td className="px-4 py-2 text-right text-yellow-700">
                          {formatarMoeda(c.valor_a_vencer)}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-[#000638]">
                          {formatarMoeda(c.valor_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== MODAL DO CLIENTE (faturas) — padrão MTM ===== */}
      {modalAberto && clienteSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-y-auto w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BolinhaOrigem c={clienteSelecionado} />
                  Detalhes das Faturas - {clienteSelecionado.nm_cliente}
                </h3>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Código {clienteSelecionado.cd_cliente}</span>
                  <span>CPF {fmtCpf(clienteSelecionado.nr_cpfcnpj)}</span>
                  {linkWhats(clienteSelecionado.nr_telefone) && (
                    <a
                      href={linkWhats(clienteSelecionado.nr_telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-green-700 hover:underline"
                    >
                      <WhatsappLogo size={12} weight="fill" />
                      {fmtTel(clienteSelecionado.nr_telefone)}
                    </a>
                  )}
                  <span>{(clienteSelecionado.filiais_nomes || []).join(' · ')}</span>
                </div>
              </div>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600">
                <X size={22} weight="bold" />
              </button>
            </div>

            {/* Faturas Vencidas */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-red-700 mb-3 flex items-center gap-2">
                <Warning size={20} weight="bold" className="text-red-600" />
                Faturas Vencidas ({faturasVencidas.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-red-600">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Nº Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor Fatura</th>
                      <th className="px-4 py-3">Juros</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Cobrança</th>
                      <th className="px-4 py-3">Portador</th>
                      <th className="px-4 py-3">Boleto</th>
                      <th className="px-4 py-3">Tempo Inadimplência</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturasVencidas.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-4 text-center text-gray-500">
                          Nenhuma fatura vencida encontrada
                        </td>
                      </tr>
                    ) : (
                      faturasVencidas.map((fatura) => {
                        const chave = chaveFatura(fatura);
                        const tc = getTipoCobranca(fatura.tp_cobranca);
                        const eleg = elegibilidadeProtesto(fatura);
                        const enviando = enviandoProtesto === chave;
                        return (
                          <tr key={chave} className="bg-red-50 border-b border-red-100">
                            <td className="px-4 py-3">
                              <div className="font-medium">{fatura.nm_empresa || fatura.cd_empresa}</div>
                              <div className="text-[10px] text-gray-400 font-mono">#{fatura.cd_empresa}</div>
                            </td>
                            <td className="px-4 py-3 font-medium">{fatura.nr_fat || fatura.nr_fatura}</td>
                            <td className="px-4 py-3">{formatarData(fatura.dt_emissao)}</td>
                            <td className="px-4 py-3">{formatarData(fatura.dt_vencimento)}</td>
                            <td className="px-4 py-3 font-medium text-red-600">
                              {formatarMoeda(fatura.vl_fatura)}
                            </td>
                            <td className="px-4 py-3 font-medium text-red-600">
                              {formatarMoeda((fatura.vl_juros || 0) + (fatura.vl_multa || 0))}
                            </td>
                            <td className="px-4 py-3">{fatura.nr_parcela || 1}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`${tc.color} px-1.5 py-0.5 rounded font-medium`}>
                                {tc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <BadgePortador f={fatura} />
                            </td>
                            <td className="px-4 py-3">
                              <BotaoBoleto t={fatura} chave={chave} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded whitespace-nowrap">
                                {tempoInadimplencia(fatura.dias_atraso)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirModalBaixa(fatura);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors whitespace-nowrap"
                                  title="Enviar para solicitação de baixa"
                                >
                                  <PaperPlaneRight size={12} weight="bold" />
                                  Baixa
                                </button>
                                {eleg.protestado ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-green-800 bg-green-100 border border-green-300 rounded-lg whitespace-nowrap"
                                    title="Título já enviado para a Esteira de Protesto"
                                  >
                                    <CheckCircle size={12} weight="bold" />
                                    PROTESTADO
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      enviarParaProtesto(fatura);
                                    }}
                                    disabled={enviando || !eleg.ok}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
                                    title={eleg.ok ? 'Enviar para a Esteira de Protesto' : eleg.motivo}
                                  >
                                    {enviando ? (
                                      <CircleNotch size={12} className="animate-spin" />
                                    ) : (
                                      <Gavel size={12} weight="bold" />
                                    )}
                                    Protestar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Faturas a Vencer */}
            <div className="mb-2">
              <h4 className="text-md font-semibold text-orange-700 mb-3 flex items-center gap-2">
                <Clock size={20} weight="bold" className="text-orange-600" />
                Faturas a Vencer ({faturasAVencer.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-orange-500">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Nº Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor Fatura</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Cobrança</th>
                      <th className="px-4 py-3">Portador</th>
                      <th className="px-4 py-3">Boleto</th>
                      <th className="px-4 py-3">Dias para Vencer</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturasAVencer.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-4 text-center text-gray-500">
                          Nenhuma fatura a vencer encontrada
                        </td>
                      </tr>
                    ) : (
                      faturasAVencer.map((fatura) => {
                        const chave = chaveFatura(fatura);
                        const tc = getTipoCobranca(fatura.tp_cobranca);
                        const dias = diasParaVencer(fatura.dt_vencimento, hoje);
                        return (
                          <tr key={chave} className="bg-orange-50 border-b border-orange-100">
                            <td className="px-4 py-3">
                              <div className="font-medium">{fatura.nm_empresa || fatura.cd_empresa}</div>
                              <div className="text-[10px] text-gray-400 font-mono">#{fatura.cd_empresa}</div>
                            </td>
                            <td className="px-4 py-3 font-medium">{fatura.nr_fat || fatura.nr_fatura}</td>
                            <td className="px-4 py-3">{formatarData(fatura.dt_emissao)}</td>
                            <td className="px-4 py-3">{formatarData(fatura.dt_vencimento)}</td>
                            <td className="px-4 py-3 font-medium text-orange-600">
                              {formatarMoeda(fatura.vl_fatura)}
                            </td>
                            <td className="px-4 py-3">{fatura.nr_parcela || 1}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`${tc.color} px-1.5 py-0.5 rounded font-medium`}>
                                {tc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <BadgePortador f={fatura} />
                            </td>
                            <td className="px-4 py-3">
                              <BotaoBoleto t={fatura} chave={chave} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded whitespace-nowrap">
                                {dias === null ? '—' : dias === 0 ? 'vence hoje' : `${dias} dia${dias === 1 ? '' : 's'}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalBaixa(fatura);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors whitespace-nowrap"
                                title="Enviar para solicitação de baixa"
                              >
                                <PaperPlaneRight size={12} weight="bold" />
                                Baixa
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SOLICITAÇÃO DE BAIXA — padrão MTM ===== */}
      {modalBaixaAberto && faturaBaixa && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PaperPlaneRight size={20} weight="bold" />
                Solicitação de Baixa
              </h3>
              <button onClick={fecharModalBaixa} className="text-white hover:text-red-300 transition-colors">
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-semibold">{clienteSelecionado?.nm_cliente || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Empresa:</span>
                  <span className="font-semibold">{faturaBaixa.nm_empresa || faturaBaixa.cd_empresa}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fatura:</span>
                  <span className="font-semibold">{faturaBaixa.nr_fat || faturaBaixa.nr_fatura}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parcela:</span>
                  <span className="font-semibold">{faturaBaixa.nr_parcela || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor:</span>
                  <span className="font-bold text-red-600">{formatarMoeda(faturaBaixa.vl_fatura)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vencimento:</span>
                  <span className="font-semibold">{formatarData(faturaBaixa.dt_vencimento)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Portador:</span>
                  <BadgePortador f={faturaBaixa} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Data de Pagamento *</label>
                <input
                  type="date"
                  value={dataPagamentoBaixa}
                  onChange={(e) => setDataPagamentoBaixa(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Data que consta no comprovante de pagamento</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Forma de Pagamento *</label>
                <select
                  value={formaPagamentoBaixa}
                  onChange={(e) => {
                    setFormaPagamentoBaixa(e.target.value);
                    setDadosCartaoBaixa({ bandeira: '', autorizacao: '', nsu: '' });
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                  required
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formaPagamentoBaixa === 'cartao_credito' || formaPagamentoBaixa === 'cartao_debito') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-yellow-800">Dados do Cartão</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-0.5">Bandeira *</label>
                    <input
                      type="text"
                      value={dadosCartaoBaixa.bandeira}
                      onChange={(e) => setDadosCartaoBaixa((p) => ({ ...p, bandeira: e.target.value }))}
                      placeholder="Ex: Visa, Mastercard, Elo..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">Nº Autorização *</label>
                      <input
                        type="text"
                        value={dadosCartaoBaixa.autorizacao}
                        onChange={(e) => setDadosCartaoBaixa((p) => ({ ...p, autorizacao: e.target.value }))}
                        placeholder="Nº autorização"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">NSU *</label>
                      <input
                        type="text"
                        value={dadosCartaoBaixa.nsu}
                        onChange={(e) => setDadosCartaoBaixa((p) => ({ ...p, nsu: e.target.value }))}
                        placeholder="NSU"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Comprovante de Pagamento *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleComprovante}
                  className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#000638] file:text-white file:text-xs file:font-bold hover:file:bg-[#fe0000]"
                />
                {previewComprovante && (
                  <img
                    src={previewComprovante}
                    alt="Prévia do comprovante"
                    className="mt-2 max-h-40 rounded-lg border object-contain"
                  />
                )}
                {comprovanteBaixa && !previewComprovante && (
                  <p className="text-xs text-gray-500 mt-1">{comprovanteBaixa.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Observação</label>
                <textarea
                  value={observacaoBaixa}
                  onChange={(e) => setObservacaoBaixa(e.target.value)}
                  rows={2}
                  placeholder="Opcional"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={fecharModalBaixa}
                  disabled={loadingBaixa}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviarBaixa}
                  disabled={loadingBaixa}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#000638] text-white hover:bg-[#fe0000] disabled:opacity-50"
                >
                  {loadingBaixa ? (
                    <>
                      <CircleNotch size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <PaperPlaneRight size={16} weight="bold" />
                      Enviar Solicitação
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
