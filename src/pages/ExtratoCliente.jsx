import React, { useState } from 'react';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  MagnifyingGlass,
  Calendar,
  CurrencyDollar,
  DownloadSimple,
  Receipt,
  CircleNotch,
  IdentificationCard,
  Eye,
  X,
  FileArrowDown,
} from '@phosphor-icons/react';

const ExtratoCliente = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Estados dos filtros
  const [cdPessoa, setCdPessoa] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Estados do modal de detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [detalhesLoading, setDetalhesLoading] = useState(false);
  const [detalhesFatura, setDetalhesFatura] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);

  // Estados para DANFE
  const [danfeLoading, setDanfeLoading] = useState(false);
  const [danfeError, setDanfeError] = useState('');

  // Estados para Boleto
  const [boletoLoading, setBoletoLoading] = useState({}); // Agora é um objeto com loading por nr_fat
  const [boletoError, setBoletoError] = useState('');
  const [boletoBase64, setBoletoBase64] = useState('');
  const [faturaParaBoleto, setFaturaParaBoleto] = useState(null);

  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

  // Função para buscar dados
  const buscarExtrato = async () => {
    if (!cdPessoa) {
      setErro('Por favor, informe o código do cliente');
      return;
    }

    if (!dataInicio || !dataFim) {
      setErro('Por favor, informe o período (data inicial e final)');
      return;
    }

    setLoading(true);
    setErro('');
    try {
      console.log('🔍 Buscando extrato do cliente:', {
        cd_pessoa: cdPessoa,
        dt_inicio: dataInicio,
        dt_fim: dataFim,
      });

      const result = await apiClient.financial.extratoCliente({
        cd_pessoa: cdPessoa,
        dt_inicio: dataInicio,
        dt_fim: dataFim,
      });

      if (result.success) {
        // O useApiClient já processa a estrutura aninhada, então result.data já é o array
        const dadosExtrato = Array.isArray(result.data)
          ? result.data
          : result.data?.data || [];

        // Filtrar apenas códigos históricos 900 e 901
        const dadosFiltrados = dadosExtrato.filter(
          (item) => item.cd_historico === '900' || item.cd_historico === '901',
        );

        // Ordenar por data de movimentação em ordem decrescente (mais recente primeiro)
        // Se datas iguais, débito (D) vem antes de crédito (C)
        const dadosOrdenados = [...dadosFiltrados].sort((a, b) => {
          const dataA = new Date(a.dt_movim);
          const dataB = new Date(b.dt_movim);

          // Primeiro ordena por data (decrescente)
          if (dataB - dataA !== 0) {
            return dataB - dataA;
          }

          // Se datas iguais, ordena por tipo de operação (D antes de C)
          if (a.tp_operacao === 'D' && b.tp_operacao === 'C') return -1;
          if (a.tp_operacao === 'C' && b.tp_operacao === 'D') return 1;

          return 0;
        });

        console.log('✅ Extrato recebido:', {
          total: dadosOrdenados.length,
          totalSemFiltro: dadosExtrato.length,
          primeiroItem: dadosOrdenados[0],
          estruturaCompleta: result,
        });
        setDados(dadosOrdenados);
      } else {
        throw new Error(result.message || 'Erro ao buscar extrato');
      }
    } catch (err) {
      console.error('❌ Erro ao buscar extrato:', err);
      setErro('Erro ao carregar dados do servidor.');
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  const formatarDataBR = (data) => {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';

    // Ajustar para ignorar fuso horário e mostrar a data correta
    const dataLocal = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return dataLocal.toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor) => {
    if (valor === null || valor === undefined) return '-';
    return Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Calcular totalizadores
  const saldoTotal = dados.reduce(
    (acc, item) => acc + (Number(item.vl_lancto) || 0),
    0,
  );
  const totalDebito = dados
    .filter((item) => item.tp_operacao === 'D')
    .reduce((acc, item) => acc + (Number(item.vl_lancto) || 0), 0);
  const totalCredito = dados
    .filter((item) => item.tp_operacao === 'C')
    .reduce((acc, item) => acc + (Number(item.vl_lancto) || 0), 0);

  // Função para exportar dados para Excel
  const handleExportExcel = () => {
    if (dados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }

    try {
      const dadosParaExportar = dados.map((item) => ({
        Data: formatarDataBR(item.dt_movim),
        'NR CTAPES': item.nr_ctapes || '',
        'Seq Mov': item.nr_seqmov || '',
        'Cod Histórico':
          item.cd_historico === '900'
            ? 'LANÇAMENTO'
            : item.cd_historico === '901'
            ? 'UTILIZAÇÃO'
            : item.cd_historico || '',
        'Tipo Doc':
          item.tp_documento === '10'
            ? 'ADIANTAMENTO'
            : item.tp_documento === '20'
            ? 'CREDEV'
            : item.tp_documento || '',
        Operação: item.tp_operacao === 'D' ? 'Débito' : 'Crédito',
        'Valor Lançamento': Number(item.vl_lancto) || 0,
        'Data Liquidação': formatarDataBR(item.dt_liq),
        'Nome Fantasia': item.nm_fantasia || '',
        Empresa: item.cd_empresa || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Extrato Cliente');

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `extrato-cliente-${cdPessoa}-${hoje}.xlsx`;

      saveAs(data, nomeArquivo);

      console.log('✅ Excel exportado com sucesso:', nomeArquivo);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      alert('Erro ao exportar arquivo Excel. Tente novamente.');
    }
  };

  // Função para abrir modal e buscar detalhes
  const handleDetalhar = async (item) => {
    setItemSelecionado(item);
    setModalOpen(true);
    setDetalhesLoading(true);
    setDetalhesFatura([]);

    try {
      // Verificar se é operação de crédito (C) e tipo documento ADIANTAMENTO (10)
      const isCreditoAdiantamento =
        item.tp_operacao === 'C' && item.tp_documento === '10';

      if (isCreditoAdiantamento) {
        // Usar rota lanc-ext-adiant para crédito de adiantamento
        console.log('🔍 Buscando lançamentos de adiantamento:', {
          cd_cliente: cdPessoa,
          dt_emissao: item.dt_movim.split('T')[0],
          cd_empresa: item.cd_empresa,
        });

        const result = await apiClient.financial.lancExtAdiant({
          cd_cliente: cdPessoa,
          dt_emissao: item.dt_movim.split('T')[0],
          cd_empresa: item.cd_empresa,
        });

        if (result.success) {
          const detalhes = Array.isArray(result.data)
            ? result.data
            : result.data?.data || [];
          console.log(
            '✅ Lançamentos de adiantamento recebidos:',
            detalhes.length,
          );
          setDetalhesFatura(detalhes);
        } else {
          console.error('❌ Erro ao buscar lançamentos:', result.message);
          setDetalhesFatura([]);
        }
      } else {
        // Usar rota original fatura-ext-cliente para débito
        console.log('🔍 Buscando detalhes da fatura:', {
          cd_cliente: cdPessoa,
          vl_fatura: item.vl_lancto,
        });

        const result = await apiClient.financial.faturaExtCliente({
          cd_cliente: cdPessoa,
          vl_fatura: item.vl_lancto,
        });

        if (result.success) {
          const detalhes = Array.isArray(result.data)
            ? result.data
            : result.data?.data || [];
          console.log('✅ Detalhes da fatura recebidos:', detalhes.length);
          setDetalhesFatura(detalhes);
        } else {
          console.error('❌ Erro ao buscar detalhes:', result.message);
          setDetalhesFatura([]);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar detalhes:', error);
      setDetalhesFatura([]);
    } finally {
      setDetalhesLoading(false);
    }
  };

  // Função para fechar modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setItemSelecionado(null);
    setDetalhesFatura([]);
  };

  // Função para gerar DANFE a partir da transação
  const gerarDanfeTransacao = async (detalhe) => {
    try {
      setDanfeLoading(true);
      setDanfeError('');

      console.log('🔍 Gerando DANFE da transação:', detalhe);

      const cd_pessoa = parseInt(cdPessoa) || 0;

      // Função auxiliar para tentar gerar DANFE
      const tentarGerarDanfe = async (
        cd_empresa,
        nr_transacao,
        dataTransacao,
        tipo,
      ) => {
        const payload = {
          filter: {
            branchCodeList: [cd_empresa],
            personCodeList: [cd_pessoa],
            transactionBranchCode: cd_empresa,
            transactionCode: nr_transacao,
            transactionDate: dataTransacao,
          },
        };

        console.log(`📤 Tentativa ${tipo} - Payload DANFE:`, payload);

        const response = await fetch(`${TotvsURL}danfe-from-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao gerar DANFE');
        }

        const data = await response.json();
        console.log(`✅ DANFE recebida (${tipo}):`, data);

        let base64 = '';
        if (data.success && data.data) {
          base64 = data.data.danfePdfBase64 || data.data.base64 || '';
        } else if (data.danfePdfBase64) {
          base64 = data.danfePdfBase64;
        }

        if (!base64) {
          throw new Error('DANFE não retornada pela API');
        }

        return { base64, nr_transacao };
      };

      // Tentativa 1: Empresa DESTINO com NR_TRANSACAODEST
      let resultado = null;
      let erroDestino = null;

      if (
        detalhe.cd_empresadest &&
        detalhe.nr_transacaodest &&
        detalhe.dt_transacaodest
      ) {
        try {
          console.log('🔄 Tentativa 1: EMPRESA DESTINO + NR_TRANSACAODEST');
          const cd_empresadest = parseInt(detalhe.cd_empresadest);
          const nr_transacaodest = parseInt(detalhe.nr_transacaodest);
          const dataTransacaodest = detalhe.dt_transacaodest.split('T')[0];

          resultado = await tentarGerarDanfe(
            cd_empresadest,
            nr_transacaodest,
            dataTransacaodest,
            'DESTINO',
          );
        } catch (error) {
          erroDestino = error;
          console.warn('⚠️ Tentativa DESTINO falhou:', error.message);
        }
      }

      // Tentativa 2: Empresa ORIGEM com NR_TRANSACAOORI (se a primeira falhou)
      if (
        !resultado &&
        detalhe.cd_empresaori &&
        detalhe.nr_transacaoori &&
        detalhe.dt_transacaoori
      ) {
        try {
          console.log('🔄 Tentativa 2: EMPRESA ORIGEM + NR_TRANSACAOORI');
          const cd_empresaori = parseInt(detalhe.cd_empresaori);
          const nr_transacaoori = parseInt(detalhe.nr_transacaoori);
          const dataTransacaoori = detalhe.dt_transacaoori.split('T')[0];

          resultado = await tentarGerarDanfe(
            cd_empresaori,
            nr_transacaoori,
            dataTransacaoori,
            'ORIGEM',
          );
        } catch (error) {
          console.error('❌ Tentativa ORIGEM também falhou:', error.message);
          throw new Error(
            `Não foi possível gerar DANFE. Erro DESTINO: ${
              erroDestino?.message || 'N/A'
            }. Erro ORIGEM: ${error.message}`,
          );
        }
      }

      // Se não conseguiu por nenhum dos métodos
      if (!resultado) {
        throw new Error(
          erroDestino?.message ||
            'Dados da transação incompletos para gerar DANFE',
        );
      }

      // Abrir o PDF
      abrirPDFDanfe(resultado.base64, resultado.nr_transacao);
    } catch (error) {
      console.error('❌ Erro ao gerar DANFE:', error);
      setDanfeError(error.message || 'Erro ao gerar DANFE');
      alert(`Erro ao gerar DANFE: ${error.message}`);
    } finally {
      setDanfeLoading(false);
    }
  };

  // Função para abrir PDF da DANFE em nova aba
  const abrirPDFDanfe = (base64String, nrTransacao) => {
    try {
      const base64 = base64String.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const newWindow = window.open(url, '_blank');

      if (newWindow) {
        console.log('✅ DANFE aberta em nova aba');
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        console.warn('⚠️ Popup bloqueado, iniciando download...');
        const link = document.createElement('a');
        link.href = url;
        link.download = `danfe-transacao-${nrTransacao}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir DANFE:', error);
      alert('Erro ao abrir a DANFE. Tente novamente.');
    }
  };

  // Função para buscar boleto bancário
  const buscarBoleto = async (fatura) => {
    if (!fatura) return;

    const faturaId = `${fatura.nr_fat}-${fatura.nr_parcela}`;

    try {
      // Ativar loading apenas para esta fatura específica
      setBoletoLoading((prev) => ({ ...prev, [faturaId]: true }));
      setBoletoError('');
      setBoletoBase64('');
      setFaturaParaBoleto(fatura);

      const payload = {
        branchCode: parseInt(itemSelecionado.cd_empresa) || 0,
        customerCode: cdPessoa || '',
        receivableCode: parseInt(fatura.nr_fat) || 0,
        installmentNumber: parseInt(fatura.nr_parcela) || 0,
      };

      console.log('🔍 Buscando boleto com os dados:', payload);

      const response = await fetch(`${TotvsURL}bank-slip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar boleto');
      }

      const data = await response.json();
      console.log('✅ Boleto recebido:', data);

      // O boleto pode vir em diferentes formatos
      let base64 = '';

      if (typeof data === 'string') {
        base64 = data;
      } else if (data.data && data.data.base64) {
        if (typeof data.data.base64 === 'string') {
          base64 = data.data.base64;
        } else if (data.data.base64.content) {
          base64 = data.data.base64.content;
        }
      } else if (data.data && typeof data.data === 'string') {
        base64 = data.data;
      } else if (data.base64) {
        if (typeof data.base64 === 'string') {
          base64 = data.base64;
        } else if (data.base64.content) {
          base64 = data.base64.content;
        }
      }

      if (base64 && typeof base64 === 'string') {
        setBoletoBase64(base64);
        console.log('✅ Base64 do boleto:', base64.substring(0, 100) + '...');
        console.log('📏 Tamanho do base64:', base64.length, 'caracteres');

        // Converter base64 para PDF e abrir em nova aba
        abrirPDF(base64, fatura);
      } else {
        console.error('❌ Formato de resposta inválido:', data);
        throw new Error('Formato de resposta inválido - base64 não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar boleto:', error);
      setBoletoError(error.message || 'Erro ao buscar boleto');
      alert(`Erro ao gerar boleto: ${error.message}`);
    } finally {
      // Desativar loading apenas para esta fatura específica
      setBoletoLoading((prev) => ({ ...prev, [faturaId]: false }));
    }
  };

  // Função para abrir PDF do boleto em nova aba
  const abrirPDF = (base64String, fatura) => {
    try {
      const base64 = base64String.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const newWindow = window.open(url, '_blank');

      if (newWindow) {
        console.log('✅ Boleto aberto em nova aba');
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        console.warn('⚠️ Popup bloqueado, iniciando download...');
        const link = document.createElement('a');
        link.href = url;
        link.download = `boleto-${fatura?.nr_fat || 'fatura'}-parcela-${
          fatura?.nr_parcela || '1'
        }.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir boleto:', error);
      alert('Erro ao abrir o boleto. Tente novamente.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#000638] mb-2">
            EXTRATO CLIENTE
          </h1>
          <p className="text-gray-600">Extrato detalhado por cliente</p>
        </div>
      </div>

      {erro && (
        <div className="mb-6 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          {erro}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <MagnifyingGlass size={20} className="text-[#000638]" />
          <h3 className="text-lg font-semibold text-[#000638]">
            Buscar Extrato
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Código do Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código do Cliente
            </label>
            <input
              type="number"
              value={cdPessoa}
              onChange={(e) => setCdPessoa(e.target.value)}
              placeholder="Ex: 1178"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 outline-none transition-colors focus:border-[#000638] focus:ring-2 focus:ring-[#000638]/20"
            />
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 outline-none transition-colors focus:border-[#000638] focus:ring-2 focus:ring-[#000638]/20"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 outline-none transition-colors focus:border-[#000638] focus:ring-2 focus:ring-[#000638]/20"
            />
          </div>

          {/* Botão Buscar */}
          <div className="flex items-end">
            <button
              onClick={buscarExtrato}
              disabled={loading}
              className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition h-10 text-sm font-bold shadow-md tracking-wide uppercase disabled:opacity-50 w-full justify-center"
            >
              <MagnifyingGlass
                size={18}
                weight="bold"
                className={loading ? 'animate-pulse' : ''}
              />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      {dados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total de Movimentações */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">
                  Total de Movimentações
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-blue-600">
                {dados.length}
              </div>
            </CardContent>
          </Card>

          {/* Total Débito */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">
                  Total Débito
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-red-600">
                {formatarMoeda(totalDebito)}
              </div>
            </CardContent>
          </Card>

          {/* Total Crédito */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">
                  Total Crédito
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-green-600">
                {formatarMoeda(totalCredito)}
              </div>
            </CardContent>
          </Card>

          {/* Saldo Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <IdentificationCard size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-700">
                  Saldo Total
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-lg font-extrabold text-purple-600">
                {formatarMoeda(saldoTotal)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-xl font-bold text-[#000638]">
              Movimentações Financeiras
            </h2>
            {dados.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
              >
                <DownloadSimple size={16} />
                BAIXAR EXCEL
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#000638]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Data Movim
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                  NR CTAPES
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                  Seq Mov
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Cód Histórico
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Tipo Doc
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                  Operação
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                  Valor Lançamento
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                  Data Liquidação
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                  Detalhe
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <LoadingSpinner size="lg" />
                      <span className="text-gray-500">Carregando dados...</span>
                    </div>
                  </td>
                </tr>
              ) : dados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt size={48} className="text-gray-400" />
                      <span className="text-gray-500 font-medium">
                        Nenhum registro encontrado
                      </span>
                      <span className="text-gray-400 text-sm">
                        Informe o código do cliente e o período para buscar
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                dados.map((item, index) => (
                  <tr
                    key={index}
                    className="hover:bg-blue-50 transition-all duration-200"
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-gray-400" />
                        {formatarDataBR(item.dt_movim)}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.cd_empresa || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.nr_ctapes || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                      {item.nr_seqmov || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.cd_historico === '900'
                        ? 'LANÇAMENTO'
                        : item.cd_historico === '901'
                        ? 'UTILIZAÇÃO'
                        : item.cd_historico || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      {item.tp_documento === '10'
                        ? 'ADIANTAMENTO'
                        : item.tp_documento === '20'
                        ? 'CREDEV'
                        : item.tp_documento || '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.tp_operacao === 'D'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.tp_operacao === 'D' ? 'Débito' : 'Crédito'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold">
                      <span
                        className={
                          item.tp_operacao === 'D'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }
                      >
                        {formatarMoeda(item.vl_lancto)}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                      {formatarDataBR(item.dt_liq)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleDetalhar(item)}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                      >
                        <Eye size={14} weight="bold" />
                        Detalhar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="bg-[#000638] text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Detalhes da Fatura</h2>
                {itemSelecionado && (
                  <p className="text-sm text-gray-300 mt-1">
                    Valor: {formatarMoeda(itemSelecionado.vl_lancto)} | Data:{' '}
                    {formatarDataBR(itemSelecionado.dt_movim)}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <X size={24} weight="bold" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {detalhesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                  <span className="text-gray-500 mt-4">
                    Carregando detalhes...
                  </span>
                </div>
              ) : detalhesFatura.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Receipt size={48} className="text-gray-400" />
                  <span className="text-gray-500 font-medium mt-4">
                    Nenhum detalhe encontrado
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Verificar se é crédito de adiantamento */}
                  {itemSelecionado?.tp_operacao === 'C' &&
                  itemSelecionado?.tp_documento === '10' ? (
                    /* Tabela para Crédito de Adiantamento */
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Valor Fatura
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            NR Fat
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            NR Parcela
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Data Emissão
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Data Vencimento
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Data Liquidação
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Valor Pago
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase">
                            Gerar Boleto
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {detalhesFatura.map((detalhe, index) => {
                          // Verificar se o boleto está pago (dt_liq E vl_pago preenchidos)
                          const temDataLiquidacao =
                            detalhe.dt_liq &&
                            detalhe.dt_liq !== null &&
                            detalhe.dt_liq !== '';
                          const temValorPago =
                            detalhe.vl_pago &&
                            detalhe.vl_pago !== null &&
                            parseFloat(detalhe.vl_pago) > 0;
                          const estaPago = temDataLiquidacao && temValorPago;

                          // ID único para esta fatura
                          const faturaId = `${detalhe.nr_fat}-${detalhe.nr_parcela}`;
                          const isLoadingBoleto =
                            boletoLoading[faturaId] || false;

                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {formatarMoeda(detalhe.vl_fatura)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {detalhe.nr_fat || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {detalhe.nr_parcela || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {formatarDataBR(detalhe.dt_emissao)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {formatarDataBR(detalhe.dt_vencimento)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {formatarDataBR(detalhe.dt_liq)}
                              </td>
                              <td className="px-3 py-2 text-sm font-semibold text-green-600">
                                {formatarMoeda(detalhe.vl_pago)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {estaPago ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
                                    <CheckCircle size={14} weight="bold" />
                                    PAGO
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => buscarBoleto(detalhe)}
                                    disabled={isLoadingBoleto}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                    title="Gerar boleto bancário"
                                  >
                                    <FileArrowDown size={14} weight="bold" />
                                    {isLoadingBoleto
                                      ? 'Gerando...'
                                      : 'Gerar Boleto'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    /* Tabela para Débito com transações e botão Gerar NF */
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Valor Fatura
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            NR Fat
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            NR Transação
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Empresa Dest
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Empresa Ori
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Data Trans Dest
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            Situação Dest
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {detalhesFatura.map((detalhe, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {formatarMoeda(detalhe.vl_fatura)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {detalhe.nr_fat || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {detalhe.nr_transacao || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {detalhe.cd_empresadest || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {detalhe.cd_empresaori || '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {formatarDataBR(detalhe.dt_transacaodest)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {detalhe.tp_situacaodest || '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => gerarDanfeTransacao(detalhe)}
                                disabled={danfeLoading}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                title="Gerar DANFE desta transação"
                              >
                                <FileArrowDown size={14} weight="bold" />
                                {danfeLoading ? 'Gerando...' : 'Gerar NF'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtratoCliente;
