import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent } from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import {
  Robot,
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  ArrowsClockwise,
  PaperPlaneTilt,
  Prohibit,
  CurrencyDollar,
  Flask,
} from '@phosphor-icons/react';

// ── Roadmap das automações do Financeiro ──────────────────────────────────
const AUTOMACOES = [
  {
    id: 1,
    nome: 'Envio de boletos por WhatsApp',
    desc: 'Dispara o boleto (PDF) ao cliente 3 dias antes e no dia do vencimento, pulando faturas pagas ou canceladas.',
    status: 'ativa',
  },
  {
    id: 2,
    nome: 'Régua de cobrança de inadimplentes',
    desc: 'Sequência de lembretes após o vencimento (D+1, D+7, D+15…) com escalonamento para o financeiro.',
    status: 'planejada',
  },
  {
    id: 3,
    nome: 'Classificação de respostas por IA',
    desc: 'Interpreta a resposta do cliente ("já paguei", "quero negociar") e aciona a ação correta.',
    status: 'planejada',
  },
  {
    id: 4,
    nome: 'Alertas de baixa e conciliação',
    desc: 'Notifica liquidações e divergências de conciliação automaticamente.',
    status: 'backlog',
  },
];

const STATUS_AUTOMACAO = {
  ativa: { label: 'Ativa', cls: 'bg-green-100 text-green-700' },
  planejada: { label: 'Planejada', cls: 'bg-blue-100 text-blue-700' },
  backlog: { label: 'Backlog', cls: 'bg-gray-100 text-gray-600' },
};

// ── Estilo por status de envio ─────────────────────────────────────────────
const STATUS_ENVIO = {
  enviado: { label: 'Enviado', cls: 'bg-green-100 text-green-700' },
  pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
  falha: { label: 'Falha', cls: 'bg-red-100 text-red-700' },
  pulado_pago: { label: 'Pulado — pago', cls: 'bg-gray-100 text-gray-600' },
  pulado_cancelado: {
    label: 'Pulado — cancelado',
    cls: 'bg-gray-100 text-gray-600',
  },
  pulado_sem_telefone: {
    label: 'Sem telefone',
    cls: 'bg-orange-100 text-orange-700',
  },
};

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
function fmtData(s) {
  if (!s) return '-';
  const d = String(s).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s;
}
function fmtHora(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
function hojeBRT() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const StatCard = ({ icon: Icon, label, value, cls, iconCls }) => (
  <Card className="flex-1 min-w-[140px]">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`p-2 rounded-full ${cls}`}>
        <Icon size={22} weight="light" className={iconCls} />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#000638] leading-none">
          {value}
        </div>
        <div className="text-xs text-gray-500 mt-1">{label}</div>
      </div>
    </CardContent>
  </Card>
);

