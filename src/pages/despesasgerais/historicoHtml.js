// Parser do HTML "Despesas Gerais 2026" (ferramenta anterior) — puro, sem React
// e sem eval (o arquivo é dado não confiável).
//
// O exportHtml() do tool antigo injeta no fim do arquivo:
//   window.__SAVED_STATE__ = { months, forecasts, flags }
// com o estado VIVO: meses com os lançamentos manuais ("Nova despesa"),
// edições e totais recalculados; os forecasts; e as flags (correção/corte),
// inclusive as manuais (manual:true + snap). As constantes <MES>_SUMMARY /
// <MES>_DETAILS são só a base original — usadas apenas como fallback.
//
// Só os meses CONGELADOS (jan–ago) são importados; setembro em diante é
// HeadCoach ao vivo.

export const HTML_MESES = {
  JAN: 'jan',
  FEV: 'fev',
  MAR: 'mar',
  ABR: 'abr',
  MAI: 'mai',
  JUN: 'jun',
  JUL: 'jul',
  AGO: 'ago',
};
const MESES_IMPORT = new Set(Object.values(HTML_MESES));
// mesma convenção de prefixo de forecast do store (jan sem prefixo)
const PREFIXO_MES = {
  jan: '',
  fev: 'FEV_',
  mar: 'MAR_',
  abr: 'ABR_',
  mai: 'MAI_',
  jun: 'JUN_',
  jul: 'JUL_',
  ago: 'AGO_',
};
const PREFIXOS_IMPORT = new Set(Object.values(PREFIXO_MES));

// Extrai o literal de `const NOME = ...` balanceando chaves (respeita strings).
export function extrairConstHtml(html, nome) {
  const i = html.indexOf(`const ${nome}`);
  if (i < 0) return null;
  const eq = html.indexOf('=', i);
  if (eq < 0) return null;
  let j = eq + 1;
  let depth = 0;
  let started = false;
  let emStr = false;
  let asp = '';
  for (; j < html.length; j++) {
    const c = html[j];
    if (emStr) {
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === asp) emStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      emStr = true;
      asp = c;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
      started = true;
    } else if (c === '}' || c === ']') {
      depth--;
      if (started && depth === 0) {
        j++;
        break;
      }
    }
  }
  return html.slice(eq + 1, j).trim();
}

// Literal JS → JSON válido: aspas nas chaves sem aspas, remove vírgulas finais.
export function normalizarLiteralJs(str) {
  let out = '';
  let emStr = false;
  let asp = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (emStr) {
      out += c;
      if (c === '\\') {
        out += str[++i] ?? '';
        continue;
      }
      if (c === asp) emStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      emStr = true;
      asp = c;
      out += '"';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < str.length && /[A-Za-z0-9_$]/.test(str[j])) j++;
      let k = j;
      while (k < str.length && /\s/.test(str[k])) k++;
      if (str[k] === ':') {
        out += `"${str.slice(i, j)}"`;
        i = j - 1;
        continue;
      }
    }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function lerConstHtml(html, nome) {
  const bruto = extrairConstHtml(html, nome);
  if (!bruto) return null;
  try {
    return JSON.parse(normalizarLiteralJs(bruto));
  } catch {
    return null;
  }
}

