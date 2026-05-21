// Página pública (sem chrome/autenticação) que renderiza UM relatório
// de Forecast pra captura via Puppeteer. Aceita query params:
//   ?tipo=mensal|semanal|comparativo|vendedores
//   ?target=B2R|B2M  (só pra vendedores)
//   ?untilToday=true|false  (default false — até ontem D-1)
//   ?ano=2026&mes=5  ou  ?ano=2026&semana=21
// Quando renderiza com sucesso, adiciona classe `data-print-ready="1"` no body
// pra Puppeteer saber que pode capturar.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WhatsappReportCard from '../components/forecast/WhatsappReportCard';
import { API_BASE_URL } from '../config/constants';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNo };
}

export default function PrintForecast() {
  const [params] = useSearchParams();
  const tipo = (params.get('tipo') || 'semanal').toLowerCase();
  const target = (params.get('target') || '').toUpperCase(); // B2R|B2M (vendedores)
  const untilToday = params.get('untilToday') === 'true';

  const [data, setData] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        let url;
        const now = new Date();
        const qsExtra = untilToday ? '&until_today=true' : '';
        if (tipo === 'mensal') {
          const ano = parseInt(params.get('ano')) || now.getFullYear();
          const mes = parseInt(params.get('mes')) || (now.getMonth() + 1);
          url = `${API_BASE_URL}/api/forecast/promessa-mensal?ano=${ano}&mes=${mes}${qsExtra}`;
        } else if (tipo === 'comparativo') {
          const ano = parseInt(params.get('ano')) || now.getFullYear();
          const mes = parseInt(params.get('mes')) || (now.getMonth() + 1);
          url = `${API_BASE_URL}/api/forecast/comparativo-anual?ano=${ano}&mes=${mes}${qsExtra}`;
        } else if (tipo === 'vendedores') {
          const cur = isoWeek(now);
          const ano = parseInt(params.get('ano')) || cur.ano;
          const semana = parseInt(params.get('semana')) || cur.semana;
          url = `${API_BASE_URL}/api/forecast/promessa-vendedores?ano=${ano}&semana=${semana}${qsExtra}`;
        } else {
          // 'semanal' default
          const cur = isoWeek(now);
          const ano = parseInt(params.get('ano')) || cur.ano;
          const semana = parseInt(params.get('semana')) || cur.semana;
          url = `${API_BASE_URL}/api/forecast/promessa-semanal?ano=${ano}&semana=${semana}${qsExtra}`;
        }
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
        let d = j.data;
        // Filtra cards se target específico (B2R ou B2M)
        if (tipo === 'vendedores' && target && Array.isArray(d?.cards)) {
          d = { ...d, cards: d.cards.filter((c) => c.code === target) };
        }
        setData(d);
      } catch (e) {
        setErro(e.message);
        document.body.setAttribute('data-print-error', '1');
      }
    };
    fetchData();
  }, [tipo, target, untilToday, params]);

  // Sinaliza ao Puppeteer quando o render está pronto (data carregada + DOM pintado)
  useEffect(() => {
    if (!data) return;
    // 2 frames pra garantir que o CSS/fonts aplicaram
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.setAttribute('data-print-ready', '1');
      });
    });
  }, [data]);

  // Título baseado em tipo + target
  const titulo = (() => {
    if (tipo === 'mensal') {
      const mes = parseInt(params.get('mes')) || (new Date().getMonth() + 1);
      const ano = parseInt(params.get('ano')) || new Date().getFullYear();
      return `Promessa Mensal ${MESES[mes - 1]}/${ano}`;
    }
    if (tipo === 'comparativo') {
      const mes = parseInt(params.get('mes')) || (new Date().getMonth() + 1);
      const ano = parseInt(params.get('ano')) || new Date().getFullYear();
      return `Comparativo ${ano - 1} × ${ano} (${MESES[mes - 1]})`;
    }
    if (tipo === 'vendedores') {
      const semana = data?.semana_iso ?? params.get('semana') ?? '?';
      if (target === 'B2R') return `Vendedores B2R — Semana ${semana}`;
      if (target === 'B2M') return `Vendedores B2M — Semana ${semana}`;
      return `Detalhe por Vendedor — Semana ${semana}`;
    }
    const semana = data?.semana_iso ?? params.get('semana') ?? '?';
    return `Promessa Semanal — Semana ${semana}`;
  })();

  // Tipo passado ao WhatsappReportCard
  const reportTipo = tipo === 'vendedores' ? 'vendedores' : tipo;

  return (
    <div style={{ background: 'white', padding: '16px', minHeight: '100vh' }}>
      {erro && (
        <div style={{ color: '#dc2626', padding: '12px', fontFamily: 'monospace' }}>
          Erro: {erro}
        </div>
      )}
      {!data && !erro && (
        <div style={{ color: '#6b7280', padding: '24px' }}>Carregando…</div>
      )}
      {data && (
        <WhatsappReportCard tipo={reportTipo} data={data} titulo={titulo} />
      )}
    </div>
  );
}
