// Contas a Receber — Hoje. O que entrou, o que vai entrar e o que precisa da
// sua ação, num lugar só (pedido do João, Recuperação de Créditos, 21/10/2026,
// inspirado na tela Hoje do Dryland /cobranca). Dados do backend em
// GET /api/contas-receber/hoje (cache de 5 min; "Atualizar" força).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  ArrowsClockwise,
  Spinner,
  Warning,
  CheckCircle,
  ArrowRight,
  CaretDown,
  CaretUp,
  Copy,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { apiJson } from '../utils/apiAuth';

function fmtBRL(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(s) {
  if (!s) return '—';
  const [a, m, d] = String(s).slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : s;
}
function fmtHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function Kpi({ label, value, sub, color = 'text-[#000638]', onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white rounded-lg border p-3 ${onClick ? 'hover:border-[#000638] cursor-pointer' : ''} ${
        active ? 'border-[#000638] ring-1 ring-[#000638]' : 'border-gray-200'
      }`}
    >
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </Tag>
  );
}

function Coluna({ titulo, cor, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className={`px-3 py-2 border-b border-gray-200 text-xs font-bold uppercase tracking-wide ${cor}`}>{titulo}</div>
      <div className="p-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Linha({ label, valor, sub }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <div>
        <div className="font-semibold text-[#000638]">{label}</div>
        {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
      </div>
      <div className="font-bold text-[#000638] whitespace-nowrap">{valor}</div>
    </div>
  );
}

export default function ContasReceberHoje() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState({}); // demandas expandidas
  const [verRecebidos, setVerRecebidos] = useState(false);
  const [verRecebiveis, setVerRecebiveis] = useState(null); // 'hoje' | 'amanha' | null
  const [copiado, setCopiado] = useState(false);

  // O servidor devolve o último snapshot na hora; a carga pesada roda uma vez
  // por dia (job) ou quando se clica em Atualizar (em segundo plano). Enquanto
  // `gerando`, a tela consulta de novo a cada 15 s até vir o snapshot novo.
  const carregar = async (refresh = false) => {
    setLoading(true);
    setErro('');
    try {
      const j = await apiJson(`/api/contas-receber/hoje${refresh ? '?refresh=1' : ''}`, { timeoutMs: 60 * 1000 });
      setDados(j?.data || j);
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

  useEffect(() => {
    if (!dados?.gerando || loading) return undefined;
    const t = setTimeout(() => carregar(false), 15000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  const rec = dados?.recebido;
  const pm = dados?.pagarme;
  const meta = dados?.meta;
  const vt = dados?.vencidoTotal;
  const rb = dados?.recebiveis;
  const demandas = dados?.demandas || [];
  const METODO = { boleto: 'boleto', credit_card: 'cartão', debit_card: 'débito', pix: 'Pix' };
  const resumoMetodos = (bl) =>
    bl && bl.porMetodo
      ? Object.entries(bl.porMetodo)
          .map(([m, v]) => `${METODO[m] || m} ${fmtBRL(v.liquido)}`)
          .join(' · ')
      : '';
  const urgentes = demandas.filter((d) => d.urgente).length;

  const faturasCancelar = useMemo(() => {
    const d = demandas.find((x) => x.chave === 'boleto_cancelar');
    return (d?.itens || []).map((i) => `${i.cd_empresa}-${i.nr_fatura}-${i.nr_parcela}`).join('\n');
  }, [demandas]);

  const copiarFaturas = async () => {
    try {
      await navigator.clipboard.writeText(faturasCancelar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  const entrouHoje = (rec?.hoje?.valor || 0) + 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Hoje"
        subtitle={
          dados?.geradoEm
            ? `${fmtData(dados.dia)} · o que entrou, o que vai entrar e o que precisa de você · carga de ${fmtData(dados.snapshotDia || dados.dia)} ${fmtHora(dados.geradoEm)}${dados.gerando ? ' · gerando carga nova...' : ''}`
            : 'O que entrou, o que vai entrar e o que precisa de você'
        }
        icon={Sun}
        iconColor="text-amber-500"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => carregar(true)}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60"
        >
          {loading ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} weight="bold" />}
          {loading ? 'Carregando...' : dados?.gerando ? 'Gerando carga nova...' : 'Atualizar (gera carga nova)'}
        </button>
        {urgentes > 0 && (
          <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
            {urgentes} demanda(s) urgente(s)
          </span>
        )}
        {erro && (
          <span className="flex items-center gap-1.5 text-xs text-red-600">
            <Warning size={14} weight="fill" /> {erro}
          </span>
        )}
      </div>

      {(loading && !dados) || (dados?.gerando && !dados?.geradoEm) ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
          <Spinner size={22} className="animate-spin inline-block mb-2" />
          <div>Gerando a carga do dia (TOTVS, Pagar.me e pendências do HeadCoach)... leva de 1 a 2 minutos. A tela atualiza sozinha.</div>
        </div>
      ) : null}

      {dados?.desatualizado && dados?.geradoEm && (
        <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta carga é de {fmtData(dados.snapshotDia)}. {dados.gerando ? 'A carga de hoje está sendo gerada e a tela atualiza sozinha.' : 'Clique em Atualizar para gerar a carga de hoje.'}
        </div>
      )}

      {dados?.geradoEm && (
        <>
          {dados.avisos?.length > 0 && (
            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {dados.avisos.map((a, i) => (
                <div key={i}>• {a}</div>
              ))}
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
            <Kpi
              label="Recebido hoje (TOTVS)"
              value={fmtBRL(rec?.hoje?.valor)}
              color="text-green-700"
              sub={rec ? `${rec.hoje.n} título(s) · semana ${fmtBRL(rec.semana.valor)} · mês ${fmtBRL(rec.mes.valor)}` : ''}
              onClick={() => setVerRecebidos((v) => !v)}
              active={verRecebidos}
            />
            <Kpi
              label="Boletos Pagar.me pagos hoje"
              value={fmtBRL(pm?.pagosHoje?.valor)}
              color="text-green-700"
              sub={pm ? `${pm.pagosHoje.n} boleto(s)${pm.aguardandoBaixa?.n ? ` · ${pm.aguardandoBaixa.n} aguardando baixa` : ''}` : ''}
            />
            <Kpi
              label="Vence hoje"
              value={fmtBRL(dados.venceHoje?.valor)}
              color="text-amber-600"
              sub={dados.venceHoje ? `${dados.venceHoje.n} título(s) · ${dados.venceHoje.clientes} cliente(s)` : ''}
            />
            <Kpi
              label="Vence nos próximos 7 dias"
              value={fmtBRL(dados.proximos7?.valor)}
              sub={dados.proximos7 ? `${dados.proximos7.n} título(s)` : ''}
            />
            <Kpi
              label="Vencido total (4 canais)"
              value={vt ? fmtBRL(vt.valor) : 'carregando...'}
              color="text-red-600"
              sub={vt ? `${vt.clientes} cliente(s) · ${vt.n} título(s) · +60d: ${fmtBRL(vt.inadimplentes60?.valor)}` : 'a lista de devedores demora na primeira carga'}
            />
          </div>

          {/* Recebíveis Pagar.me: dinheiro que caiu / vai cair na conta (data de crédito, não de pagamento) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            <Kpi
              label={`Recebido em conta hoje (Pagar.me${rb ? `, ${fmtData(rb.hoje.dia)}` : ''})`}
              value={rb ? fmtBRL(rb.hoje.liquido) : '—'}
              color="text-green-700"
              sub={rb ? `${rb.hoje.n} recebível(is) · boletos ${fmtBRL(rb.hoje.boletos.liquido)} (${rb.hoje.boletos.n})${rb.hoje.n ? ` · ${resumoMetodos(rb.hoje)}` : ''} · líquido de tarifa` : 'sem dado da Pagar.me'}
              onClick={rb ? () => setVerRecebiveis((v) => (v === 'hoje' ? null : 'hoje')) : undefined}
              active={verRecebiveis === 'hoje'}
            />
            <Kpi
              label={`Boleto a receber ${rb ? fmtData(rb.amanha.dia) : 'amanhã'} (Pagar.me)`}
              value={rb ? fmtBRL(rb.amanha.liquido) : '—'}
              color="text-blue-700"
              sub={rb ? `${rb.amanha.n} recebível(is) · boletos ${fmtBRL(rb.amanha.boletos.liquido)} (${rb.amanha.boletos.n})${rb.amanha.n ? ` · ${resumoMetodos(rb.amanha)}` : ''} · ${rb.amanha.creditado ? 'já creditado' : 'agendado pela Pagar.me'}` : 'sem dado da Pagar.me'}
              onClick={rb ? () => setVerRecebiveis((v) => (v === 'amanha' ? null : 'amanha')) : undefined}
              active={verRecebiveis === 'amanha'}
            />
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">Próximos créditos (Pagar.me)</div>
              {rb && rb.proximos.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {rb.proximos.slice(0, 8).map((d) => (
                    <span key={d.dia} className="text-[11px] rounded border border-blue-200 bg-blue-50 text-blue-800 px-1.5 py-0.5">
                      {fmtData(d.dia).slice(0, 5)}: <b>{fmtBRL(d.liquido)}</b> ({d.n})
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 mt-1">nenhum crédito agendado</div>
              )}
              <div className="text-[10px] text-gray-400 mt-1">
                Contas: {rb ? rb.contas.map((c) => `${c.nome}${c.configurada ? '' : ' (sem chave)'}`).join(' · ') : '—'}
              </div>
            </div>
          </div>

          {verRecebiveis && rb && (
            <div className="bg-white rounded-lg border border-gray-200 mb-3 overflow-x-auto">
              <div className="px-3 py-2 text-xs font-bold text-[#000638] border-b border-gray-100">
                {verRecebiveis === 'hoje' ? 'Caiu na conta hoje' : `Cai na conta em ${fmtData(rb.amanha.dia)}`} — por recebível (Pagar.me)
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Conta</th>
                    <th className="px-2 py-1.5 text-left">Forma</th>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">Fatura</th>
                    <th className="px-2 py-1.5 text-left">Pago em</th>
                    <th className="px-2 py-1.5 text-right">Pago</th>
                    <th className="px-2 py-1.5 text-right">Tarifa</th>
                    <th className="px-2 py-1.5 text-right">Líquido</th>
                    <th className="px-2 py-1.5 text-left">Baixa TOTVS</th>
                  </tr>
                </thead>
                <tbody>
                  {(verRecebiveis === 'hoje' ? rb.hoje : rb.amanha).itens.map((i, ix) => (
                    <tr key={ix} className="border-b border-gray-100">
                      <td className="px-2 py-1 whitespace-nowrap">{i.conta === 'fabio' ? 'FA MODA' : 'Crosby'}</td>
                      <td className="px-2 py-1">{METODO[i.metodo] || i.metodo}</td>
                      <td className="px-2 py-1">
                        {i.cd_cliente ? <span className="text-gray-500">{i.cd_cliente} - </span> : null}
                        {i.nome || '—'}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{i.nr_fatura ? `${i.nr_fatura}/${i.nr_parcela}` : '—'}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{i.pago_em ? new Date(i.pago_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-2 py-1 text-right">{fmtBRL(i.bruto)}</td>
                      <td className="px-2 py-1 text-right text-gray-500">{fmtBRL(i.tarifa)}</td>
                      <td className="px-2 py-1 text-right font-semibold">{fmtBRL(i.liquido)}</td>
                      <td className="px-2 py-1">{i.baixa || '—'}</td>
                    </tr>
                  ))}
                  {!(verRecebiveis === 'hoje' ? rb.hoje : rb.amanha).itens.length && (
                    <tr>
                      <td colSpan={9} className="px-2 py-4 text-center text-gray-400">
                        Nenhum recebível nesse dia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {verRecebidos && (
            <div className="bg-white rounded-lg border border-gray-200 mb-3 overflow-x-auto">
              <div className="px-3 py-2 text-xs font-bold text-[#000638] border-b border-gray-100">Recebido hoje no TOTVS — maiores títulos</div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Empresa</th>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">Fatura</th>
                    <th className="px-2 py-1.5 text-left">Vencimento</th>
                    <th className="px-2 py-1.5 text-left">Portador</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(dados.recebidoHojeItens || []).map((t, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1">{t.cd_empresa}</td>
                      <td className="px-2 py-1">
                        <span className="text-gray-500">{t.cd_cliente} - </span>
                        {t.nome}
                      </td>
                      <td className="px-2 py-1">
                        {t.nr_fatura}/{t.nr_parcela}
                      </td>
                      <td className="px-2 py-1">{fmtData(t.vencimento)}</td>
                      <td className="px-2 py-1">{t.portador ?? '—'}</td>
                      <td className="px-2 py-1 text-right font-semibold">{fmtBRL(t.valor)}</td>
                    </tr>
                  ))}
                  {!(dados.recebidoHojeItens || []).length && (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                        Nenhuma baixa hoje ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 3 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <Coluna titulo="Entrou" cor="text-green-700">
              <Linha label="Baixas no TOTVS hoje" valor={fmtBRL(entrouHoje)} sub={rec ? `${rec.hoje.n} título(s) de ${rec.hoje.clientes} cliente(s)` : ''} />
              <Linha label="Boletos Pagar.me pagos hoje" valor={fmtBRL(pm?.pagosHoje?.valor)} sub={pm ? `${pm.pagosHoje.n} boleto(s)` : ''} />
              <Linha label="Caiu na conta hoje (Pagar.me)" valor={rb ? fmtBRL(rb.hoje.liquido) : '—'} sub={rb ? `${rb.hoje.n} recebível(is), líquido de tarifa` : ''} />
              <Linha label="Semana (desde segunda)" valor={fmtBRL(rec?.semana?.valor)} sub={rec ? `${rec.semana.n} título(s)` : ''} />
              <Linha label="Mês" valor={fmtBRL(rec?.mes?.valor)} sub={rec ? `${rec.mes.n} título(s) · ${rec.mes.clientes} cliente(s)` : ''} />
              {(dados.pagarmePagosHojeItens || []).length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <div className="text-[11px] font-semibold text-gray-600 mb-1">Pagar.me pagos hoje</div>
                  {dados.pagarmePagosHojeItens.slice(0, 8).map((b, i) => (
                    <div key={i} className="flex justify-between text-[11px] text-gray-700">
                      <span className="truncate pr-2">
                        {b.cd_cliente} - {b.nome} · {b.nr_fatura}/{b.nr_parcela}
                      </span>
                      <span className="whitespace-nowrap">{fmtBRL(b.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Coluna>

            <Coluna titulo="Vai entrar" cor="text-blue-700">
              <Linha label={`Cai na conta ${rb ? fmtData(rb.amanha.dia).slice(0, 5) : 'amanhã'} (Pagar.me)`} valor={rb ? fmtBRL(rb.amanha.liquido) : '—'} sub={rb ? `${rb.amanha.n} recebível(is) já pagos pelos clientes` : ''} />
              <Linha label="Vence hoje" valor={fmtBRL(dados.venceHoje?.valor)} sub={dados.venceHoje ? `${dados.venceHoje.n} título(s)` : ''} />
              <Linha label="Próximos 7 dias" valor={fmtBRL(dados.proximos7?.valor)} sub={dados.proximos7 ? `${dados.proximos7.n} título(s)` : ''} />
              <Linha
                label="Boletos Pagar.me a vencer (7 dias)"
                valor={fmtBRL(pm?.aVencer7?.valor)}
                sub={pm ? `${pm.aVencer7.n} boleto(s) · pendentes no total: ${pm.pendentes.n}` : ''}
              />
              {(dados.proximos7?.porDia || []).length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <div className="text-[11px] font-semibold text-gray-600 mb-1">Por dia</div>
                  {dados.proximos7.porDia.map((d) => (
                    <div key={d.dia} className="flex justify-between text-[11px] text-gray-700">
                      <span>{fmtData(d.dia)}</span>
                      <span>
                        {d.n} · {fmtBRL(d.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Coluna>

            <Coluna titulo={`Precisa de você${demandas.length ? ` (${demandas.length})` : ''}`} cor="text-red-700">
              {demandas.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle size={14} weight="fill" /> Nada pendente agora.
                </div>
              )}
              {demandas.map((d) => (
                <div key={d.chave} className={`rounded-lg border ${d.urgente ? 'border-red-200 bg-red-50' : 'border-gray-200'} p-2`}>
                  <button
                    type="button"
                    onClick={() => setAberto((a) => ({ ...a, [d.chave]: !a[d.chave] }))}
                    className="w-full flex items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#000638]">
                        {d.urgente && <span className="text-[10px] bg-red-600 text-white rounded px-1 mr-1">URGENTE</span>}
                        {d.titulo}
                      </div>
                      <div className="text-[11px] text-gray-600">{d.descricao}</div>
                    </div>
                    {aberto[d.chave] ? <CaretUp size={14} /> : <CaretDown size={14} />}
                  </button>
                  {aberto[d.chave] && (
                    <div className="mt-2 text-[11px] text-gray-700">
                      <div>
                        <b>O que fazer:</b> {d.oQueFazer}
                      </div>
                      {d.chave === 'boleto_cancelar' && faturasCancelar && (
                        <button
                          type="button"
                          onClick={copiarFaturas}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#000638] underline decoration-dotted"
                        >
                          {copiado ? <CheckCircle size={12} weight="fill" className="text-green-700" /> : <Copy size={12} weight="bold" />}
                          {copiado ? 'Copiado!' : 'Copiar lista de faturas (empresa-fatura-parcela) pra colar na baixa em massa'}
                        </button>
                      )}
                      {d.itens?.length > 0 && (
                        <div className="overflow-x-auto max-h-56 overflow-y-auto mt-2 border border-gray-100 rounded">
                          <table className="w-full text-[11px]">
                            <thead className="bg-gray-50 text-gray-600 sticky top-0">
                              <tr>
                                <th className="px-2 py-1 text-left">Cliente</th>
                                <th className="px-2 py-1 text-left">Fatura</th>
                                <th className="px-2 py-1 text-left">{d.chave === 'boleto_cancelar' ? 'Motivo' : 'Em'}</th>
                                <th className="px-2 py-1 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.itens.map((i, ix) => (
                                <tr key={ix} className="border-b border-gray-100">
                                  <td className="px-2 py-1">
                                    <span className="text-gray-500">{i.cd_cliente} - </span>
                                    {i.nome || '—'}
                                  </td>
                                  <td className="px-2 py-1 whitespace-nowrap">
                                    {i.cd_empresa ? `${i.cd_empresa}-` : ''}
                                    {i.nr_fatura}/{i.nr_parcela}
                                  </td>
                                  <td className="px-2 py-1 whitespace-nowrap">
                                    {d.chave === 'boleto_cancelar' ? `${i.motivo}${i.baixa_em ? ` · ${fmtData(i.baixa_em)}` : ''}` : fmtData(i.em)}
                                  </td>
                                  <td className="px-2 py-1 text-right">{fmtBRL(i.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {d.rota && (
                        <button
                          type="button"
                          onClick={() => navigate(d.rota)}
                          className="mt-2 inline-flex items-center gap-1 bg-[#000638] text-white text-[11px] font-semibold rounded-lg px-2.5 py-1.5 hover:bg-[#fe0000] transition-colors"
                        >
                          Abrir a tela <ArrowRight size={12} weight="bold" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Coluna>
          </div>

          {/* Meta do mês */}
          {meta && meta.base > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#000638]">
                  Meta do mês: recuperar {meta.metaMesPct}% do que vence em {MESES[Number(meta.mes.slice(5, 7)) - 1]}{' '}
                  <span className="font-normal text-gray-500">({meta.metaSemanaPct}% por semana)</span>
                </div>
                <div className="text-xs">
                  Recuperado <b>{fmtBRL(meta.pago)}</b> · vence no mês <b>{fmtBRL(meta.base)}</b> ·{' '}
                  <b className={`text-base ${meta.pct >= meta.metaAteSemanaPct ? 'text-green-700' : 'text-amber-600'}`}>
                    {meta.pct.toFixed(1).replace('.', ',')}%
                  </b>{' '}
                  <span className="text-gray-500">
                    · até a {meta.semanaAtual}ª semana a meta é {meta.metaAteSemanaPct}%
                  </span>
                </div>
              </div>
              <div className="relative h-4 rounded-full bg-gray-200 my-2 overflow-hidden">
                <div
                  className={`h-4 rounded-full ${meta.pct >= meta.metaAteSemanaPct ? 'bg-green-600' : 'bg-blue-600'}`}
                  style={{ width: `${Math.min(100, meta.pct)}%` }}
                />
                {[1, 2, 3, 4].map((k) => (
                  <div
                    key={k}
                    title={`${k * meta.metaSemanaPct}%`}
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-500 opacity-60"
                    style={{ left: `${k * meta.metaSemanaPct}%` }}
                  />
                ))}
              </div>
              <div className="text-[11px] text-gray-600">
                {meta.pct >= meta.metaAteSemanaPct ? 'No ritmo da meta.' : `Faltam ${fmtBRL(meta.faltaSemana)} pra chegar nos ${meta.metaAteSemanaPct}% desta semana.`}{' '}
                Faltam {fmtBRL(meta.faltaMes)} pros {meta.metaMesPct}% do mês. Vencido até hoje no mês: {fmtBRL(meta.vencidoAteHoje)} · a vencer: {fmtBRL(meta.aVencer)}.
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Semana</th>
                      <th className="px-2 py-1 text-left">Dias</th>
                      <th className="px-2 py-1 text-right">Recuperado</th>
                      <th className="px-2 py-1 text-right">% do mês</th>
                      <th className="px-2 py-1 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.semanas.map((w) => (
                      <tr key={w.n} className={`border-b border-gray-100 ${w.atual ? 'font-bold' : ''}`}>
                        <td className="px-2 py-1">{w.n}ª semana</td>
                        <td className="px-2 py-1">
                          {fmtData(w.ini).slice(0, 5)} a {fmtData(w.fim).slice(0, 5)}
                        </td>
                        <td className="px-2 py-1 text-right">{w.futura ? '—' : fmtBRL(w.pago)}</td>
                        <td className={`px-2 py-1 text-right ${w.futura ? '' : w.pct >= meta.metaSemanaPct ? 'text-green-700' : 'text-amber-600'}`}>
                          {w.futura ? '—' : `${w.pct.toFixed(1).replace('.', ',')}%`}
                        </td>
                        <td className="px-2 py-1 text-[11px]">
                          {w.futura ? (
                            <span className="text-gray-400">ainda não começou</span>
                          ) : w.pct >= meta.metaSemanaPct ? (
                            <span className="text-green-700">bateu {meta.metaSemanaPct}%</span>
                          ) : w.atual ? (
                            <span className="text-amber-600">faltam {fmtBRL(Math.max(0, (meta.metaSemanaPct / 100) * meta.base - w.pago))}</span>
                          ) : (
                            <span className="text-red-600">ficou abaixo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Mesma regra da tela Metas Inadimplência: vence no mês = valor cheio de toda fatura com vencimento no mês, paga ou não; recuperado = tudo que foi pago no
                mês, de qualquer vencimento. Renegociação fica fora.
              </p>
            </div>
          )}

          {vt?.porCanal && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-xs font-bold text-[#000638] mb-2">Vencido por canal</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(vt.porCanal).map(([canal, c]) => (
                  <div key={canal} className="rounded-lg border border-gray-100 px-2 py-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{canal}</div>
                    <div className="text-sm font-extrabold text-red-600">{fmtBRL(c.valor_vencido)}</div>
                    <div className="text-[10px] text-gray-500">
                      {c.clientes} cliente(s) · {c.titulos} título(s)
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Lista consolidada de devedores (Multimarcas, Revenda, Franquias e BlueCred), atualizada a cada 10 minutos.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
