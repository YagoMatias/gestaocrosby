// Contas a Receber — Receita Financeira (pedido do Yago, 25/10/2026).
// Faturas pagas no período (pela data de pagamento) e quanto o cliente pagou a
// mais do que a fatura: juros, multa e taxas. Ficam de fora, mas conferíveis na
// lista: baixa com liquidação sem valor pago, fatura quitada com CREDEV e
// renegociação. Dados de GET /api/contas-receber/receita-financeira.
import React, { useEffect, useMemo, useState } from "react";
import {
  Coins,
  ArrowsClockwise,
  Spinner,
  Warning,
  FileXls,
  MagnifyingGlass,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  Table,
  ChartLineUp,
} from "@phosphor-icons/react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line, Doughnut } from "react-chartjs-2";
import PageTitle from "../components/ui/PageTitle";
import { apiJson } from "../utils/apiAuth";

// O plugin de rótulos é global no Chart.js: registrar aqui garante que os
// rótulos existam mesmo se esta for a primeira página com gráfico aberta, e
// cada gráfico abaixo configura (ou desliga) os seus.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  ChartDataLabels,
);

// Cores dos gráficos (par validado para daltonismo e contraste): juros em azul,
// taxa de boleto em âmbar. Receita sozinha usa o azul.
const COR_JUROS = "#1d4ed8";
const COR_TAXA = "#d97706";
const COR_MEDIA = "#eab308"; // amarelo da linha de média (tracejada, sem pontos)

const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const fmtData = (s) => {
  if (!s) return "—";
  const [a, m, d] = String(s).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : s;
};
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const fmtMes = (k) => {
  const [a, m] = String(k).split("-").map(Number);
  return `${MESES[m - 1]}/${String(a).slice(2)}`;
};
const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const inicioMesISO = () => `${hojeISO().slice(0, 7)}-01`;

const SITUACOES = {
  considerada: { label: "Considerada", cor: "bg-green-100 text-green-800" },
  sem_valor_pago: { label: "Sem valor pago", cor: "bg-gray-200 text-gray-700" },
  credev: { label: "Pago com CREDEV", cor: "bg-purple-100 text-purple-800" },
  renegociacao: { label: "Renegociação", cor: "bg-amber-100 text-amber-800" },
};
// filtro ativo na lista (escolhido pelos cards)
const FILTRO_LABEL = {
  considerada: "Faturas consideradas no cálculo",
  atraso_sem_juros: "Pagas em atraso sem juros",
  sem_valor_pago: "Fora: liquidação sem valor pago",
  credev: "Fora: pagas com CREDEV",
  renegociacao: "Fora: renegociação",
  TODAS: "Todas as faturas pagas",
};
const fmtPct = (v) =>
  `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const POR_PAGINA = 200;

function Card({
  label,
  value,
  sub,
  color = "text-[#000638]",
  destaque = false,
  onClick,
  active,
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`text-left rounded-lg border p-3 ${destaque ? "bg-[#000638] border-[#000638]" : "bg-white"} ${
        onClick ? "hover:border-[#000638] cursor-pointer" : ""
      } ${active ? "ring-2 ring-[#000638]" : destaque ? "" : "border-gray-200"}`}
    >
      <div
        className={`text-[11px] ${destaque ? "text-blue-100" : "text-gray-500"}`}
      >
        {label}
      </div>
      <div className={`text-xl font-bold ${destaque ? "text-white" : color}`}>
        {value}
      </div>
      {sub && (
        <div
          className={`text-[11px] mt-0.5 ${destaque ? "text-blue-100" : "text-gray-500"}`}
        >
          {sub}
        </div>
      )}
    </Tag>
  );
}

// ─── Dashboard: receita por mês, taxa × juros por mês e a divisão em pizza ──
const GRID = "rgba(0,0,0,0.06)";
const eixoBRL = (v) =>
  Math.abs(v) >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
    : fmtBRL(v);
const tooltipBRL = {
  callbacks: {
    label: (ctx) => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}`,
  },
};
// Rótulo de valor em cada ponto: "R$ 1.620,98", afastado da linha. Com duas
// séries, a primeira rotula acima e a segunda abaixo para não colidir.
const rotulos = (posicao = "top") => ({
  display: true,
  align: posicao,
  anchor: "center",
  offset: 10,
  clamp: true,
  clip: false,
  color: "#374151",
  font: { size: 10, weight: "600" },
  formatter: (v) => (v || v === 0 ? fmtBRL(v) : ""),
});
const serie = (label, dados, cor, posicaoRotulo = "top") => ({
  label,
  data: dados,
  borderColor: cor,
  backgroundColor: cor,
  borderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 6,
  pointBorderWidth: 2,
  pointBorderColor: "#fff",
  tension: 0.25,
  fill: false,
  datalabels: rotulos(posicaoRotulo),
});
const opcoesLinha = (legenda) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  // espaço para o rótulo do ponto mais alto e dos pontos das pontas
  layout: { padding: { top: 18, left: 24, right: 32, bottom: 4 } },
  plugins: {
    legend: {
      display: legenda,
      position: "top",
      labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } },
    },
    tooltip: tooltipBRL,
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: {
      beginAtZero: true,
      grace: "10%",
      grid: { color: GRID },
      ticks: { font: { size: 11 }, callback: eixoBRL },
    },
  },
});