// window.__SAVED_STATE__ = {...}  — pega a ÚLTIMA ocorrência seguida de "{"
// (a primeira está dentro do código-fonte do exportHtml, não é o estado).
export function extrairSavedState(html) {
  const tag = 'window.__SAVED_STATE__=';
  let i = html.lastIndexOf(tag);
  while (i >= 0 && html[i + tag.length] !== '{') i = html.lastIndexOf(tag, i - 1);
  if (i < 0) return null;
  let j = i + tag.length;
  let depth = 0;
  let started = false;
  let emStr = false;
  for (; j < html.length; j++) {
    const c = html[j];
    if (emStr) {
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === '"') emStr = false;
      continue;
    }
    if (c === '"') {
      emStr = true;
      continue;
    }
    if (c === '{') {
      depth++;
      started = true;
    } else if (c === '}') {
      depth--;
      if (started && depth === 0) {
        j++;
        break;
      }
    }
  }
  try {
    return JSON.parse(html.slice(i + tag.length, j));
  } catch {
    return null;
  }
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Linhas no shape do store. Mantém a ORDEM original (as flags por índice
// "mes||cat||i" dependem disso).
function montarDetails(detailsRaw) {
  const details = {};
  let cnt = 0;
  for (const cat of Object.keys(detailsRaw || {})) {
    const linhas = Array.isArray(detailsRaw[cat]) ? detailsRaw[cat] : [];
    details[cat] = linhas.map((l, idx) => ({
      id: `${l.emp ?? ''}|${String(l.dupl ?? '').replace(/\D/g, '')}|${idx}`,
      emp: String(l.emp ?? ''),
      forn: l.forn || '',
      dupl: String(l.dupl ?? ''),
      emis: l.emis || '',
      venc: l.venc || '',
      liq: l.liq || '',
      val: r2(l.val),
      estag: l.estag || '',
      obs: l.obs || '',
    }));
    cnt += details[cat].length;
  }
  return { details, cnt };
}

function montarMes(summaryRaw, detailsRaw, totalRaw, cntRaw) {
  const { details, cnt } = montarDetails(detailsRaw);
  const summary = Array.isArray(summaryRaw)
    ? summaryRaw.map((s) => ({ cat: s.cat, total: r2(s.total) }))
    : Object.entries(details).map(([cat, rows]) => ({ cat, total: r2(rows.reduce((a, r) => a + (Number(r.val) || 0), 0)) }));
  if (!Array.isArray(summaryRaw)) summary.sort((a, b) => b.total - a.total);
  const total = Number.isFinite(Number(totalRaw)) && totalRaw !== null && totalRaw !== undefined
    ? r2(totalRaw)
    : r2(summary.reduce((a, x) => a + x.total, 0));
  return { summary, details, total, cnt: Number(cntRaw) || cnt };
}

// Resultado: { origem:'saved'|'base', meses:{mk:{summary,details,total,cnt}},
//              forecasts:{...só jan–ago}, flags:{...só jan–ago}, manuais }
export function parseHistoricoHtml(html) {
  const out = { origem: 'base', meses: {}, forecasts: {}, flags: {}, manuais: 0 };
  const saved = extrairSavedState(html);

  if (saved && saved.months && typeof saved.months === 'object') {
    out.origem = 'saved';
    for (const mk of Object.keys(saved.months)) {
      if (!MESES_IMPORT.has(mk)) continue; // set+ é HeadCoach ao vivo
      const sm = saved.months[mk];
      out.meses[mk] = montarMes(sm.summary, sm.details, sm.total, sm.cnt);
    }
    for (const [k, v] of Object.entries(saved.forecasts || {})) {
      const pref = (k.match(/^[A-Z]{3}_/) || [''])[0];
      if (PREFIXOS_IMPORT.has(pref)) out.forecasts[k] = r2(v);
    }
    for (const [k, f] of Object.entries(saved.flags || {})) {
      if (!f || typeof f !== 'object') continue;
      const mes = f.manual ? f.mes : String(k).split('||')[0];
      if (!MESES_IMPORT.has(mes)) continue;
      out.flags[k] = f;
      if (f.manual) out.manuais++;
    }
    if (Object.keys(out.meses).length) return out;
  }

  // fallback: constantes da base original
  for (const [sigla, mk] of Object.entries(HTML_MESES)) {
    const summaryRaw = lerConstHtml(html, `${sigla}_SUMMARY`);
    const detailsRaw = lerConstHtml(html, `${sigla}_DETAILS`);
    if (!summaryRaw && !detailsRaw) continue;
    out.meses[mk] = montarMes(summaryRaw, detailsRaw);
  }
  return out;
}