const AutomacaoFinanceiro = () => {
  const { user } = useAuth();
  const [data, setData] = useState(hojeBRT());
  const [envios, setEnvios] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [acao, setAcao] = useState(null); // feedback de gatilho manual

  const carregar = useCallback(async (dia) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/automacao/boletos/envios?data=${dia}`,
      );
      const json = await r.json();
      if (!json.success) throw new Error(json.message || 'Erro ao carregar');
      setEnvios(json.envios || []);
      setResumo(json.resumo || null);
    } catch (e) {
      setErro(e.message);
      setEnvios([]);
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'owner') carregar(data);
  }, [data, user, carregar]);

  const testarEnvio = async () => {
    setAcao({ tipo: 'loading', msg: 'Enviando 1 boleto de teste ao seu número…' });
    try {
      const r = await fetch(`${API_BASE_URL}/api/automacao/boletos/testar`, {
        method: 'POST',
      });
      const json = await r.json();
      const res = json.resultado || {};
      if (!res.ok) throw new Error(res.error || json.message || 'Erro no teste');
      const a = res.amostra || {};
      setAcao({
        tipo: 'ok',
        msg: `🧪 Teste enviado para ${res.destino} (instância "${res.instancia}"). Amostra: ${a.cliente} — fatura ${a.fatura} (${a.tipo}), ${fmtBRL(a.valor)}. Confira seu WhatsApp.`,
      });
    } catch (e) {
      setAcao({ tipo: 'erro', msg: e.message });
    }
  };

  const simular = async () => {
    setAcao({ tipo: 'loading', msg: 'Simulando planejamento (dry run)…' });
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/automacao/boletos/run?dryRun=1`,
        { method: 'POST' },
      );
      const json = await r.json();
      if (!json.success) throw new Error(json.message || 'Erro');
      const res = json.resultado || {};
      const testeMsg = res.modo_teste
        ? ` 🧪 MODO TESTE ATIVO — envios iriam para ${res.test_phone}.`
        : '';
      setAcao({
        tipo: 'ok',
        msg: `Simulação: ${res.selecionados ?? 0} fatura(s) elegíveis (D-3: ${res.d3 ?? 0}, D-0: ${res.d0 ?? 0}, sem telefone: ${res.sem_telefone ?? 0}) de ${res.total_faturas ?? 0} no período.${testeMsg}`,
      });
    } catch (e) {
      setAcao({ tipo: 'erro', msg: e.message });
    }
  };

  // Guard: só owner
  if (user?.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Warning size={64} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Acesso Negado
            </h2>
            <p className="text-gray-600">
              Apenas proprietários podem acessar a Automação Financeiro.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Automação Financeiro"
        subtitle="Central de automações do financeiro — logs e status de execução"
        icon={Robot}
        iconColor="text-emerald-600"
      />

      {/* Roadmap de automações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {AUTOMACOES.map((a) => {
          const st = STATUS_AUTOMACAO[a.status];
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[#000638] text-sm">
                    {a.id}. {a.nome}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}
                  >
                    {st.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {a.desc}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Automação #1 — Envio de boletos */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-bold text-[#000638] flex items-center gap-2">
          <PaperPlaneTilt size={20} className="text-emerald-600" />
          Envio de boletos por WhatsApp — logs
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => carregar(data)}
            className="flex items-center gap-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <ArrowsClockwise size={16} /> Atualizar
          </button>
          <button
            onClick={simular}
            className="flex items-center gap-1 bg-[#000638] text-white rounded-lg px-3 py-1.5 text-sm hover:opacity-90"
          >
            <Flask size={16} /> Simular hoje
          </button>
          <button
            onClick={testarEnvio}
            className="flex items-center gap-1 bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm hover:opacity-90"
          >
            <PaperPlaneTilt size={16} /> Enviar 1 teste
          </button>
        </div>
      </div>

      {acao && (
        <div
          className={`text-sm rounded-lg px-3 py-2 mb-3 ${
            acao.tipo === 'ok'
              ? 'bg-green-50 text-green-700'
              : acao.tipo === 'erro'
                ? 'bg-red-50 text-red-700'
                : 'bg-blue-50 text-blue-700'
          }`}
        >
          {acao.msg}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="flex flex-wrap gap-3 mb-4">
        <StatCard
          icon={CheckCircle}
          label="Enviados"
          value={resumo?.enviado ?? 0}
          cls="bg-green-50"
          iconCls="text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Pendentes"
          value={resumo?.pendente ?? 0}
          cls="bg-yellow-50"
          iconCls="text-yellow-600"
        />
        <StatCard
          icon={XCircle}
          label="Falhas"
          value={resumo?.falha ?? 0}
          cls="bg-red-50"
          iconCls="text-red-600"
        />
        <StatCard
          icon={Prohibit}
          label="Pulados (pago/cancel.)"
          value={(resumo?.pulado_pago ?? 0) + (resumo?.pulado_cancelado ?? 0)}
          cls="bg-gray-100"
          iconCls="text-gray-600"
        />
        <StatCard
          icon={CurrencyDollar}
          label="Valor total"
          value={fmtBRL(resumo?.valor_total)}
          cls="bg-emerald-50"
          iconCls="text-emerald-600"
        />
      </div>

      {/* Tabela de envios */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Carregando…
            </div>
          ) : erro ? (
            <div className="p-8 text-center text-red-500 text-sm">
              Erro: {erro}
            </div>
          ) : envios.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Nenhum disparo registrado em {fmtData(data)}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Telefone</th>
                  <th className="text-left px-3 py-2">Fatura</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-center px-3 py-2">Vencimento</th>
                  <th className="text-center px-3 py-2">Tipo</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2">Agendado</th>
                  <th className="text-center px-3 py-2">Enviado</th>
                  <th className="text-left px-3 py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => {
                  const st = STATUS_ENVIO[e.status] || {
                    label: e.status,
                    cls: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 max-w-[200px] truncate" title={e.nome_cliente}>
                        {e.nome_cliente || `Cliente ${e.cd_cliente}`}
                      </td>
                      <td className="px-3 py-2">{e.telefone || '-'}</td>
                      <td className="px-3 py-2">
                        {e.nr_fatura}/{e.nr_parcela}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {fmtBRL(e.vl_fatura)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {fmtData(e.dt_vencimento)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                          {e.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}
                        >
                          {st.label}
                        </span>
                        {e.redirecionado_para && (
                          <div
                            className="text-[9px] mt-0.5 text-orange-600 whitespace-nowrap"
                            title={`Redirecionado para ${e.redirecionado_para} (cliente real: ${e.telefone || 'sem telefone'})`}
                          >
                            🧪 teste → {e.redirecionado_para}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">
                        {fmtHora(e.scheduled_at)}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">
                        {fmtHora(e.enviado_em)}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[220px] truncate text-xs text-gray-500"
                        title={e.erro || e.conteudo_enviado || ''}
                      >
                        {e.erro || (e.status === 'enviado' ? 'Mensagem enviada' : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomacaoFinanceiro;
