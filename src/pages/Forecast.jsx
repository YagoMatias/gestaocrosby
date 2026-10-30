// Forecast — menu abaixo do DRE (Niziany, 27/10/2026).
// DRE projetada de 2026 a partir da planilha base "FORECAST PESSIMISTA /
// Conservador": Realizado (jan–set) + Previsão (out–dez), mês a mês.
// Layout no padrão das demais páginas do HeadCoach (azul #000638, cabeçalho
// cinza, cards com borda). Os valores vêm de src/data/forecastBase.json; as
// visões e blocos extras seguem no JSON caso precise voltar.
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ChartLineUp, CaretRight, CaretDown, CornersOut, CornersIn, Knife, Calculator } from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import PageTitle from '../components/ui/PageTitle';
import base from '../data/forecastBase.json';
import { API_BASE_URL } from '../config/constants';
import { gerarForecastXlsx } from './forecastExcel';

// Automação da receita bruta (Niziany, 27–28/10/2026): a partir de setembro/2026
// os canais vêm do New Forecast (GET /api/forecast-dre/receita-canais), já com
// o showroom separado por cliente. Jan–ago seguem com os números da planilha.
// É automático para os próximos meses: puxa todo mês de 2026 marcado como
// "realizado" a partir de setembro — não precisa ligar mês a mês.
const CANAL_POR_LINHA = {
  VAREJO: 'varejo',
  MULTIMARCAS: 'multimarcas',
  FRANQUIA: 'franquia',
  REVENDA: 'revenda',
  BAZAR: 'bazar',
};
// Linhas de canal que podem abrir para mostrar o CREDEV do canal (só visual).
const CREDEV_CANAL_POR_LINHA = {
  VAREJO: 'varejo',
  MULTIMARCAS: 'multimarcas',
  FRANQUIA: 'franquia',
  REVENDA: 'revenda',
  BAZAR: 'bazar',
};
const MES_ABREV = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
// Coluna mensal → 'YYYY-MM' (usa o label 'Set/26' + o ano da coluna).
const colParaMes = (c) => {
  if (c.grupo === 'mes2027') return c.mes;
  if (c.grupo === 'ano') return String(c.ano); // colunas anuais guardam edição pelo ano
  if (c.grupo !== 'mensal' || !c.ano) return null;
  const m = MES_ABREV[String(c.label || '').slice(0, 3).toLowerCase()];
  return m ? `${c.ano}-${String(m).padStart(2, '0')}` : null;
};
// Meses a puxar do New Forecast: colunas mensais de 2026, realizado, mês >= 9.
// Automático de set/2026 em diante, em QUALQUER ano: os meses seguintes
// ficam "fixos" — basta marcar o mês como realizado (Niziany 30/10).
const MES_AUTO_INICIO = '2026-09';
// Tela Previsão 2027 (Niziany 30/10): cada mês parte do último realizado e é
// editável; a última coluna soma os meses.
const MESES_2027 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
  (nome, i) => ({
    key: 'P2027-' + (i + 1),
    label: `${nome}/27`,
    tipo: 'forecast',
    grupo: 'mes2027',
    ano: 2027,
    mes: `2027-${String(i + 1).padStart(2, '0')}`,
  }),
);
const COLUNA_TOTAL_2027 = {
  key: 'P2027-T', label: '2027', tipo: 'forecast', grupo: 'total2027', ano: 2027, somaMeses: true,
};
const COLUNAS_2027 = [...MESES_2027, COLUNA_TOTAL_2027];
// Previsão 2027 sem canais: Receita Bruta = Receita Líquida (Niziany 30/10)
const OCULTAS_2027 = new Set([
  'VAREJO', 'MULTIMARCAS', 'FRANQUIA', 'REVENDA', 'BAZAR',
  'FARDAMENTO', 'IMOBILIZADO', 'BLUECRED', 'CREDEV',
]);
const LINHAS_RECEITA_2027 = ['RECEITA BRUTA', 'RECEITA LÍQUIDA'];

// Shopping Recife fora do Forecast (Niziany 30/10): a loja é a empresa CROSBY
// RECIFE MALL LTDA (cliente 29541, filial 98). Filial 98 não entra em Ocupação,
// Serviços, Marketing e Juros; sobram folha e perda. Tira aqui, ao carregar, pra
// valer também no mês travado, sem mexer no que está salvo.
const EH_SHOPPING_RECIFE = /RECIFE MALL|SHOPPING RECIFE/i;
function semShoppingRecife(pf) {
  const r2 = (v) => Math.round(v * 100) / 100;
  let fixo = 0;
  let variavel = 0;
  const rubricas = (pf.rubricas || []).map((r) => {
    if (!Array.isArray(r.funcionarios)) return r;
    const fora = r.funcionarios.filter((f) => EH_SHOPPING_RECIFE.test(f.loja || ''));
    if (!fora.length) return r;
    const soma = fora.reduce((a, f) => a + (Number(f.valor) || 0), 0);
    if (r.entra !== false && r.tipo === 'provento') {
      if (r.grupo === 'variavel') variavel += soma;
      else fixo += soma;
    }
    return {
      ...r,
      valor: r2((Number(r.valor) || 0) - soma),
      funcionarios: r.funcionarios.filter((f) => !EH_SHOPPING_RECIFE.test(f.loja || '')),
    };
  });
  const perdaFora = (pf.perdas_canais || [])
    .filter((x) => EH_SHOPPING_RECIFE.test(x.nome || ''))
    .reduce((a, x) => a + (Number(x.valor) || 0), 0);
  return {
    ...pf,
    rubricas,
    proventos_fixo: r2((pf.proventos_fixo || 0) - fixo),
    proventos_variavel: r2((pf.proventos_variavel || 0) - variavel),
    pessoal_fixo: r2((pf.pessoal_fixo || 0) + fixo),
    pessoal_variavel: r2((pf.pessoal_variavel || 0) + variavel),
    perdas_total: typeof pf.perdas_total === 'number' ? r2(pf.perdas_total + perdaFora) : pf.perdas_total,
    perdas_canais: Array.isArray(pf.perdas_canais)
      ? pf.perdas_canais.filter((x) => !EH_SHOPPING_RECIFE.test(x.nome || ''))
      : pf.perdas_canais,
  };
}
// % da coluna de total: conta sobre as somas, não soma de percentuais
const PCT_RAZAO = {
  'TAX %': ['IMPOSTOS DIRETOS', 'RECEITA LÍQUIDA'],
  'CMV %': ['CUSTO DAS MERCADORIAS VENDIDAS', 'RECEITA OPERACIONAL LÍQUIDA'],
  'MARGEM %': ['LUCRO BRUTO', 'RECEITA OPERACIONAL LÍQUIDA'],
  'EBITDA %': ['EBITDA', 'RECEITA OPERACIONAL LÍQUIDA'],
  '% LUCRO LÍQUIDO': ['LUCRO LÍQUIDO', 'RECEITA OPERACIONAL LÍQUIDA'],
};
// Colunas anuais da previsão (Niziany 30/10). 2026: soma de janeiro a dezembro.
// 2027: receita soma os meses de 2026, impostos e CMV seguem o % do último
// realizado, o resto é esse mês × 12.
const COLUNAS_ANO = [
  { key: 'ANO2026', label: '2026', tipo: 'forecast', grupo: 'ano', ano: 2026 },
  { key: 'ANO2027', label: '2027', tipo: 'forecast', grupo: 'ano', ano: 2027 },
];
function mesesAutomaticos(colunas) {
  const out = [];
  for (const c of colunas) {
    if (c.grupo !== 'mensal' || !c.ano || c.tipo !== 'realizado') continue;
    const abrev = String(c.label || '').slice(0, 3).toLowerCase();
    const m = MES_ABREV[abrev];
    if (!m) continue;
    const mes = `${c.ano}-${String(m).padStart(2, '0')}`;
    if (mes < MES_AUTO_INICIO) continue;
    out.push({ col: c.key, mes });
  }
  return out;
}

// Linhas de venda que somam a RECEITA LÍQUIDA.
const LINHAS_CANAIS_DRE = [
  'VAREJO', 'MULTIMARCAS', 'FRANQUIA', 'REVENDA', 'BAZAR',
  'FARDAMENTO', 'IMOBILIZADO', 'BLUECRED',
];
// Percentuais calculados, sem edição direta (TAX % e CMV % são editáveis).
const PCT_DERIVADOS = new Set(['MARGEM %', 'EBITDA %', '% LUCRO LÍQUIDO']);

// Corte de custo: linhas que a faca tira inteiras do cálculo no mês.
const LINHAS_FACA = new Set([
  'PESSOAL FIXO', 'PESSOAL VARIÁVEL', 'PJ', 'OCUPAÇÃO', 'SERVIÇOS DE TERCEIROS FIXOS',
  'TAXA DE CARTÃO', 'PROPAGANDA E ANÚNCIO', 'TRÁFEGO', 'BONIFICAÇÕES MARKETING', 'FRETES',
  'PERDAS COM INADIMPLÊNCIA', 'ANTECIPAÇÃO DE RECEBÍVEIS', 'JUROS E MULTA POR ATRASO',
]);

// Despesas (nível 1) que somam em COMERCIAIS, GERAIS E ADMINISTRATIVAS.
const LINHAS_SGA = [
  'PESSOAL FIXO',
  'PESSOAL VARIÁVEL',
  'PJ',
  'OCUPAÇÃO',
  'SERVIÇOS DE TERCEIROS FIXOS',
  'SERVIÇOS DE TERCEIROS VARIÁVEIS',
  'MARKETING',
  'FRETES',
  'PERDAS COM INADIMPLÊNCIA',
];

const TIPO_ROTULO = { realizado: 'Realizado', forecast: 'Previsão' };

// Cabeçalho superior agrupado por tipo (Realizado / Previsão)
const TIPO_CABECALHO = {
  realizado: 'bg-[#000638] text-white',
  forecast: 'bg-blue-600 text-white',
};

// Realce suave da coluna de previsão no corpo da tabela
const TIPO_CELULA = {
  realizado: '',
  forecast: 'bg-blue-50/70',
};

const fmtMoeda = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtInt = (v) =>
  v == null ? '–' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) =>
  v == null
    ? '–'
    : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
      '%';

function formatar(valor, fmtLinha) {
  if (fmtLinha === 'pct') return fmtPct(valor);
  if (fmtLinha === 'int') return fmtInt(valor);
  return fmtMoeda(valor);
}

// Agrupa colunas consecutivas do mesmo tipo para a linha de cabeçalho superior
function agruparColunas(colunas) {
  const grupos = [];
  for (const c of colunas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tipo === c.tipo) ultimo.qtd += 1;
    else grupos.push({ tipo: c.tipo, qtd: 1 });
  }
  return grupos;
}

// Linhas de total/resultado com destaque forte (banda azul do HeadCoach).
const TOTAIS_FORTES = new Set([
  'RECEITA BRUTA',
  'RECEITA LÍQUIDA',
  'RECEITA OPERACIONAL LÍQUIDA',
  'LUCRO BRUTO',
  'LUCRO OPERACIONAL',
  'EBITDA',
  'LUCRO ANTES DO IR E CS',
  'LUCRO LÍQUIDO',
  'RESULTADO FINAL',
]);
// Linhas que abrem uma nova seção (ganham um traço superior mais marcado).
const INICIO_SECAO = new Set([
  'RECEITA LÍQUIDA',
  'CUSTO DAS MERCADORIAS VENDIDAS',
  'RECEITAS (DESPESAS) OPERACIONAIS',
  'LUCRO OPERACIONAL',
  'RECEITA (DESPESA) NÃO OPERACIONAL',
  'INVESTIMENTOS',
]);

const tipoLinha = (l) => {
  if (l.fmt === 'pct') return 'pct';
  if (TOTAIS_FORTES.has(l.label)) return 'forte';
  if (l.nivel === 1) return 'sub';
  if (l.nivel === 2) return 'sub2'; // item de subgrupo (3º nível)
  return 'normal';
};

