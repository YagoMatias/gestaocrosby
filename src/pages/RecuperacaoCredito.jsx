import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { supabaseAdmin } from '../lib/supabase';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  MagnifyingGlass,
  WhatsappLogo,
  Users,
  CurrencyDollar,
  Warning,
  Buildings,
  Storefront,
  ArrowUp,
  ArrowDown,
  SortAscending,
  SortDescending,
  X,
  Receipt,
  FileText,
  CircleNotch,
  Scales,
} from '@phosphor-icons/react';

const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valor || 0,
  );

const formatarCNPJ = (cnpj) => {
  if (!cnpj) return '—';
  const limpo = String(cnpj).replace(/\D/g, '');
  if (limpo.length === 14) {
    return limpo.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }
  if (limpo.length === 11) {
    return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cnpj;
};

const formatarData = (data) => {
  if (!data) return 'N/A';
  const [datePart] = String(data).split('T');
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return 'N/A';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
};

const RecuperacaoCredito = () => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [notification, setNotification] = useState(null);
  const [busca, setBusca] = useState('');
  const [ordenarPor, setOrdenarPor] = useState('valor_total');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState('desc');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [filtroOrigem, setFiltroOrigem] = useState('TODOS');
  const [filtroSicredi, setFiltroSicredi] = useState(false);
  const [filiaisCodigos, setFiliaisCodigos] = useState([]);
  const [danfeLoading, setDanfeLoading] = useState(null);
  const [nfBuscando, setNfBuscando] = useState(null);
  const [nfResultados, setNfResultados] = useState({});
  const [notificacaoModal, setNotificacaoModal] = useState(null);
  const [gerandoNotificacao, setGerandoNotificacao] = useState(false);

  const hojeStr = new Date().toISOString().slice(0, 10);

  // Buscar filiais ao carregar
  useEffect(() => {
    const buscarFiliais = async () => {
      try {
        const response = await fetch(`${TotvsURL}branches`);
        if (response.ok) {
          const result = await response.json();
          let empresasArray = [];
          if (result.success && result.data) {
            if (result.data.data && Array.isArray(result.data.data)) {
              empresasArray = result.data.data;
            } else if (Array.isArray(result.data)) {
              empresasArray = result.data;
            }
          }
          const codigos = empresasArray
            .map((branch) => parseInt(branch.cd_empresa))
            .filter((code) => !isNaN(code) && code > 0);
          if (codigos.length > 0) setFiliaisCodigos(codigos);
        }
      } catch (err) {
        // silencioso
      }
    };
    buscarFiliais();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);

      // Datas: buscar vencidas desde 2024-01-01 até hoje
      const dataIni = '2024-01-01';
      const dataFim = hojeStr;

      // ==============================================
      // PASSO 1: Buscar clientes MTM e Franquias em paralelo
      // ==============================================
      const [respMTM, respFranquias] = await Promise.all([
        fetch(`${TotvsURL}multibrand-clients`),
        fetch(`${TotvsURL}franchise-clients`),
      ]);

      if (!respMTM.ok)
        throw new Error(`Erro ao buscar multimarcas: HTTP ${respMTM.status}`);
      if (!respFranquias.ok)
        throw new Error(
          `Erro ao buscar franquias: HTTP ${respFranquias.status}`,
        );

      const resultMTM = await respMTM.json();
      const resultFranquias = await respFranquias.json();

      const clientesMTM = resultMTM.data || [];
      const clientesFranquia = resultFranquias.data || [];

      // Mapas para enriquecer e identificar origem
      const origemMap = {};
      const clientesMap = {};

      clientesMTM.forEach((m) => {
        const code = String(m.code);
        origemMap[code] = 'MULTIMARCAS';
        clientesMap[code] = m;
      });
      clientesFranquia.forEach((f) => {
        const code = String(f.code);
        if (!origemMap[code]) origemMap[code] = 'FRANQUIA';
        else origemMap[code] = 'MULTIMARCAS / FRANQUIA';
        if (!clientesMap[code]) clientesMap[code] = f;
      });

      const todosCodigos = [
        ...new Set([
          ...clientesMTM.map((m) => m.code),
          ...clientesFranquia.map((f) => f.code),
        ]),
      ];

      if (todosCodigos.length === 0) {
        setClientes([]);
        return;
      }

      const codigosStr = todosCodigos.join(',');

      // ==============================================
      // PASSO 2: Buscar faturas vencidas
      // ==============================================
      const params = new URLSearchParams({
        dt_inicio: dataIni,
        dt_fim: dataFim,
        modo: 'vencimento',
        situacao: '1',
        status: 'Vencido',
        cd_cliente: codigosStr,
      });

      const respFaturas = await fetch(
        `${TotvsURL}accounts-receivable/filter?${params.toString()}`,
      );

      if (!respFaturas.ok)
        throw new Error(`Erro ao buscar faturas: HTTP ${respFaturas.status}`);

      const resultFaturas = await respFaturas.json();
      const faturas = (resultFaturas.data?.items || []).filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );

      // ==============================================
      // PASSO 3: Enriquecer com dados de pessoa (telefone, UF)
      // ==============================================
      const codigosUnicos = [
        ...new Set(faturas.map((f) => f.cd_cliente).filter(Boolean)),
      ];

      let pessoasMap = {};
      if (codigosUnicos.length > 0) {
        try {
          const respPessoas = await fetch(`${TotvsURL}persons/batch-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personCodes: codigosUnicos }),
          });
          if (respPessoas.ok) {
            const dataPessoas = await respPessoas.json();
            pessoasMap = dataPessoas?.data || {};
          }
        } catch (err) {
          console.warn('Erro ao buscar dados de pessoas:', err.message);
        }
      }

      // ==============================================
      // PASSO 4: Agrupar por cliente e filtrar >60 dias
      // ==============================================
      const agrupado = {};
      faturas.forEach((item) => {
        const cd = String(item.cd_cliente);
        if (!agrupado[cd]) {
          const pessoa = pessoasMap[cd] || {};
          const cache = clientesMap[cd] || {};
          agrupado[cd] = {
            cd_cliente: cd,
            nm_cliente:
              pessoa.name || cache.name || item.nm_cliente || `Cliente ${cd}`,
            nm_fantasia:
              pessoa.fantasyName || cache.fantasyName || item.nm_fantasia || '',
            nr_telefone: pessoa.phone || '',
            nr_cpfcnpj: item.nr_cpfcnpj || '',
            ds_uf: pessoa.uf || item.ds_uf || '',
            origem: origemMap[cd] || '—',
            valor_total: 0,
            faturas: [],
          };
        }
        // Captura o CNPJ da primeira fatura que tiver
        if (!agrupado[cd].nr_cpfcnpj && item.nr_cpfcnpj) {
          agrupado[cd].nr_cpfcnpj = item.nr_cpfcnpj;
        }
        agrupado[cd].valor_total += parseFloat(item.vl_fatura) || 0;
        agrupado[cd].faturas.push(item);
      });

      // Calcular dias de atraso e filtrar apenas INADIMPLENTES (>60 dias)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const inadimplentes = Object.values(agrupado)
        .map((cliente) => {
          const diasAtrasoMax = (cliente.faturas || []).reduce(
            (max, fatura) => {
              if (!fatura.dt_vencimento) return max;
              const [datePart] = String(fatura.dt_vencimento).split('T');
              const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
              const venc = new Date(y, m - 1, d);
              venc.setHours(0, 0, 0, 0);
              const diff = Math.floor((hoje - venc) / (1000 * 60 * 60 * 24));
              return Math.max(max, diff);
            },
            0,
          );

          return { ...cliente, diasAtrasoMax };
        })
        .filter((c) => c.diasAtrasoMax > 60);

      setClientes(inadimplentes);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setNotification({
        type: 'error',
        message: `Erro ao carregar dados: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  // Filtrar por busca textual
  const clientesFiltrados = useMemo(() => {
    let resultado = [...clientes];

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (c) =>
          (c.nm_cliente || '').toLowerCase().includes(termo) ||
          (c.nm_fantasia || '').toLowerCase().includes(termo) ||
          (c.nr_cpfcnpj || '').includes(termo) ||
          (c.cd_cliente || '').includes(termo),
      );
    }

    // Filtro por origem
    if (filtroOrigem !== 'TODOS') {
      resultado = resultado.filter((c) => c.origem === filtroOrigem);
    }

    // Filtro por Sicredi (portador 748)
    if (filtroSicredi) {
      resultado = resultado.filter((c) =>
        (c.faturas || []).some(
          (f) =>
            String(f.cd_portador) === '748' ||
            (f.nm_portador || '').toUpperCase().includes('SICREDI'),
        ),
      );
    }

    // Ordenação
    resultado.sort((a, b) => {
      let valorA, valorB;
      switch (ordenarPor) {
        case 'nm_cliente':
          valorA = (a.nm_cliente || '').toLowerCase();
          valorB = (b.nm_cliente || '').toLowerCase();
          break;
        case 'valor_total':
          valorA = a.valor_total || 0;
          valorB = b.valor_total || 0;
          break;
        case 'diasAtrasoMax':
          valorA = a.diasAtrasoMax || 0;
          valorB = b.diasAtrasoMax || 0;
          break;
        case 'origem':
          valorA = (a.origem || '').toLowerCase();
          valorB = (b.origem || '').toLowerCase();
          break;
        default:
          return 0;
      }
      if (valorA < valorB) return direcaoOrdenacao === 'asc' ? -1 : 1;
      if (valorA > valorB) return direcaoOrdenacao === 'asc' ? 1 : -1;
      return 0;
    });

    return resultado;
  }, [
    clientes,
    busca,
    ordenarPor,
    direcaoOrdenacao,
    filtroOrigem,
    filtroSicredi,
  ]);

  // Métricas
  const metricas = useMemo(() => {
    const total = clientesFiltrados.length;
    const valorTotal = clientesFiltrados.reduce(
      (sum, c) => sum + (c.valor_total || 0),
      0,
    );
    const mtm = clientesFiltrados.filter(
      (c) => c.origem === 'MULTIMARCAS',
    ).length;
    const franquia = clientesFiltrados.filter(
      (c) => c.origem === 'FRANQUIA',
    ).length;
    return { total, valorTotal, mtm, franquia };
  }, [clientesFiltrados]);

  const handleOrdenar = (coluna) => {
    if (ordenarPor === coluna) {
      setDirecaoOrdenacao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdenarPor(coluna);
      setDirecaoOrdenacao('desc');
    }
  };

  const SortIcon = ({ coluna }) => {
    if (ordenarPor !== coluna) return null;
    return direcaoOrdenacao === 'asc' ? (
      <SortAscending size={14} className="inline ml-1" />
    ) : (
      <SortDescending size={14} className="inline ml-1" />
    );
  };

  // Buscar notas fiscais relacionadas a uma fatura
  const buscarNFsFatura = async (fatura) => {
    const faturaKey = `${fatura.cd_cliente}_${fatura.nr_fat || fatura.nr_fatura}_${fatura.nr_parcela || ''}`;
    setNfBuscando(faturaKey);
    try {
      const cd_cliente = parseInt(fatura.cd_cliente) || 0;
      const dtEmissao = fatura.dt_emissao
        ? fatura.dt_emissao.split('T')[0]
        : '';
      if (!dtEmissao || !cd_cliente) {
        setNotification({
          type: 'error',
          message: 'Dados da fatura incompletos para buscar NFs',
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      const branchCodes = filiaisCodigos.filter((c) => c >= 1 && c <= 99);

      const buscarComMargem = async (margem) => {
        const startDate = new Date(dtEmissao);
        startDate.setDate(startDate.getDate() - margem);
        const endDate = new Date(dtEmissao);
        endDate.setDate(endDate.getDate() + margem);

        const payload = {
          filter: {
            branchCodeList: branchCodes,
            personCodeList: [cd_cliente],
            eletronicInvoiceStatusList: ['Authorized'],
            startIssueDate: `${startDate.toISOString().slice(0, 10)}T00:00:00`,
            endIssueDate: `${endDate.toISOString().slice(0, 10)}T23:59:59`,
          },
          page: 1,
          pageSize: 100,
          expand: 'person',
        };

        const response = await fetch(`${TotvsURL}invoices-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Erro ao buscar notas fiscais');
        const data = await response.json();
        return data.data?.items || data.items || [];
      };

      // Busca progressiva: mesmo dia → ±1 → ±2 → ±3
      for (const margem of [0, 1, 2, 3]) {
        const items = await buscarComMargem(margem);
        if (items.length > 0) {
          // Pegar a primeira NF encontrada e gerar DANFE
          await gerarDanfeNF(items[0]);
          return;
        }
      }

      setNotification({
        type: 'error',
        message: 'Nenhuma nota fiscal encontrada para esta fatura',
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      setNotification({
        type: 'error',
        message: `Erro ao buscar NF: ${error.message}`,
      });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setNfBuscando(null);
    }
  };

  // Gerar DANFE a partir de NF
  const gerarDanfeNF = async (nf) => {
    try {
      setDanfeLoading(nf.invoiceCode || nf.transactionCode);

      const dataTransacao = nf.transactionDate
        ? nf.transactionDate.split('T')[0]
        : nf.invoiceDate
          ? nf.invoiceDate.split('T')[0]
          : '';
      if (!dataTransacao) throw new Error('Data da NF não disponível');

      const payload = {
        filter: {
          branchCodeList: [nf.branchCode],
          personCodeList: [nf.personCode],
          transactionBranchCode: nf.transactionBranchCode || nf.branchCode,
          transactionCode: nf.transactionCode,
          transactionDate: dataTransacao,
        },
      };

      const response = await fetch(`${TotvsURL}danfe-from-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao gerar DANFE');
      }

      const data = await response.json();
      let base64 = '';
      if (data.success && data.data)
        base64 = data.data.danfePdfBase64 || data.data.base64 || '';
      else if (data.danfePdfBase64) base64 = data.danfePdfBase64;

      if (base64) {
        abrirPDFDanfe(base64, nf.invoiceCode || nf.transactionCode);
      } else {
        throw new Error('DANFE não retornada pela API');
      }
    } catch (error) {
      setNotification({
        type: 'error',
        message: `Erro ao gerar DANFE: ${error.message}`,
      });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setDanfeLoading(null);
    }
  };

  const abrirPDFDanfe = (base64String, nrTransacao) => {
    try {
      const base64 = base64String.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++)
        bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (newWindow) {
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `danfe-transacao-${nrTransacao}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Erro ao abrir a DANFE.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  const abrirNotificacaoModal = (cliente) => {
    const hoje = new Date();
    const faturasList = (cliente.faturas || [])
      .map((f) => {
        const nrFat = f.nr_fat || f.nr_fatura || '';
        return nrFat;
      })
      .filter(Boolean);
    const descricao =
      faturasList.length > 0
        ? `notas fiscais nº ${faturasList.join(', ')}`
        : 'mercadorias fornecidas';

    setNotificacaoModal({
      cliente,
      razao_social: cliente.nm_cliente || '',
      cnpj: formatarCNPJ(cliente.nr_cpfcnpj),
      endereco: cliente.ds_endereco || '',
      valor: formatarMoeda(cliente.valor_total),
      descricao_origem: descricao,
      dia: String(hoje.getDate()),
      mes: meses[hoje.getMonth()],
      whatsapp: '84 99135-2193',
    });
  };

  const gerarNotificacaoDocx = async () => {
    if (!notificacaoModal) return;
    setGerandoNotificacao(true);
    try {
      // ─── Carregar imagens do cabeçalho, rodapé e assinatura ───
      const loadImageAsDataURL = async (url) => {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      };

      const [fundoPaginaImg, assinaturaImg] = await Promise.all([
        loadImageAsDataURL('/tanaka-cabecalho.png.png'),
        loadImageAsDataURL('/tanaka-assinatura.png.jpg'),
      ]);

      // ─── Gerar PDF com jsPDF (auto-ajuste de fonte para caber em 1 página) ───
      let fontSize = 11;
      let pdf;
      let out;

      const gerarConteudoPDF = (fs) => {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const mL = 25;
        const cW = pageW - mL - 25;
        const lh = fs * 0.5; // line height proporcional
        const bottomLimit = pageH - 35; // espaço do rodapé
        let y = 0;

        // Helper: renderizar parágrafo com **negrito** e justificado
        const renderParagraph = (text, indentFirst = true) => {
          doc.setFontSize(fs);
          const firstIndent = indentFirst ? 15 : 0;
          const parts = text.split(/(\*\*.*?\*\*)/);
          const segments = parts
            .filter((p) => p)
            .map((p) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return { text: p.slice(2, -2), bold: true };
              return { text: p, bold: false };
            });
          const words = [];
          for (const seg of segments) {
            for (const w of seg.text.split(/\s+/).filter(Boolean)) {
              words.push({ text: w, bold: seg.bold });
            }
          }
          const lines = [];
          let curLine = [],
            curW = 0,
            isFirst = true;
          for (const word of words) {
            doc.setFont('times', word.bold ? 'bold' : 'normal');
            const ww = doc.getTextWidth(word.text);
            const sp = curLine.length > 0 ? doc.getTextWidth(' ') : 0;
            const maxW = isFirst ? cW - firstIndent : cW;
            if (curW + sp + ww > maxW && curLine.length > 0) {
              lines.push({ words: curLine, width: curW, indented: isFirst });
              curLine = [word];
              curW = ww;
              isFirst = false;
            } else {
              curW += sp + ww;
              curLine.push(word);
            }
          }
          if (curLine.length > 0)
            lines.push({
              words: curLine,
              width: curW,
              indented: isFirst,
              isLast: true,
            });
          for (const line of lines) {
            if (y > bottomLimit) {
              doc.addPage();
              y = 30;
            }
            const lx = mL + (line.indented ? firstIndent : 0);
            const lmw = line.indented ? cW - firstIndent : cW;
            const extra =
              !line.isLast && line.words.length > 1
                ? (lmw - line.width) / (line.words.length - 1)
                : 0;
            let cx = lx;
            for (let i = 0; i < line.words.length; i++) {
              doc.setFont('times', line.words[i].bold ? 'bold' : 'normal');
              doc.text(line.words[i].text, cx, y);
              cx += doc.getTextWidth(line.words[i].text);
              if (i < line.words.length - 1)
                cx += doc.getTextWidth(' ') + extra;
            }
            y += lh;
          }
          y += lh * 0.4;
        };

        // ─── Fundo da página ───
        if (fundoPaginaImg)
          doc.addImage(fundoPaginaImg, 'PNG', 0, 0, pageW, pageH);
        y = 30;

        // ─── Título ───
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'bold');
        doc.setFontSize(fs + 3);
        doc.text('NOTIFICAÇÃO EXTRAJUDICIAL', pageW / 2, y, {
          align: 'center',
        });
        const tw = doc.getTextWidth('NOTIFICAÇÃO EXTRAJUDICIAL');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(pageW / 2 - tw / 2, y + 1.5, pageW / 2 + tw / 2, y + 1.5);

        // ─── Data e destinatário ───
        y += lh * 2;
        doc.setFont('times', 'normal');
        doc.setFontSize(fs);
        doc.text(
          `Natal/RN, ${notificacaoModal.dia} de ${notificacaoModal.mes} de ${new Date().getFullYear()}.`,
          mL,
          y,
        );
        y += lh;
        const destLines = doc.splitTextToSize(
          `À ${notificacaoModal.razao_social}`,
          cW,
        );
        doc.text(destLines, mL, y);
        y += destLines.length * lh;
        doc.text(`CNPJ: ${notificacaoModal.cnpj}`, mL, y);
        y += lh;
        if (notificacaoModal.endereco) {
          const endLines = doc.splitTextToSize(
            `Endereço: ${notificacaoModal.endereco}`,
            cW,
          );
          doc.text(endLines, mL, y);
          y += endLines.length * lh;
        }
        doc.setFont('times', 'bold');
        doc.text('Ref.: Inadimplemento de obrigação comercial', mL, y);
        y += lh * 1.5;
        doc.setFont('times', 'normal');
        doc.text('Prezado(a) Senhor(a),', mL, y);
        y += lh * 1.8;

        // ─── Corpo ───
        renderParagraph(
          `A empresa **CROSBY CR VESTUÁRIO LTDA**, pessoa jurídica de direito privado, inscrita no CNPJ sob nº **17.177.680/0001-16**, com sede na Rua São José, nº 2189, Lote 61, Lagoa Nova, Natal/RN, CEP: 59.063-150, vem, por meio da presente, **NOTIFICAR** Vossa Senhoria acerca da existência de débito decorrente de operações comerciais realizadas entre as partes.`,
        );
        renderParagraph(
          `Conforme apurado em nossos registros, permanece em aberto o valor de **R$ ${notificacaoModal.valor}**, referente a ${notificacaoModal.descricao_origem}, conforme demonstrativo detalhado que segue em anexo.`,
        );
        renderParagraph(
          `O inadimplemento da obrigação caracteriza violação contratual e enseja a incidência das penalidades legais cabíveis, nos termos dos artigos 389 e 395 do Código Civil, incluindo perdas e danos, juros, correção monetária e honorários advocatícios.`,
        );
        renderParagraph(
          `Diante disso, fica Vossa Senhoria **NOTIFICADO(A)** a promover a quitação integral do débito no prazo improrrogável de **72 (setenta e duas) horas**, contadas do recebimento desta notificação.`,
        );
        renderParagraph(
          `Fica desde já consignado que o não adimplemento no prazo acima estipulado ensejará a adoção imediata das medidas judiciais cabíveis, incluindo o ajuizamento de **ação de execução ou cobrança**, conforme o caso, com a incidência de atualização monetária do débito; juros de mora; **honorários advocatícios**; custas processuais e demais implicações legais, sem prejuízo de eventual **protesto do título e/ou inscrição nos órgãos de proteção ao crédito (SPC/Serasa)**.`,
        );
        renderParagraph(
          `Caso o pagamento já tenha sido realizado, solicitamos o envio do respectivo comprovante para imediata regularização.`,
        );
        renderParagraph(
          `Ressaltamos que permanecemos à disposição para eventual composição amigável, a fim de evitar a adoção das **medidas judiciais acima descritas**, através do contato de whatsapp **${notificacaoModal.whatsapp}** e e-mail "felipetanakaadvocacia@gmail".`,
        );

        // ─── Fecho e assinatura ───
        y += lh;
        doc.setFont('times', 'normal');
        doc.setFontSize(fs);
        doc.text('Atenciosamente,', pageW / 2, y, { align: 'center' });
        y += lh * 1.5;

        if (assinaturaImg) {
          const assW = 45;
          const assH = 22;
          const assX = (pageW - assW) / 2;
          if (y + assH + 15 > bottomLimit) {
            doc.addPage();
            y = 30;
          }
          doc.addImage(assinaturaImg, 'JPEG', assX, y, assW, assH);
          y += assH + 3;
        }

        doc.setFont('times', 'bold');
        doc.setFontSize(fs);
        doc.text('CROSBY CR VESTUÁRIO LTDA', pageW / 2, y, { align: 'center' });
        y += lh;
        doc.setFont('times', 'normal');
        doc.text('P/P', pageW / 2, y, { align: 'center' });

        // Aplicar fundo nas páginas extras
        const totalPages = doc.internal.getNumberOfPages();
        if (fundoPaginaImg && totalPages > 1) {
          for (let p = 2; p <= totalPages; p++) {
            doc.setPage(p);
            doc.addImage(fundoPaginaImg, 'PNG', 0, 0, pageW, pageH);
          }
        }

        return { doc, pages: totalPages };
      };

      // Tentar gerar — se não couber em 1 página, reduz a fonte
      let result = gerarConteudoPDF(fontSize);
      while (result.pages > 1 && fontSize > 8) {
        fontSize -= 0.5;
        result = gerarConteudoPDF(fontSize);
      }
      pdf = result.doc;
      out = pdf.output('blob');

      const nomeCliente = notificacaoModal.razao_social
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z\s]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
        .replace(/_+$/, '');
      const nomeAmigavel = `notificacaoextrajudicial_${nomeCliente}`;
      const nomeArquivo = `${nomeAmigavel}.pdf`;
      const storagePath = `notificacoes/${nomeArquivo}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('clientes-confianca')
        .upload(storagePath, out, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError)
        throw new Error(`Erro no upload: ${uploadError.message}`);

      const mensagemCaption =
        `⚖️ *NOTIFICAÇÃO EXTRAJUDICIAL*\n\n` +
        `Prezado(a) representante legal de *${notificacaoModal.razao_social}*,\n\n` +
        `Pelo presente, fica V.Sa. formalmente NOTIFICADO(A) acerca da existência de débito vencido e não quitado no valor de *${notificacaoModal.valor}*, decorrente de operações comerciais realizadas com a empresa CROSBY CR VESTUÁRIO LTDA.\n\n` +
        `Concedemos o prazo improrrogável de *72 (setenta e duas) horas* para a quitação integral, sob pena de adoção das medidas judiciais cabíveis, incluindo *ação de execução*, *protesto do título* e *inscrição nos órgãos de proteção ao crédito (SPC/Serasa)*.\n\n` +
        `📎 Segue em anexo a Notificação Extrajudicial completa para ciência e providências.\n\n`;

      const cliente = notificacaoModal.cliente;
      const telefone = (cliente.nr_telefone || '').replace(/\D/g, '');

      if (!telefone) {
        throw new Error('Telefone não encontrado para este cliente');
      }

      // Enviar documento direto via WhatsApp (backend wwebjs)
      const envioRes = await fetch(
        'https://apigestaocrosby-bw2v.onrender.com/api/whatsapp/send-document',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefone,
            nomeArquivo,
            mensagem: mensagemCaption,
          }),
        },
      );

      const envioData = await envioRes.json();
      let whatsappOnline = true;

      if (!envioRes.ok) {
        // Fallback: se WhatsApp offline, abre wa.me com link de download
        if (envioData.fallback) {
          whatsappOnline = false;
          const linkPublico = `${window.location.origin}/notificacao?doc=${nomeAmigavel}`;
          const mensagemFallback =
            mensagemCaption + `\n\nBaixe o documento:\n${linkPublico}`;
          const msg = encodeURIComponent(mensagemFallback);
          window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
          setNotification({
            type: 'success',
            message:
              'WhatsApp offline — link enviado via wa.me como alternativa.',
          });
        } else {
          throw new Error(envioData.error || 'Erro ao enviar via WhatsApp');
        }
      } else {
        setNotification({
          type: 'success',
          message: 'Notificação enviada com sucesso!',
        });
      }

      // ═════════════════════════════════════════════════════════════
      // REGISTRAR SOLICITAÇÃO DE NFs (sob demanda do cliente)
      // ═════════════════════════════════════════════════════════════
      try {
        const faturas = cliente.faturas || [];
        // Deduplicar por nr_fat/nr_fatura (mesma NF com parcelas diferentes)
        const nfMap = new Map();
        for (const f of faturas) {
          const nrFat = String(f.nr_fat || f.nr_fatura || '').trim();
          if (nrFat && !nfMap.has(nrFat)) {
            nfMap.set(nrFat, f);
          }
        }

        const uniqueDates = [
          ...new Set(
            [...nfMap.values()]
              .map((f) => (f.dt_emissao || '').split('T')[0])
              .filter(Boolean),
          ),
        ];

        if (uniqueDates.length > 0 && whatsappOnline) {
          const cd_cliente = parseInt(cliente.cd_cliente);
          if (cd_cliente) {
            await fetch(
              'https://apigestaocrosby-bw2v.onrender.com/api/whatsapp/register-nf-request',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telefone,
                  personCode: cd_cliente,
                  branchCodeList: filiaisCodigos.filter(
                    (c) => c >= 1 && c <= 99,
                  ),
                  issueDates: uniqueDates,
                  razaoSocial: notificacaoModal.razao_social,
                  valor: notificacaoModal.valor,
                  nomeCliente,
                }),
              },
            );
          }
        }
      } catch (nfError) {
        console.warn('Erro ao registrar solicitação de NFs:', nfError);
        // Não impede o sucesso da notificação
      }

      setTimeout(() => setNotification(null), 5000);
      setNotificacaoModal(null);
    } catch (error) {
      setNotification({
        type: 'error',
        message: `Erro ao gerar notificação: ${error.message}`,
      });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setGerandoNotificacao(false);
    }
  };

  const abrirWhatsApp = (cliente) => {
    const telefone = cliente.nr_telefone || '';
    if (!telefone) {
      setNotification({
        type: 'error',
        message: 'Telefone não encontrado para este cliente',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const telefoneClean = telefone.replace(/\D/g, '');

    const listaFaturas = (cliente.faturas || [])
      .map((fatura) => {
        const numeroFatura = fatura.nr_fat || fatura.nr_fatura || 'N/A';
        const vencimento = fatura.dt_vencimento
          ? new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR')
          : 'N/A';
        const valor = formatarMoeda(fatura.vl_fatura || 0);
        return `*Fatura:* ${numeroFatura}\n*Vencimento:* ${vencimento}\n*Valor:* ${valor}`;
      })
      .join('\n\n');

    const mensagemPadrao = `Olá, tudo bem? *${cliente.nm_cliente}*
Somos da área de Recuperação de Créditos da Crosby.
Consta em nosso sistema a existência de pendências financeiras em aberto em seu cadastro.
Entramos em contato para alinhar e verificar a melhor forma de regularização.

Segue a lista dos títulos em aberto:

${listaFaturas}

*Observação:* Caso os pagamentos já tenham sido realizados, pedimos gentilmente que desconsidere esta mensagem e nos envie o comprovante para atualização em nosso sistema.

Atenciosamente,
Crosby`;

    const mensagemCodificada = encodeURIComponent(mensagemPadrao);
    const whatsappUrl = `https://wa.me/55${telefoneClean}?text=${mensagemCodificada}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <PageTitle
        title="Recuperação de Crédito"
        subtitle="Clientes inadimplentes (> 60 dias) — Multimarcas e Franquias"
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {loading ? (
        <LoadingSpinner size="lg" text="Carregando clientes inadimplentes..." />
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">
                    Total de Clientes
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-blue-600">
                  {metricas.total}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-red-700">
                    Valor Total Inadimplente
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-red-600">
                  {formatarMoeda(metricas.valorTotal)}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Buildings size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-700">
                    Multimarcas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-purple-600">
                  {metricas.mtm}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Storefront size={18} className="text-amber-600" />
                  <CardTitle className="text-sm font-bold text-amber-700">
                    Franquias
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-extrabold text-amber-600">
                  {metricas.franquia}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros e busca */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por nome, fantasia, CNPJ ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Filtro Origem */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {['TODOS', 'MULTIMARCAS', 'FRANQUIA'].map((op) => (
                <button
                  key={op}
                  onClick={() => setFiltroOrigem(op)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    filtroOrigem === op
                      ? 'bg-[#000638] text-white shadow'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {op === 'TODOS'
                    ? 'Todos'
                    : op === 'MULTIMARCAS'
                      ? 'Multimarcas'
                      : 'Franquias'}
                </button>
              ))}
            </div>

            {/* Filtro Sicredi */}
            <button
              onClick={() => setFiltroSicredi((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                filtroSicredi
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-extrabold ${
                  filtroSicredi
                    ? 'bg-white text-red-600'
                    : 'bg-red-600 text-white'
                }`}
              >
                P
              </span>
              Sicredi
            </button>
            <span className="text-sm text-gray-500">
              {clientesFiltrados.length} cliente
              {clientesFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabela */}
          <Card className="shadow-lg rounded-xl bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#000638] text-white">
                    <tr>
                      <th
                        className="px-4 py-3 text-left cursor-pointer hover:bg-[#000d5c] select-none"
                        onClick={() => handleOrdenar('nm_cliente')}
                      >
                        Cliente <SortIcon coluna="nm_cliente" />
                      </th>
                      <th className="px-4 py-3 text-left">Nome Fantasia</th>
                      <th className="px-4 py-3 text-left">CNPJ/CPF</th>
                      <th
                        className="px-4 py-3 text-left cursor-pointer hover:bg-[#000d5c] select-none"
                        onClick={() => handleOrdenar('origem')}
                      >
                        Origem <SortIcon coluna="origem" />
                      </th>
                      <th
                        className="px-4 py-3 text-right cursor-pointer hover:bg-[#000d5c] select-none"
                        onClick={() => handleOrdenar('valor_total')}
                      >
                        Valor Inadimplente <SortIcon coluna="valor_total" />
                      </th>
                      <th
                        className="px-4 py-3 text-center cursor-pointer hover:bg-[#000d5c] select-none"
                        onClick={() => handleOrdenar('diasAtrasoMax')}
                      >
                        Dias Atraso <SortIcon coluna="diasAtrasoMax" />
                      </th>
                      <th className="px-4 py-3 text-center">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-gray-400"
                        >
                          {clientes.length === 0
                            ? 'Nenhum cliente inadimplente encontrado.'
                            : 'Nenhum resultado para a busca.'}
                        </td>
                      </tr>
                    ) : (
                      clientesFiltrados.map((cliente, index) => (
                        <tr
                          key={cliente.cd_cliente}
                          onClick={() => setClienteSelecionado(cliente)}
                          className={`hover:bg-blue-50 transition-colors cursor-pointer ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                              {cliente.nm_cliente}
                              {(cliente.faturas || []).some(
                                (f) =>
                                  String(f.cd_portador) === '748' ||
                                  (f.nm_portador || '')
                                    .toUpperCase()
                                    .includes('SICREDI'),
                              ) && (
                                <span
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex-shrink-0"
                                  title="Possui títulos na SICREDI (protestados)"
                                >
                                  P
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              Cód: {cliente.cd_cliente}{' '}
                              {cliente.ds_uf ? `• ${cliente.ds_uf}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            {cliente.nm_fantasia || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                            {formatarCNPJ(cliente.nr_cpfcnpj)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                cliente.origem === 'MULTIMARCAS'
                                  ? 'bg-purple-100 text-purple-700'
                                  : cliente.origem === 'FRANQUIA'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {cliente.origem}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600 text-xs">
                            {formatarMoeda(cliente.valor_total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                cliente.diasAtrasoMax > 120
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {cliente.diasAtrasoMax} dias
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirWhatsApp(cliente);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                              title={
                                cliente.nr_telefone
                                  ? `Enviar WhatsApp: ${cliente.nr_telefone}`
                                  : 'Telefone não encontrado'
                              }
                            >
                              <WhatsappLogo size={16} weight="fill" />
                              Enviar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de Faturas do Cliente */}
      {clienteSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setClienteSelecionado(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-[#000638] flex items-center gap-2">
                  <Receipt size={20} className="text-red-600" />
                  Faturas — {clienteSelecionado.nm_cliente}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {clienteSelecionado.nm_fantasia
                    ? `${clienteSelecionado.nm_fantasia} • `
                    : ''}
                  CNPJ: {formatarCNPJ(clienteSelecionado.nr_cpfcnpj)} • Valor
                  Total:{' '}
                  <span className="font-bold text-red-600">
                    {formatarMoeda(clienteSelecionado.valor_total)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setClienteSelecionado(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Tabela de faturas */}
            <div className="overflow-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                      Fatura
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                      Emissão
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                      Vencimento
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                      Portador
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Valor
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">
                      NF
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(clienteSelecionado.faturas || [])
                    .sort((a, b) => {
                      const da = a.dt_vencimento || '';
                      const db = b.dt_vencimento || '';
                      return da < db ? -1 : da > db ? 1 : 0;
                    })
                    .map((fatura, i) => (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                      >
                        <td className="px-4 py-2 text-xs font-medium text-gray-900">
                          {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                          {fatura.nr_parcela ? ` / ${fatura.nr_parcela}` : ''}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {formatarData(fatura.dt_emissao)}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {formatarData(fatura.dt_vencimento)}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {fatura.nm_portador || fatura.cd_portador || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-right font-bold text-red-600">
                          {formatarMoeda(fatura.vl_fatura)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => buscarNFsFatura(fatura)}
                            disabled={
                              nfBuscando !== null || danfeLoading !== null
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-[10px] font-bold rounded transition-colors"
                            title="Gerar Nota Fiscal (DANFE)"
                          >
                            {nfBuscando ===
                            `${fatura.cd_cliente}_${fatura.nr_fat || fatura.nr_fatura}_${fatura.nr_parcela || ''}` ? (
                              <CircleNotch size={12} className="animate-spin" />
                            ) : (
                              <FileText size={12} />
                            )}
                            NF
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-2 text-xs font-bold text-gray-700 text-right"
                    >
                      Total ({clienteSelecionado.faturas?.length || 0} faturas)
                    </td>
                    <td className="px-4 py-2 text-xs text-right font-extrabold text-red-700">
                      {formatarMoeda(clienteSelecionado.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <span className="text-xs text-gray-500">
                {clienteSelecionado.faturas?.length || 0} faturas • Maior
                atraso: {clienteSelecionado.diasAtrasoMax} dias
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    abrirNotificacaoModal(clienteSelecionado);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Scales size={16} weight="fill" />
                  Notificação Extrajudicial
                </button>
                <button
                  onClick={() => abrirWhatsApp(clienteSelecionado)}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <WhatsappLogo size={16} weight="fill" />
                  WhatsApp
                </button>
                <button
                  onClick={() => setClienteSelecionado(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição da Notificação Extrajudicial */}
      {notificacaoModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setNotificacaoModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-[#000638] flex items-center gap-2">
                <Scales size={20} className="text-amber-600" />
                Notificação Extrajudicial
              </h2>
              <button
                onClick={() => setNotificacaoModal(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-auto flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Razão Social do Devedor
                </label>
                <input
                  type="text"
                  value={notificacaoModal.razao_social}
                  onChange={(e) =>
                    setNotificacaoModal((prev) => ({
                      ...prev,
                      razao_social: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    value={notificacaoModal.cnpj}
                    onChange={(e) =>
                      setNotificacaoModal((prev) => ({
                        ...prev,
                        cnpj: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Valor Total
                  </label>
                  <input
                    type="text"
                    value={notificacaoModal.valor}
                    onChange={(e) =>
                      setNotificacaoModal((prev) => ({
                        ...prev,
                        valor: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={notificacaoModal.endereco}
                  onChange={(e) =>
                    setNotificacaoModal((prev) => ({
                      ...prev,
                      endereco: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Descrição / Origem
                </label>
                <textarea
                  value={notificacaoModal.descricao_origem}
                  onChange={(e) =>
                    setNotificacaoModal((prev) => ({
                      ...prev,
                      descricao_origem: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Dia
                  </label>
                  <input
                    type="text"
                    value={notificacaoModal.dia}
                    onChange={(e) =>
                      setNotificacaoModal((prev) => ({
                        ...prev,
                        dia: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Mês
                  </label>
                  <input
                    type="text"
                    value={notificacaoModal.mes}
                    onChange={(e) =>
                      setNotificacaoModal((prev) => ({
                        ...prev,
                        mes: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    WhatsApp Contato
                  </label>
                  <input
                    type="text"
                    value={notificacaoModal.whatsapp}
                    onChange={(e) =>
                      setNotificacaoModal((prev) => ({
                        ...prev,
                        whatsapp: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setNotificacaoModal(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarNotificacaoDocx}
                disabled={gerandoNotificacao}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {gerandoNotificacao ? (
                  <CircleNotch size={16} className="animate-spin" />
                ) : (
                  <WhatsappLogo size={16} weight="fill" />
                )}
                Gerar e Enviar via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecuperacaoCredito;
