// Página: Etiquetas de Preço — imprime etiquetas (hangtag) dos produtos de uma
// transação do TOTVS na Argox OS-2140 PPLA (ou qualquer impressora instalada).
//
// Fluxo: filial + nº da transação + data → backend lê general/v2/transactions
// (/api/totvs/pdv/transaction) e devolve os itens com o PREÇO LÍQUIDO unitário
// → escolho os itens e a quantidade de etiquetas → imprimo.
//
// Layout da etiqueta: EDITOR VISUAL — cada elemento (marca, hashtag, preço…)
// tem posição x/y em MILÍMETROS dentro da etiqueta e é arrastável no editor
// (alça no canto redimensiona a fonte). Como editor, prévia e impressão usam
// as MESMAS coordenadas físicas (mm/pt), o que se vê é o que sai na Argox.
//
// Impressão: cada página = UMA LINHA da bobina (N etiquetas lado a lado);
// o @page recebe exatamente largura da bobina × altura da etiqueta+gap.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tag,
  Printer,
  MagnifyingGlass,
  Spinner,
  Gear,
  CheckSquare,
  Square,
  Storefront,
  ArrowsOutCardinal,
} from '@phosphor-icons/react';
import { jsPDF } from 'jspdf';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

// v2: layout por elemento (editor visual) — não migra o formato antigo
const CONFIG_KEY = 'etiquetas_preco_config_v2';

const PT_TO_MM = 0.352778; // 1pt em mm

// Rotação FIXA do conteúdo na impressão (confirmada em teste físico: 0° sai
// lendo na horizontal com o furo da etiqueta pra cima; 180° saía invertido).
const ROTACAO_IMPRESSAO = 0;

// Elementos da etiqueta: posição do CENTRO em mm, fonte em pt.
// Defaults pra etiqueta 30×40 (medida real: 3cm × 4cm, duas seções — corpo
// da tag em cima e canhoto destacável do preço embaixo do picote ~25mm).
const DEFAULT_ELEMENTS = {
  marca: { visible: true, x: 15, y: 8, fontSize: 11, bold: true },
  hashtag: { visible: true, x: 15, y: 13, fontSize: 5, bold: false },
  descricao: { visible: false, x: 15, y: 18, fontSize: 5, bold: false },
  preco: { visible: true, x: 15, y: 32, fontSize: 11, bold: true },
  referencia: { visible: false, x: 15, y: 37, fontSize: 4, bold: false },
};

const ELEMENT_NAMES = {
  marca: 'Marca',
  hashtag: 'Hashtag',
  descricao: 'Descrição',
  preco: 'Preço',
  referencia: 'Ref. / código',
};

