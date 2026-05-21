// Detalhe por vendedor — B2R e B2M (semana corrente)
// Cada card mostra: vendedor | Promessa | Realizado | Percentual
// Promessa = meta_canal_semana / N vendedores titulares
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Trophy, UserCircle, WhatsappLogo } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import EnviarWhatsappModal from './EnviarWhatsappModal';
import {
  MetricaHeader,
  PctPill,
  MiniProgress,
  LoadingValue,
  InfoBanner,
  formatBRL,
} from './MetricasDiariasUI';

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNo };
}

// Card de UM canal (B2R ou B2M) com lista de vendedores
// `cardRef` é a ref pra captura via html2canvas (passada do parent).
// `onSendWhats` ativa o modal de envio só desse card (opcional).
function CardVendedores({ card, loading, cardRef, onSendWhats }) {
  const { vendedores = [], extras = [], total = {}, label, code } = card;
  // Identifica líder do card (maior valor)
  const liderNome = vendedores
    .concat(extras)
    .filter((v) => v.real > 0)
    .sort((a, b) => b.real - a.real)[0]?.nome;
  // Tom do card baseado em B2R/B2M
  const headerTone = code === 'B2R'
    ? 'bg-gradient-to-r from-emerald-700 to-emerald-800'
    : code === 'B2M'
      ? 'bg-gradient-to-r from-purple-700 to-purple-800'
      : 'bg-gradient-to-r from-[#000638] to-[#1a2461]';
  const totalPct = Number(total.percentual || 0);

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${loading ? 'opacity-95' : ''}`}
    >
      <div className={`${headerTone} text-white px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="bg-white/15 p-1.5 rounded-md">
            <Trophy size={16} weight="fill" className="text-yellow-300" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-wide">{label}</h4>
            <p className="text-[10px] text-white/70 mt-0.5">{vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && total.meta > 0 && (
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                totalPct >= 100
                  ? 'bg-emerald-400/30 text-emerald-100'
                  : totalPct >= 70
                    ? 'bg-amber-400/30 text-amber-100'
                    : 'bg-rose-400/30 text-rose-100'
              }`}>
                {totalPct.toFixed(0)}% atingido
              </div>
              <p className="text-[10px] text-white/70 mt-0.5">R$ {formatBRL(total.real)} / R$ {formatBRL(total.meta)}</p>
            </div>
          )}
          {loading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-100 bg-white/10 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse" />
              atualizando
            </span>
          )}
          {onSendWhats && !loading && (
            <button
              data-h2c-ignore="true"
              onClick={onSendWhats}
              className="text-[11px] px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-white inline-flex items-center gap-1.5 font-semibold shadow-sm transition"
              title={`Enviar apenas ${label} via WhatsApp`}
            >
              <WhatsappLogo size={14} weight="fill" /> Enviar
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
              <th className="py-2.5 px-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendedor</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Promessa</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Realizado</th>
              <th className="py-2.5 px-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[90px]">%</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v, idx) => {
              const isLider = v.nome === liderNome && v.real > 0;
              // Zebra: alterna branco/cinza-suave. Líder sempre tem destaque amarelo.
              const zebraBg = isLider
                ? 'bg-yellow-50/50'
                : idx % 2 === 0
                  ? 'bg-white'
                  : 'bg-gray-50/40';
              return (
                <tr key={v.nome} className={`border-b border-gray-100 transition-colors hover:bg-emerald-50/40 ${zebraBg}`}>
                  <td className="py-2.5 px-3">
                    <div className="inline-flex items-center gap-2">
                      {isLider ? (
                        <div className="bg-yellow-100 p-1 rounded-full">
                          <Trophy size={11} weight="fill" className="text-yellow-600" />
                        </div>
                      ) : (
                        <div className="bg-gray-100 p-1 rounded-full">
                          <UserCircle size={11} weight="fill" className="text-gray-500" />
                        </div>
                      )}
                      <span className="font-semibold text-gray-800 text-[12px]">{v.nome}</span>
                      {v.convidado && (
                        <span
                          className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded normal-case"
                          title={`Meta vem de: ${v.canal_origem}`}
                        >
                          {v.canal_origem}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 text-[12px]">
                    {v.meta > 0 ? `R$ ${formatBRL(v.meta)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 font-semibold">
                    {loading ? <LoadingValue /> : `R$ ${formatBRL(v.real)}`}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col items-end gap-1">
                      {loading ? (
                        <LoadingValue width={50} />
                      ) : v.meta > 0 ? (
                        <>
                          <PctPill pct={v.percentual} />
                          <div className="w-full max-w-[80px]">
                            <MiniProgress pct={v.percentual} />
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {extras.map((v) => (
              <tr key={`extra-${v.nome}`} className="border-b border-gray-100 bg-gray-50/40">
                <td className="py-2 px-3">
                  <div className="inline-flex items-center gap-2">
                    <div className="bg-gray-100 p-1 rounded-full">
                      <UserCircle size={11} weight="fill" className="text-gray-400" />
                    </div>
                    <span className="text-gray-600 italic text-[11px]">{v.nome}</span>
                    <span className="text-[8px] uppercase tracking-wider font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                      extra
                    </span>
                  </div>
                </td>
                <td className="py-2 px-3 text-right text-gray-300 text-xs">—</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-700 text-[12px]">
                  {loading ? <LoadingValue /> : `R$ ${formatBRL(v.real)}`}
                </td>
                <td className="py-2 px-3 text-right text-gray-300 text-xs">—</td>
              </tr>
            ))}
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold border-t-2 border-gray-300">
              <td className="py-3 px-3 text-gray-800 text-[12px] uppercase tracking-wider">Total</td>
              <td className="py-3 px-3 text-right tabular-nums text-gray-800">R$ {formatBRL(total.meta)}</td>
              <td className="py-3 px-3 text-right tabular-nums text-gray-900 font-extrabold">
                {loading ? <LoadingValue /> : `R$ ${formatBRL(total.real)}`}
              </td>
              <td className="py-3 px-3">
                <div className="flex justify-end">
                  {loading ? (
                    <LoadingValue width={50} />
                  ) : total.meta > 0 ? (
                    <PctPill pct={total.percentual} size="md" />
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PromessaVendedores() {
  const cur = isoWeek(new Date());
  const [ano] = useState(cur.ano);
  const [semana] = useState(cur.semana);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  // whatsTarget: null | 'all' | 'B2R' | 'B2M' | (qualquer card.code) → controla o
  // que será enviado. 'all' captura o bloco inteiro; um code captura só o
  // card individual.
  const [whatsTarget, setWhatsTarget] = useState(null);
  const [untilToday, setUntilToday] = useState(false);
  const cardRef = useRef(null);           // bloco inteiro (envia tudo)
  const cardRefsByCode = useRef({});      // refs individuais por card

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const qs = `?ano=${ano}&semana=${semana}${untilToday ? '&until_today=true' : ''}`;
      const r = await fetch(`${API_BASE_URL}/api/forecast/promessa-vendedores${qs}`);
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, semana, untilToday]);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <MetricaHeader
          title="Detalhe por Vendedor"
          subtitle="Semana corrente"
          icon={Users}
          color="emerald"
        />
        <div className="p-4">
          <InfoBanner tone="rose">{erro}</InfoBanner>
        </div>
      </div>
    );
  }

  // Skeleton inicial
  if (!data?.cards?.length) {
    if (loading) {
      return (
        <div className="mb-6" ref={cardRef}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
            <MetricaHeader
              title="Detalhe por Vendedor"
              subtitle="Carregando…"
              icon={Users}
              color="emerald"
              untilToday={untilToday}
              setUntilToday={setUntilToday}
              onRefresh={carregar}
              loading={loading}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <CardVendedores
                key={i}
                loading
                card={{
                  label: i === 1 ? 'PROMETIDO B2R - …' : 'PROMETIDO B2M - …',
                  code: i === 1 ? 'B2R' : 'B2M',
                  vendedores: [
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                    { nome: '...........', meta: 1, real: 0, percentual: 0 },
                  ],
                  extras: [],
                  total: { meta: 1, real: 0, percentual: 0 },
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  // Card alvo do envio (se for individual). null se 'all' ou nenhum.
  const targetCard = whatsTarget && whatsTarget !== 'all'
    ? data.cards.find((c) => c.code === whatsTarget)
    : null;
  // Ref do alvo do envio
  const targetRef = whatsTarget === 'all'
    ? cardRef
    : whatsTarget
      ? { current: cardRefsByCode.current[whatsTarget] }
      : null;
  // reportData filtrado pra incluir apenas o card alvo (ou todos se 'all')
  const reportData = whatsTarget === 'all'
    ? data
    : targetCard
      ? { ...data, cards: [targetCard] }
      : data;
  const titulo = whatsTarget && whatsTarget !== 'all' && targetCard
    ? `${targetCard.label} — Semana ${data.semana_iso}`
    : `Detalhe por Vendedor — Semana ${data.semana_iso}`;

  return (
    <div className="mb-6" ref={cardRef}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
        <MetricaHeader
          title="Detalhe por Vendedor"
          subtitle={`Semana ${data.semana_iso}/${data.ano || ano} · envie B2R ou B2M separadamente`}
          icon={Users}
          color="emerald"
          untilToday={untilToday}
          setUntilToday={setUntilToday}
          onRefresh={carregar}
          loading={loading}
          onWhatsapp={() => setWhatsTarget('all')}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.cards.map((card) => (
          <CardVendedores
            key={card.code}
            card={card}
            loading={loading}
            cardRef={(el) => {
              if (el) cardRefsByCode.current[card.code] = el;
            }}
            onSendWhats={() => setWhatsTarget(card.code)}
          />
        ))}
      </div>
      {whatsTarget && (
        <EnviarWhatsappModal
          targetRef={targetRef}
          tipo="vendedores"
          reportTipo="vendedores"
          reportData={reportData}
          titulo={titulo}
          params={{ ano, semana, target: whatsTarget }}
          onClose={() => setWhatsTarget(null)}
        />
      )}
    </div>
  );
}
