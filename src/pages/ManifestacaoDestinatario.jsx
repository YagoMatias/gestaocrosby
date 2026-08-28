import React, { useEffect, useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import {
  Funnel,
  Spinner,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  CaretUpDown,
  FileArrowDown,
  MagnifyingGlass,
  ClipboardText,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const SITUACAO_LABEL = {
  1: 'Autorizada',
  2: 'Cancelada',
  3: 'Denegada',
};

const MANIFESTACAO_LABEL = {
  210200: 'Confirmação da Operação',
  210210: 'Ciência da Operação',
  210220: 'Desconhecimento',
  210240: 'Operação não Realizada',
};

// Origem do registro: SEFAZ (Distribuição DFe) ou TOTVS (importação do FISFP153)
const origemDoRegistro = (schema) =>
  schema === 'csv-fisfp153' ? 'TOTVS' : 'SEFAZ';

const formatCnpj = (cnpj) => {
  const d = String(cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj || '--';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

// Layout da chave: cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) ...
const nfDaChave = (chave) => {
  const c = String(chave || '');
  if (c.length !== 44) return '--';
  return String(parseInt(c.slice(25, 34), 10));
};
const serieDaChave = (chave) => {
  const c = String(chave || '');
  if (c.length !== 44) return '--';
  return String(parseInt(c.slice(22, 25), 10));
};

const ManifestacaoDestinatario = () => {
  const [dados, setDados] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoSync, setAvisoSync] = useState('');
  const [periodo, setPeriodo] = useState({ dt_inicio: '', dt_fim: '' });
  const [tipoOperacao, setTipoOperacao] = useState('');
  const [situacao, setSituacao] = useState('');
  const [origem, setOrigem] = useState('');
  const [pesquisa, setPesquisa] = useState('');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);
  const [ordenacao, setOrdenacao] = useState({
    campo: 'data_emissao',
    direcao: 'desc',
  });

  // Período padrão: início do ano (histórico importado do FISFP153 + sync SEFAZ)
  useEffect(() => {
    const hoje = new Date();
    setPeriodo({
      dt_inicio: `${hoje.getFullYear()}-01-01`,
      dt_fim: hoje.toISOString().split('T')[0],
    });
  }, []);

  // Filiais consultadas na SEFAZ (código + nome do TOTVS)
  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/sefaz/dfe/empresas`);
        const json = await r.json();
        if (json.success && Array.isArray(json.data)) setEmpresas(json.data);
      } catch (e) {
        console.error('Erro ao carregar empresas:', e);
      }
    };
    carregar();
  }, []);

  const nomePorCodigo = useMemo(() => {
    const m = {};
    empresas.forEach((e) => {
      if (e.codigo) m[e.codigo] = e.nome;
    });
    return m;
  }, [empresas]);

  const nomeDaFilial = (item) =>
    item.empresa_nome || nomePorCodigo[item.empresa_codigo] || '';

  const formatDateBR = (isoDate) => {
    if (!isoDate) return '--';
    try {
      const [datePart] = String(isoDate).split('T');
      const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
      if (!y || !m || !d) return '--';
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    } catch {
      return '--';
    }
  };

  const buscarDados = async () => {
    setLoading(true);
    setErro('');
    setPaginaAtual(1);
    try {
      const params = new URLSearchParams();
      const codigosFiliais = filiaisSelecionadas
        .map((f) => parseInt(f.cd_empresa))
        .filter((c) => !isNaN(c));
      if (codigosFiliais.length > 0)
        params.set('empresas', codigosFiliais.join(','));
      if (periodo.dt_inicio) params.set('startDate', periodo.dt_inicio);
      if (periodo.dt_fim) params.set('endDate', periodo.dt_fim);
      if (tipoOperacao) params.set('tipoOperacao', tipoOperacao);
      if (situacao) params.set('situacao', situacao);
      if (origem) params.set('origem', origem);

      const r = await fetch(`${API_BASE_URL}/api/sefaz/dfe/notas?${params}`);
      const json = await r.json();
      if (r.ok && json.success) {
        setDados(json.data || []);
        setDadosCarregados(true);
      } else {
        setErro(json.message || 'Erro ao buscar notas');
        setDados([]);
        setDadosCarregados(true);
      }
    } catch (e) {
      console.error('❌ Erro ao buscar notas:', e);
      setErro(e.message || 'Erro ao buscar notas');
      setDados([]);
      setDadosCarregados(true);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarSefaz = async () => {
    setSincronizando(true);
    setAvisoSync('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/sefaz/dfe/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await r.json();
      if (r.ok && json.success) {
        const total = (json.data || []).reduce(
          (acc, x) => acc + (x.novosDocs || 0),
          0,
        );
        const erros = (json.data || [])
          .filter((x) => x.erro)
          .map((x) => `${x.descricao}: ${x.erro}`);
        setAvisoSync(
          `Sincronização concluída — ${total} documentos novos.` +
            (erros.length ? ` Avisos: ${erros.join(' | ')}` : ''),
        );
        buscarDados();
      } else {
        setAvisoSync(json.message || 'Erro na sincronização');
      }
    } catch (e) {
      setAvisoSync(e.message || 'Erro na sincronização');
    } finally {
      setSincronizando(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  const handleSort = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (campo) => {
    if (ordenacao.campo !== campo) {
      return <CaretUpDown size={12} className="opacity-50" />;
    }
    return ordenacao.direcao === 'asc' ? (
      <CaretUp size={12} />
    ) : (
      <CaretDown size={12} />
    );
  };

  const dadosProcessados = useMemo(() => {
    let filtrados = [...dados];

    if (pesquisa.trim()) {
      const termo = pesquisa.trim().toLowerCase();
      filtrados = filtrados.filter((item) =>
        [
          item.emitente_nome,
          item.emitente_cnpj,
          item.chave_acesso,
          nfDaChave(item.chave_acesso),
          nomeDaFilial(item),
          item.cnpj_destinatario,
          item.empresa_codigo,
          origemDoRegistro(item.schema_origem),
        ]
          .map((v) => String(v ?? '').toLowerCase())
          .some((v) => v.includes(termo)),
      );
    }

    if (ordenacao.campo) {
      const campo = ordenacao.campo;
      filtrados.sort((a, b) => {
        let valorA = a[campo];
        let valorB = b[campo];
        if (campo === 'valor_total') {
          valorA = parseFloat(valorA) || 0;
          valorB = parseFloat(valorB) || 0;
        }
        if (typeof valorA === 'string') {
          valorA = valorA.toLowerCase();
          valorB = String(valorB || '').toLowerCase();
        }
        valorA = valorA ?? '';
        valorB = valorB ?? '';
        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtrados;
  }, [dados, ordenacao, pesquisa, nomePorCodigo]);

  const totalPages = Math.ceil(dadosProcessados.length / itensPorPagina);

  const dadosPaginados = useMemo(() => {
    const startIndex = (paginaAtual - 1) * itensPorPagina;
    return dadosProcessados.slice(startIndex, startIndex + itensPorPagina);
  }, [dadosProcessados, paginaAtual, itensPorPagina]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [dados, ordenacao, pesquisa]);

  const totais = useMemo(() => {
    return dadosProcessados.reduce(
      (acc, item) => {
        acc.valorTotal += parseFloat(item.valor_total) || 0;
        acc.quantidade += 1;
        if (!item.manifestacao) acc.pendentes += 1;
        if (origemDoRegistro(item.schema_origem) === 'SEFAZ') acc.sefaz += 1;
        else acc.totvs += 1;
        return acc;
      },
      { valorTotal: 0, quantidade: 0, pendentes: 0, sefaz: 0, totvs: 0 },
    );
  }, [dadosProcessados]);

  const handleExportExcel = () => {
    if (dadosProcessados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    try {
      const dadosParaExportar = dadosProcessados.map((item) => ({
        Filial: item.empresa_codigo ?? '',
        Destinatário: nomeDaFilial(item),
        'CNPJ Destinatário': formatCnpj(item.cnpj_destinatario),
        'Data Emissão': formatDateBR(item.data_emissao),
        'Nº NF': nfDaChave(item.chave_acesso),
        Série: serieDaChave(item.chave_acesso),
        Emitente: item.emitente_nome || '',
        'CNPJ Emitente': formatCnpj(item.emitente_cnpj),
        'Tipo Operação':
          item.tipo_operacao === '0'
            ? 'Entrada'
            : item.tipo_operacao === '1'
              ? 'Saída'
              : item.tipo_operacao || '',
        Situação: SITUACAO_LABEL[item.situacao] || item.situacao || '',
        Manifestação:
          MANIFESTACAO_LABEL[item.manifestacao] ||
          item.manifestacao_descricao ||
          'Pendente',
        Origem: origemDoRegistro(item.schema_origem),
        'Valor Total': parseFloat(item.valor_total) || 0,
        'Chave de Acesso': item.chave_acesso || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Manifestações');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      saveAs(data, `manifestacao-destinatario-${hoje}.xlsx`);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      alert('Erro ao exportar arquivo Excel. Tente novamente.');
    }
  };

  const gerarPaginas = () => {
    const paginas = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) paginas.push(i);
    } else if (paginaAtual <= 3) {
      paginas.push(1, 2, 3, 4, '...', totalPages);
    } else if (paginaAtual >= totalPages - 2) {
      paginas.push(1, '...');
      for (let i = totalPages - 3; i <= totalPages; i++) paginas.push(i);
    } else {
      paginas.push(
        1,
        '...',
        paginaAtual - 1,
        paginaAtual,
        paginaAtual + 1,
        '...',
        totalPages,
      );
    }
    return paginas;
  };

  const situacaoBadgeClass = (s) => {
    if (s === '1') return 'bg-green-100 text-green-700';
    if (s === '2') return 'bg-red-100 text-red-700';
    if (s === '3') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Manifestação do Destinatário"
        subtitle="Notas fiscais emitidas contra os seus CNPJs (SEFAZ Distribuição DFe)"
        icon={ClipboardText}
        iconColor="text-amber-600"
      />

      {/* Formulário de Filtros */}
      <div className="mb-4">
        <form
          onSubmit={handleFiltrar}
          className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-7xl mx-auto border border-[#000638]/10"
        >
          <div className="mb-2 flex justify-between items-start">
            <div>
              <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
                <Funnel size={18} weight="bold" />
                Filtros
              </span>
              <span className="text-xs text-gray-500 mt-1 block">
                Selecione a empresa destinatária, o período de emissão, o tipo
                de operação e a situação da nota
              </span>
            </div>
            <button
              type="button"
              onClick={sincronizarSefaz}
              disabled={sincronizando}
              className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-xs font-bold shadow-md uppercase"
              title="Buscar documentos novos na SEFAZ agora"
            >
              {sincronizando ? (
                <Spinner size={12} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={12} weight="bold" />
              )}
              {sincronizando ? 'Sincronizando...' : 'Sincronizar SEFAZ'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 mb-3">
            <div className="lg:col-span-1">
              <FiltroEmpresa
                empresasSelecionadas={filiaisSelecionadas}
                onSelectEmpresas={setFiliaisSelecionadas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Emissão - Início
              </label>
              <input
                type="date"
                value={periodo.dt_inicio}
                onChange={(e) =>
                  setPeriodo((prev) => ({ ...prev, dt_inicio: e.target.value }))
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Emissão - Fim
              </label>
              <input
                type="date"
                value={periodo.dt_fim}
                onChange={(e) =>
                  setPeriodo((prev) => ({ ...prev, dt_fim: e.target.value }))
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Tipo de Operação
              </label>
              <select
                value={tipoOperacao}
                onChange={(e) => setTipoOperacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="">Todos</option>
                <option value="1">Saída (do emitente)</option>
                <option value="0">Entrada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação da NF
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="">Todas</option>
                <option value="1">Autorizada</option>
                <option value="2">Cancelada</option>
                <option value="3">Denegada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Origem
              </label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="">Todas</option>
                <option value="sefaz">SEFAZ</option>
                <option value="totvs">TOTVS</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size={10} className="animate-spin" />
                    <span>Carregando...</span>
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={10} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {avisoSync && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              {avisoSync}
            </div>
          )}
        </form>
      </div>

      {/* Cards de Resumo */}
      {dadosCarregados && dadosProcessados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4 max-w-7xl mx-auto w-full">
          <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
            <div className="text-xs font-bold text-green-700 mb-1">
              Valor Total
            </div>
            <div className="text-sm font-extrabold text-green-600">
              {totais.valorTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
            <div className="text-xs font-bold text-blue-700 mb-1">
              Quantidade de Notas
            </div>
            <div className="text-sm font-extrabold text-blue-600">
              {totais.quantidade}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
            <div className="text-xs font-bold text-amber-700 mb-1">
              Sem Manifestação
            </div>
            <div className="text-sm font-extrabold text-amber-600">
              {totais.pendentes}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 border border-[#000638]/10">
            <div className="text-xs font-bold text-gray-700 mb-1">Origem</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-emerald-600">
                {totais.sefaz}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                SEFAZ
              </span>
              <span className="text-sm font-extrabold text-indigo-600">
                {totais.totvs}
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                TOTVS
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 max-w-7xl mx-auto w-full">
        <div className="p-3 border-b border-[#000638]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h2 className="text-sm font-bold text-[#000638] font-barlow">
            Notas Emitidas Contra Meus CNPJs
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <MagnifyingGlass
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Pesquisar na tabela..."
                className="border border-[#000638]/30 rounded-lg pl-7 pr-2 py-1.5 w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div className="text-xs text-gray-600 whitespace-nowrap">
              {dadosCarregados
                ? `${dadosProcessados.length} registros`
                : 'Nenhum dado carregado'}
            </div>
            {dadosProcessados.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition-colors font-medium text-xs whitespace-nowrap"
              >
                <FileArrowDown size={12} />
                BAIXAR EXCEL
              </button>
            )}
          </div>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="sm" text="Carregando notas..." />
            </div>
          ) : erro ? (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          ) : !dadosCarregados ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-2">
                  Clique em "Buscar" para carregar as informações
                </div>
                <div className="text-gray-400 text-xs">
                  Use "Sincronizar SEFAZ" para capturar documentos novos
                </div>
              </div>
            </div>
          ) : dadosProcessados.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-2">
                  Nenhuma nota encontrada
                </div>
                <div className="text-gray-400 text-xs">
                  Verifique os filtros ou clique em "Sincronizar SEFAZ"
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse rounded-lg overflow-hidden shadow-lg w-full">
                <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                  <tr>
                    {[
                      ['empresa_codigo', 'Filial', 'center'],
                      ['empresa_nome', 'Destinatário', 'left'],
                      ['data_emissao', 'Data Emissão', 'center'],
                      ['chave_acesso', 'Nº NF', 'center'],
                      ['emitente_nome', 'Emitente', 'left'],
                      ['tipo_operacao', 'Tipo Op.', 'center'],
                      ['situacao', 'Situação', 'center'],
                      ['manifestacao', 'Manifestação', 'center'],
                      ['schema_origem', 'Origem', 'center'],
                      ['valor_total', 'Valor Total', 'center'],
                    ].map(([campo, label, align]) => (
                      <th
                        key={campo}
                        className="px-2 py-2 cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort(campo)}
                      >
                        <div
                          className={`flex items-center ${
                            align === 'center' ? 'justify-center' : ''
                          }`}
                        >
                          {label}
                          {getSortIcon(campo)}
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-left">Chave de Acesso</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dadosPaginados.map((item, index) => (
                    <tr
                      key={`${item.cnpj_destinatario}-${item.chave_acesso}-${index}`}
                      className="text-xs odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <td className="text-center px-2 py-2">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">
                          {item.empresa_codigo ?? '--'}
                        </span>
                      </td>
                      <td className="text-left text-gray-900 px-2 py-2">
                        <div>{nomeDaFilial(item) || '--'}</div>
                        <div className="text-[10px] text-gray-400">
                          {formatCnpj(item.cnpj_destinatario)}
                        </div>
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {formatDateBR(item.data_emissao)}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {nfDaChave(item.chave_acesso)}
                        <span className="text-gray-400">
                          {' '}
                          / {serieDaChave(item.chave_acesso)}
                        </span>
                      </td>
                      <td className="text-left text-gray-900 px-2 py-2">
                        <div>{item.emitente_nome || '--'}</div>
                        <div className="text-[10px] text-gray-400">
                          {formatCnpj(item.emitente_cnpj)}
                        </div>
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.tipo_operacao === '0'
                          ? 'Entrada'
                          : item.tipo_operacao === '1'
                            ? 'Saída'
                            : '--'}
                      </td>
                      <td className="text-center px-2 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${situacaoBadgeClass(
                            item.situacao,
                          )}`}
                        >
                          {SITUACAO_LABEL[item.situacao] ||
                            item.situacao ||
                            '--'}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.manifestacao
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {MANIFESTACAO_LABEL[item.manifestacao] ||
                            item.manifestacao_descricao ||
                            'Pendente'}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                            origemDoRegistro(item.schema_origem) === 'SEFAZ'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                          title={
                            origemDoRegistro(item.schema_origem) === 'SEFAZ'
                              ? 'Capturada na SEFAZ (Distribuição DFe)'
                              : 'Importada do TOTVS (FISFP153)'
                          }
                        >
                          {origemDoRegistro(item.schema_origem)}
                        </span>
                      </td>
                      <td className="text-center font-semibold text-green-600 px-2 py-2">
                        {(parseFloat(item.valor_total) || 0).toLocaleString(
                          'pt-BR',
                          { style: 'currency', currency: 'BRL' },
                        )}
                      </td>
                      <td className="text-left text-gray-500 px-2 py-2 font-mono text-[10px] break-all">
                        {item.chave_acesso || '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Paginação */}
              {dadosProcessados.length > itensPorPagina && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-4 sm:mb-0">
                    Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{' '}
                    {Math.min(
                      paginaAtual * itensPorPagina,
                      dadosProcessados.length,
                    )}{' '}
                    de {dadosProcessados.length} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        paginaAtual > 1 && setPaginaAtual(paginaAtual - 1)
                      }
                      disabled={paginaAtual === 1}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CaretLeft size={16} />
                      Anterior
                    </button>
                    <div className="flex items-center gap-1">
                      {gerarPaginas().map((pagina, index) => (
                        <button
                          key={index}
                          onClick={() =>
                            typeof pagina === 'number' && setPaginaAtual(pagina)
                          }
                          disabled={typeof pagina !== 'number'}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pagina === paginaAtual
                              ? 'bg-[#000638] text-white'
                              : typeof pagina === 'number'
                                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                : 'text-gray-400 cursor-default'
                          }`}
                        >
                          {pagina}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        paginaAtual < totalPages &&
                        setPaginaAtual(paginaAtual + 1)
                      }
                      disabled={paginaAtual === totalPages}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Próximo
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManifestacaoDestinatario;