const DEFAULT_CONFIG = {
  colunas: 3,
  larguraEtiqueta: 30, // mm (medida real: 3cm)
  alturaEtiqueta: 40, // mm (medida real: 4cm — as duas seções juntas)
  gapH: 3, // mm entre colunas
  gapV: 0, // mm entre linhas
  margemEsq: 2, // mm
  margemTopo: 0, // mm — a página deve ter EXATAMENTE a altura da etiqueta
  larguraPagina: 0, // 0 = calcula pela soma das colunas
  divisoria: 25, // mm do topo até o picote interno do preço (0 = sem guia)
  deslocY: 0, // mm — ajuste fino de fase vertical na impressão (pode ser negativo)
  marca: 'CROSBY',
  hashtag: '#INSPIRESUCESSO',
  elements: DEFAULT_ELEMENTS,
};

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const hoje = () => new Date().toISOString().slice(0, 10);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Texto de cada elemento pra uma etiqueta concreta
function textoElemento(key, cfg, label) {
  switch (key) {
    case 'marca':
      return cfg.marca;
    case 'hashtag':
      return cfg.hashtag;
    case 'descricao':
      return label.description || '';
    case 'preco':
      return fmtBRL(label.price);
    case 'referencia':
      return [label.reference, label.productCode].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

// ─── Conteúdo da etiqueta (compartilhado: editor, prévia e impressão) ────────
// scale=null → unidades físicas (mm/pt, vai pra impressora)
// scale=S    → editor, S px por mm
function LabelContent({
  cfg,
  label,
  scale,
  selected,
  onDragStart,
  onResizeStart,
}) {
  const mm = (v) => (scale ? `${v * scale}px` : `${v}mm`);
  const font = (pt) => (scale ? `${pt * PT_TO_MM * scale}px` : `${pt}pt`);
  const interactive = !!onDragStart;

  return (
    <>
      {Object.entries(cfg.elements).map(([key, el]) => {
        if (!el.visible) return null;
        const texto = textoElemento(key, cfg, label);
        if (!texto) return null;
        const isSel = selected === key;
        return (
          <div
            key={key}
            onPointerDown={interactive ? onDragStart(key) : undefined}
            style={{
              position: 'absolute',
              left: mm(el.x),
              top: mm(el.y),
              transform: 'translate(-50%, -50%)',
              fontSize: font(el.fontSize),
              fontWeight: el.bold ? 800 : 400,
              letterSpacing: key === 'marca' ? '0.06em' : '0.02em',
              whiteSpace: key === 'descricao' ? 'normal' : 'nowrap',
              maxWidth: mm(cfg.larguraEtiqueta - 2),
              textAlign: 'center',
              lineHeight: 1.15,
              color: '#000',
              cursor: interactive ? 'move' : undefined,
              userSelect: 'none',
              outline: isSel ? '1.5px dashed #2563eb' : 'none',
              outlineOffset: '2px',
              zIndex: isSel ? 2 : 1,
            }}
          >
            {texto}
            {isSel && interactive && (
              <span
                onPointerDown={onResizeStart(key)}
                title="Arraste pra mudar o tamanho da fonte"
                style={{
                  position: 'absolute',
                  right: -8,
                  bottom: -8,
                  width: 12,
                  height: 12,
                  background: '#2563eb',
                  borderRadius: 3,
                  cursor: 'nwse-resize',
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Uma etiqueta física (prévia/impressão) ──────────────────────────────────
function Etiqueta({ cfg, label }) {
  const rot = ROTACAO_IMPRESSAO;
  const emPe = rot === 90 || rot === 270;
  return (
    <div
      className="etq-label"
      style={{
        width: `${cfg.larguraEtiqueta}mm`,
        height: `${cfg.alturaEtiqueta}mm`,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Arial Narrow', Arial, Helvetica, sans-serif",
        boxSizing: 'border-box',
        flex: '0 0 auto',
      }}
    >
      {/* wrapper de rotação: em 90/270 a caixa interna troca L×A */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${emPe ? cfg.alturaEtiqueta : cfg.larguraEtiqueta}mm`,
          height: `${emPe ? cfg.larguraEtiqueta : cfg.alturaEtiqueta}mm`,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        }}
      >
        {label.__teste ? (
          // Etiqueta de teste de alinhamento: moldura na borda + número.
          // Se a moldura sair deslocada do recorte físico, calibre o sensor
          // de gap da impressora (ver aviso na tela).
          <div
            style={{
              position: 'absolute',
              inset: '0.8mm',
              border: '0.4mm solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18pt',
              fontWeight: 800,
            }}
          >
            {label.__teste}
          </div>
        ) : (
          <LabelContent cfg={cfg} label={label} scale={null} />
        )}
      </div>
    </div>
  );
}

// ─── Folha: linhas de N colunas (1 linha = 1 página impressa) ────────────────
// Estilos inline (não classes) pra garantir a ordenação horizontal 1-2-3.
function Folha({ cfg, labels, id }) {
  const linhas = [];
  const cols = Math.max(1, Number(cfg.colunas) || 1);
  for (let i = 0; i < labels.length; i += cols) {
    linhas.push(labels.slice(i, i + cols));
  }
  return (
    <div id={id} className="etq-sheet" style={{ background: '#fff' }}>
      {linhas.map((linha, li) => (
        <div
          key={li}
          className="etq-row"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'flex-start',
            boxSizing: 'border-box',
            paddingLeft: `${cfg.margemEsq}mm`,
            paddingTop: `${cfg.margemTopo}mm`,
            gap: `${cfg.gapH}mm`,
            height: `${cfg.alturaEtiqueta + cfg.margemTopo + cfg.gapV}mm`,
          }}
        >
          {linha.map((label, ci) => (
            <Etiqueta key={`${li}-${ci}`} cfg={cfg} label={label} />
          ))}
        </div>
      ))}
    </div>
  );
}

const EtiquetasPreco = () => {
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState(
    () => localStorage.getItem('etiquetas_branch') || '',
  );
  const [code, setCode] = useState('');
  const [date, setDate] = useState(hoje());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [transacao, setTransacao] = useState(null);
  const [linhas, setLinhas] = useState([]); // itens + seleção/qtd/preço editável
  const [showCfg, setShowCfg] = useState(false);
  const [sel, setSel] = useState('preco'); // elemento selecionado no editor
  const [zoom, setZoom] = useState(6); // px por mm no editor

  const [cfg, setCfg] = useState(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      return {
        ...DEFAULT_CONFIG,
        ...salvo,
        elements: { ...DEFAULT_ELEMENTS, ...(salvo.elements || {}) },
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }, [cfg]);
  useEffect(() => {
    if (branch) localStorage.setItem('etiquetas_branch', branch);
  }, [branch]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/branches`);
        const j = await r.json();
        setBranches(j?.data?.data || []);
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const setC = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const setNum = (k) => (e) => setC(k, Number(e.target.value) || 0);
  const updateEl = useCallback(
    (key, patch) =>
      setCfg((p) => ({
        ...p,
        elements: { ...p.elements, [key]: { ...p.elements[key], ...patch } },
      })),
    [],
  );

  // Largura da página: soma das colunas + gaps + margem (ou override manual)
  const larguraPagina = useMemo(() => {
    if (cfg.larguraPagina > 0) return cfg.larguraPagina;
    return (
      cfg.margemEsq * 2 +
      cfg.colunas * cfg.larguraEtiqueta +
      Math.max(0, cfg.colunas - 1) * cfg.gapH
    );
  }, [cfg]);
  const alturaPagina = cfg.margemTopo + cfg.alturaEtiqueta + cfg.gapV;

  // ─── Busca a transação ────────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    if (!branch || !code || !date) {
      setErro('Informe filial, número da transação e data.');
      return;
    }
    setLoading(true);
    setErro('');
    setTransacao(null);
    setLinhas([]);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/totvs/pdv/transaction?branch=${branch}&code=${encodeURIComponent(
          code.trim(),
        )}&date=${date}`,
      );
      const j = await r.json();
      if (!r.ok || !j?.data?.items?.length) {
        setErro(j?.message || 'Transação não encontrada no TOTVS.');
        return;
      }
      setTransacao(j.data.transaction);
      setLinhas(
        j.data.items.map((it) => ({
          ...it,
          selecionado: true,
          qtdEtiquetas: Math.max(1, Math.round(it.quantity || 1)),
          preco: it.netUnit,
        })),
      );
    } catch (e) {
      setErro(`Falha ao consultar o TOTVS: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [branch, code, date]);

  const alterarLinha = (idx, patch) =>
    setLinhas((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const todosSelecionados =
    linhas.length > 0 && linhas.every((l) => l.selecionado);
  const alternarTodos = () =>
    setLinhas((p) => p.map((l) => ({ ...l, selecionado: !todosSelecionados })));

  // Expande cada item na quantidade de etiquetas pedida
  const labels = useMemo(
    () =>
      linhas
        .filter((l) => l.selecionado && l.qtdEtiquetas > 0)
        .flatMap((l) =>
          Array.from({ length: l.qtdEtiquetas }, () => ({
            price: l.preco,
            description: l.description,
            reference: l.reference,
            productCode: l.productCode,
          })),
        ),
    [linhas],
  );

  // Etiqueta de amostra do editor: primeiro item selecionado ou exemplo
  const amostra = labels[0] || {
    price: 258,
    description: 'CAMISA CLOUDY STORM',
    reference: '001 023 001',
    productCode: 46602,
  };

  // ─── Impressão via PDF (jsPDF) ────────────────────────────────────────────
  // Gera um PDF com coordenadas exatas em mm: cada linha da bobina é uma
  // página do tamanho exato. Elimina a paginação do navegador (que quebrava
  // linhas no meio) — basta imprimir o PDF em escala 100%/"Tamanho real".
  const gerarPdf = useCallback(
    (lista) => {
      if (!lista.length) return;
      const orient = larguraPagina > alturaPagina ? 'landscape' : 'portrait';
      const doc = new jsPDF({
        unit: 'mm',
        format: [larguraPagina, alturaPagina],
        orientation: orient,
      });
      const cols = Math.max(1, Number(cfg.colunas) || 1);
      const paginas = [];
      for (let i = 0; i < lista.length; i += cols) {
        paginas.push(lista.slice(i, i + cols));
      }
      paginas.forEach((linha, li) => {
        if (li > 0) doc.addPage([larguraPagina, alturaPagina], orient);
        linha.forEach((label, ci) => {
          const x0 = cfg.margemEsq + ci * (cfg.larguraEtiqueta + cfg.gapH);
          const y0 = cfg.margemTopo + (Number(cfg.deslocY) || 0);
          if (label.__teste) {
            // moldura de teste de alinhamento + número
            doc.setLineWidth(0.4);
            doc.rect(
              x0 + 0.8,
              y0 + 0.8,
              cfg.larguraEtiqueta - 1.6,
              cfg.alturaEtiqueta - 1.6,
            );
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(
              String(label.__teste),
              x0 + cfg.larguraEtiqueta / 2,
              y0 + cfg.alturaEtiqueta / 2,
              { align: 'center', baseline: 'middle' },
            );
            return;
          }
          Object.entries(cfg.elements).forEach(([key, el]) => {
            if (!el.visible) return;
            const texto = textoElemento(key, cfg, label);
            if (!texto) return;
            doc.setFont('helvetica', el.bold ? 'bold' : 'normal');
            doc.setFontSize(el.fontSize);
            doc.text(String(texto), x0 + el.x, y0 + el.y, {
              align: 'center',
              baseline: 'middle',
              ...(key === 'descricao'
                ? { maxWidth: cfg.larguraEtiqueta - 2 }
                : {}),
            });
          });
        });
      });
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    },
    [cfg, larguraPagina, alturaPagina],
  );

  const imprimir = () => gerarPdf(labels);
  const imprimirTeste = () => {
    const cols = Math.max(1, Number(cfg.colunas) || 1);
    gerarPdf(Array.from({ length: cols * 3 }, (_, i) => ({ __teste: i + 1 })));
  };

  // ─── Manual de configuração (PDF pra download) ────────────────────────────
  const baixarManual = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const M = 18; // margem
    const LW = 210 - M * 2; // largura útil
    let y = 20;

    const quebra = (alt) => {
      if (y + alt > 282) {
        doc.addPage();
        y = 20;
      }
    };
    const titulo = (t) => {
      quebra(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 6, 56);
      doc.text(t, M, y);
      y += 9;
      doc.setTextColor(0, 0, 0);
    };
    const secao = (t) => {
      quebra(12);
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 6, 56);
      doc.text(t, M, y);
      doc.setDrawColor(0, 6, 56);
      doc.setLineWidth(0.3);
      doc.line(M, y + 1.5, M + LW, y + 1.5);
      y += 7;
      doc.setTextColor(0, 0, 0);
    };
    const item = (t, indent = 0) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const linhas = doc.splitTextToSize(t, LW - indent - 4);
      quebra(linhas.length * 4.8 + 1);
      doc.text('•', M + indent, y);
      doc.text(linhas, M + indent + 4, y);
      y += linhas.length * 4.8 + 1.5;
    };
    const nota = (t) => {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const linhas = doc.splitTextToSize(t, LW);
      quebra(linhas.length * 4.4 + 2);
      doc.text(linhas, M, y);
      y += linhas.length * 4.4 + 2;
    };

    const pag = `${larguraPagina.toFixed(1).replace('.', ',')} mm de largura × ${alturaPagina.toFixed(1).replace('.', ',')} mm de altura`;

    titulo('Manual — Etiquetas de Preço (Argox OS-2140 PPLA)');
    nota(
      `Gerado pelo HeadCoach em ${new Date().toLocaleDateString('pt-BR')}. Medidas atuais da bobina: etiqueta ${cfg.larguraEtiqueta}×${cfg.alturaEtiqueta} mm, ${cfg.colunas} colunas, página de ${pag}.`,
    );

    secao('1. Criar o papel no driver do Windows (uma vez por computador)');
    item(
      'Caminho: Configurações do Windows > Bluetooth e dispositivos > Impressoras e scanners > Argox OS-2140 PPLA > Preferências de impressão.',
    );
    item('Abra a aba "Configuração de página".');
    item('Em "Papel de etiquetas", clique no botão "Novo…".');
    item(`Nome: Etiquetas Crosby  ·  Largura: ${larguraPagina.toFixed(1).replace('.', ',')} mm  ·  Altura: ${alturaPagina.toFixed(1).replace('.', ',')} mm.`, 4);
    item('Orientação: Retrato. Clique OK e depois Aplicar.', 4);
    nota(
      'IMPORTANTE: a altura do papel deve ser EXATAMENTE a da linha de etiquetas (mostrada no card "Bobina e impressão" da página). Papel maior faz a impressora avançar além da etiqueta e desalinha as linhas seguintes.',
    );

    secao('2. Configurar o sensor de mídia (mesma janela do driver)');
    item('Abra a aba "Papel de etiquetas".');
    item('Sensor de etiquetas: "Intervalo entre etiquetas".', 4);
    item('Altura do intervalo: 3,0 mm.', 4);
    item('Ação pós-impressão: "Nenhum".', 4);
    item('Clique OK para salvar.');

    secao('3. Calibrar o sensor na impressora (quando desalinhar)');
    item('Desligue a impressora e aguarde 5 segundos.');
    item(
      'Segure o botão FEED, ligue a impressora SEGURANDO o botão, e mantenha por 5 a 10 segundos — solte quando ela puxar etiquetas sozinha.',
    );
    item(
      'Teste: com a impressora pronta, um toque no FEED deve avançar exatamente UMA etiqueta e parar no picote.',
    );
    item(
      'Alternativa sem o botão: instale o "Argox Printer Utility" (site da Argox > Support > Download > OS-2140 > PPLA) e use o botão de calibração.',
    );

    secao('4. Imprimir pelo navegador (HeadCoach > Etiquetas de Preço)');
    item('Busque a transação (filial + número + data) e confira os itens e preços.');
    item('Clique em "Imprimir" — abre uma aba com o PDF e o diálogo de impressão.');
    item('Destino: Argox OS-2140 PPLA.', 4);
    item('Tamanho do papel: Etiquetas Crosby (criado no passo 1).', 4);
    item('Margens: Nenhuma.', 4);
    item('Escala: 100% (ou "Tamanho real"). NUNCA use "Ajustar à página".', 4);

    secao('5. Se sair desalinhado');
    item(
      'Use o botão "Teste de alinhamento" da página: imprime 3 linhas de molduras numeradas (1 a 9) para comparar com o recorte físico.',
    );
    item(
      'Moldura deslocada por um valor CONSTANTE em todas as linhas: corrija no campo "Ajuste de fase vertical (mm)" — ex.: saiu 5 mm adiantado, digite 5.',
    );
    item(
      'Moldura escorregando MAIS a cada linha: o papel do driver está com altura errada (refaça o passo 1) ou o sensor está descalibrado (passo 3).',
    );
    item(
      'Deslocada para esquerda/direita: ajuste "Margem esquerda (mm)" no card Bobina e impressão.',
    );

    doc.save('manual-etiquetas-argox-os2140.pdf');
  };

  // ─── Drag & resize no editor ──────────────────────────────────────────────
  const S = zoom; // px por mm

  const onDragStart = useCallback(
    (key) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSel(key);
      const el = cfg.elements[key];
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = el.x;
      const oy = el.y;
      const move = (ev) => {
        updateEl(key, {
          x: clamp(
            Math.round((ox + (ev.clientX - sx) / S) * 10) / 10,
            0,
            cfg.larguraEtiqueta,
          ),
          y: clamp(
            Math.round((oy + (ev.clientY - sy) / S) * 10) / 10,
            0,
            cfg.alturaEtiqueta,
          ),
        });
      };
      const up = () => window.removeEventListener('pointermove', move);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    },
    [cfg.elements, cfg.larguraEtiqueta, cfg.alturaEtiqueta, S, updateEl],
  );

  const onResizeStart = useCallback(
    (key) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = cfg.elements[key];
      const sx = e.clientX;
      const of = el.fontSize;
      const move = (ev) => {
        // arrastar pra direita/baixo aumenta a fonte (1pt a cada ~4px)
        updateEl(key, {
          fontSize: clamp(Math.round(of + (ev.clientX - sx) / 4), 3, 60),
        });
      };
      const up = () => window.removeEventListener('pointermove', move);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    },
    [cfg.elements, updateEl],
  );

  const selEl = sel ? cfg.elements[sel] : null;

  const campoNum = (label, key, extra = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      <input
        type="number"
        step="0.5"
        value={cfg[key]}
        onChange={setNum(key)}
        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-[#000638]/20 focus:border-[#000638] outline-none"
        {...extra}
      />
    </label>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageTitle
        title="Etiquetas de Preço"
        subtitle="Imprime etiquetas dos produtos de uma transação do TOTVS (Argox OS-2140 PPLA)"
        icon={Tag}
      />

      {/* ─── Busca da transação ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-[#000638] font-semibold text-sm">
          <Storefront size={18} weight="bold" /> Transação
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-600">
              Filial
            </span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#000638]"
            >
              <option value="">Selecione…</option>
              {branches.map((b) => (
                <option key={b.cd_empresa} value={b.cd_empresa}>
                  {b.cd_empresa} — {b.nm_grupoempresa}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-600">
              Nº da transação
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="ex.: 123456"
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#000638]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-600">
              Data da transação
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#000638]"
            />
          </label>
          <button
            onClick={buscar}
            disabled={loading}
            className="self-end h-[38px] rounded-lg bg-[#000638] text-white text-sm font-medium px-4 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Spinner size={16} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={16} weight="bold" />
            )}
            Buscar itens
          </button>
        </div>
        {erro && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {erro}
          </div>
        )}
        {transacao && (
          <div className="mt-3 text-xs text-gray-600">
            Transação <b>{transacao.transactionCode}</b> · filial{' '}
            {transacao.branchCode} ·{' '}
            {String(transacao.transactionDate).slice(0, 10)}
            {transacao.customerName ? ` · ${transacao.customerName}` : ''}
            {transacao.totalAmount
              ? ` · total ${fmtBRL(transacao.totalAmount)}`
              : ''}
          </div>
        )}
      </div>

      {/* ─── Itens ──────────────────────────────────────────────────────── */}
      {linhas.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#000638] font-semibold text-sm">
              Itens da transação ({linhas.length})
            </div>
            <button
              onClick={alternarTodos}
              className="text-xs text-[#000638] flex items-center gap-1"
            >
              {todosSelecionados ? (
                <CheckSquare size={16} weight="fill" />
              ) : (
                <Square size={16} />
              )}
              {todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-500 border-b">
                  <th className="py-2 w-8"></th>
                  <th className="py-2">Produto</th>
                  <th className="py-2">Ref. / Cor / Tam.</th>
                  <th className="py-2 text-right">Qtd</th>
                  <th className="py-2 text-right">Preço líquido</th>
                  <th className="py-2 text-right">Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr
                    key={`${l.productCode}-${i}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={l.selecionado}
                        onChange={(e) =>
                          alterarLinha(i, { selecionado: e.target.checked })
                        }
                        className="accent-[#000638]"
                      />
                    </td>
                    <td className="py-2">
                      <div className="font-medium text-gray-800">
                        {l.description}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        cód. {l.productCode}
                      </div>
                    </td>
                    <td className="py-2 text-xs text-gray-600">
                      {[l.reference, l.color, l.size]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {l.quantity}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={l.preco}
                        onChange={(e) =>
                          alterarLinha(i, {
                            preco: Number(e.target.value) || 0,
                          })
                        }
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={l.qtdEtiquetas}
                        onChange={(e) =>
                          alterarLinha(i, {
                            qtdEtiquetas: Math.max(
                              0,
                              parseInt(e.target.value, 10) || 0,
                            ),
                          })
                        }
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-right text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Editor visual da etiqueta ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-[#000638] font-semibold text-sm">
          <ArrowsOutCardinal size={18} weight="bold" /> Editor da etiqueta
          <span className="text-xs font-normal text-gray-500">
            arraste pra posicionar · alça azul redimensiona a fonte
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Canvas */}
          <div className="flex-1 flex flex-col items-center">
            <div className="bg-gray-100 rounded-xl p-6 overflow-auto w-full flex justify-center">
              <div
                style={{
                  width: cfg.larguraEtiqueta * S,
                  height: cfg.alturaEtiqueta * S,
                  background: '#fff',
                  position: 'relative',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
                  fontFamily: "'Arial Narrow', Arial, Helvetica, sans-serif",
                  flex: '0 0 auto',
                  // linha-guia vertical central
                  backgroundImage:
                    'linear-gradient(to right, transparent calc(50% - 0.5px), rgba(37,99,235,0.15) calc(50% - 0.5px), rgba(37,99,235,0.15) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                }}
              >
                {cfg.divisoria > 0 && (
                  // picote interno (destacável do preço) — só guia visual
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: cfg.divisoria * S,
                      borderTop: '1.5px dashed #f59e0b',
                      zIndex: 0,
                    }}
                    title={`Picote do preço a ${cfg.divisoria}mm do topo`}
                  />
                )}
                <LabelContent
                  cfg={cfg}
                  label={amostra}
                  scale={S}
                  selected={sel}
                  onDragStart={onDragStart}
                  onResizeStart={onResizeStart}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
              Zoom
              <input
                type="range"
                min="3"
                max="12"
                step="1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              {zoom}×
              <span className="text-gray-400">
                · etiqueta {cfg.larguraEtiqueta}×{cfg.alturaEtiqueta} mm
              </span>
            </div>
          </div>

          {/* Painel lateral */}
          <div className="w-full lg:w-72 flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-500 uppercase">
              Elementos
            </div>
            {Object.keys(cfg.elements).map((key) => (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer ${
                  sel === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSel(key)}
              >
                <input
                  type="checkbox"
                  checked={cfg.elements[key].visible}
                  onChange={(e) => updateEl(key, { visible: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-[#000638]"
                />
                <span className="text-sm text-gray-700 flex-1">
                  {ELEMENT_NAMES[key]}
                </span>
                <span className="text-[10px] text-gray-400">
                  {cfg.elements[key].fontSize}pt
                </span>
              </div>
            ))}

            {selEl && (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-2 mt-1">
                <div className="text-xs font-semibold text-gray-600">
                  {ELEMENT_NAMES[sel]}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500">X (mm)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={selEl.x}
                      onChange={(e) =>
                        updateEl(sel, { x: Number(e.target.value) || 0 })
                      }
                      className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500">Y (mm)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={selEl.y}
                      onChange={(e) =>
                        updateEl(sel, { y: Number(e.target.value) || 0 })
                      }
                      className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500">
                      Fonte (pt)
                    </span>
                    <input
                      type="number"
                      step="1"
                      value={selEl.fontSize}
                      onChange={(e) =>
                        updateEl(sel, {
                          fontSize: clamp(Number(e.target.value) || 3, 3, 60),
                        })
                      }
                      className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!selEl.bold}
                    onChange={(e) => updateEl(sel, { bold: e.target.checked })}
                    className="accent-[#000638]"
                  />
                  Negrito
                </label>
                {(sel === 'marca' || sel === 'hashtag') && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500">Texto</span>
                    <input
                      value={sel === 'marca' ? cfg.marca : cfg.hashtag}
                      onChange={(e) =>
                        setC(
                          sel === 'marca' ? 'marca' : 'hashtag',
                          e.target.value,
                        )
                      }
                      className="border border-gray-300 rounded px-1.5 py-1 text-xs"
                    />
                  </label>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setCfg((p) => ({ ...p, elements: DEFAULT_ELEMENTS }));
                setSel('preco');
              }}
              className="text-xs text-gray-500 underline self-start mt-1"
            >
              Restaurar layout padrão
            </button>
          </div>
        </div>
      </div>

      {/* ─── Configuração da bobina ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <button
          onClick={() => setShowCfg((v) => !v)}
          className="flex items-center gap-2 text-[#000638] font-semibold text-sm"
        >
          <Gear size={18} weight="bold" /> Bobina e impressão
          <span className="text-xs font-normal text-gray-500">
            (página: {larguraPagina.toFixed(1)} × {alturaPagina.toFixed(1)} mm)
          </span>
          {larguraPagina > 104 && (
            <span className="text-xs font-semibold text-red-600">
              ⚠ maior que a área de impressão da OS-2140 (104 mm) — reduza
              largura/gap
            </span>
          )}
        </button>
        {showCfg && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
            {campoNum('Colunas', 'colunas', { step: 1, min: 1 })}
            {campoNum('Largura etiqueta (mm)', 'larguraEtiqueta')}
            {campoNum('Altura etiqueta (mm)', 'alturaEtiqueta')}
            {campoNum('Espaço entre colunas (mm)', 'gapH')}
            {campoNum('Espaço entre linhas (mm)', 'gapV')}
            {campoNum('Margem esquerda (mm)', 'margemEsq')}
            {campoNum('Margem superior (mm)', 'margemTopo')}
            {campoNum('Largura da página (0 = auto)', 'larguraPagina')}
            {campoNum('Picote do preço (mm do topo)', 'divisoria')}
            {campoNum('Ajuste de fase vertical (mm)', 'deslocY', {
              step: 0.5,
              min: -60,
            })}
          </div>
        )}
      </div>

      {/* ─── Prévia + impressão ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[#000638] font-semibold text-sm">
            Prévia da impressão — {labels.length} etiqueta(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={baixarManual}
              className="rounded-lg border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2"
              title="Baixa um PDF com o passo a passo de configuração do driver e da impressão"
            >
              Manual (PDF)
            </button>
            <button
              onClick={imprimirTeste}
              className="rounded-lg border border-[#000638] text-[#000638] text-sm font-medium px-4 py-2 flex items-center gap-2"
              title="Imprime 3 linhas de molduras numeradas pra conferir o alinhamento com o recorte físico"
            >
              Teste de alinhamento
            </button>
            <button
              onClick={imprimir}
              disabled={labels.length === 0}
              className="rounded-lg bg-[#000638] text-white text-sm font-medium px-4 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              <Printer size={16} weight="bold" /> Imprimir
            </button>
          </div>
        </div>

        {labels.length === 0 ? (
          <div className="text-sm text-gray-500 py-8 text-center">
            Busque uma transação e selecione os itens para ver a prévia.
          </div>
        ) : (
          <div className="overflow-auto bg-gray-50 rounded-xl p-4">
            <div
              className="bg-white shadow-sm mx-auto"
              style={{ width: `${larguraPagina}mm` }}
            >
              <Folha cfg={cfg} labels={labels.slice(0, 12)} id="etq-preview" />
            </div>
            {labels.length > 12 && (
              <div className="text-xs text-gray-500 text-center mt-2">
                Mostrando as 12 primeiras — a impressão sai com todas as{' '}
                {labels.length}.
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-gray-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          <b>Configuração do driver (faça uma vez):</b> Impressoras &gt; Argox
          OS-2140 PPLA &gt; Preferências &gt; aba &quot;Configuração de
          página&quot; &gt; <b>Novo</b> papel de etiquetas com{' '}
          <b>
            largura {larguraPagina.toFixed(1).replace('.', ',')} mm × altura{' '}
            {alturaPagina.toFixed(1).replace('.', ',')} mm
          </b>
          , orientação <b>Retrato</b>. O botão Imprimir gera um <b>PDF</b>{' '}
          que abre em outra aba já com o diálogo de impressão: selecione a
          Argox, o papel criado acima e escala <b>100% / Tamanho real</b>.
          Cada página do PDF é uma linha da bobina — se mudar as medidas
          aqui, atualize o papel no driver com o tamanho mostrado acima.
          <br />
          <b>Se a impressão sair fora de posição (no meio da etiqueta):</b>{' '}
          calibre o sensor de gap — desligue a impressora, segure o botão{' '}
          <b>FEED</b>, ligue segurando e solte quando ela começar a puxar
          etiquetas. Depois, no driver, aba &quot;Papel de etiquetas&quot;,
          confira o tipo de mídia <b>&quot;Etiquetas com intervalos&quot;</b>{' '}
          (gap). Teste: um toque no FEED deve avançar exatamente UMA linha de
          etiquetas — se avançar certo, use o botão &quot;Teste de
          alinhamento&quot; aqui pra conferir as molduras no recorte físico.
        </div>
      </div>


    </div>
  );
};

export default EtiquetasPreco;
