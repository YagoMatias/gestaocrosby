import React, { useMemo } from 'react';
import {
  WhatsappLogo,
  Link as LinkIcon,
  Warning,
  ArrowRight,
} from '@phosphor-icons/react';
import {
  COLORS,
  formatPhone,
  cleanPhone,
  ALL_INSTANCES,
  instLabel,
} from './constants';

// ═══════════════════════════════════════════════════════════════════════════
// CanalErrado — Detecta leads em canais possivelmente incorretos
// Compara o canal declarado do lead com a instância que está efetivamente
// conversando com ele (via phoneStatus).
// ═══════════════════════════════════════════════════════════════════════════

// Mapeamento instância → canal (duplicado aqui para leitura local, mesmo
// conteúdo do INST_CANAL_MAP em constants.js)
const INST_CANAL_LOCAL = {
  prosp: 'todos',
  anderson: 'revenda',
  walter: 'multimarcas',
  marcio: 'business',
  // Lojas Varejo
  midway: 'varejo',
  cidadejardim: 'varejo',
  shoppingcidadejardim: 'varejo',
  ayrtonsenna: 'varejo',
  canguartema: 'varejo',
  novacruz: 'varejo',
  parnamirim: 'varejo',
  recife: 'varejo',
  teresina: 'varejo',
  imperatriz: 'varejo',
  guararapes: 'varejo',
  patos: 'varejo',
  joaopessoa: 'varejo',
};

// Palavras-chave por canal para análise Tier 2 (origem/detalhe)
const KEYWORDS_CANAL = {
  revenda: ['revenda', 'revendedor', 'atacado pequeno'],
  multimarcas: ['multimarca', 'multimarcas', 'loja multimarca'],
  business: ['b2b', 'business', 'corporativo', 'empresa'],
  franquia: ['franquia', 'franqueado'],
  varejo: ['varejo', 'loja própria', 'consumidor final'],
};

// Normaliza string para comparação (lowercase + sem acentos)
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Analisa um lead e retorna sugestão (ou null se estiver OK)
function analisarLead(lead, phoneStatus) {
  const canalAtual = normalize(lead.canalDetalhe);
  if (!canalAtual) return null;

  const clean = cleanPhone(lead.fone);
  const ps = phoneStatus?.[clean];
  if (!ps || !ps.instances || ps.instances.length === 0) return null;

  // Tier 1: instância ativa de outro canal está conversando
  const outroCanalAtivo = ps.instances
    .map((inst) => ({ inst, canal: INST_CANAL_LOCAL[inst] }))
    .find(
      (x) =>
        x.canal &&
        x.canal !== 'todos' &&
        !canalAtual.includes(x.canal) &&
        !x.canal.includes(canalAtual),
    );

  if (outroCanalAtivo) {
    return {
      tier: 1,
      canalSugerido: outroCanalAtivo.canal,
      instSugerida: outroCanalAtivo.inst,
      motivo: `Instância "${instLabel(outroCanalAtivo.inst)}" (${outroCanalAtivo.canal}) está conversando ativamente com o lead.`,
    };
  }

  // Tier 2: palavras-chave no campo origem
  const origem = normalize(lead.origem);
  for (const [canal, keywords] of Object.entries(KEYWORDS_CANAL)) {
    if (canalAtual.includes(canal)) continue; // já está no canal certo
    if (keywords.some((k) => origem.includes(k))) {
      return {
        tier: 2,
        canalSugerido: canal,
        instSugerida: null,
        motivo: `Origem "${lead.origem}" sugere o canal "${canal}".`,
      };
    }
  }

  return null;
}

// Gera link do ClickUp (placeholder — ajustar conforme configuração real)
function clickUpLink(lead) {
  if (!lead.clickUpId) return null;
  return `https://app.clickup.com/t/${lead.clickUpId}`;
}

// ─── Badge de tier ──────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const cfg =
    tier === 1
      ? { label: 'Tier 1 · Alta', cls: 'bg-red-100 text-red-700' }
      : { label: 'Tier 2 · Média', cls: 'bg-yellow-100 text-yellow-700' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Card de lead suspeito ──────────────────────────────────────────────────
function LeadSuspeitoCard({ item, onChatLead }) {
  const { lead, sugestao } = item;
  const link = clickUpLink(lead);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-bold text-[#000638] truncate">
              {lead.nome || 'Lead sem nome'}
            </h4>
            <TierBadge tier={sugestao.tier} />
          </div>
          <div className="text-xs font-mono text-gray-600">{formatPhone(lead.fone)}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          {onChatLead && (
            <button
              onClick={() => onChatLead({ fone: lead.fone, nome: lead.nome })}
              className="bg-[#000638] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#fe0000] flex items-center gap-1"
              title="Abrir chat"
            >
              <WhatsappLogo size={12} /> Chat
            </button>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="bg-[#000638] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#fe0000] flex items-center gap-1"
              title="Abrir no ClickUp"
            >
              <LinkIcon size={12} /> ClickUp
            </a>
          )}
        </div>
      </div>

      {/* Canal atual → sugerido */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mb-2 text-xs">
        <div className="flex-1">
          <div className="text-[10px] text-gray-500 uppercase">Canal atual</div>
          <div className="font-bold text-gray-800">{lead.canalDetalhe || '—'}</div>
        </div>
        <ArrowRight size={14} className="text-gray-400" />
        <div className="flex-1">
          <div className="text-[10px] text-gray-500 uppercase">Sugerido</div>
          <div className="font-bold text-[#000638] capitalize">
            {sugestao.canalSugerido}
          </div>
        </div>
      </div>

      {/* Motivo */}
      <div className="flex items-start gap-1 text-xs text-gray-700">
        <Warning size={12} className="text-yellow-600 mt-0.5 shrink-0" />
        <span>
          <span className="font-bold">Motivo:</span> {sugestao.motivo}
        </span>
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function CanalErrado({ data, modulo, phoneStatus }) {
  // Processa leads e identifica canais possivelmente errados
  const suspeitos = useMemo(() => {
    const leads = Array.isArray(data)
      ? data
      : Array.isArray(data?.leads)
        ? data.leads
        : [];

    const out = [];
    leads.forEach((lead) => {
      const sugestao = analisarLead(lead, phoneStatus || {});
      if (sugestao) out.push({ lead, sugestao });
    });

    // Ordena: Tier 1 primeiro, depois Tier 2
    out.sort((a, b) => a.sugestao.tier - b.sugestao.tier);
    return out;
  }, [data, phoneStatus]);

  // Empty state
  if (suspeitos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <Warning size={40} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">
          Nenhum lead com canal incorreto detectado
        </p>
      </div>
    );
  }

  // Contagem por tier
  const t1 = suspeitos.filter((s) => s.sugestao.tier === 1).length;
  const t2 = suspeitos.filter((s) => s.sugestao.tier === 2).length;

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xl font-bold text-[#000638]">{suspeitos.length}</div>
          <div className="text-[10px] text-gray-500 uppercase">Total Suspeitos</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xl font-bold text-red-600">{t1}</div>
          <div className="text-[10px] text-gray-500 uppercase">Tier 1 · Alta Confiança</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xl font-bold text-yellow-600">{t2}</div>
          <div className="text-[10px] text-gray-500 uppercase">Tier 2 · Média Confiança</div>
        </div>
      </div>

      {/* Lista de leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suspeitos.map((item, idx) => (
          <LeadSuspeitoCard
            key={`${item.lead.fone}-${idx}`}
            item={item}
            onChatLead={item.onChatLead}
          />
        ))}
      </div>
    </div>
  );
}