export default function Forecast({ modoCorte = false }) {
  // Realizado × Previsão por mês: a Niziany marca na tela (salvo no backend).
  // Mescla por cima do tipo padrão da planilha.
  const [tipoOverrides, setTipoOverrides] = useState({});
  // Meses travados (Niziany 30/10): { [mes]: { travado, snapshot } }
  const [travas, setTravas] = useState({});
  // Botão "Atualizar dados": força o recálculo nas fontes e relê
  const [atualizando, setAtualizando] = useState(false);
  const [refetchTick, setRefetchTick] = useState(0);
  // Overrides ao vivo por coluna: { [colKey]: { VAREJO: v, MULTIMARCAS: v, ... } }
  const [overrides, setOverrides] = useState({});
  // CREDEV por canal (só visualização): { [colKey]: { varejo, multimarcas, ... } }
  const [credevCanais, setCredevCanais] = useState({});
  // Rubricas da folha por coluna (abrir Pessoal Fixo): { [colKey]: [{desc,tipo,qtd,valor}] }
  const [rubricasFolha, setRubricasFolha] = useState({});
  // Proventos dos empregados (sem pró-labore) e pró-labore editável por coluna
  const [pfFixo, setPfFixo] = useState({}); // proventos fixos por coluna
  const [pfVariavel, setPfVariavel] = useState({}); // proventos variáveis (comissão)
  const [prolabore, setProlabore] = useState({});
  const [editandoProl, setEditandoProl] = useState(null); // col sendo editada
  // CMV % editável por mês (Niziany 30/10): fração negativa (ex.: -0.335).
  // Sem override usa o % da planilha (linha CMV %). Ao editar, CMV = % × ROL.
  const [cmvPct, setCmvPct] = useState({}); // { [colKey]: pct }
  const [editandoCmv, setEditandoCmv] = useState(null); // col sendo editada
  // Valores editados nos meses de previsão: { [colKey]: { [label]: valor } }
  const [edicoesPrev, setEdicoesPrev] = useState({});
  const [editandoPrev, setEditandoPrev] = useState(null); // 'label|col'
  // Corte de custo: edições e facas próprias, separadas do Forecast
  const [edicoesCorte, setEdicoesCorte] = useState({});
  const [facas, setFacas] = useState({}); // { [colKey]: [{ linha, chave, nome, valor }] }
  const enviarCorte = (corpo) =>
    fetch(`${API_BASE_URL}/api/forecast-dre/corte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }).catch(() => {});
  const estaCortado = (col, linha, chave) =>
    (facas[col] || []).some((f) => f.linha === linha && f.chave === chave);
  const alternarFaca = (col, linha, chave, nome, valor) => {
    const ativo = !estaCortado(col, linha, chave);
    setFacas((p) => {
      const lista = (p[col] || []).filter((f) => !(f.linha === linha && f.chave === chave));
      if (ativo) lista.push({ linha, chave, nome, valor });
      return { ...p, [col]: lista };
    });
    enviarCorte({ tipo: 'faca', mes: colParaMes(colunas.find((c) => c.key === col)), linha, chave, nome, valor, ativo });
  };
  // Botão da faca (só no Corte de custo). valor = como entra na DRE (despesa negativa).
  const faca = (col, linha, chave, nome, valor) => {
    if (!modoCorte || !col || modoSel) return null;
    const cortado = estaCortado(col, linha, chave);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alternarFaca(col, linha, chave, nome, Number(valor) || 0);
        }}
        title={cortado ? 'Cortado: fora do cálculo (clique para desfazer)' : 'Cortar: tira este valor do cálculo'}
        className={
          'inline-flex items-center justify-center rounded p-0.5 ml-1 align-middle ' +
          (cortado ? 'bg-red-100 text-red-600' : 'text-gray-300 hover:text-red-500')
        }
      >
        <Knife size={11} weight={cortado ? 'fill' : 'regular'} />
      </button>
    );
  };
  const salvarEdicaoPrev = (col, mes, label, valor) => {
    if (mes.startsWith('2027-') && LINHAS_RECEITA_2027.includes(label)) {
      const outra = LINHAS_RECEITA_2027.find((x) => x !== label);
      gravarEdicaoPrev(col, mes, outra, valor);
    }
    gravarEdicaoPrev(col, mes, label, valor);
  };
  const gravarEdicaoPrev = (col, mes, label, valor) => {
    if (modoCorte) {
      setEdicoesCorte((p) => {
        const doMes = { ...(p[col] || {}) };
        if (valor === null) delete doMes[label];
        else doMes[label] = valor;
        return { ...p, [col]: doMes };
      });
      enviarCorte({ tipo: 'edicao', mes, linha: label, valor, ativo: valor !== null });
      return;
    }
    setEdicoesPrev((p) => {
      const doMes = { ...(p[col] || {}) };
      if (valor === null) delete doMes[label];
      else doMes[label] = valor;
      return { ...p, [col]: doMes };
    });
    fetch(`${API_BASE_URL}/api/forecast-dre/previsao-manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, linha: label, valor }),
    }).catch(() => {});
  };
  const salvarCmvPct = (col, mes, pct) => {
    setCmvPct((p) => ({ ...p, [col]: pct }));
    fetch(`${API_BASE_URL}/api/forecast-dre/cmv-pct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, pct }),
    }).catch(() => {});
  };
  // Qual MÊS (coluna) está aberto em cada linha de despesa expansível
  // (Pessoal Fixo/Variável, PJ, Ocupação, Serviços de Terceiros Fixos).
  // Clica na célula do mês → abre só aquele mês. { [label]: colKey | null }
  const [mesAberto, setMesAberto] = useState({});
  const abrirMes = (label, col) =>
    setMesAberto((p) => ({ ...p, [label]: p[label] === col ? null : col }));
  const salvarProlabore = (col, mes, valor) => {
    setProlabore((p) => ({ ...p, [col]: valor }));
    fetch(`${API_BASE_URL}/api/forecast-dre/prolabore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, valor }),
    }).catch(() => {});
  };
  // Despesa de PJ (linha PJ): total por coluna e nomes dos contratados
  const [pjLinha, setPjLinha] = useState({}); // { [colKey]: total (negativo) }
  const [pjNomes, setPjNomes] = useState({}); // { [colKey]: [{nome, valor}] }
  // Despesa de OCUPAÇÃO (linha OCUPAÇÃO): total por coluna e por filial
  const [ocupLinha, setOcupLinha] = useState({}); // { [colKey]: total (negativo) }
  const [ocupFiliais, setOcupFiliais] = useState({}); // { [colKey]: [{nome, valor}] }
  // Despesa de MARKETING (Propaganda e Anúncios do Contas a Pagar)
  const [mktLinha, setMktLinha] = useState({}); // { [colKey]: total (negativo) } — PROPAGANDA E ANÚNCIO
  const [mktLanc, setMktLanc] = useState({}); // { [colKey]: [{forn, venc, valor}] }
  // Subitem TRÁFEGO do Marketing (Forecast de Mídia do Dryland)
  const [trafegoLinha, setTrafegoLinha] = useState({}); // { [colKey]: total (negativo) }
  const [trafegoItens, setTrafegoItens] = useState({}); // { [colKey]: [{canal, nome, valor}] }
  // PERDAS COM INADIMPLÊNCIA (Dashboard Inadimplência, mês específico)
  // RECEITA FINANCEIRA (tela Receita Financeira do Contas a Receber)
  const [recFinLinha, setRecFinLinha] = useState({}); // { [colKey]: valor (positivo) }
  // FRETES (custo do Financeiro/Frete do Dryland)
  const [freteLinha, setFreteLinha] = useState({}); // { [colKey]: total (negativo) }
  const [freteCanais, setFreteCanais] = useState({}); // { [colKey]: [{nome, valor, envios}] }
  // JUROS E MULTA POR ATRASO (natureza 7005 paga no mês)
  const [jurosLinha, setJurosLinha] = useState({}); // { [colKey]: total (negativo) }
  const [jurosLanc, setJurosLanc] = useState({}); // { [colKey]: [{forn, venc, valor}] }
  const [perdasLinha, setPerdasLinha] = useState({}); // { [colKey]: total (negativo) }
  const [perdasCanais, setPerdasCanais] = useState({}); // { [colKey]: [{nome, valor, titulos, clientes}] }
  // Importação da planilha de taxas de cartão (Niziany 30/10): por coluna,
  // { total, empresas:[{empresa, valor}] } — antecipação e taxa de cartão.
  const [impAntecip, setImpAntecip] = useState({});
  const [impCartao, setImpCartao] = useState({});
  const [importando, setImportando] = useState(false);
  const fileRef = useRef(null);
  // SERVIÇOS DE TERCEIROS FIXOS: lido do localStorage da DRE Analítica
  // (despesas-gerais-2026:v2). Mesmos números que a Niziany vê lá, com as
  // bonificações importadas manualmente — não dá pra reproduzir pelo backend.
  const [dreLocal, setDreLocal] = useState(null);
  const [servCatsAbertas, setServCatsAbertas] = useState(() => new Set());
  const toggleServCat = (cat) =>
    setServCatsAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  // Canais abertos para mostrar o CREDEV do canal (por label)
  const [canaisAbertos, setCanaisAbertos] = useState(() => new Set());
  const toggleCanal = (label) =>
    setCanaisAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  // Só 2026, visão mensal. Aplica o tipo (realizado/previsão) salvo.
  const colunas = useMemo(
    () =>
      base.colunas
        .filter((c) => c.grupo === 'mensal' && c.ano !== 2025)
        .map((c) => {
          const mes = colParaMes(c);
          const ov = mes && tipoOverrides[mes];
          if (!ov) return c;
          return { ...c, tipo: ov === 'previsao' ? 'forecast' : 'realizado' };
        })
        .concat(COLUNAS_ANO),
    [tipoOverrides],
  );
  const [visao2027, setVisao2027] = useState(false);
  const colunasTela = visao2027 ? COLUNAS_2027 : colunas;
  const grupos = useMemo(() => agruparColunas(colunasTela), [colunasTela]);
  const linhas = base.blocos.dre || [];

  // Estrutura pai → filhos: uma linha de nível 0 seguida de linhas de nível 1
  // é "pai" (expansível). Clicar nela recolhe/mostra os detalhes.
  // Agora com 3 níveis (Niziany 30/10): seção (0) → subgrupo (1) → item (2).
  // Recolher a seção esconde subgrupos e itens; recolher o subgrupo esconde
  // só os itens dele (paiId = quem abre/fecha direto, avoId = a seção).
  const estrutura = useMemo(() => {
    const info = linhas.map(() => ({ isPai: false, paiId: null, avoId: null }));
    let ultimoPai = null; // seção (nível 0)
    let ultimoSub = null; // subgrupo (nível 1)
    linhas.forEach((l, i) => {
      if (l.fmt === 'pct') return;
      if (l.nivel === 1) {
        if (ultimoPai != null) {
          info[i].paiId = linhas[ultimoPai].id;
          info[ultimoPai].isPai = true;
        }
        ultimoSub = i;
      } else if (l.nivel === 2) {
        if (ultimoSub != null) {
          info[i].paiId = linhas[ultimoSub].id;
          info[ultimoSub].isPai = true;
          info[i].avoId = ultimoPai != null ? linhas[ultimoPai].id : null;
        } else if (ultimoPai != null) {
          info[i].paiId = linhas[ultimoPai].id;
          info[ultimoPai].isPai = true;
        }
      } else {
        ultimoPai = i;
        ultimoSub = null;
      }
    });
    return info;
  }, [linhas]);

  // Totais calculados (Niziany, 28/10/2026):
  //   RECEITA LÍQUIDA = soma de todas as receitas por canal de venda
  //   RECEITA BRUTA   = soma dos canais + CREDEV (somado pelo valor ABSOLUTO,
  //                     independente do sinal — o CREDEV soma, não diminui)
  // Só recalcula a coluna que tem dados de canal; previsão sem canais (out–dez)
  // mantém o alvo da planilha.
  const totaisCalculados = useMemo(() => {
    const LINHAS_CANAIS = [
      'VAREJO', 'MULTIMARCAS', 'FRANQUIA', 'REVENDA', 'BAZAR',
      'FARDAMENTO', 'IMOBILIZADO', 'BLUECRED',
    ];
    const porLabel = {};
    for (const l of linhas) porLabel[l.label] = l;
    const valor = (label, col) => {
      const ov = overrides[col]?.[label];
      if (ov !== undefined) return ov;
      const l = porLabel[label];
      return l ? (l.valores[col] ?? 0) : 0;
    };
    const out = {};
    for (const c of colunas) {
      const soma = LINHAS_CANAIS.reduce((a, lab) => a + (valor(lab, c.key) || 0), 0);
      if (!soma) continue; // sem canais → mantém o estático (previsão)
      const credev = valor('CREDEV', c.key) || 0;
      out[c.key] = {
        'RECEITA LÍQUIDA': Math.round(soma * 100) / 100,
        'RECEITA BRUTA': Math.round((soma + Math.abs(credev)) * 100) / 100,
      };
    }
    return out;
  }, [colunas, overrides, linhas]);

  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const [telaCheia, setTelaCheia] = useState(false);
  const [carregandoAuto, setCarregandoAuto] = useState(false);

  const [rubricasAbertas, setRubricasAbertas] = useState(() => new Set());
  const toggleRubrica = (key) =>
    setRubricasAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const [empresasAbertas, setEmpresasAbertas] = useState(() => new Set());
  const toggleEmpresa = (key) =>
    setEmpresasAbertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // Rubricas da folha unidas por coluna (para abrir sob Pessoal Fixo).
  const rubricasUnidas = useMemo(() => {
    const map = new Map();
    for (const [col, lista] of Object.entries(rubricasFolha)) {
      for (const r of lista || []) {
        const key = r.tipo + '|' + r.desc;
        const e =
          map.get(key) ||
          {
            key,
            desc: r.desc,
            tipo: r.tipo,
            entra: r.entra !== false,
            grupo: r.grupo || 'fixo',
            porCol: {},
            funcPorCol: {},
            max: 0,
          };
        e.porCol[col] = r.valor;
        if (Array.isArray(r.funcionarios)) e.funcPorCol[col] = r.funcionarios;
        e.max = Math.max(e.max, Math.abs(Number(r.valor) || 0));
        map.set(key, e);
      }
    }
    return [...map.values()].sort((a, b) => b.max - a.max);
  }, [rubricasFolha]);

  // Valores editados na previsão, por mês → coluna
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/previsao-manual`);
        if (!r.ok) return;
        const j = await r.json();
        const ed = (j && j.data && j.data.edicoes) || {};
        if (cancelado) return;
        const novo = {};
        for (const c of [...colunas, ...MESES_2027]) {
          const mes = colParaMes(c);
          if (mes && ed[mes]) novo[c.key] = ed[mes];
        }
        setEdicoesPrev(novo);
      } catch {
        /* fica só com o espelho */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colunas]);

  // Corte de custo: edições e facas, por mês → coluna
  useEffect(() => {
    if (!modoCorte) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/corte`);
        if (!r.ok) return;
        const j = await r.json();
        const d = (j && j.data) || {};
        if (cancelado) return;
        const ed = {};
        const fc = {};
        for (const c of [...colunas, ...MESES_2027]) {
          const mes = colParaMes(c);
          if (mes && d.edicoes && d.edicoes[mes]) ed[c.key] = d.edicoes[mes];
          if (mes && d.facas && d.facas[mes]) fc[c.key] = d.facas[mes];
        }
        setEdicoesCorte(ed);
        setFacas(fc);
      } catch {
        /* fica igual ao Forecast */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colunas, modoCorte]);

  // CMV % salvo no backend por mês → coluna
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/cmv-pct`);
        if (!r.ok) return;
        const j = await r.json();
        const ov = (j && j.data && j.data.overrides) || {};
        if (cancelado) return;
        const novo = {};
        for (const c of colunas) {
          const mes = colParaMes(c);
          if (mes && typeof ov[mes] === 'number') novo[c.key] = ov[mes];
        }
        setCmvPct(novo);
      } catch {
        /* fica com o % da planilha */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colunas]);

  // Lê o estado da DRE Analítica (localStorage, mesmo do menu Despesas Gerais)
  // uma vez — é de onde sai a linha SERVIÇOS DE TERCEIROS FIXOS.
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem('despesas-gerais-2026:v2') ||
        localStorage.getItem('despesas-gerais-2026:v1');
      if (raw) setDreLocal(JSON.parse(raw));
    } catch {
      /* sem acesso ao localStorage: cai no número da planilha */
    }
  }, []);

  // SERVIÇOS DE TERCEIROS FIXOS por coluna realizada = todas as despesas da DRE
  // Analítica do mês, MENOS "Serviços Prestados por Terceiros" (já no PJ) e a
  // "Bonificação Marketing" (a outra bonificação fica). Abre por despesa →
  // lançamentos, igual à DRE Analítica.
  const servTerc = useMemo(() => {
    const out = {};
    const norm = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();
    for (const c of colunas) {
      if (c.grupo !== 'mensal' || c.tipo !== 'realizado') continue;
      const mk = String(c.label || '').slice(0, 3).toLowerCase();
      // Só set/2026 em diante — jan–ago ficam com o número da planilha.
      if (!c.ano || !MES_ABREV[mk]) continue;
      const mesStr = `${c.ano}-${String(MES_ABREV[mk]).padStart(2, '0')}`;
      if (mesStr < MES_AUTO_INICIO) continue;
      const tv = travas[mesStr];
      if (tv && tv.travado) {
        if (tv.snapshot && tv.snapshot.servTerc) out[c.key] = tv.snapshot.servTerc;
        continue; // mês travado: só o snapshot
      }
      if (!dreLocal || !dreLocal.months) continue;
      const mes = dreLocal.months[mk];
      if (!mes || !mes.details) continue;
      const categorias = [];
      let total = 0;
      for (const [cat, rows] of Object.entries(mes.details)) {
        const n = norm(cat);
        if (n === 'SERVICOS PRESTADOS POR TERCEIROS') continue; // já está no PJ
        if (/BONIFIC.*MARKETING/.test(n)) continue; // bonificação marketing fora
        if (/FRETE/.test(n)) continue; // frete fora (Niziany 29/10)
        const lanc = (rows || []).map((r) => ({
          forn: r.forn || '—',
          venc: r.venc || '',
          val: Number(r.val) || 0,
        }));
        const soma = lanc.reduce((a, x) => a + x.val, 0);
        if (!lanc.length) continue;
        total += soma;
        categorias.push({
          cat,
          valor: Math.round(soma * 100) / 100,
          lancamentos: lanc.sort((a, b) => b.val - a.val),
        });
      }
      categorias.sort((a, b) => b.valor - a.valor);
      out[c.key] = { total: Math.round(total * 100) / 100, categorias };
    }
    return out;
  }, [dreLocal, colunas, travas]);

  // BONIFICAÇÕES MARKETING (subitem do Marketing, Niziany 30/10): vem da DRE
  // Analítica (localStorage) — as categorias /BONIFIC.*MARKETING/, que ficam
  // FORA dos Serviços de Terceiros Fixos. Só set/2026 em diante.
  const bonifMkt = useMemo(() => {
    const out = {};
    for (const c of colunas) {
      if (c.grupo !== 'mensal' || c.tipo !== 'realizado') continue;
      const mk = String(c.label || '').slice(0, 3).toLowerCase();
      if (!c.ano || !MES_ABREV[mk]) continue;
      const mesStr = `${c.ano}-${String(MES_ABREV[mk]).padStart(2, '0')}`;
      if (mesStr < MES_AUTO_INICIO) continue;
      const tv = travas[mesStr];
      if (tv && tv.travado) {
        if (tv.snapshot && tv.snapshot.bonifMkt) out[c.key] = tv.snapshot.bonifMkt;
        continue; // mês travado: só o snapshot
      }
      if (!dreLocal || !dreLocal.months) continue;
      const mes = dreLocal.months[mk];
      if (!mes || !mes.details) continue;
      const lanc = [];
      for (const [cat, rows] of Object.entries(mes.details)) {
        const n = String(cat || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        if (!/BONIFIC.*MARKETING/.test(n)) continue;
        for (const r of rows || []) {
          lanc.push({ forn: r.forn || '—', venc: r.venc || '', valor: Number(r.val) || 0 });
        }
      }
      if (!lanc.length) continue;
      lanc.sort((a, b) => b.valor - a.valor);
      out[c.key] = { total: Math.round(lanc.reduce((a, x) => a + x.valor, 0) * 100) / 100, lanc };
    }
    return out;
  }, [dreLocal, colunas, travas]);
  const toggleRecolher = (id) =>
    setRecolhidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Carrega a config de meses (realizado/previsão) salva.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/forecast-dre/config`);
        if (!r.ok) return;
        const j = await r.json();
        const ov = (j?.data || j)?.overrides;
        if (!cancelado && ov && typeof ov === 'object') setTipoOverrides(ov);
        const tv = (j?.data || j)?.travas;
        if (!cancelado && tv && typeof tv === 'object') setTravas(tv);
      } catch {
        /* sem config → usa o padrão da planilha */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Alterna um mês entre Realizado e Previsão (clique no cabeçalho do mês).
  const alternarTipoMes = async (c) => {
    const mes = colParaMes(c);
    if (!mes || c.grupo !== 'mensal') return;
    const novo = c.tipo === 'realizado' ? 'previsao' : 'realizado';
    setTipoOverrides((p) => ({ ...p, [mes]: novo }));
    try {
      await fetch(`${API_BASE_URL}/api/forecast-dre/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, tipo: novo }),
      });
    } catch {
      /* falha ao salvar: fica só na sessão */
    }
  };

  // Previsão = espelho do último mês realizado (Niziany 30/10): cada mês em
  // previsão repete o realizado anterior. Se o CMV % do mês foi editado, o CMV e
  // os totais abaixo dele recalculam com esse %.
  const espelho = useMemo(() => {
    const out = {};
    let ultimo = null;
    for (const c of colunas) {
      if (c.tipo === 'realizado') ultimo = c;
      else if (ultimo) out[c.key] = ultimo;
    }
    if (ultimo) MESES_2027.forEach((c) => (out[c.key] = ultimo));
    return out;
  }, [colunas]);

  // Coluna com edições ou cortes: parte do valor normal, aplica o que mudou e
  // recalcula os totais. Sem mudança devolve null e a coluna fica como está.
  const cachePrevisao = {};
  const previsaoDe = (c) => {
    if (c.key in cachePrevisao) return cachePrevisao[c.key];
    const fonte = espelho[c.key];
    const ano = c.grupo === 'ano';
    const soma2026 = c.key === 'ANO2026'; // soma dos meses, inclusive os totais
    const anual = ano && !soma2026; // projeção × 12
    const mes2027 = c.grupo === 'mes2027';
    if (!fonte && (ano || !modoCorte)) return (cachePrevisao[c.key] = null);
    const ed = {
      ...(edicoesPrev[c.key] || {}),
      ...(modoCorte ? edicoesCorte[c.key] || {} : {}),
    };
    const listaFacas = modoCorte ? facas[c.key] || [] : [];
    if (
      !ano &&
      !mes2027 &&
      !Object.keys(ed).length &&
      !listaFacas.length &&
      ed['CMV %'] === undefined &&
      cmvPct[c.key] === undefined
    ) {
      return (cachePrevisao[c.key] = null);
    }
    const porLabel = Object.fromEntries(linhas.map((x) => [x.label, x]));
    const num = (v) => Number(v) || 0;
    const r2 = (v) => Math.round(v * 100) / 100;
    const direto = (label) => {
      const x = porLabel[label];
      if (!x) return undefined;
      return (fonte ? valorCelula(x, fonte) : valorBruto(x, c)).v;
    };
    const mesesAno = colunas.filter((x) => x.grupo === 'mensal');
    const somaMeses = (label) =>
      mesesAno.reduce((a, k) => a + num(valorCelula(porLabel[label], k).v), 0);
    const ehReceita = (label) => LINHAS_CANAIS_DRE.includes(label) || label === 'CREDEV';
    const base = (label) => {
      if (soma2026) return somaMeses(label);
      if (!anual) return direto(label);
      return ehReceita(label) ? somaMeses(label) : num(direto(label)) * 12;
    };
    const fracao = (a, b) => (num(direto(b)) ? num(direto(a)) / num(direto(b)) : 0);
    const proprio =
      ed['CMV %'] !== undefined
        ? ed['CMV %']
        : anual
          ? fracao('CUSTO DAS MERCADORIAS VENDIDAS', 'RECEITA OPERACIONAL LÍQUIDA')
          : fonte
            ? cmvPct[c.key]
            : undefined;
    // Ano: mês com total digitado sem canais também entra na receita do ano
    const somaCanaisBase = anual ? LINHAS_CANAIS_DRE.reduce((a, label) => a + num(base(label)), 0) : 0;
    const ajusteRL = anual ? somaMeses('RECEITA LÍQUIDA') - somaCanaisBase : 0;
    const ajusteRB = anual
      ? somaMeses('RECEITA BRUTA') - somaCanaisBase - Math.abs(num(base('CREDEV')))
      : 0;
    // Facas: linha inteira zera; item do detalhe sai da linha. Item cujo pai
    // também foi cortado não desconta duas vezes.
    const chaves = new Set(listaFacas.map((f) => f.linha + '|' + f.chave));
    const paiCortado = (f) => {
      const partes = f.chave.split('»');
      return partes.some((_, i) => i > 0 && chaves.has(f.linha + '|' + partes.slice(0, i).join('»')));
    };
    const edicoes = { ...ed };
    delete edicoes['CMV %'];
    for (const f of listaFacas) {
      if (!f.chave || paiCortado(f)) continue;
      edicoes[f.linha] = (edicoes[f.linha] ?? num(base(f.linha))) - num(f.valor);
    }
    for (const f of listaFacas) if (!f.chave) edicoes[f.linha] = 0;
    if (mes2027) {
      const receita = edicoes['RECEITA LÍQUIDA'] ?? edicoes['RECEITA BRUTA'] ?? direto('RECEITA LÍQUIDA');
      LINHAS_RECEITA_2027.forEach((label) => (edicoes[label] = receita));
    }

    const cadeia = (e, pctCmv) => {
      const m = {};
      const item = (label) => {
        m[label] = e[label] !== undefined ? e[label] : base(label);
        return num(m[label]);
      };
      const tot = (label, calculado) => {
        m[label] = e[label] !== undefined ? e[label] : r2(calculado);
        return num(m[label]);
      };
      const filho = (pai, filhos) => {
        const valores = filhos.map(item);
        const editou = filhos.some((f) => e[f] !== undefined);
        return tot(pai, editou ? valores.reduce((a, b) => a + b, 0) : num(base(pai)));
      };
      const canais = LINHAS_CANAIS_DRE.reduce((a, label) => a + item(label), 0);
      const credev = item('CREDEV');
      const rl = tot('RECEITA LÍQUIDA', canais + ajusteRL);
      tot('RECEITA BRUTA', canais + Math.abs(credev) + ajusteRB);
      const baseImp = num(base('IMPOSTOS DIRETOS'));
      const taxa =
        e['TAX %'] !== undefined
          ? e['TAX %']
          : anual
            ? fracao('IMPOSTOS DIRETOS', 'RECEITA LÍQUIDA')
            : undefined;
      const imp =
        e['IMPOSTOS DIRETOS'] !== undefined
          ? e['IMPOSTOS DIRETOS']
          : taxa !== undefined
            ? r2(taxa * rl)
            : baseImp;
      m['IMPOSTOS DIRETOS'] = imp;
      const mudouImposto = e['IMPOSTOS DIRETOS'] !== undefined || rl !== num(base('RECEITA LÍQUIDA'));
      m['TAX %'] = taxa !== undefined ? taxa : (mudouImposto || soma2026) && rl ? imp / rl : base('TAX %');
      const rol = tot('RECEITA OPERACIONAL LÍQUIDA', rl + imp);
      const baseCmv = num(base('CUSTO DAS MERCADORIAS VENDIDAS'));
      const cmvCalc = pctCmv !== undefined ? pctCmv * rol : baseCmv;
      const cmv = tot('CUSTO DAS MERCADORIAS VENDIDAS', cmvCalc);
      m['CMV %'] =
        e['CUSTO DAS MERCADORIAS VENDIDAS'] === undefined && pctCmv !== undefined
          ? pctCmv
          : rol
            ? cmv / rol
            : base('CMV %');
      const lb = tot('LUCRO BRUTO', rol + cmv);
      filho('MARKETING', ['PROPAGANDA E ANÚNCIO', 'TRÁFEGO', 'BONIFICAÇÕES MARKETING']);
      filho('SERVIÇOS DE TERCEIROS VARIÁVEIS', ['TAXA DE CARTÃO']);
      ['PESSOAL FIXO', 'PESSOAL VARIÁVEL', 'PJ', 'OCUPAÇÃO', 'SERVIÇOS DE TERCEIROS FIXOS', 'FRETES', 'PERDAS COM INADIMPLÊNCIA'].forEach(item);
      const sga = tot('COMERCIAIS, GERAIS E ADMINISTRATIVAS', LINHAS_SGA.reduce((a, label) => a + num(m[label]), 0));
      const oper = tot('RECEITAS (DESPESAS) OPERACIONAIS', sga);
      const lo = tot('LUCRO OPERACIONAL', lb + oper + item('OUTRAS (DESPESAS) RECEITAS'));
      tot('EBITDA', lo);
      const recFin = filho('RECEITA FINANCEIRA', ['RECEITA FINANCEIRA COM JUROS']);
      const despFin = filho('DESPESA FINANCEIRA', ['ANTECIPAÇÃO DE RECEBÍVEIS', 'JUROS E MULTA POR ATRASO']);
      const naoOp = tot('RECEITA (DESPESA) NÃO OPERACIONAL', recFin + despFin);
      const resFin = tot('RESULTADO FINANCEIRO', naoOp);
      const lair = tot('LUCRO ANTES DO IR E CS', lo + resFin);
      const ll = tot('LUCRO LÍQUIDO', lair + item('IMPOSTO DE RENDA E CONTRIBUIÇÃO SOCIAL'));
      tot('RESULTADO FINAL', ll + item('INVESTIMENTOS') + item('DISTRIBUIÇÃO LUCROS'));
      return m;
    };
    const m = cadeia(edicoes, proprio);
    // Mês cuja planilha não fecha com a fórmula: mantém a diferença original,
    // assim só o que foi editado ou cortado move os totais.
    const m0 = cadeia({}, undefined);
    for (const x of anual ? [] : linhas) {
      if (x.fmt === 'pct' || edicoes[x.label] !== undefined || !(x.label in m)) continue;
      if (x.label === 'CUSTO DAS MERCADORIAS VENDIDAS' && proprio !== undefined) continue;
      m[x.label] = r2(num(m[x.label]) + num(base(x.label)) - num(m0[x.label]));
    }
    const rol = num(m['RECEITA OPERACIONAL LÍQUIDA']);
    if (soma2026) {
      const rlAno = num(m['RECEITA LÍQUIDA']);
      if (ed['TAX %'] === undefined && rlAno) m['TAX %'] = num(m['IMPOSTOS DIRETOS']) / rlAno;
      if (ed['CMV %'] === undefined && rol) m['CMV %'] = num(m['CUSTO DAS MERCADORIAS VENDIDAS']) / rol;
    }
    m['MARGEM %'] = rol ? num(m['LUCRO BRUTO']) / rol : base('MARGEM %');
    m['EBITDA %'] = rol ? num(m.EBITDA) / rol : base('EBITDA %');
    m['% LUCRO LÍQUIDO'] = rol ? num(m['LUCRO LÍQUIDO']) / rol : base('% LUCRO LÍQUIDO');
    return (cachePrevisao[c.key] = m);
  };

  // Valor exibido de uma linha numa coluna (tela e Excel usam a mesma conta).
  const valorCelula = (l, c) => {
    if (c.grupo === 'total2027') {
      const somaLinha = (x) => MESES_2027.reduce((a, m) => a + (Number(valorCelula(x, m).v) || 0), 0);
      const razao = PCT_RAZAO[l.label];
      if (!razao) return { v: somaLinha(l), auto: false };
      const [a, b] = razao.map((label) => somaLinha(linhas.find((x) => x.label === label)));
      return { v: b ? a / b : 0, auto: false };
    }
    const fonte = espelho[c.key];
    const base = fonte ? valorCelula(l, fonte) : valorBruto(l, c);
    const m = previsaoDe(c);
    if (!m || !(l.label in m)) return base;
    return { ...base, v: m[l.label] };
  };
  const valorBruto = (l, c) => {
    let pfLine = valorAuto(l.label, c.key);
    // Linhas calculadas (só célula vazia na planilha, colunas mensais)
    const resultadoCalc =
      c.grupo === 'mensal' &&
      l.valores[c.key] == null &&
      (l.label === 'RESULTADO FINANCEIRO' || l.label === 'RESULTADO FINAL');
    if (resultadoCalc) {
      const bruto =
        l.label === 'RESULTADO FINANCEIRO' ? valResultadoFinanceiro(c.key) : valResultadoFinal(c.key);
      pfLine = Math.round(bruto * 100) / 100;
    }
    // Mês automático realizado: totais recalculados a partir das linhas de cima
    if (colsCadeia.has(c.key)) {
      const recalculado = cadeiaDre(c.key)[l.label];
      if (recalculado !== undefined) pfLine = recalculado;
    }
    const ovr = overrides[c.key]?.[l.label];
    const calc = totaisCalculados[c.key]?.[l.label];
    const auto = pfLine !== undefined || ovr !== undefined;
    const v =
      pfLine !== undefined
        ? pfLine
        : calc !== undefined
          ? calc
          : ovr !== undefined
            ? ovr
            : l.valores[c.key];
    return { v, auto, calc, resultadoCalc };
  };

  // ── Exportar Excel (Niziany 30/10) ────────────────────────────────────────
  // Mesmos valores da tela, com o detalhe das despesas em níveis recolhíveis.
  // Detalhe de uma linha: [{ label, nivel, valores: { [colKey]: número } }]
  const detalhesLinha = (l) => {
    const porNome = (fonte, nomeDe, valorDe) => {
      const m = new Map();
      for (const [col, lista] of Object.entries(fonte)) {
        (lista || []).forEach((it) => {
          const nome = nomeDe(it);
          const e = m.get(nome) || { label: nome, nivel: 1, valores: {} };
          e.valores[col] = (e.valores[col] || 0) + valorDe(it);
          m.set(nome, e);
        });
      }
      return [...m.values()];
    };
    // Lançamentos ficam separados, um por linha, como na tela.
    const lancamentos = (fonte, nivel = 1) => {
      const out = [];
      for (const [col, lista] of Object.entries(fonte)) {
        (lista || []).forEach((x) => {
          out.push({
            label: x.forn + (x.venc ? ` · ${x.venc}` : ''),
            nivel,
            valores: { [col]: -(Number(x.valor ?? x.val) || 0) },
          });
        });
      }
      return out;
    };
    const negativo = (it) => -(Number(it.valor) || 0);
    const soLista = (obj, campo) =>
      Object.fromEntries(Object.entries(obj).map(([col, d]) => [col, (d && d[campo]) || []]));

    if (l.label === 'PESSOAL FIXO' || l.label === 'PESSOAL VARIÁVEL') {
      const grupo = l.label === 'PESSOAL FIXO' ? 'fixo' : 'variavel';
      const out = [];
      if (grupo === 'fixo') {
        const valores = {};
        Object.keys(pfFixo).forEach((col) => {
          valores[col] = prolabore[col] ?? 80000;
        });
        out.push({ label: 'PRÓ-LABORE (DIRETORES)', nivel: 1, valores, peso: -1 });
      }
      rubricasUnidas
        .filter((r) => r.grupo === grupo)
        .forEach((ru) => {
          // Provento é despesa na DRE; rubrica que não entra não soma
          const peso = !ru.entra ? 0 : ru.tipo === 'provento' ? -1 : 1;
          out.push({ label: ru.desc, nivel: 1, valores: { ...ru.porCol }, peso });
          const lojas = new Map();
          for (const [col, lista] of Object.entries(ru.funcPorCol)) {
            (lista || []).forEach((f) => {
              const nomeLoja = f.loja || '— sem seção —';
              const lj = lojas.get(nomeLoja) || { valores: {}, funcs: new Map() };
              lj.valores[col] = (lj.valores[col] || 0) + (Number(f.valor) || 0);
              const fk = (f.chapa || '') + '|' + f.nome;
              const fe = lj.funcs.get(fk) || {
                label: f.funcao ? `${f.nome} · ${f.funcao}` : f.nome,
                valores: {},
              };
              fe.valores[col] = Number(f.valor) || 0;
              lj.funcs.set(fk, fe);
              lojas.set(nomeLoja, lj);
            });
          }
          for (const [nomeLoja, lj] of lojas) {
            out.push({ label: nomeLoja, nivel: 2, valores: lj.valores });
            for (const fe of lj.funcs.values()) out.push({ ...fe, nivel: 3 });
          }
        });
      return out;
    }
    if (l.label === 'SERVIÇOS DE TERCEIROS FIXOS') {
      const cats = new Map();
      for (const [col, d] of Object.entries(servTerc)) {
        (d.categorias || []).forEach((cg) => {
          const e = cats.get(cg.cat) || { valores: {}, lanc: {} };
          e.valores[col] = -(Number(cg.valor) || 0);
          e.lanc[col] = cg.lancamentos;
          cats.set(cg.cat, e);
        });
      }
      const out = [];
      for (const [cat, e] of cats) {
        out.push({ label: cat, nivel: 1, valores: e.valores });
        out.push(...lancamentos(e.lanc, 2));
      }
      return out;
    }
    if (l.label === 'PJ') return porNome(pjNomes, (x) => x.nome, negativo);
    if (l.label === 'OCUPAÇÃO') return porNome(ocupFiliais, (x) => x.nome, negativo);
    if (l.label === 'PERDAS COM INADIMPLÊNCIA') return porNome(perdasCanais, (x) => x.nome, negativo);
    if (l.label === 'FRETES') return porNome(freteCanais, (x) => x.nome, negativo);
    if (l.label === 'TRÁFEGO') return porNome(trafegoItens, (x) => x.nome, negativo);
    if (l.label === 'ANTECIPAÇÃO DE RECEBÍVEIS')
      return porNome(soLista(impAntecip, 'empresas'), (x) => x.empresa, negativo);
    if (l.label === 'TAXA DE CARTÃO')
      return porNome(soLista(impCartao, 'empresas'), (x) => x.empresa, negativo);
    if (l.label === 'PROPAGANDA E ANÚNCIO') return lancamentos(mktLanc);
    if (l.label === 'BONIFICAÇÕES MARKETING') return lancamentos(soLista(bonifMkt, 'lanc'));
    if (l.label === 'JUROS E MULTA POR ATRASO') return lancamentos(jurosLanc);
    return [];
  };

  // Seleção de células com soma (Niziany 30/10): botão liga o modo; ligado, o
  // clique seleciona em vez de editar ou abrir o detalhe.
  const [modoSel, setModoSel] = useState(false);
  const [selCel, setSelCel] = useState(() => new Set()); // 'indiceLinha|colKey'
  const arrastoSel = useRef(null);
  const chaveSel = (idx, col) => idx + '|' + col;
  const linhaVisivel = (idx) => {
    const info = estrutura[idx];
    if (visao2027 && OCULTAS_2027.has(linhas[idx].label)) return false;
    return !(
      (info.paiId && recolhidos.has(info.paiId)) ||
      (info.avoId && recolhidos.has(info.avoId))
    );
  };
  const iniciarArrasto = (idx, i) => {
    const chave = chaveSel(idx, colunasTela[i].key);
    const base = new Set(selCel);
    const adiciona = !base.has(chave);
    arrastoSel.current = { idx, i, base, adiciona };
    if (adiciona) base.add(chave);
    else base.delete(chave);
    setSelCel(new Set(base));
  };
  const continuarArrasto = (idx, i) => {
    const a = arrastoSel.current;
    if (!a) return;
    const novo = new Set(a.base);
    for (let r = Math.min(a.idx, idx); r <= Math.max(a.idx, idx); r++) {
      if (!linhaVisivel(r)) continue;
      for (let k = Math.min(a.i, i); k <= Math.max(a.i, i); k++) {
        const chave = chaveSel(r, colunasTela[k].key);
        if (a.adiciona) novo.add(chave);
        else novo.delete(chave);
      }
    }
    setSelCel(novo);
  };
  // Linha ou mês inteiro: clique marca; se já estava tudo marcado, desmarca.
  const alternarGrupoSel = (chaves) => {
    setSelCel((p) => {
      const novo = new Set(p);
      const todas = chaves.every((k) => novo.has(k));
      chaves.forEach((k) => (todas ? novo.delete(k) : novo.add(k)));
      return novo;
    });
  };
  const selecionarLinha = (idx) => alternarGrupoSel(colunasTela.map((c) => chaveSel(idx, c.key)));
  const selecionarMes = (col) =>
    alternarGrupoSel(linhas.map((_, idx) => idx).filter(linhaVisivel).map((idx) => chaveSel(idx, col)));
  useEffect(() => {
    const soltar = () => {
      arrastoSel.current = null;
    };
    window.addEventListener('mouseup', soltar);
    return () => window.removeEventListener('mouseup', soltar);
  }, []);
  const resumoSel = () => {
    let soma = 0;
    let qtd = 0;
    let ignoradas = 0;
    for (const chave of selCel) {
      const sep = chave.indexOf('|');
      const l = linhas[Number(chave.slice(0, sep))];
      const c = colunasTela.find((x) => x.key === chave.slice(sep + 1));
      if (!l || !c) continue;
      const v = valorCelula(l, c).v;
      if (l.fmt === 'pct') ignoradas++;
      else if (typeof v === 'number') {
        soma += v;
        qtd++;
      }
    }
    return { soma, qtd, ignoradas };
  };

  const [exportando, setExportando] = useState(false);
  const exportarExcel = async () => {
    try {
      setExportando(true);
      const { default: ExcelJS } = await import('exceljs');
      const { buffer } = await gerarForecastXlsx({
        ExcelJS,
        linhas: visao2027 ? linhas.filter((l) => !OCULTAS_2027.has(l.label)) : linhas,
        colunas: colunasTela,
        valorDe: (l) => Object.fromEntries(colunasTela.map((c) => [c.key, valorCelula(l, c).v])),
        detalhesDe: modoCorte || visao2027 ? () => [] : detalhesLinha,
        titulo: visao2027 ? 'Previsão 2027' : modoCorte ? 'Corte de custo' : 'DRE Forecast',
        tipoDe: tipoLinha,
        inicioSecao: INICIO_SECAO,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      a.download = `${modoCorte ? 'Corte_de_custo' : 'Forecast_DRE'}${visao2027 ? '_Previsao_2027' : ''}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      window.alert('Não consegui gerar o Excel: ' + (e.message || e));
    } finally {
      setExportando(false);
    }
  };

  // ── Travar mês (Niziany 30/10) ────────────────────────────────────────────
  const mesTravado = (c) => {
    const mes = colParaMes(c);
    return !!(mes && travas[mes] && travas[mes].travado);
  };
  const podeTravar = (c) => {
    const mes = colParaMes(c);
    return !!(!modoCorte && mes && c.grupo === 'mensal' && c.tipo === 'realizado' && mes >= MES_AUTO_INICIO);
  };
  const alternarTrava = async (c) => {
    const mes = colParaMes(c);
    if (!mes) return;
    const novo = !mesTravado(c);
    if (
      !window.confirm(
        novo
          ? `Travar ${c.label}? Os valores do mês ficam congelados: as automações param de atualizar e pró-labore, CMV % e importação ficam bloqueados.`
          : `Destravar ${c.label}? As automações voltam a atualizar esse mês.`,
      )
    )
      return;
    // snapshot das linhas que vêm do localStorage (DRE Analítica)
    const snapshot = novo
      ? { servTerc: servTerc[c.key] || null, bonifMkt: bonifMkt[c.key] || null }
      : null;
    try {
      const r = await fetch(`${API_BASE_URL}/api/forecast-dre/travar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, travado: novo, snapshot }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setTravas((p) => {
        const n = { ...p };
        if (novo) n[mes] = { travado: true, snapshot };
        else delete n[mes];
        return n;
      });
      if (!novo) setRefetchTick((t) => t + 1);
    } catch (e) {
      window.alert(`Não consegui ${novo ? 'travar' : 'destravar'} o mês: ${e.message}`);
    }
  };

  // ── Atualizar dados nas fontes originais (Niziany 30/10) ──────────────────
  // Dispara o recálculo (refresh=1, roda em background no servidor) pros meses
  // automáticos não travados e vai relendo a cada 20 s até a folha (pessoal-fixo)
  // ter um calculado_em novo — a receita (New Forecast) pode demorar mais e
  // entra nas releituras seguintes.
  const atualizarDados = async () => {
    const alvos = mesesAutomaticos(colunas).filter(({ mes }) => !(travas[mes] && travas[mes].travado));
    if (!alvos.length) {
      window.alert('Nenhum mês automático destravado pra atualizar (marque o mês como realizado e sem cadeado).');
      return;
    }
    if (
      !window.confirm(
        `Atualizar ${alvos.map((a) => a.mes).join(', ')} nas fontes originais (vendas, Dryland, Contas a Pagar…)? Pode levar alguns minutos.`,
      )
    )
      return;
    setAtualizando(true);
    const inicio = Date.now();
    try {
      await Promise.all(
        alvos.flatMap(({ mes }) => [
          fetch(`${API_BASE_URL}/api/forecast-dre/receita-canais?mes=${mes}&refresh=1`).catch(() => null),
          fetch(`${API_BASE_URL}/api/forecast-dre/pessoal-fixo?mes=${mes}&refresh=1`).catch(() => null),
        ]),
      );
      const limite = inicio + 15 * 60 * 1000;
      const prontos = new Set();
      while (Date.now() < limite && prontos.size < alvos.length) {
        await new Promise((ok) => setTimeout(ok, 20000));
        for (const { mes } of alvos) {
          if (prontos.has(mes)) continue;
          try {
            const r = await fetch(`${API_BASE_URL}/api/forecast-dre/pessoal-fixo?mes=${mes}`);
            const j = await r.json();
            const d = j?.data || j;
            const em = d && d.calculado_em ? Date.parse(d.calculado_em) : 0;
            if (em >= inicio) prontos.add(mes);
          } catch {
            /* tenta de novo no próximo ciclo */
          }
        }
        setRefetchTick((t) => t + 1);
      }
      setRefetchTick((t) => t + 1);
      window.alert(
        prontos.size === alvos.length
          ? 'Dados atualizados nas fontes originais. A receita de vendas pode levar mais alguns minutos — a tela relê sozinha ao recarregar.'
          : 'Atualização disparada; alguns meses ainda estão recalculando no servidor. Dá um Ctrl+Shift+R daqui a alguns minutos.',
      );
    } finally {
      setAtualizando(false);
    }
  };

  // Valor da planilha (estático) de uma linha numa coluna — usado pra recompor
  // os pais quando um filho é sobrescrito pela importação.
  const estatico = (label, col) => {
    const r = linhas.find((x) => x.label === label);
    return Number(r?.valores?.[col]) || 0;
  };
  // Filhos da Despesa financeira: valor automático quando há, senão a planilha.
  const valAntecip = (col) =>
    impAntecip[col] !== undefined
      ? -(impAntecip[col].total || 0)
      : estatico('ANTECIPAÇÃO DE RECEBÍVEIS', col);
  const valRecFin = (col) =>
    recFinLinha[col] !== undefined ? recFinLinha[col] : estatico('RECEITA FINANCEIRA', col);
  const valJuros = (col) =>
    jurosLinha[col] !== undefined ? jurosLinha[col] : estatico('JUROS E MULTA POR ATRASO', col);
  // Linhas calculadas só onde a planilha está vazia: Resultado Financeiro =
  // Receita + Despesa financeira; Resultado Final = Lucro Líquido + Investimentos
  // + Distribuição de Lucros (fórmula da própria planilha).
  const valResultadoFinanceiro = (col) => valRecFin(col) + valAntecip(col) + valJuros(col);
  const valResultadoFinal = (col) =>
    estatico('LUCRO LÍQUIDO', col) + estatico('INVESTIMENTOS', col) + estatico('DISTRIBUIÇÃO LUCROS', col);
  // Valor automático de uma linha numa coluna (undefined = usa a planilha).
  const valorAuto = (label, col) => {
    // Pessoal Fixo = fixos + pró-labore; Variável = comissão
    let pfLine;
    if (label === 'PESSOAL FIXO' && pfFixo[col] !== undefined) {
      pfLine =
        -Math.round(
          ((pfFixo[col] || 0) + (prolabore[col] || 0)) * 100,
        ) / 100;
    } else if (
      label === 'PESSOAL VARIÁVEL' &&
      pfVariavel[col] !== undefined
    ) {
      pfLine = -Math.round((pfVariavel[col] || 0) * 100) / 100;
    } else if (label === 'PJ' && pjLinha[col] !== undefined) {
      pfLine = pjLinha[col];
    } else if (
      label === 'OCUPAÇÃO' &&
      ocupLinha[col] !== undefined
    ) {
      pfLine = ocupLinha[col];
    } else if (
      label === 'PROPAGANDA E ANÚNCIO' &&
      mktLinha[col] !== undefined
    ) {
      pfLine = mktLinha[col];
    } else if (label === 'TRÁFEGO' && trafegoLinha[col] !== undefined) {
      pfLine = trafegoLinha[col];
    } else if (
      label === 'BONIFICAÇÕES MARKETING' &&
      bonifMkt[col] !== undefined
    ) {
      pfLine = -Math.round((bonifMkt[col].total || 0) * 100) / 100;
    } else if (label === 'CMV %' && cmvPct[col] !== undefined) {
      pfLine = cmvPct[col];
    } else if (
      label === 'CUSTO DAS MERCADORIAS VENDIDAS' &&
      cmvPct[col] !== undefined
    ) {
      // CMV = % editado × Receita Operacional Líquida (calculada ou da planilha)
      const rol =
        totaisCalculados[col]?.['RECEITA OPERACIONAL LÍQUIDA'] ??
        estatico('RECEITA OPERACIONAL LÍQUIDA', col);
      pfLine = Math.round(cmvPct[col] * rol * 100) / 100;
    } else if (label === 'TAXA DE CARTÃO' && impCartao[col] !== undefined) {
      pfLine = -Math.round((impCartao[col].total || 0) * 100) / 100;
    } else if (
      label === 'SERVIÇOS DE TERCEIROS VARIÁVEIS' &&
      impCartao[col] !== undefined
    ) {
      // = soma do subnível (só Taxa de cartão por enquanto)
      pfLine = -Math.round((impCartao[col].total || 0) * 100) / 100;
    } else if (
      label === 'ANTECIPAÇÃO DE RECEBÍVEIS' &&
      impAntecip[col] !== undefined
    ) {
      pfLine = -Math.round((impAntecip[col].total || 0) * 100) / 100;
    } else if (
      (label === 'RECEITA FINANCEIRA' || label === 'RECEITA FINANCEIRA COM JUROS') &&
      recFinLinha[col] !== undefined
    ) {
      pfLine = recFinLinha[col];
    } else if (label === 'FRETES' && freteLinha[col] !== undefined) {
      pfLine = freteLinha[col];
    } else if (label === 'JUROS E MULTA POR ATRASO' && jurosLinha[col] !== undefined) {
      pfLine = jurosLinha[col];
    } else if (
      label === 'DESPESA FINANCEIRA' &&
      (impAntecip[col] !== undefined || jurosLinha[col] !== undefined)
    ) {
      // = Antecipação de recebíveis + Juros e multa por atraso
      pfLine = Math.round((valAntecip(col) + valJuros(col)) * 100) / 100;
    } else if (
      label === 'RECEITA (DESPESA) NÃO OPERACIONAL' &&
      (impAntecip[col] !== undefined ||
        jurosLinha[col] !== undefined ||
        recFinLinha[col] !== undefined)
    ) {
      // = Receita financeira + Despesa financeira recomposta
      pfLine =
        Math.round((valRecFin(col) + valAntecip(col) + valJuros(col)) * 100) / 100;
    } else if (
      label === 'PERDAS COM INADIMPLÊNCIA' &&
      perdasLinha[col] !== undefined
    ) {
      pfLine = perdasLinha[col];
    } else if (
      label === 'MARKETING' &&
      (mktLinha[col] !== undefined ||
        trafegoLinha[col] !== undefined ||
        bonifMkt[col] !== undefined)
    ) {
      // Marketing = Propaganda e anúncio + Tráfego + Bonificações marketing
      pfLine =
        Math.round(
          ((mktLinha[col] || 0) +
            (trafegoLinha[col] || 0) -
            (bonifMkt[col]?.total || 0)) *
            100,
        ) / 100;
    } else if (
      label === 'SERVIÇOS DE TERCEIROS FIXOS' &&
      servTerc[col] !== undefined
    ) {
      pfLine = -Math.round((servTerc[col].total || 0) * 100) / 100;
    }
    return pfLine;
  };

  // Cadeia da DRE recalculada (Niziany 30/10), só nos meses automáticos realizados
  // (set/2026 em diante): cada total parte das linhas de cima, sem o snapshot da
  // planilha. Fórmulas conferidas com os valores estáticos dela.
  const colsCadeia = useMemo(
    () => new Set(mesesAutomaticos(colunas).map((a) => a.col)),
    [colunas],
  );
  const valorLinha = (label, col) => {
    const a = valorAuto(label, col);
    return a !== undefined ? a : estatico(label, col);
  };
  const cadeiaDre = (col, cmvProprio) => {
    const r2 = (x) => Math.round(x * 100) / 100;
    const rl = totaisCalculados[col]?.['RECEITA LÍQUIDA'] ?? estatico('RECEITA LÍQUIDA', col);
    const rol = rl + estatico('IMPOSTOS DIRETOS', col);
    const pctCmv = cmvProprio !== undefined ? cmvProprio : cmvPct[col];
    const cmv = pctCmv !== undefined ? pctCmv * rol : estatico('CUSTO DAS MERCADORIAS VENDIDAS', col);
    const lb = rol + cmv;
    const sga = LINHAS_SGA.reduce((a, label) => a + valorLinha(label, col), 0);
    const lo = lb + sga + estatico('OUTRAS (DESPESAS) RECEITAS', col);
    const lair = lo + valResultadoFinanceiro(col);
    const ll = lair + estatico('IMPOSTO DE RENDA E CONTRIBUIÇÃO SOCIAL', col);
    const pct = (x) => (rol ? x / rol : 0);
    return {
      'RECEITA OPERACIONAL LÍQUIDA': r2(rol),
      'CUSTO DAS MERCADORIAS VENDIDAS': r2(cmv),
      'LUCRO BRUTO': r2(lb),
      'MARGEM %': pct(lb),
      'RECEITAS (DESPESAS) OPERACIONAIS': r2(sga),
      'COMERCIAIS, GERAIS E ADMINISTRATIVAS': r2(sga),
      'LUCRO OPERACIONAL': r2(lo),
      EBITDA: r2(lo),
      'EBITDA %': pct(lo),
      'LUCRO ANTES DO IR E CS': r2(lair),
      'LUCRO LÍQUIDO': r2(ll),
      '% LUCRO LÍQUIDO': pct(ll),
      'RESULTADO FINAL': r2(
        ll + estatico('INVESTIMENTOS', col) + estatico('DISTRIBUIÇÃO LUCROS', col),
      ),
    };
  };

  // ── Importar planilha de taxas de cartão (Niziany 30/10) ──────────────────
  // Arquivo mensal "PAINEL DRE — TAXAS DE CARTÃO": o mês vem do título da aba
  // "Painel DRE"; a aba "Painel por Empresa" traz, por empresa (linhas
  // "► TOTAL …"), TAXA DE CARTÃO e TAXA DE ANTECIPAÇÃO. Só manda os totais por
  // empresa pro backend; reimportar o mesmo mês substitui a importação anterior.
  const MESES_PT = {
    janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const lerNumero = (v) => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const t = String(v).trim();
    const n = Number(/^-?[\d.]+,\d+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtBRL2 = (v) =>
    (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const importarPlanilha = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      setImportando(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const abaEmp = wb.Sheets['Painel por Empresa'];
      if (!abaEmp) throw new Error('Não achei a aba "Painel por Empresa" nessa planilha.');
      let mes = null;
      const abaDre = wb.Sheets['Painel DRE'];
      if (abaDre) {
        const m1 = XLSX.utils.sheet_to_json(abaDre, { header: 1, blankrows: false, defval: '' });
        const titulo = String((m1[0] && m1[0][0]) || '');
        const m = titulo.match(/([A-Za-zÇç]+)\s*\/\s*(\d{4})\s*$/);
        const num = m && MESES_PT[m[1].toLowerCase()];
        if (num) mes = `${m[2]}-${String(num).padStart(2, '0')}`;
      }
      if (!mes) {
        const dig = window.prompt('Não achei o mês no título da planilha. Informe o mês (AAAA-MM):', '');
        if (!dig || !/^\d{4}-\d{2}$/.test(dig.trim())) throw new Error('Mês não informado.');
        mes = dig.trim();
      }
      if (travas[mes] && travas[mes].travado) {
        throw new Error(`O mês ${mes} está travado — destrave no cadeado do mês pra importar.`);
      }
      const mat = XLSX.utils.sheet_to_json(abaEmp, { header: 1, blankrows: false, defval: '' });
      const up = (v) => String(v || '').trim().toUpperCase();
      const hi = mat.findIndex((r) => r.some((c) => up(c) === 'EMPRESA'));
      if (hi < 0) throw new Error('Não achei o cabeçalho EMPRESA na aba "Painel por Empresa".');
      const hdr = mat[hi].map(up);
      const iE = hdr.indexOf('EMPRESA');
      const iA = hdr.indexOf('ADQUIRENTE');
      const iC = hdr.indexOf('TAXA DE CARTÃO');
      const iT = hdr.indexOf('TAXA DE ANTECIPAÇÃO');
      if (iE < 0 || iC < 0 || iT < 0) {
        throw new Error('Cabeçalho sem EMPRESA / TAXA DE CARTÃO / TAXA DE ANTECIPAÇÃO.');
      }
      const emp = [];
      for (const r of mat.slice(hi + 1)) {
        const e = String(r[iE] || '').trim();
        if (!e || up(e).startsWith('TOTAL')) continue;
        const a = iA >= 0 ? String(r[iA] || '').trim() : '';
        if (a && !a.startsWith('►') && !up(a).startsWith('TOTAL')) continue;
        emp.push({ empresa: e, cartao: lerNumero(r[iC]), antecip: lerNumero(r[iT]) });
      }
      if (!emp.length) throw new Error('Nenhuma empresa encontrada na aba "Painel por Empresa".');
      const totC = emp.reduce((a, x) => a + x.cartao, 0);
      const totA = emp.reduce((a, x) => a + x.antecip, 0);
      const ok = window.confirm(
        `Importar "${file.name}" para ${mes}?\n\n` +
          `Taxa de cartão → Serviços de Terceiros Variáveis: R$ ${fmtBRL2(totC)}\n` +
          `Taxa de antecipação → Antecipação de recebíveis: R$ ${fmtBRL2(totA)}\n\n` +
          `Empresas: ${emp.map((x) => x.empresa).join(', ')}\n\n` +
          'Isso substitui uma importação anterior do mesmo mês.',
      );
      if (!ok) return;
      const resp = await fetch(`${API_BASE_URL}/api/forecast-dre/importacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes,
          arquivo: file.name,
          linhas: {
            taxa_antecipacao: emp.map((x) => ({ empresa: x.empresa, valor: x.antecip })),
            taxa_cartao: emp.map((x) => ({ empresa: x.empresa, valor: x.cartao })),
          },
        }),
      });
      if (!resp.ok) throw new Error(`Falha ao salvar (HTTP ${resp.status}).`);
      const r2 = await fetch(`${API_BASE_URL}/api/forecast-dre/importacao?mes=${mes}`);
      const j2 = await r2.json();
      const d2 = (j2 && j2.data) || j2 || {};
      const col = colunas.find((c) => colParaMes(c) === mes);
      if (col) {
        setImpAntecip((p) => ({ ...p, [col.key]: d2.taxa_antecipacao }));
        setImpCartao((p) => ({ ...p, [col.key]: d2.taxa_cartao }));
      }
      window.alert(
        `Importado ${mes}: taxa de cartão R$ ${fmtBRL2(totC)} e taxa de antecipação R$ ${fmtBRL2(totA)}.` +
          (col ? '' : ' O mês ainda não está marcado como realizado na tabela; aparece quando for.'),
      );
    } catch (e) {
      window.alert(`Não importei: ${e.message}`);
    } finally {
      setImportando(false);
    }
  };

  useEffect(() => {
    let cancelado = false;
    const alvos = mesesAutomaticos(colunas);
    if (alvos.length === 0) return undefined;
    setCarregandoAuto(true);
    (async () => {
      const resultados = await Promise.all(
        alvos.map(async ({ col, mes }) => {
          // Receita por canal + CREDEV, e em paralelo a folha (Pessoal Fixo)
          const [recOk, pf, imp] = await Promise.all([
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/receita-canais?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && typeof d.varejo === 'number' ? d : null;
              } catch {
                return null;
              }
            })(),
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/pessoal-fixo?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && typeof d.pessoal_fixo === 'number' ? d : null;
              } catch {
                return null;
              }
            })(),
            (async () => {
              try {
                const r = await fetch(
                  `${API_BASE_URL}/api/forecast-dre/importacao?mes=${mes}`,
                );
                if (!r.ok) return null;
                const j = await r.json();
                const d = j?.data || j;
                return d && (d.taxa_antecipacao || d.taxa_cartao) ? d : null;
              } catch {
                return null;
              }
            })(),
          ]);
          if (!recOk && !pf && !imp) return null;
          return [col, recOk, pf, imp];
        }),
      );
      if (cancelado) return;
      const novo = {};
      const novoCredevCanais = {};
      const novoRubricas = {};
      const novoPfFixo = {};
      const novoPfVar = {};
      const novoProlabore = {};
      const novoPjLinha = {};
      const novoPjNomes = {};
      const novoOcupLinha = {};
      const novoOcupFiliais = {};
      const novoMktLinha = {};
      const novoMktLanc = {};
      const novoTrafLinha = {};
      const novoTrafItens = {};
      const novoRecFin = {};
      const novoFreteLinha = {};
      const novoFreteCanais = {};
      const novoJurosLinha = {};
      const novoJurosLanc = {};
      const novoPerdasLinha = {};
      const novoPerdasCanais = {};
      const novoImpAntecip = {};
      const novoImpCartao = {};
      for (const item of resultados) {
        if (!item) continue;
        const [col, d, pfSalvo, imp] = item;
        novo[col] = {};
        if (d) {
          for (const [linha, chave] of Object.entries(CANAL_POR_LINHA)) {
            if (typeof d[chave] === 'number') novo[col][linha] = d[chave];
          }
          // CREDEV vem do Contas a Receber (já negativo).
          if (typeof d.credev === 'number') novo[col].CREDEV = d.credev;
          // CREDEV por canal (só visualização)
          if (d.credev_canais && typeof d.credev_canais === 'object') {
            novoCredevCanais[col] = d.credev_canais;
          }
        }
        // Pessoal Fixo (fixos + pró-labore) e Pessoal Variável (comissão).
        if (pfSalvo && typeof pfSalvo.pessoal_fixo === 'number') {
          const pf = semShoppingRecife(pfSalvo);
          novoPfFixo[col] = pf.proventos_fixo || 0;
          novoPfVar[col] = pf.proventos_variavel || 0;
          novoProlabore[col] = typeof pf.prolabore === 'number' ? pf.prolabore : 80000;
          if (Array.isArray(pf.rubricas)) {
            // pró-labore é tratado à parte (editável); e tira o que não entra na DRE
            novoRubricas[col] = pf.rubricas.filter(
              (r) => !r.editavel && r.entra !== false,
            );
          }
          // Despesa de PJ (linha separada): total e nomes dos contratados
          if (typeof pf.pj_total === 'number') novoPjLinha[col] = pf.pj_total;
          if (Array.isArray(pf.pj_nomes)) novoPjNomes[col] = pf.pj_nomes;
          // Despesa de OCUPAÇÃO (aluguel): total e por filial
          if (typeof pf.ocupacao_total === 'number') novoOcupLinha[col] = pf.ocupacao_total;
          if (Array.isArray(pf.ocupacao_filiais)) novoOcupFiliais[col] = pf.ocupacao_filiais;
          // Despesa de MARKETING (propaganda): total e lançamentos
          if (typeof pf.marketing_total === 'number') novoMktLinha[col] = pf.marketing_total;
          if (Array.isArray(pf.marketing_lanc)) novoMktLanc[col] = pf.marketing_lanc;
          // Tráfego pago (Forecast de Mídia do Dryland)
          if (typeof pf.trafego_total === 'number') novoTrafLinha[col] = pf.trafego_total;
          if (Array.isArray(pf.trafego_itens)) novoTrafItens[col] = pf.trafego_itens;
          if (typeof pf.receita_financeira === 'number') novoRecFin[col] = pf.receita_financeira;
          // Fretes (Dryland, valor de custo)
          if (typeof pf.frete_total === 'number') novoFreteLinha[col] = pf.frete_total;
          if (Array.isArray(pf.frete_canais)) novoFreteCanais[col] = pf.frete_canais;
          // Juros e multa por atraso (Contas a Pagar)
          if (typeof pf.juros_total === 'number') novoJurosLinha[col] = pf.juros_total;
          if (Array.isArray(pf.juros_lanc)) novoJurosLanc[col] = pf.juros_lanc;
          // Perdas com inadimplência (Dashboard Inadimplência)
          if (typeof pf.perdas_total === 'number') novoPerdasLinha[col] = pf.perdas_total;
          if (Array.isArray(pf.perdas_canais)) novoPerdasCanais[col] = pf.perdas_canais;
        }
        // Planilha de taxas importada (antecipação / taxa de cartão por empresa)
        if (imp) {
          if (imp.taxa_antecipacao?.empresas?.length) novoImpAntecip[col] = imp.taxa_antecipacao;
          if (imp.taxa_cartao?.empresas?.length) novoImpCartao[col] = imp.taxa_cartao;
        }
      }
      setOverrides(novo);
      setCredevCanais(novoCredevCanais);
      setRubricasFolha(novoRubricas);
      setPfFixo(novoPfFixo);
      setPfVariavel(novoPfVar);
      setProlabore(novoProlabore);
      setPjLinha(novoPjLinha);
      setPjNomes(novoPjNomes);
      setOcupLinha(novoOcupLinha);
      setOcupFiliais(novoOcupFiliais);
      setMktLinha(novoMktLinha);
      setMktLanc(novoMktLanc);
      setTrafegoLinha(novoTrafLinha);
      setTrafegoItens(novoTrafItens);
      setRecFinLinha(novoRecFin);
      setFreteLinha(novoFreteLinha);
      setFreteCanais(novoFreteCanais);
      setJurosLinha(novoJurosLinha);
      setJurosLanc(novoJurosLanc);
      setPerdasLinha(novoPerdasLinha);
      setPerdasCanais(novoPerdasCanais);
      setImpAntecip(novoImpAntecip);
      setImpCartao(novoImpCartao);
      setCarregandoAuto(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas, refetchTick]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <PageTitle
        title={modoCorte ? 'Corte de custo' : 'Forecast'}
        subtitle={
          modoCorte
            ? 'Espelho do Forecast: a faca tira valores do cálculo e a previsão é editável. O Forecast não muda'
            : 'DRE projetada de 2026 — Realizado (jan–set) e Previsão (out–dez)'
        }
        icon={modoCorte ? Knife : ChartLineUp}
        iconColor="text-[#000638]"
      />

      <div
        className={
          telaCheia
            ? 'fixed inset-0 z-50 bg-white flex flex-col overflow-hidden'
            : 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'
        }
      >
        {/* Barra de topo: legenda + ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Clique no mês para Realizado / Previsão · clique na seção para expandir
            </span>
            {carregandoAuto && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Atualizando dados…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#000638]" /> Realizado
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Previsão
              </span>
            </div>
            <button
              type="button"
              disabled={atualizando}
              onClick={atualizarDados}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-60"
              title="Recalcula os meses automáticos (não travados) nas fontes originais: vendas, Dryland, Contas a Pagar…"
            >
              {atualizando ? 'Atualizando…' : 'Atualizar dados'}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={visao2027}
              onClick={() => {
                setVisao2027((v) => !v);
                setSelCel(new Set());
              }}
              className={
                'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ' +
                (visao2027
                  ? 'border-blue-400 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
              }
              title="Meses de 2027 a partir do último mês realizado, editáveis, com o total do ano na última coluna"
            >
              <span
                className={
                  'relative inline-block w-6 h-3.5 rounded-full ' +
                  (visao2027 ? 'bg-white/40' : 'bg-gray-300')
                }
              >
                <span
                  className={
                    'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow ' +
                    (visao2027 ? 'left-3' : 'left-0.5')
                  }
                />
              </span>
              Previsão 2027
            </button>
            <button
              type="button"
              onClick={() => setModoSel((v) => !v)}
              className={
                'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ' +
                (modoSel
                  ? 'border-violet-400 bg-violet-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
              }
              title="Selecione células e veja a soma em um painel"
            >
              <Calculator size={14} />
              {modoSel ? 'Selecionando' : 'Selecionar células'}
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={exportando}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title="Baixa o painel em Excel, com fórmulas nos totais e as despesas abertas em níveis"
            >
              {exportando ? 'Gerando…' : 'Exportar Excel'}
            </button>
            {!modoCorte && (
              <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importarPlanilha}
            />
            <button
              type="button"
              disabled={importando}
              onClick={() => fileRef.current && fileRef.current.click()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              title="Importar a planilha mensal de taxas de cartão (Painel DRE): preenche Antecipação de recebíveis e Taxa de cartão por empresa"
            >
              {importando ? 'Importando…' : 'Importar planilha'}
            </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setTelaCheia((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {telaCheia ? <CornersIn size={14} /> : <CornersOut size={14} />}
              {telaCheia ? 'Sair' : 'Tela cheia'}
            </button>
          </div>
        </div>

        {modoSel &&
          (() => {
            const { soma, qtd, ignoradas } = resumoSel();
            return (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-violet-200 bg-violet-50 px-3 py-2 text-[11px] text-violet-900">
                {selCel.size === 0 ? (
                  <span>Clique ou arraste nas células. O nome da linha e o mês selecionam tudo.</span>
                ) : (
                  <>
                    <span>
                      Soma: <strong className="text-sm">R$ {fmtBRL2(soma)}</strong>
                    </span>
                    <span>
                      Células: <strong>{qtd}</strong>
                    </span>
                    <span>
                      Média: <strong>R$ {fmtBRL2(qtd ? soma / qtd : 0)}</strong>
                    </span>
                    {ignoradas > 0 && (
                      <span className="text-violet-600">{ignoradas} em % fora da soma</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelCel(new Set())}
                      className="ml-auto font-semibold underline hover:text-violet-700"
                    >
                      Limpar seleção
                    </button>
                  </>
                )}
              </div>
            );
          })()}

        {/* Tabela */}
        <div
          className={
            telaCheia
              ? 'overflow-auto flex-1 min-h-0'
              : 'overflow-auto max-h-[calc(100vh-250px)]'
          }
        >
          <table className="min-w-full text-[11px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-2 text-left text-[11px] font-bold uppercase text-gray-600 min-w-[240px]">
                  DRE Forecast
                </th>
                {grupos.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.qtd}
                    className={
                      'border-b border-l border-white/20 px-2 py-1.5 text-center text-[11px] font-bold uppercase ' +
                      TIPO_CABECALHO[g.tipo]
                    }
                  >
                    {TIPO_ROTULO[g.tipo]}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-200 px-3 py-1.5 text-left text-[10px] text-gray-400 font-normal">
                  em R$
                </th>
                {colunasTela.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => (modoSel ? selecionarMes(c.key) : !mesTravado(c) && alternarTipoMes(c))}
                    title={
                      modoSel
                        ? 'Clique para selecionar o mês inteiro'
                        : mesTravado(c)
                        ? 'Mês travado — clique no cadeado para destravar'
                        : 'Clique para alternar entre Realizado e Previsão'
                    }
                    className={
                      'border-b border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap bg-gray-100 cursor-pointer select-none hover:bg-blue-100 hover:text-[#000638] ' +
                      TIPO_CELULA[c.tipo] +
                      (mesTravado(c) ? ' ring-1 ring-inset ring-amber-400' : '')
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {podeTravar(c) && (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            alternarTrava(c);
                          }}
                          title={mesTravado(c) ? 'Destravar o mês' : 'Travar o mês (congela os valores)'}
                          className={
                            'text-[11px] leading-none ' +
                            (mesTravado(c) ? 'text-amber-600' : 'text-gray-300 hover:text-gray-500')
                          }
                        >
                          {mesTravado(c) ? '🔒' : '🔓'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => {
                const info = estrutura[idx];
                if (visao2027 && OCULTAS_2027.has(l.label)) return null;
                // Esconde filhos de uma seção recolhida
                if (
                  (info.paiId && recolhidos.has(info.paiId)) ||
                  (info.avoId && recolhidos.has(info.avoId))
                )
                  return null;
                const tipo = tipoLinha(l);
                const forte = tipo === 'forte';
                const pct = tipo === 'pct';
                const sub = tipo === 'sub';
                const sub2 = tipo === 'sub2';
                const ehPai = info.isPai;
                const recolhido = recolhidos.has(l.id);
                const secao = INICIO_SECAO.has(l.label);
                const zebra = sub && idx % 2 === 1;
                const trBg = forte
                  ? 'bg-[#000638]/[0.04]'
                  : zebra
                    ? 'bg-gray-50/50'
                    : 'hover:bg-blue-50/40';
                const bordaTopo = secao ? 'border-t-2 border-[#000638]/15' : '';
                const labelCls = forte
                  ? 'font-bold text-[#000638]'
                  : pct
                    ? 'pl-8 text-gray-400 italic font-normal text-[10px]'
                    : sub2
                      ? 'pl-14 text-gray-500 font-normal text-[10px]'
                      : sub
                        ? ehPai
                          ? 'pl-8 text-gray-700 font-semibold'
                          : 'pl-8 text-gray-500 font-normal'
                        : 'font-semibold text-gray-700';
                const labelBg = forte ? 'bg-[#eef0f6]' : zebra ? 'bg-gray-50' : 'bg-white';
                // Linha de canal que abre pra mostrar o CREDEV do canal (só visual)
                const canalKey = CREDEV_CANAL_POR_LINHA[l.label];
                const temCredevCanal =
                  !visao2027 &&
                  canalKey &&
                  Object.values(credevCanais).some(
                    (cc) => cc && typeof cc[canalKey] === 'number' && cc[canalKey] !== 0,
                  );
                const canalAberto = temCredevCanal && canaisAbertos.has(l.label);
                // Linhas da folha (Pessoal Fixo / Variável) abrem as rubricas
                const grupoFolha =
                  l.label === 'PESSOAL FIXO'
                    ? 'fixo'
                    : l.label === 'PESSOAL VARIÁVEL'
                      ? 'variavel'
                      : null;
                const rubsDaLinha = grupoFolha
                  ? rubricasUnidas.filter((r) => r.grupo === grupoFolha)
                  : [];
                const ehFolha = grupoFolha !== null && rubsDaLinha.length > 0;
                // Todas as despesas expansíveis abrem por MÊS: clica na célula
                // do mês e abre só aquele mês (folha, PJ, Ocupação, Serviços).
                const ehPJ = l.label === 'PJ' && Object.keys(pjLinha).length > 0;
                const ehOcup = l.label === 'OCUPAÇÃO' && Object.keys(ocupLinha).length > 0;
                // Marketing agora é a soma de 3 subitens (nível 2); o drill de
                // lançamentos de propaganda fica no subitem PROPAGANDA E ANÚNCIO.
                const ehMkt = l.label === 'PROPAGANDA E ANÚNCIO' && Object.keys(mktLinha).length > 0;
                const ehTraf = l.label === 'TRÁFEGO' && Object.keys(trafegoLinha).length > 0;
                const ehBonif = l.label === 'BONIFICAÇÕES MARKETING' && Object.keys(bonifMkt).length > 0;
                const ehPerdas =
                  l.label === 'PERDAS COM INADIMPLÊNCIA' && Object.keys(perdasLinha).length > 0;
                const ehFrete = l.label === 'FRETES' && Object.keys(freteLinha).length > 0;
                const ehJuros =
                  l.label === 'JUROS E MULTA POR ATRASO' && Object.keys(jurosLinha).length > 0;
                const ehImpAnt =
                  l.label === 'ANTECIPAÇÃO DE RECEBÍVEIS' && Object.keys(impAntecip).length > 0;
                const ehImpCar = l.label === 'TAXA DE CARTÃO' && Object.keys(impCartao).length > 0;
                const ehServTerc =
                  l.label === 'SERVIÇOS DE TERCEIROS FIXOS' && Object.keys(servTerc).length > 0;
                // Coluna (mês) aberta nesta linha, se houver dado nela
                const temDadoMes = (col) =>
                  (ehFolha && (pfFixo[col] !== undefined || pfVariavel[col] !== undefined)) ||
                  (ehPJ && pjLinha[col] !== undefined) ||
                  (ehOcup && ocupLinha[col] !== undefined) ||
                  (ehMkt && mktLinha[col] !== undefined) ||
                  (ehTraf && trafegoLinha[col] !== undefined) ||
                  (ehBonif && bonifMkt[col] !== undefined) ||
                  (ehPerdas && perdasLinha[col] !== undefined) ||
                  (ehFrete && freteLinha[col] !== undefined) ||
                  (ehJuros && jurosLinha[col] !== undefined) ||
                  (ehImpAnt && impAntecip[col] !== undefined) ||
                  (ehImpCar && impCartao[col] !== undefined) ||
                  (ehServTerc && servTerc[col] !== undefined);
                const colMesLinha =
                  !visao2027 && mesAberto[l.label] && temDadoMes(mesAberto[l.label])
                    ? mesAberto[l.label]
                    : null;
                const folhaAberta = ehFolha && !!colMesLinha;
                const pjAbertoLinha = ehPJ && !!colMesLinha;
                const ocupAbertoLinha = ehOcup && !!colMesLinha;
                const mktAbertoLinha = ehMkt && !!colMesLinha;
                const trafAbertoLinha = ehTraf && !!colMesLinha;
                const bonifAbertoLinha = ehBonif && !!colMesLinha;
                const perdasAbertoLinha = ehPerdas && !!colMesLinha;
                const freteAberto = ehFrete && !!colMesLinha;
                const jurosAberto = ehJuros && !!colMesLinha;
                const impAntAberto = ehImpAnt && !!colMesLinha;
                const impCarAberto = ehImpCar && !!colMesLinha;
                const servAbertoLinha = ehServTerc && !!colMesLinha;
                const ehDespesaMes =
                  ehFolha || ehPJ || ehOcup || ehMkt || ehTraf || ehBonif || ehPerdas || ehFrete || ehJuros || ehImpAnt || ehImpCar || ehServTerc;
                // Só a label de seção (pai) e de canal (CREDEV) abrem pela label;
                // as despesas abrem clicando na célula do mês.
                const clicavel = ehPai || temCredevCanal;
                const onClickLabel = ehPai
                  ? () => toggleRecolher(l.id)
                  : temCredevCanal
                    ? () => toggleCanal(l.label)
                    : undefined;
                return (
                  <React.Fragment key={l.id}>
                  <tr className={trBg}>
                    <td
                      onClick={modoSel ? () => selecionarLinha(idx) : onClickLabel}
                      className={
                        'sticky left-0 z-10 border-b border-r border-gray-100 px-3 py-2 whitespace-nowrap ' +
                        bordaTopo + ' ' + labelBg + ' ' + labelCls +
                        (clicavel ? ' cursor-pointer hover:text-blue-700' : '')
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {ehPai ? (
                          recolhido ? (
                            <CaretRight size={11} weight="bold" className="text-gray-400 shrink-0" />
                          ) : (
                            <CaretDown size={11} weight="bold" className="text-gray-400 shrink-0" />
                          )
                        ) : temCredevCanal ? (
                          canalAberto ? (
                            <CaretDown size={10} weight="bold" className="text-gray-300 shrink-0" />
                          ) : (
                            <CaretRight size={10} weight="bold" className="text-gray-300 shrink-0" />
                          )
                        ) : null}
                        {l.label}
                      </span>
                    </td>
                    {colunasTela.map((c, colIdx) => {
                      const { v, auto, calc, resultadoCalc } = valorCelula(l, c);
                      const selecionada = modoSel && selCel.has(chaveSel(idx, c.key));
                      // Marcação verde só nos meses de previsão (Niziany 30/10).
                      const autoVisual = auto && c.tipo === 'forecast' && !resultadoCalc;
                      // Faturamento por canal: mesma fonte das outras células (só o fundo marca o automático)
                      const ehFat = CANAL_POR_LINHA[l.label] !== undefined;
                      const negativo = typeof v === 'number' && v < 0;
                      const corTexto = negativo
                        ? 'text-red-600'
                        : v == null
                          ? 'text-gray-300'
                          : autoVisual && !ehFat
                            ? 'text-emerald-700'
                            : forte
                              ? 'text-[#000638]'
                              : pct
                                ? 'text-gray-400 italic'
                                : sub || sub2
                                  ? 'text-gray-600'
                                  : 'text-gray-800';
                      // Célula de mês clicável nas linhas de despesa: abre só
                      // aquele mês (folha, PJ, Ocupação, Serviços).
                      const celulaMes = ehDespesaMes && temDadoMes(c.key);
                      // Linha CMV %: célula de mês editável (clique → digita o %)
                      const cmvEditavel =
                        !modoCorte && l.label === 'CMV %' && c.grupo === 'mensal' && !!colParaMes(c) && !mesTravado(c);
                      const cmvEditando = cmvEditavel && editandoCmv === c.key;
                      // Mês de previsão: qualquer valor editável (exceto % calculados)
                      const prevEditavel =
                        !!espelho[c.key] && !cmvEditavel && !PCT_DERIVADOS.has(l.label);
                      const chavePrev = l.label + '|' + c.key;
                      const prevEditando = prevEditavel && editandoPrev === chavePrev;
                      const prevEditado =
                        (modoCorte ? edicoesCorte : edicoesPrev)[c.key]?.[l.label] !== undefined;
                      const ehPctPrev = l.fmt === 'pct';
                      const celulaMesAberta = celulaMes && colMesLinha === c.key;
                      return (
                        <td
                          key={c.key}
                          onMouseDown={
                            modoSel
                              ? (e) => {
                                  e.preventDefault();
                                  iniciarArrasto(idx, colIdx);
                                }
                              : undefined
                          }
                          onMouseEnter={modoSel ? () => continuarArrasto(idx, colIdx) : undefined}
                          style={selecionada ? { backgroundColor: '#ddd6fe' } : undefined}
                          onClick={
                            modoSel
                              ? undefined
                              : cmvEditavel
                              ? () => !cmvEditando && setEditandoCmv(c.key)
                              : prevEditavel
                                ? () => !prevEditando && setEditandoPrev(chavePrev)
                                : celulaMes
                                ? () => abrirMes(l.label, c.key)
                                : undefined
                          }
                          title={
                            modoSel
                              ? undefined
                              : cmvEditavel
                              ? 'Clique para editar o % do CMV sobre a Receita Operacional Líquida'
                              : prevEditavel
                                ? 'Clique para editar. Apague o valor para voltar ao espelho do último realizado'
                              : celulaMes
                              ? 'Clique para abrir as despesas deste mês'
                              : calc !== undefined
                                ? l.label === 'RECEITA BRUTA'
                                  ? 'Calculado: soma dos canais + CREDEV'
                                  : 'Calculado: soma dos canais de venda'
                                : auto
                                  ? 'Puxado automaticamente'
                                  : undefined
                          }
                          className={
                            'border-b border-gray-100 px-3 py-2 text-right tabular-nums whitespace-nowrap ' +
                            bordaTopo + ' ' +
                            (autoVisual ? (ehFat ? 'bg-emerald-50 ' : 'bg-emerald-50 font-semibold ') : TIPO_CELULA[c.tipo] + ' ') +
                            (forte && !autoVisual ? 'font-bold ' : '') +
                            (pct || sub2 ? 'text-[10px] ' : '') +
                            (modoSel
                              ? 'cursor-cell select-none '
                              : celulaMes || cmvEditavel || prevEditavel
                                ? 'cursor-pointer hover:underline '
                                : '') +
                            (celulaMesAberta ? 'ring-1 ring-inset ring-emerald-400 ' : '') +
                            corTexto
                          }
                        >
                          {cmvEditando ? (
                            <span className="inline-flex items-center gap-0.5">
                              <input
                                type="number"
                                step="0.1"
                                autoFocus
                                defaultValue={Math.round(Math.abs((v || 0) * 100) * 10) / 10}
                                onBlur={(e) => {
                                  const n = Math.abs(Number(e.target.value) || 0);
                                  const pct = -(n / 100);
                                  if (Math.abs(pct - (v || 0)) > 1e-9) salvarCmvPct(c.key, colParaMes(c), pct);
                                  setEditandoCmv(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                  if (e.key === 'Escape') setEditandoCmv(null);
                                }}
                                className="w-14 text-right text-[10px] text-emerald-800 bg-white border border-emerald-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </span>
                          ) : prevEditando ? (
                            <span className="inline-flex items-center gap-0.5">
                              <input
                                type="number"
                                step={ehPctPrev ? '0.1' : '0.01'}
                                autoFocus
                                defaultValue={
                                  ehPctPrev
                                    ? Math.round(Math.abs((v || 0) * 100) * 10) / 10
                                    : Math.round((v || 0) * 100) / 100
                                }
                                onBlur={(e) => {
                                  const t = e.target.value.trim();
                                  const n = ehPctPrev ? -(Math.abs(Number(t) || 0) / 100) : Number(t) || 0;
                                  const atual = ehPctPrev
                                    ? -(Math.round(Math.abs((v || 0) * 100) * 10) / 10) / 100
                                    : Math.round((v || 0) * 100) / 100;
                                  if (t === '') {
                                    if (prevEditado) salvarEdicaoPrev(c.key, colParaMes(c), l.label, null);
                                  } else if (Math.abs(n - atual) > 1e-9) {
                                    salvarEdicaoPrev(c.key, colParaMes(c), l.label, n);
                                  }
                                  setEditandoPrev(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                  if (e.key === 'Escape') setEditandoPrev(null);
                                }}
                                className="w-24 text-right text-[10px] text-gray-800 bg-white border border-amber-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              {ehPctPrev && <span className="text-[10px] text-gray-500">%</span>}
                            </span>
                          ) : (
                            formatar(v, l.fmt)
                          )}
                          {!prevEditando &&
                            LINHAS_FACA.has(l.label) &&
                            c.grupo === 'mensal' &&
                            !!colParaMes(c) &&
                            faca(c.key, l.label, '', l.label, v)}
                        </td>
                      );
                    })}
                  </tr>
                  {canalAberto && (
                    <tr className="bg-red-50/40">
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1.5 whitespace-nowrap bg-red-50/60 text-[10px] font-semibold text-red-700">
                        ↳ CREDEV {l.label}
                      </td>
                      {colunasTela.map((c) => {
                        const cv = credevCanais[c.key]?.[canalKey];
                        return (
                          <td
                            key={c.key}
                            title="CREDEV do canal (apenas visualização, não entra no cálculo)"
                            className="border-b border-gray-100 px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-red-50/40"
                          >
                            {typeof cv === 'number' && cv !== 0 ? formatar(cv, 'moeda') : '–'}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {pjAbertoLinha &&
                    (() => {
                      // Só o mês clicado: contratados daquele mês.
                      const mc = colMesLinha;
                      const lista = (pjNomes[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((p) => (
                        <tr key={'pj-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                              {faca(mc, l.label, p.nome, p.nome, -p.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && p.valor ? formatar(-p.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {ocupAbertoLinha &&
                    (() => {
                      // Só o mês clicado: filiais daquele mês.
                      const mc = colMesLinha;
                      const lista = (ocupFiliais[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((p) => (
                        <tr key={'ocup-' + p.nome} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {p.nome}
                              {faca(mc, l.label, p.nome, p.nome, -p.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && p.valor ? formatar(-p.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {mktAbertoLinha &&
                    (() => {
                      // Só o mês clicado: lançamentos de propaganda daquele mês.
                      const mc = colMesLinha;
                      const lista = (mktLanc[mc] || [])
                        .slice()
                        .sort((a, b) => (b.valor || 0) - (a.valor || 0));
                      return lista.map((x, i) => (
                        <tr key={'mkt-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.forn}
                              {x.venc ? (
                                <span className="text-gray-400 font-normal"> · venc {x.venc}</span>
                              ) : null}
                              {faca(mc, l.label, i + ' ' + x.forn, x.forn, -x.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {trafAbertoLinha &&
                    (() => {
                      // Só o mês clicado: tráfego por canal → loja/conta (competência).
                      const mc = colMesLinha;
                      const lista = (trafegoItens[mc] || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'traf-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.nome}
                              {x.canal ? (
                                <span className="text-gray-400 font-normal"> · {x.canal}</span>
                              ) : null}
                              {faca(mc, l.label, x.nome, x.nome, -x.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {bonifAbertoLinha &&
                    (() => {
                      // Só o mês clicado: bonificações de marketing (DRE Analítica).
                      const mc = colMesLinha;
                      const lista = (bonifMkt[mc]?.lanc || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'bonif-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.forn}
                              {x.venc ? (
                                <span className="text-gray-400 font-normal"> · venc {x.venc}</span>
                              ) : null}
                              {faca(mc, l.label, i + ' ' + x.forn, x.forn, -x.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {perdasAbertoLinha &&
                    (() => {
                      // Só o mês clicado: saldo vencido em aberto por canal.
                      const mc = colMesLinha;
                      const lista = (perdasCanais[mc] || []).slice();
                      return lista.map((x, i) => (
                        <tr key={'perdas-' + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.nome}
                              <span className="text-gray-400 font-normal">
                                {' '}· {x.titulos} tít. · {x.clientes} cli.
                              </span>
                              {faca(mc, l.label, x.nome, x.nome, -x.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {freteAberto &&
                    (freteCanais[colMesLinha] || []).map((x, i) => (
                      <tr key={'frete-' + i} className="bg-slate-50/50">
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {x.nome}
                            <span className="text-gray-400 font-normal"> · {x.envios} envios</span>
                            {faca(colMesLinha, l.label, x.nome, x.nome, -x.valor)}
                          </span>
                        </td>
                        {colunasTela.map((c) => (
                          <td
                            key={c.key}
                            className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                          >
                            {c.key === colMesLinha && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  {jurosAberto &&
                    (jurosLanc[colMesLinha] || []).map((x, i) => (
                      <tr key={'juros-' + i} className="bg-slate-50/50">
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {x.forn}
                            {x.venc ? (
                              <span className="text-gray-400 font-normal"> · pago {x.venc}</span>
                            ) : null}
                            {faca(colMesLinha, l.label, i + ' ' + x.forn, x.forn, -x.valor)}
                          </span>
                        </td>
                        {colunasTela.map((c) => (
                          <td
                            key={c.key}
                            className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                          >
                            {c.key === colMesLinha && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  {(impAntAberto || impCarAberto) &&
                    (() => {
                      // Só o mês clicado: taxa por empresa (planilha importada).
                      const mc = colMesLinha;
                      const src = impAntAberto ? impAntecip[mc] : impCartao[mc];
                      const lista = ((src && src.empresas) || []).slice();
                      const pref = impAntAberto ? 'impA-' : 'impC-';
                      return lista.map((x, i) => (
                        <tr key={pref + i} className="bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              {x.empresa}
                              {faca(mc, l.label, x.empresa, x.empresa, -x.valor)}
                            </span>
                          </td>
                          {colunasTela.map((c) => (
                            <td
                              key={c.key}
                              className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                            >
                              {c.key === mc && x.valor ? formatar(-x.valor, 'moeda') : '–'}
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  {servAbertoLinha &&
                    (() => {
                      // Só o mês clicado: despesas e lançamentos daquele mês.
                      const mc = colMesLinha;
                      const cats = (servTerc[mc]?.categorias || []).slice();
                      const colMes = colunas.find((c) => c.key === mc);
                      const rotuloMes = colMes ? colMes.label : '';
                      return cats.map((cg) => {
                        const catAberta = servCatsAbertas.has(cg.cat);
                        return (
                          <React.Fragment key={'serv-' + cg.cat}>
                            <tr className="bg-slate-50/50">
                              <td
                                onClick={() => toggleServCat(cg.cat)}
                                className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-red-600 cursor-pointer hover:underline"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {catAberta ? (
                                    <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  ) : (
                                    <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  )}
                                  {cg.cat}
                                  <span className="text-gray-400 font-normal"> · {rotuloMes}</span>
                                  {faca(mc, l.label, cg.cat, cg.cat, -cg.valor)}
                                </span>
                              </td>
                              {colunasTela.map((c) => (
                                <td
                                  key={c.key}
                                  className="border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] text-red-600 bg-slate-50/40"
                                >
                                  {c.key === mc && cg.valor
                                    ? formatar(-cg.valor, 'moeda')
                                    : '–'}
                                </td>
                              ))}
                            </tr>
                            {catAberta &&
                              (cg.lancamentos || []).map((x, i) => (
                                <tr key={'serv-' + cg.cat + '-' + i} className="bg-white">
                                  <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-0.5 whitespace-nowrap bg-white text-[10px] text-gray-500">
                                    {x.forn}
                                    {x.venc ? (
                                      <span className="text-gray-400"> · venc {x.venc}</span>
                                    ) : null}
                                    {faca(mc, l.label, cg.cat + '»' + i, x.forn, -x.val)}
                                  </td>
                                  {colunasTela.map((c) => (
                                    <td
                                      key={c.key}
                                      className="border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[10px] text-gray-500"
                                    >
                                      {c.key === mc && x.val ? formatar(-x.val, 'moeda') : '–'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      });
                    })()}
                  {ehFolha && folhaAberta && l.label === 'PESSOAL FIXO' && (
                    <tr className="bg-slate-50/50">
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] text-emerald-700">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          PRÓ-LABORE (DIRETORES)
                          {faca(colMesLinha, l.label, 'PRÓ-LABORE', 'PRÓ-LABORE (DIRETORES)', -(prolabore[colMesLinha] ?? 80000))}
                        </span>
                      </td>
                      {colunasTela.map((c) => {
                        const temFolha = pfFixo[c.key] !== undefined;
                        const podeEditar = temFolha && !modoCorte && !mesTravado(c);
                        const editando = editandoProl === c.key;
                        const val = prolabore[c.key] ?? 80000;
                        return (
                          <td
                            key={c.key}
                            onClick={() => podeEditar && !editando && setEditandoProl(c.key)}
                            title={podeEditar ? 'Clique para editar o pró-labore' : undefined}
                            className={
                              'border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] bg-slate-50/40 text-emerald-700 ' +
                              (podeEditar && !editando ? 'cursor-pointer hover:underline' : '')
                            }
                          >
                            {temFolha ? (
                              editando ? (
                                <input
                                  type="number"
                                  autoFocus
                                  defaultValue={val}
                                  onBlur={(e) => {
                                    const n = Math.max(0, Number(e.target.value) || 0);
                                    if (n !== val) salvarProlabore(c.key, colParaMes(c), n);
                                    setEditandoProl(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') setEditandoProl(null);
                                  }}
                                  className="w-20 text-right text-[10px] text-emerald-800 bg-white border border-emerald-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              ) : (
                                formatar(val, 'moeda')
                              )
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {ehFolha &&
                    folhaAberta &&
                    rubsDaLinha.map((ru) => {
                      const prov = ru.tipo === 'provento';
                      const corVal = prov ? 'text-emerald-700' : 'text-red-600';
                      const dot = prov ? 'bg-emerald-500' : 'bg-red-500';
                      // Corte: como a rubrica entra na DRE (provento é despesa, negativo)
                      const contrib = (x) => (prov ? -1 : 1) * Math.abs(Number(x) || 0);
                      const facaFolha = (chave, nome, x) =>
                        ru.entra ? faca(colMesLinha, l.label, chave, nome, contrib(x)) : null;
                      const temFunc = Object.keys(ru.funcPorCol).length > 0;
                      const rubAberta = temFunc && rubricasAbertas.has(ru.key);
                      // Agrupa por EMPRESA e, dentro, por funcionário — só o mês
                      // aberto (colMesLinha), pra não misturar meses.
                      let empresas = [];
                      if (rubAberta) {
                        const col = colMesLinha;
                        const em = new Map();
                        for (const f of ru.funcPorCol[col] || []) {
                          const emp = f.loja || '— sem seção —';
                          const e =
                            em.get(emp) ||
                            { empresa: emp, porCol: {}, max: 0, funcs: new Map() };
                          e.porCol[col] = (e.porCol[col] || 0) + (Number(f.valor) || 0);
                          e.max = Math.max(e.max, Math.abs(e.porCol[col]));
                          const fk = (f.chapa || '') + '|' + f.nome;
                          const fe =
                            e.funcs.get(fk) ||
                            { nome: f.nome, chapa: f.chapa, funcao: f.funcao, porCol: {}, max: 0 };
                          fe.porCol[col] = f.valor;
                          fe.max = Math.max(fe.max, Math.abs(Number(f.valor) || 0));
                          e.funcs.set(fk, fe);
                          em.set(emp, e);
                        }
                        empresas = [...em.values()]
                          .map((e) => ({
                            ...e,
                            funcs: [...e.funcs.values()].sort((a, b) => b.max - a.max),
                          }))
                          .sort((a, b) => b.max - a.max);
                      }
                      return (
                        <React.Fragment key={'rub-' + ru.key}>
                          <tr className="bg-slate-50/50">
                            <td
                              onClick={temFunc ? () => toggleRubrica(ru.key) : undefined}
                              className={
                                'sticky left-0 z-10 border-b border-r border-gray-100 pl-12 pr-3 py-1 whitespace-nowrap bg-slate-50 text-[10px] ' +
                                corVal +
                                (temFunc ? ' cursor-pointer hover:underline' : '')
                              }
                            >
                              <span className="inline-flex items-center gap-1">
                                {temFunc ? (
                                  rubAberta ? (
                                    <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  ) : (
                                    <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                  )
                                ) : (
                                  <span className={'w-1.5 h-1.5 rounded-full ' + dot} />
                                )}
                                {ru.desc}
                                {facaFolha(ru.key, ru.desc, ru.porCol[colMesLinha])}
                              </span>
                            </td>
                            {colunasTela.map((c) => {
                              const rv = ru.porCol[c.key];
                              return (
                                <td
                                  key={c.key}
                                  className={
                                    'border-b border-gray-100 px-3 py-1 text-right tabular-nums whitespace-nowrap text-[10px] bg-slate-50/40 ' +
                                    corVal
                                  }
                                >
                                  {typeof rv === 'number' && rv !== 0 ? formatar(rv, 'moeda') : '–'}
                                </td>
                              );
                            })}
                          </tr>
                          {rubAberta &&
                            empresas.map((emp, ei) => {
                              const empKey = ru.key + '|' + emp.empresa;
                              const empAberta = empresasAbertas.has(empKey);
                              return (
                                <React.Fragment key={'e-' + empKey}>
                                  <tr className="bg-white">
                                    <td
                                      onClick={() => toggleEmpresa(empKey)}
                                      className="sticky left-0 z-10 border-b border-r border-gray-100 pl-[4.5rem] pr-3 py-0.5 whitespace-nowrap bg-white text-[10px] text-gray-600 cursor-pointer hover:underline"
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {empAberta ? (
                                          <CaretDown size={9} weight="bold" className="text-gray-300 shrink-0" />
                                        ) : (
                                          <CaretRight size={9} weight="bold" className="text-gray-300 shrink-0" />
                                        )}
                                        {emp.empresa}
                                        <span className="text-gray-300"> · {emp.funcs.length} func.</span>
                                        {facaFolha(ru.key + '»' + emp.empresa, emp.empresa, emp.porCol[colMesLinha])}
                                      </span>
                                    </td>
                                    {colunasTela.map((c) => {
                                      const ev = emp.porCol[c.key];
                                      return (
                                        <td
                                          key={c.key}
                                          className={
                                            'border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[10px] ' +
                                            corVal
                                          }
                                        >
                                          {typeof ev === 'number' && ev !== 0 ? formatar(ev, 'moeda') : '–'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {empAberta &&
                                    emp.funcs.map((f, fi) => (
                                      <tr key={'f-' + empKey + '-' + fi} className="bg-gray-50/40">
                                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 pl-28 pr-3 py-0.5 whitespace-nowrap bg-gray-50 text-[9px] text-gray-500">
                                          {f.nome}
                                          {f.funcao ? (
                                            <span className="text-gray-400"> · {f.funcao}</span>
                                          ) : null}
                                          {facaFolha(
                                            ru.key + '»' + emp.empresa + '»' + (f.chapa || f.nome),
                                            f.nome,
                                            f.porCol[colMesLinha],
                                          )}
                                        </td>
                                        {colunasTela.map((c) => {
                                          const fv = f.porCol[c.key];
                                          return (
                                            <td
                                              key={c.key}
                                              className={
                                                'border-b border-gray-100 px-3 py-0.5 text-right tabular-nums whitespace-nowrap text-[9px] ' +
                                                corVal
                                              }
                                            >
                                              {typeof fv === 'number' && fv !== 0 ? formatar(fv, 'moeda') : '–'}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                </React.Fragment>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 px-1 mt-3">
        Base: {base.origem}. A partir de setembro/2026 (células em verde): a receita bruta por
        canal vem do New Forecast (showroom separado por cliente) e o CREDEV vem do Contas a
        Receber (faturas CREDEV das filiais, por emissão do mês). Jan–ago e os totais seguem
        com os números da planilha.
      </p>
    </div>
  );
}
