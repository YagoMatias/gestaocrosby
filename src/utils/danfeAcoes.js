// DANFE de uma nota emitida pelo HeadCoach: IMPRIMIR e SALVAR EM PDF como ações
// separadas (pedido do Yago, 11/11/2026).
//   imprimirDanfe  → abre o DANFE e já chama a impressão
//   salvarDanfePdf → no app do PDV (Electron) abre "Salvar como" para escolher a
//                    pasta, com o nome "NF <número> - <cliente>.pdf", e grava o
//                    PDF direto (window.pdv.salvarPdf, pdv-electron/main.js);
//                    no navegador, sem acesso a pastas, abre a impressão com o
//                    mesmo nome sugerido para usar "Salvar como PDF".
import { API_BASE_URL } from '../config/constants';
import { gerarHtmlDanfeDeXml } from './danfeHtml';

const tag = (xml, t) => (String(xml).match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1] || '';
const bloco = (xml, t) => (String(xml).match(new RegExp(`<${t}[ >][\\s\\S]*?</${t}>`)) || [])[0] || '';
const desescapar = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

// "NF 16532 - NOME DO CLIENTE" (sem caracteres que o Windows não aceita em nome de arquivo)
export function nomeDoDanfe(xml) {
  const numero = tag(xml, 'nNF');
  const cliente = desescapar(tag(bloco(xml, 'dest'), 'xNome'));
  return `NF ${numero || 's-n'}${cliente ? ` - ${cliente}` : ''}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

async function carregar(notaId, { cancelada = false } = {}) {
  const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}/xml`);
  if (!r.ok) throw new Error('XML da nota não encontrado');
  const xml = await r.text();
  return { html: gerarHtmlDanfeDeXml(xml, { cancelada }), nome: nomeDoDanfe(xml) };
}

function abrirJanela(html, titulo, { imprimir = false } = {}) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) throw new Error('O navegador bloqueou a janela do DANFE. Libere pop-ups para este site.');
  w.document.open();
  w.document.write(html);
  w.document.close();
  try {
    // o navegador sugere o título como nome do arquivo em "Salvar como PDF"
    w.document.title = titulo;
  } catch {
    /* janela ainda carregando */
  }
  if (imprimir) {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* o botão Imprimir da própria janela continua lá */
      }
    }, 500);
  }
  return w;
}

/** Abre o DANFE e chama a impressão. */
export async function imprimirDanfe(notaId, opcoes = {}) {
  const { html, nome } = await carregar(notaId, opcoes);
  abrirJanela(html, nome, { imprimir: true });
  return { nome };
}

/**
 * Salva o DANFE em PDF. Devolve { ok, caminho } quando gravou pelo app do PDV,
 * { cancelado: true } se o operador fechou o "Salvar como", ou
 * { navegador: true } quando caiu na impressão do navegador.
 */
export async function salvarDanfePdf(notaId, opcoes = {}) {
  const { html, nome } = await carregar(notaId, opcoes);
  if (window.pdv?.salvarPdf) {
    const r = await window.pdv.salvarPdf({ html, nome });
    if (r?.cancelado) return { cancelado: true, nome };
    if (!r?.ok) throw new Error(r?.erro || 'Não consegui gravar o PDF');
    return { ok: true, caminho: r.caminho, nome };
  }
  abrirJanela(html, nome, { imprimir: true });
  return { navegador: true, nome };
}

/** Texto curto para o aviso da tela depois de salvarDanfePdf. */
export function avisoDoPdf(r) {
  if (r?.cancelado) return null;
  if (r?.ok) return `PDF salvo em ${r.caminho}`;
  return `No navegador, escolha "Salvar como PDF" na janela de impressão (nome sugerido: ${r?.nome}). No app do PDV o arquivo é gravado direto na pasta que você escolher.`;
}