function Grafico({ titulo, sub, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-[#000638]">
        {titulo}
      </div>
      {sub && <div className="text-[11px] text-gray-500 mb-2">{sub}</div>}
      <div className="h-80 md:h-96">{children}</div>
    </div>
  );
}

function Dashboard({ porMes, cons }) {
  const labels = porMes.map((m) => fmtMes(m.mes));
  const taxa = cons.taxa_boleto || 0;
  const juros = cons.juros_cobrado || 0;
  const total = taxa + juros;
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);
  const umMes = porMes.length < 2;
  const mediaMes = porMes.length
    ? Math.round(
        (porMes.reduce((a, m) => a + (m.pago_a_mais || 0), 0) / porMes.length) *
          100,
      ) / 100
    : 0;

  return (
    <div className="mb-4">
      {umMes && (
        <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          O período tem só um mês de pagamento. Para ver a evolução nas linhas,
          escolha um período com mais meses.
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Grafico
          titulo="Receita financeira por mês"
          sub={`pago a mais do que a fatura, pelo mês de pagamento · média do período ${fmtBRL(mediaMes)}/mês`}
        >
          <Line
            data={{
              labels,
              datasets: [
                serie(
                  "Receita financeira",
                  porMes.map((m) => m.pago_a_mais),
                  COR_JUROS,
                ),
                {
                  label: `Média do período (${fmtBRL(mediaMes)})`,
                  data: porMes.map(() => mediaMes),
                  borderColor: COR_MEDIA,
                  backgroundColor: COR_MEDIA,
                  borderWidth: 2,
                  borderDash: [6, 4],
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  tension: 0,
                  fill: false,
                  // rótulo só no último ponto, para a linha ficar limpa
                  datalabels: {
                    ...rotulos("top"),
                    color: COR_MEDIA,
                    display: (ctx) =>
                      ctx.dataIndex === ctx.dataset.data.length - 1,
                    formatter: () => `Média ${fmtBRL(mediaMes)}`,
                  },
                },
              ],
            }}
            options={opcoesLinha(true)}
          />
        </Grafico>
        <Grafico
          titulo="Taxa de boleto × juros por mês"
          sub="fatura paga com exatamente R$ 0,98 a mais é taxa de boleto; qualquer outro valor a mais é juros"
        >
          <Line
            data={{
              labels,
              datasets: [
                serie(
                  "Juros",
                  porMes.map((m) => m.juros_cobrado),
                  COR_JUROS,
                ),
                serie(
                  "Taxa de boleto",
                  porMes.map((m) => m.taxa_boleto),
                  COR_TAXA,
                  "bottom",
                ),
              ],
            }}
            options={opcoesLinha(true)}
          />
        </Grafico>
        <Grafico
          titulo="Receita: taxa × juros"
          sub={`${fmtBRL(total)} no período · juros ${fmtBRL(juros)} (${pct(juros).toFixed(1)}%) · taxa ${fmtBRL(taxa)} (${pct(taxa).toFixed(1)}%)`}
        >
          {total > 0 ? (
            <Doughnut
              data={{
                labels: ["Juros", "Taxa de boleto"],
                datasets: [
                  {
                    data: [juros, taxa],
                    backgroundColor: [COR_JUROS, COR_TAXA],
                    borderColor: "#fff",
                    borderWidth: 2,
                    hoverOffset: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "55%",
                plugins: {
                  datalabels: {
                    color: "#fff",
                    font: { size: 12, weight: "700" },
                    formatter: (v) => `${pct(v).toFixed(1)}%`,
                  },
                  legend: {
                    position: "bottom",
                    labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) =>
                        ` ${ctx.label}: ${fmtBRL(ctx.parsed)} (${pct(ctx.parsed).toFixed(1)}%)`,
                    },
                  },
                },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-500">
              Sem receita financeira no período
            </div>
          )}
        </Grafico>
      </div>
    </div>
  );
}

export default function ReceitaFinanceira() {
  const [inicio, setInicio] = useState(inicioMesISO());
  const [fim, setFim] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // filtros da lista
  const [visao, setVisao] = useState("dados"); // 'dados' | 'dashboard'
  const [situacao, setSituacao] = useState("considerada");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ campo: "dt_pagamento", asc: true });
  const [pagina, setPagina] = useState(1);

  const carregar = async (refresh = false) => {
    if (!inicio || !fim) return;
    if (inicio > fim) {
      setErro("A data inicial não pode ser maior que a final.");
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const q = new URLSearchParams({
        inicio,
        fim,
        ...(refresh ? { refresh: "1" } : {}),
      });
      const j = await apiJson(`/api/contas-receber/receita-financeira?${q}`, {
        timeoutMs: 5 * 60 * 1000,
      });
      setDados(j?.data || j);
      setPagina(1);
    } catch (e) {
      setErro(`Não consegui carregar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titulos = dados?.titulos || [];
  const resumo = dados?.resumo;
  const cons = resumo?.consideradas;
  const desc = resumo?.desconsideradas;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = titulos.filter((t) => {
      if (situacao === "atraso_sem_juros") {
        if (!t.atraso_sem_juros) return false;
      } else if (situacao !== "TODAS" && t.situacao !== situacao) return false;
      if (q) {
        const alvo =
          `${t.nm_cliente || ""} ${t.cd_cliente} ${t.nr_cpfcnpj || ""} ${t.nr_fatura} ${t.nm_portador || ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    const { campo, asc } = ordem;
    lista.sort((a, b) => {
      let va = a[campo];
      let vb = b[campo];
      if (campo === "nm_cliente") {
        va = (va || String(a.cd_cliente)).toLowerCase();
        vb = (vb || String(b.cd_cliente)).toLowerCase();
      }
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    return lista;
  }, [titulos, situacao, busca, ordem]);

  useEffect(() => setPagina(1), [situacao, busca]);

  const totaisFiltro = useMemo(
    () =>
      filtrados.reduce(
        (a, t) => {
          a.vl_fatura += t.vl_fatura;
          a.vl_pago += t.vl_pago;
          a.diferenca += t.vl_pago - t.vl_fatura;
          a.juros += t.vl_juros;
          a.multa += t.vl_multa;
          return a;
        },
        { vl_fatura: 0, vl_pago: 0, diferenca: 0, juros: 0, multa: 0 },
      ),
    [filtrados],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );

  const ordenar = (campo) =>
    setOrdem((o) =>
      o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true },
    );
  const Th = ({ campo, children, right, center }) => (
    <th
      onClick={() => ordenar(campo)}
      className={`px-2 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : center ? "text-center" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {ordem.campo === campo &&
          (ordem.asc ? (
            <CaretUp size={10} weight="bold" />
          ) : (
            <CaretDown size={10} weight="bold" />
          ))}
      </span>
    </th>
  );

  const exportarExcel = () => {
    const linhas = filtrados.map((t) => ({
      Cliente: t.nm_cliente || "",
      "Cód. cliente": t.cd_cliente,
      "CPF/CNPJ": t.nr_cpfcnpj || "",
      Empresa: t.cd_empresa,
      Fatura: t.nr_fatura,
      Parcela: t.nr_parcela,
      Portador: t.nm_portador || "",
      Emissão: fmtData(t.dt_emissao),
      Vencimento: fmtData(t.dt_vencimento),
      "Pago em": fmtData(t.dt_pagamento),
      "Dias de atraso": t.dias_atraso,
      "Valor da fatura": t.vl_fatura,
      "Valor pago": t.vl_pago,
      "Diferença (pago − fatura)":
        Math.round((t.vl_pago - t.vl_fatura) * 100) / 100,
      "% cobrado sobre a fatura": t.pct_juros,
      "Taxa de boleto": t.vl_taxa_boleto,
      "Juros cobrados": t.vl_juros_cobrado,
      "Atraso +3 dias sem juros": t.atraso_sem_juros ? "Sim" : "",
      "Juros (TOTVS)": t.vl_juros,
      "Multa (TOTVS)": t.vl_multa,
      "Desconto (TOTVS)": t.vl_desconto,
      "Abatimento (TOTVS)": t.vl_abatimento,
      "Tipo de baixa": t.tp_baixa ?? "",
      Situação: SITUACOES[t.situacao]?.label || t.situacao,
      "CREDEV usado": t.credev
        ? t.credev.map((c) => `${c.nr_titulo} (${fmtBRL(c.valor)})`).join("; ")
        : "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faturas pagas");
    if (cons) {
      const resumoLinhas = [
        { Indicador: "Faturas consideradas", Valor: cons.n },
        { Indicador: "Valor das faturas", Valor: cons.vl_fatura },
        { Indicador: "Valor pago", Valor: cons.vl_pago },
        {
          Indicador: "Receita financeira (pago a mais)",
          Valor: cons.pago_a_mais,
        },
        { Indicador: "Pago a menos (descontos)", Valor: cons.pago_a_menos },
        {
          Indicador: "Receita financeira líquida",
          Valor: cons.receita_financeira,
        },
        {
          Indicador: "% médio cobrado sobre as faturas",
          Valor: cons.pct_receita,
        },
        { Indicador: "Receita que é taxa de boleto", Valor: cons.taxa_boleto },
        { Indicador: "Receita que é juros", Valor: cons.juros_cobrado },
        {
          Indicador: `Pagas com mais de ${cons.atraso_sem_juros?.dias ?? 3} dias de atraso sem juros`,
          Valor: cons.atraso_sem_juros?.n ?? 0,
        },
        { Indicador: "Juros informados no TOTVS", Valor: cons.juros_totvs },
        { Indicador: "Multa informada no TOTVS", Valor: cons.multa_totvs },
        {
          Indicador: "Desconsideradas: sem valor pago",
          Valor: desc.sem_valor_pago.n,
        },
        {
          Indicador: "Desconsideradas: pagas com CREDEV",
          Valor: desc.credev.n,
        },
        {
          Indicador: "Desconsideradas: renegociação",
          Valor: desc.renegociacao.n,
        },
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(resumoLinhas),
        "Resumo",
      );
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `receita-financeira-${inicio}-a-${fim}.xlsx`,
    );
  };

  // campos e botões com a mesma altura (h-9) para a linha de filtros ficar alinhada
  const inputCls =
    "h-9 border border-[#000638]/30 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs";
  const labelCls =
    "text-[11px] font-semibold uppercase tracking-wide text-[#000638]";
  const btnPrimario =
    "h-9 inline-flex items-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-4 hover:bg-[#fe0000] transition-colors disabled:opacity-60";
  const btnSecundario =
    "h-9 inline-flex items-center gap-1.5 bg-white text-[#000638] border border-[#000638]/30 text-xs font-semibold rounded-lg px-3 hover:bg-gray-50 transition-colors disabled:opacity-50";

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Receita Financeira"
        subtitle="Faturas pagas no período e o que foi pago a mais do que a fatura: juros, multa e taxas"
        icon={Coins}
        iconColor="text-green-600"
      />

      {/* Filtros */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar(false);
        }}
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Pago de</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={`${inputCls} w-40`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Até</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className={`${inputCls} w-40`}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[260px] max-w-md">
            <label className={labelCls}>Filtrar a lista</label>
            <div className="relative">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Cliente, código, fatura ou portador"
                title="Filtra a lista já carregada (não consulta o TOTVS)"
                className={`${inputCls} w-full pl-8`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={loading} className={btnPrimario}>
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={14} weight="bold" />
              )}
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button
              type="button"
              onClick={() => carregar(true)}
              disabled={loading}
              title="Ignora o cache de 5 minutos e consulta o TOTVS de novo"
              className={btnSecundario}
            >
              <ArrowsClockwise size={14} weight="bold" /> Atualizar
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={!filtrados.length}
              title="Exporta a lista com os filtros aplicados e uma aba de resumo"
              className={btnSecundario}
            >
              <FileXls size={14} weight="bold" /> Excel ({filtrados.length})
            </button>
          </div>
        </div>
        {erro && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <Warning size={14} weight="fill" /> {erro}
          </div>
        )}
        {dados?.avisos?.map((a, i) => (
          <div
            key={i}
            className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          >
            {a}
          </div>
        ))}
      </form>

      {loading && !dados && (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
          <Spinner size={22} className="animate-spin inline-block mb-2" />
          <div>Consultando as faturas pagas no TOTVS...</div>
        </div>
      )}

      {cons && (
        <>
          {/* Dados | Dashboard */}
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex rounded-lg border border-[#000638]/30 bg-white p-0.5">
              {[
                { v: "dados", label: "Dados", Icon: Table },
                { v: "dashboard", label: "Dashboard", Icon: ChartLineUp },
              ].map(({ v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisao(v)}
                  className={`h-8 inline-flex items-center gap-1.5 rounded-md px-4 text-xs font-semibold transition-colors ${
                    visao === v
                      ? "bg-[#000638] text-white"
                      : "text-[#000638] hover:bg-gray-100"
                  }`}
                >
                  <Icon size={14} weight="bold" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
            <Card
              label="Faturas pagas"
              value={cons.n.toLocaleString("pt-BR")}
              sub={`${cons.clientes} cliente(s) · ${fmtData(inicio)} a ${fmtData(fim)}`}
              onClick={() => setSituacao("considerada")}
              active={situacao === "considerada"}
            />
            <Card
              label="Valor das faturas"
              value={fmtBRL(cons.vl_fatura)}
              sub="soma do valor original"
            />
            <Card
              label="Valor pago"
              value={fmtBRL(cons.vl_pago)}
              sub="soma do que entrou"
              color="text-green-700"
            />
            <Card
              label="Receita financeira"
              value={fmtBRL(cons.pago_a_mais)}
              sub={`pago a mais em ${cons.n_pago_a_mais} fatura(s) · ${fmtPct(cons.pct_receita)} sobre as faturas`}
              destaque
            />
            <Card
              label="Pago a menos"
              value={fmtBRL(cons.pago_a_menos)}
              sub={
                cons.n_pago_a_menos
                  ? `${cons.n_pago_a_menos} fatura(s) com desconto`
                  : "nenhuma fatura paga abaixo do valor"
              }
              color={cons.pago_a_menos < 0 ? "text-red-600" : "text-gray-400"}
            />
            <Card
              label="Juros + multa (TOTVS)"
              value={fmtBRL(cons.juros_totvs + cons.multa_totvs)}
              sub={`juros ${fmtBRL(cons.juros_totvs)} · multa ${fmtBRL(cons.multa_totvs)}`}
            />
          </div>

          {/* Atenção + desconsideradas */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <Card
              label={`Pagas em atraso (+${cons.atraso_sem_juros?.dias ?? 3} dias) sem juros`}
              value={`${cons.atraso_sem_juros?.n ?? 0} fatura(s)`}
              sub={`${fmtBRL(cons.atraso_sem_juros?.vl_fatura)} em faturas · ${cons.atraso_sem_juros?.clientes ?? 0} cliente(s) · pagaram no máximo a taxa de boleto (R$ 0,98) a mais`}
              color="text-red-600"
              onClick={() => setSituacao("atraso_sem_juros")}
              active={situacao === "atraso_sem_juros"}
            />
            <Card
              label="Fora: liquidação sem valor pago"
              value={`${desc.sem_valor_pago.n} fatura(s)`}
              sub={`${fmtBRL(desc.sem_valor_pago.vl_fatura)} em faturas · baixa por abatimento/decurso`}
              color="text-gray-600"
              onClick={() => setSituacao("sem_valor_pago")}
              active={situacao === "sem_valor_pago"}
            />
            <Card
              label="Fora: pagas com CREDEV"
              value={`${desc.credev.n} fatura(s)`}
              sub={`${fmtBRL(desc.credev.vl_pago)} quitados com crédito do cliente`}
              color="text-purple-700"
              onClick={() => setSituacao("credev")}
              active={situacao === "credev"}
            />
            <Card
              label="Fora: renegociação"
              value={`${desc.renegociacao.n} fatura(s)`}
              sub={`${fmtBRL(desc.renegociacao.vl_fatura)} em faturas · saldo virou título novo`}
              color="text-amber-700"
              onClick={() => setSituacao("renegociacao")}
              active={situacao === "renegociacao"}
            />
          </div>

          {visao === "dashboard" && (
            <Dashboard porMes={dados.porMes || []} cons={cons} />
          )}

          {/* Por mês */}
          {visao === "dados" && dados.porMes?.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-x-auto">
              <div className="px-3 py-2 border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-[#000638]">
                Por mês de pagamento (faturas consideradas)
              </div>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-left font-semibold">Mês</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Faturas
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Valor das faturas
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Valor pago
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Pago a mais
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Pago a menos
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Receita líquida
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porMes.map((m) => (
                    <tr key={m.mes} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-semibold text-[#000638]">
                        {fmtMes(m.mes)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{m.n}</td>
                      <td className="px-3 py-1.5 text-right">
                        {fmtBRL(m.vl_fatura)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {fmtBRL(m.vl_pago)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-700 font-semibold">
                        {fmtBRL(m.pago_a_mais)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-red-600">
                        {m.pago_a_menos ? fmtBRL(m.pago_a_menos) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#000638]">
                        {fmtBRL(m.receita_financeira)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lista */}
          <div
            className={`bg-white rounded-lg shadow-sm border border-gray-200 ${visao === "dados" ? "" : "hidden"}`}
          >
            <div className="px-3 py-2 border-b border-gray-200 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#000638]">
                Faturas
              </span>
              <span className="text-xs text-gray-600">
                · {FILTRO_LABEL[situacao] || situacao}
                {busca.trim() ? ` · filtro "${busca.trim()}"` : ""}
              </span>
              {situacao !== "TODAS" ? (
                <button
                  type="button"
                  onClick={() => setSituacao("TODAS")}
                  className="text-[11px] text-[#000638] underline hover:text-[#fe0000]"
                >
                  ver todas as faturas pagas
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSituacao("considerada")}
                  className="text-[11px] text-[#000638] underline hover:text-[#fe0000]"
                >
                  só as consideradas
                </button>
              )}
              <span className="text-[11px] text-gray-500 ml-auto">
                {filtrados.length} fatura(s) · fatura{" "}
                {fmtBRL(totaisFiltro.vl_fatura)} · pago{" "}
                {fmtBRL(totaisFiltro.vl_pago)} · diferença{" "}
                <b
                  className={
                    totaisFiltro.diferenca >= 0
                      ? "text-green-700"
                      : "text-red-600"
                  }
                >
                  {fmtBRL(totaisFiltro.diferenca)}
                </b>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <Th campo="nm_cliente">Cliente</Th>
                    <Th campo="nr_fatura">Fatura</Th>
                    <Th campo="cd_empresa" center>
                      Emp.
                    </Th>
                    <Th campo="nm_portador">Portador</Th>
                    <Th campo="dt_vencimento" center>
                      Vencimento
                    </Th>
                    <Th campo="dt_pagamento" center>
                      Pago em
                    </Th>
                    <Th campo="dias_atraso" right>
                      Atraso
                    </Th>
                    <Th campo="vl_fatura" right>
                      Valor fatura
                    </Th>
                    <Th campo="vl_pago" right>
                      Valor pago
                    </Th>
                    <Th campo="vl_diferenca" right>
                      Diferença
                    </Th>
                    <Th campo="pct_juros" right>
                      % juros
                    </Th>
                    <Th campo="vl_juros" right>
                      Juros
                    </Th>
                    <Th campo="vl_multa" right>
                      Multa
                    </Th>
                    <Th campo="tp_baixa" center>
                      Baixa
                    </Th>
                    <Th campo="situacao">Situação</Th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.length === 0 && (
                    <tr>
                      <td
                        colSpan={15}
                        className="px-3 py-8 text-center text-gray-500"
                      >
                        Nenhuma fatura com esses filtros
                      </td>
                    </tr>
                  )}
                  {visiveis.map((t) => {
                    const dif =
                      Math.round((t.vl_pago - t.vl_fatura) * 100) / 100;
                    const sit = SITUACOES[t.situacao] || {
                      label: t.situacao,
                      cor: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <tr
                        key={`${t.cd_empresa}-${t.nr_fatura}-${t.nr_parcela}-${t.dt_pagamento}`}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-2 py-1.5">
                          <div className="font-semibold text-[#000638]">
                            {t.nm_cliente || `Cliente ${t.cd_cliente}`}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Cód. {t.cd_cliente}
                            {t.nr_cpfcnpj ? ` · ${t.nr_cpfcnpj}` : ""}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {t.nr_fatura}
                          {t.nr_parcela ? `/${t.nr_parcela}` : ""}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {t.cd_empresa}
                        </td>
                        <td
                          className="px-2 py-1.5 text-gray-600 max-w-[180px] truncate"
                          title={t.nm_portador || ""}
                        >
                          {t.nm_portador || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          {fmtData(t.dt_vencimento)}
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          {fmtData(t.dt_pagamento)}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right ${t.dias_atraso > 0 ? "text-amber-700" : "text-gray-400"}`}
                        >
                          {t.dias_atraso > 0 ? `${t.dias_atraso}d` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {fmtBRL(t.vl_fatura)}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold text-green-700">
                          {t.vl_pago > 0 ? fmtBRL(t.vl_pago) : "—"}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right whitespace-nowrap font-bold ${dif > 0 ? "text-green-700" : dif < 0 ? "text-red-600" : "text-gray-400"}`}
                        >
                          {Math.abs(dif) > 0.005
                            ? `${dif > 0 ? "+" : ""}${fmtBRL(dif)}`
                            : "—"}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right whitespace-nowrap ${t.atraso_sem_juros ? "text-red-600 font-bold" : t.pct_juros > 0 ? "text-green-700" : "text-gray-400"}`}
                          title={
                            t.atraso_sem_juros
                              ? `${t.dias_atraso} dias de atraso e ${t.so_taxa_boleto ? "só a taxa de boleto (R$ 0,98) a mais" : "nada cobrado a mais"}`
                              : t.so_taxa_boleto
                                ? "só a taxa de boleto (R$ 0,98) a mais"
                                : "pago a mais ÷ valor da fatura"
                          }
                        >
                          {t.atraso_sem_juros
                            ? t.so_taxa_boleto
                              ? "só taxa ⚠"
                              : "0% ⚠"
                            : t.pct_juros
                              ? fmtPct(t.pct_juros)
                              : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap text-gray-600">
                          {t.vl_juros ? fmtBRL(t.vl_juros) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap text-gray-600">
                          {t.vl_multa ? fmtBRL(t.vl_multa) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {t.tp_baixa ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${sit.cor}`}
                          >
                            {sit.label}
                          </span>
                          {t.credev && (
                            <div className="text-[10px] text-purple-700 mt-0.5">
                              {t.credev
                                .map(
                                  (c) =>
                                    `CREDEV ${c.nr_titulo} · ${fmtBRL(c.valor)}`,
                                )
                                .join(" · ")}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtrados.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-bold text-[#000638]">
                      <td className="px-2 py-2" colSpan={7}>
                        Total ({filtrados.length} fatura(s))
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {fmtBRL(totaisFiltro.vl_fatura)}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-green-700">
                        {fmtBRL(totaisFiltro.vl_pago)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right whitespace-nowrap ${totaisFiltro.diferenca >= 0 ? "text-green-700" : "text-red-600"}`}
                      >
                        {fmtBRL(totaisFiltro.diferenca)}
                      </td>
                      <td
                        className="px-2 py-2 text-right whitespace-nowrap"
                        title="diferença total ÷ valor total das faturas"
                      >
                        {totaisFiltro.vl_fatura > 0
                          ? fmtPct(
                              (totaisFiltro.diferenca /
                                totaisFiltro.vl_fatura) *
                                100,
                            )
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {fmtBRL(totaisFiltro.juros)}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {fmtBRL(totaisFiltro.multa)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                <span>
                  Mostrando {(paginaAtual - 1) * POR_PAGINA + 1}–
                  {Math.min(paginaAtual * POR_PAGINA, filtrados.length)} de{" "}
                  {filtrados.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual <= 1}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <CaretLeft size={12} />
                  </button>
                  <span>
                    {paginaAtual} / {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((p) => Math.min(totalPaginas, p + 1))
                    }
                    disabled={paginaAtual >= totalPaginas}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <CaretRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
