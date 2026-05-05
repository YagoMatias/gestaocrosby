import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  WhatsappLogo,
  Link as LinkIcon,
  Sparkle,
  CheckCircle,
  XCircle,
  Clock,
  MagnifyingGlass,
  ArrowRight,
} from '@phosphor-icons/react';
import {
  COLORS,
  cleanPhone,
  formatPhone,
  getContactStatus,
  instLabel,
  VENDEDORES_POR_MODULO,
} from './constants';

// Cores por categoria para badges
const CATEGORIA_COLORS = {
  Varejo: { bg: 'bg-orange-100', text: 'text-orange-700' },
  Revenda: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Multimarcas: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Business: { bg: 'bg-teal-100', text: 'text-teal-700' },
  Franquia: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};
function catColor(cat = '') {
  for (const [k, v] of Object.entries(CATEGORIA_COLORS)) {
    if (cat.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return { bg: 'bg-gray-100', text: 'text-gray-600' };
}

// ─── Card de vendedor com breakdown por categoria ───────────────────────────
function CardItem({ item, color, onClick }) {
  const enc = item.enc || 0;
  const conv = item.conv || 0;
  const naoConv = Math.max(0, enc - conv);
  const taxa = enc > 0 ? ((conv / enc) * 100).toFixed(1) : '0.0';
  const taxaNum = parseFloat(taxa);

  // Categorias ordenadas por encaminhados desc
  const cats = Object.entries(item.porCategoria || {}).sort(
    (a, b) => b[1].enc - a[1].enc,
  );

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-gray-100 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-all"
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: color }}
          />
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {item.nome}
          </h3>
        </div>
        <span className="text-[10px] font-medium text-gray-400 shrink-0 ml-2 tabular-nums">
          {enc} leads
        </span>
      </div>

      {/* Breakdown por categoria */}
      {cats.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {cats.map(([cat, stats]) => {
            const cc = catColor(cat);
            const t =
              stats.enc > 0 ? ((stats.conv / stats.enc) * 100).toFixed(0) : '0';
            return (
              <div key={cat} className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${cc.bg} ${cc.text}`}
                >
                  {cat
                    .replace('Multimarcas Inbound', 'MTM Inbound')
                    .replace('Multimarcas Outbound', 'MTM Outbound')}
                </span>
                <div className="flex-1 flex items-center justify-between gap-1 min-w-0">
                  <div className="flex-1 h-1 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: enc > 0 ? `${(stats.enc / enc) * 100}%` : '0%',
                        background: color,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-500 shrink-0">
                    {stats.enc}
                    {stats.conv > 0 && (
                      <span className="text-emerald-600 ml-0.5">
                        /{stats.conv}✓
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-400 tabular-nums shrink-0">
                    {t}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totais */}
      <div className="pt-2.5 border-t border-gray-50 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="tabular-nums font-medium text-emerald-600">
            {conv} conv.
          </span>
          <span className="tabular-nums text-gray-400">
            {naoConv} não conv.
          </span>
        </div>
        <span
          className={`font-medium tabular-nums ${taxaNum > 0 ? 'text-gray-900' : 'text-gray-300'}`}
        >
          {taxa}%
        </span>
      </div>
    </div>
  );
}

// ─── View de detalhes (lista de leads) ──────────────────────────────────────
function ListView({
  group,
  onBack,
  onChatLead,
  onChatCloser,
  onAnalise,
  phoneStatus,
}) {
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroQual, setFiltroQual] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroContato, setFiltroContato] = useState('');

  const { tasks, statuses, origens, quals } = useMemo(() => {
    const ts = group?.tasks || [];
    const st = new Set(),
      or = new Set(),
      qu = new Set();
    for (const t of ts) {
      if (t.status) st.add(t.status);
      if (t.origem) or.add(t.origem);
      if (t.qualidade) qu.add(t.qualidade);
    }
    return {
      tasks: ts,
      statuses: [...st].sort(),
      origens: [...or].sort(),
      quals: [...qu].sort(),
    };
  }, [group]);

  // Filtrar e deduplicar por telefone
  const filtered = useMemo(() => {
    const seen = {};
    const out = [];
    const q = busca.toLowerCase().trim();

    for (const t of tasks) {
      const key = cleanPhone(t.telefone).slice(-11);
      if (key && key.length >= 10) {
        if (seen[key]) continue;
        seen[key] = true;
      }
      if (filtroStatus && t.status !== filtroStatus) continue;
      if (filtroOrigem && t.origem !== filtroOrigem) continue;
      if (filtroQual && t.qualidade !== filtroQual) continue;
      if (q && !((t.nome || '') + (t.telefone || '')).toLowerCase().includes(q))
        continue;

      const cs = getContactStatus(t.telefone, t.closerInst, phoneStatus);
      if (filtroContato === 'pendente' && cs !== 'pendente') continue;
      if (filtroContato === 'contatado' && cs !== 'contatado') continue;
      if (filtroContato === 'outro' && cs !== 'outro') continue;

      out.push({ ...t, _contactStatus: cs });
    }
    return out.slice(0, 300);
  }, [
    tasks,
    filtroStatus,
    filtroOrigem,
    filtroQual,
    busca,
    filtroContato,
    phoneStatus,
  ]);

  const enc = group?.enc || tasks.length;
  const conv = group?.conv || 0;
  const naoConv = Math.max(0, enc - conv);
  const taxa = enc > 0 ? ((conv / enc) * 100).toFixed(1) : '0.0';

  const statusBadge = (cs) => {
    const base = 'text-[10px] px-2 py-0.5 rounded-full font-medium';
    if (cs === 'contatado')
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700`}>
          Contatado
        </span>
      );
    if (cs === 'outro')
      return (
        <span className={`${base} bg-amber-50 text-amber-700`}>Outro</span>
      );
    return <span className={`${base} bg-gray-50 text-gray-500`}>Pendente</span>;
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Resumo */}
      <div>
        <h2 className="text-base font-medium text-gray-900 mb-3">
          {group?.nome}
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setFiltroContato('')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors ${
              !filtroContato
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium tabular-nums">{enc}</span>
            <span
              className={!filtroContato ? 'text-white/80' : 'text-gray-400'}
            >
              Encaminhados
            </span>
          </button>
          <button
            onClick={() => setFiltroContato('contatado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors ${
              filtroContato === 'contatado'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium tabular-nums">{conv}</span>
            <span
              className={
                filtroContato === 'contatado'
                  ? 'text-white/80'
                  : 'text-gray-400'
              }
            >
              Convertidos
            </span>
          </button>
          <button
            onClick={() => setFiltroContato('pendente')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors ${
              filtroContato === 'pendente'
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium tabular-nums">{naoConv}</span>
            <span
              className={
                filtroContato === 'pendente' ? 'text-white/80' : 'text-gray-400'
              }
            >
              Não convertidos
            </span>
          </button>
          <span className="flex items-center gap-1.5 px-3 py-1.5 ml-auto text-gray-500">
            <span className="font-medium text-gray-900 tabular-nums">
              {taxa}%
            </span>
            <span className="text-[10px] uppercase tracking-wider">
              Conversão
            </span>
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center pb-2 border-b border-gray-100">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:border-gray-400"
        >
          <option value="">Todos status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:border-gray-400"
        >
          <option value="">Todas origens</option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={filtroQual}
          onChange={(e) => setFiltroQual(e.target.value)}
          className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:border-gray-400"
        >
          <option value="">Todas qualidades</option>
          {quals.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:border-gray-400"
          />
        </div>
        <span className="text-[10px] text-gray-400">
          {filtered.length} de {tasks.length}
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider w-8">
                #
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Nome
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Telefone
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Vendedor
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Status
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Origem
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Data
              </th>
              <th className="px-2 py-2 text-left font-medium text-[10px] uppercase tracking-wider">
                Contato
              </th>
              <th className="px-2 py-2 text-center font-medium text-[10px] uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-8 text-center text-gray-300 text-xs"
                >
                  Nenhum lead encontrado
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => (
                <tr
                  key={t.id || i}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                >
                  <td className="px-2 py-2 text-gray-300 font-mono tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2 text-gray-900 font-medium">
                    {t.nome || '—'}
                  </td>
                  <td className="px-2 py-2 font-mono text-gray-500 text-[11px]">
                    {formatPhone(t.telefone)}
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    {t.vendedor || '—'}
                  </td>
                  <td className="px-2 py-2">
                    <span className="text-[10px] text-gray-600">
                      {t.status || '—'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-500">{t.origem || '—'}</td>
                  <td className="px-2 py-2 text-gray-400 text-[10px] tabular-nums">
                    {t.dataCriacao
                      ? new Date(t.dataCriacao).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-2 py-2">{statusBadge(t._contactStatus)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onChatLead && onChatLead(t)}
                        title="Abrir chat (Jason/Prosp)"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                      >
                        <WhatsappLogo size={13} />
                      </button>
                      <button
                        onClick={() => onChatCloser && onChatCloser(t)}
                        title="Chat com Closer"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                      >
                        <ArrowRight size={13} />
                      </button>
                      {t.clickupUrl && (
                        <a
                          href={t.clickupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir no ClickUp"
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                        >
                          <LinkIcon size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => onAnalise && onAnalise(t)}
                        title="Análise por IA"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                      >
                        <Sparkle size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function FunilView({
  data, // { canais: [{ nome, tarefas: [...] }] }
  modulo, // 'multimarcas' | 'revenda' | etc.
  phoneStatus = {},
  onChatLead,
  onChatCloser,
  onAnalise,
  vendedoresMap,
}) {
  const [selected, setSelected] = useState(null);

  // Construir cards agrupados por vendedor com breakdown por categoria
  const cards = useMemo(() => {
    if (!data?.canais) return [];

    // Módulos que filtram por vendedorModulo (vendedores cadastrados no Supabase)
    const modulosComVendedor = ['multimarcas', 'revenda', 'business'];
    const usaVendedorModulo = modulosComVendedor.includes(modulo);

    const moduloLabels = {
      multimarcas: ['multimarcas'],
      revenda: ['revenda'],
      business: ['business', 'b2b'],
      franquia: ['franquia'],
      varejo: ['varejo', 'sdr'],
    };
    const aceitos = moduloLabels[modulo] || [];

    // Coletar tarefas do módulo (aceita por vendedorModulo OU canalDetalhe)
    const matchByCanal = (lead) => {
      const c = String(lead.canalDetalhe || lead._canal || '').toLowerCase();
      if (!c) return false;
      if (modulo === 'multimarcas')
        return c.includes('multimarcas') || c.includes('multimarca') || c.includes('b2m');
      if (modulo === 'revenda')
        return c.includes('revenda') || c.includes('revend') || c.includes('b2r') || c.includes('atacado');
      if (modulo === 'business') return c.includes('business') || c.includes('b2b');
      return false;
    };
    const todasTarefas = [];
    for (const ch of data.canais) {
      for (const t of ch.tarefas || []) {
        const tagged = { ...t, _canal: ch.nome };
        if (usaVendedorModulo) {
          // Aceita: vendedorModulo bate OU canalDetalhe (categoria) bate
          if (t.vendedorModulo === modulo || matchByCanal(tagged)) {
            todasTarefas.push(tagged);
          }
        } else {
          // Filtra pelo nome do canal (categoria) para varejo/franquia
          const nomeCanal = (ch.nome || '').toLowerCase();
          const pertence =
            aceitos.length === 0 || aceitos.some((a) => nomeCanal.includes(a));
          if (pertence) {
            todasTarefas.push(tagged);
          }
        }
      }
    }

    // Agrupar por vendedor
    const vendMap = {};
    for (const t of todasTarefas) {
      const v = t.vendedor || 'Sem Vendedor';
      if (!vendMap[v]) {
        vendMap[v] = { nome: v, tasks: [], enc: 0, conv: 0, porCategoria: {} };
      }
      vendMap[v].tasks.push(t);
      vendMap[v].enc++;

      const stl = (t.status || '').toLowerCase();
      const convertido =
        stl.includes('convertido') ||
        stl.includes('comprou') ||
        stl.includes('venda');
      if (convertido) vendMap[v].conv++;

      const cat = t.canalDetalhe || t._canal || 'Sem Categoria';
      if (!vendMap[v].porCategoria[cat]) {
        vendMap[v].porCategoria[cat] = { enc: 0, conv: 0 };
      }
      vendMap[v].porCategoria[cat].enc++;
      if (convertido) vendMap[v].porCategoria[cat].conv++;
    }

    // Adiciona vendedores do módulo SEM leads no período (cards com 0).
    // Usa o set canônico de VENDEDORES_POR_MODULO (TOTVS codes) — restringe
    // ao time real do canal, ignora vendedores legados marcados no Supabase.
    if (usaVendedorModulo && vendedoresMap?.byClickupId) {
      const codesPermitidos = VENDEDORES_POR_MODULO[modulo];
      for (const info of Object.values(vendedoresMap.byClickupId)) {
        if (!info?.nome) continue;
        if (info.ativo === false) continue;
        const totvsId = Number(info.totvs_id);
        // Só inclui se está no time canônico (quando definido)
        if (codesPermitidos && !codesPermitidos.has(totvsId)) continue;
        // Fallback: módulo cadastrado no Supabase
        if (!codesPermitidos && String(info.modulo || '').toLowerCase() !== modulo) continue;
        if (vendMap[info.nome]) continue; // já está
        vendMap[info.nome] = {
          nome: info.nome,
          tasks: [],
          enc: 0,
          conv: 0,
          porCategoria: {},
        };
      }
    }

    return Object.values(vendMap).sort((a, b) => b.enc - a.enc);
  }, [data, modulo, vendedoresMap]);

  if (selected) {
    return (
      <ListView
        group={selected}
        onBack={() => setSelected(null)}
        onChatLead={onChatLead}
        onChatCloser={onChatCloser}
        onAnalise={onAnalise}
        phoneStatus={phoneStatus}
      />
    );
  }

  if (!data?.canais || cards.length === 0) {
    const canaisExistentes = (data?.canais || []).map((c) => c.nome);
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">
          Nenhum lead encontrado para <strong>{modulo}</strong>
        </p>
        {data?.canais ? (
          <p className="text-xs mt-2 text-gray-300">
            Canais disponíveis: {canaisExistentes.join(', ') || 'nenhum'}
          </p>
        ) : (
          <p className="text-xs mt-1 text-gray-300">
            Ajuste o período e clique em Pesquisar
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-widest text-gray-400">
          {modulo} — por vendedor
        </h2>
        <span className="text-[10px] text-gray-400 tabular-nums">
          {cards.reduce((s, c) => s + c.enc, 0)} leads ·{' '}
          {cards.reduce((s, c) => s + c.conv, 0)} convertidos
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <CardItem
            key={i}
            item={c}
            color={COLORS[i % COLORS.length]}
            onClick={() => setSelected(c)}
          />
        ))}
      </div>
    </div>
  );
}
