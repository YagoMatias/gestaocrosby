import React, { useEffect, useMemo, useState } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import { ChartLineUp } from '@phosphor-icons/react';

const CMVConsolidado = () => {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState([]);
  const [dadosVarejo, setDadosVarejo] = useState([]);

  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    empresas: [],
    nr_transacao: '',
    cd_pessoa: '',
    cd_empresa: '',
  });

  // Filtro de Mês/Ano (igual Contas a Receber)
  const [filtroMensal, setFiltroMensal] = useState('ANO');
  const [filtroDia, setFiltroDia] = useState(null);

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    setFiltros((f) => ({ ...f, dt_inicio: primeiroDia, dt_fim: ultimoDia }));
  }, []);

  const buscar = async () => {
    try {
      setLoading(true);
      setErro('');
      const params = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        // Classificações fixas: 2 (MULTIMARCAS), 3 (REVENDA), 4 (FRANQUIAS)
        cd_classificacao: [2, 3, 4],
      };
      if (Array.isArray(filtros.empresas) && filtros.empresas.length > 0) {
        params.cd_empresa = filtros.empresas;
      }

      if (filtros.nr_transacao && String(filtros.nr_transacao).trim() !== '') {
        params.nr_transacao = String(filtros.nr_transacao).trim();
      }
      if (filtros.cd_pessoa && String(filtros.cd_pessoa).trim() !== '') {
        params.cd_pessoa = String(filtros.cd_pessoa).trim();
      }

      // Fetch consolidado (classificações 2,3,4) e varejo em paralelo
      const empresasFixasVarejo = [
        '2',
        '5',
        '55',
        '65',
        '90',
        '91',
        '92',
        '93',
        '94',
        '95',
        '96',
        '97',
        '98',
      ];
      const paramsVarejo = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixasVarejo,
      };

      const [respConsolidado, respVarejo] = await Promise.all([
        api.sales.cmvtest(params),
        api.sales.faturamento(paramsVarejo),
      ]);

      if (!respConsolidado.success) {
        setErro(respConsolidado.message || 'Falha ao carregar dados');
        setDados([]);
      } else {
        const lista = Array.isArray(respConsolidado?.data?.data)
          ? respConsolidado.data.data
          : Array.isArray(respConsolidado?.data)
          ? respConsolidado.data
          : [];
        setDados(lista);
      }

      if (!respVarejo.success) {
        // mantém erro informativo mas não bloqueia os dados de consolidado
        console.warn('Falha ao carregar varejo:', respVarejo.message);
        setDadosVarejo([]);
      } else {
        const listaVar = Array.isArray(respVarejo?.data?.data)
          ? respVarejo.data.data
          : Array.isArray(respVarejo?.data)
          ? respVarejo.data
          : [];
        setDadosVarejo(listaVar);
      }
    } catch (e) {
      setErro('Erro ao buscar dados');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // helpers de formatação
  const toNumber = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const n = Number(String(val).trim());
    return Number.isNaN(n) ? 0 : n;
  };

  const formatCurrency = (v) =>
    toNumber(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d) => {
    if (!d) return '';
    // Evita deslocamento de fuso: usa a parte de data UTC (YYYY-MM-DD)
    const iso = typeof d === 'string' ? d : new Date(d).toISOString();
    const base = iso.includes('T') ? iso.split('T')[0] : iso;
    const [yyyy, mm, dd] = base.split('-');
    if (!yyyy || !mm || !dd) return String(d);
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatQuantity = (q) =>
    toNumber(q).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

  // Helpers de data sem fuso horário (igual Contas a Receber)
  const parseDateNoTZ = (isoDate) => {
    if (!isoDate) return null;
    try {
      const [datePart] = String(isoDate).split('T');
      const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    } catch {
      return null;
    }
  };

  // Função para obter dias do mês
  const obterDiasDoMes = (mes) => {
    const meses = {
      JAN: 31,
      FEV: 28,
      MAR: 31,
      ABR: 30,
      MAI: 31,
      JUN: 30,
      JUL: 31,
      AGO: 31,
      SET: 30,
      OUT: 31,
      NOV: 30,
      DEZ: 31,
    };
    return meses[mes] || 0;
  };

  // Função para lidar com mudança de filtro mensal
  const handleFiltroMensalChange = (novoFiltro) => {
    setFiltroMensal(novoFiltro);
    setFiltroDia(null); // Limpar filtro de dia quando mudar o mês
  };

  // Função para aplicar filtro mensal e por dia (igual Contas a Receber)
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
    return dados.filter((item) => {
      // Usar dt_transacao como base para o filtro mensal
      const dataTransacao = item.dt_transacao;
      if (!dataTransacao) return false;

      const data = parseDateNoTZ(dataTransacao);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();

      if (filtro === 'ANO') {
        // Mostrar dados do ano atual
        const anoAtual = new Date().getFullYear();
        return ano === anoAtual;
      }

      // Filtros por mês específico
      const mesesMap = {
        JAN: 1,
        FEV: 2,
        MAR: 3,
        ABR: 4,
        MAI: 5,
        JUN: 6,
        JUL: 7,
        AGO: 8,
        SET: 9,
        OUT: 10,
        NOV: 11,
        DEZ: 12,
      };

      const mesNumero = mesesMap[filtro];
      if (!mesNumero) return false;

      if (mes !== mesNumero) return false;

      // Se há filtro de dia, aplicar também
      if (diaFiltro !== null) {
        return dia === diaFiltro;
      }

      return true;
    });
  };

  // Filtragem em memória (como "duplicata" em Contas a Pagar)
  const dadosFiltrados = useMemo(() => {
    const termoNr = String(filtros.nr_transacao || '').trim();
    const termoPessoa = String(filtros.cd_pessoa || '').trim();
    const termoEmpresa = String(filtros.cd_empresa || '').trim();

    let dadosFiltrados = dados;

    // Aplicar filtros de texto primeiro
    if (termoNr || termoPessoa || termoEmpresa) {
      dadosFiltrados = dados.filter((row) => {
        let ok = true;
        if (termoNr) {
          ok = ok && String(row?.nr_transacao || '').includes(termoNr);
        }
        if (termoPessoa) {
          ok = ok && String(row?.cd_pessoa || '').includes(termoPessoa);
        }
        if (termoEmpresa) {
          ok =
            ok &&
            String(row?.cd_grupoempresa || row?.cd_empresa || '').includes(
              termoEmpresa,
            );
        }
        return ok;
      });
    }

    // Aplicar filtro mensal aos dados já filtrados
    dadosFiltrados = aplicarFiltroMensal(
      dadosFiltrados,
      filtroMensal,
      filtroDia,
    );

    return dadosFiltrados;
  }, [
    dados,
    filtros.nr_transacao,
    filtros.cd_pessoa,
    filtros.cd_empresa,
    filtroMensal,
    filtroDia,
  ]);

  // Helpers de agregação por segmento
  const aggregateTotais = (rows) => {
    let totalLiquido = 0;
    let totalBruto = 0;
    let totalDevolucoes = 0;
    let totalCMV = 0;
    let totalFrete = 0;
    for (const row of rows || []) {
      const qtd = toNumber(row?.qt_faturado) || 1;
      const frete = toNumber(row?.vl_freterat) || 0;
      const liq = toNumber(row?.vl_unitliquido) * qtd + frete;
      const bru = toNumber(row?.vl_unitbruto) * qtd + frete;
      const cmv = toNumber(row?.vl_produto) * qtd;
      const isDev = String(row?.tp_operacao).trim() === 'E';
      if (isDev) {
        totalLiquido -= Math.abs(liq);
        totalBruto -= Math.abs(bru);
        totalDevolucoes += Math.abs(liq);
        totalCMV -= Math.abs(cmv);
      } else {
        totalLiquido += liq;
        totalBruto += bru;
        totalCMV += cmv;
      }
      totalFrete += frete;
    }
    return { totalLiquido, totalBruto, totalDevolucoes, totalCMV, totalFrete };
  };

  const aggregateVarejo = (rows) => {
    // Varejo vem da rota /faturamento: cmv = vl_produto * qt_faturado, vendas com frete incluso
    let totalLiquido = 0;
    let totalBruto = 0;
    let totalDevolucoes = 0;
    let totalCMV = 0;
    let totalFrete = 0;
    for (const row of rows || []) {
      const qtd = toNumber(row?.qt_faturado) || 1;
      const frete = toNumber(row?.vl_freterat) || 0;
      const liq = toNumber(row?.vl_unitliquido) * qtd + frete;
      const bru = toNumber(row?.vl_unitbruto) * qtd + frete;
      const cmv = toNumber(row?.vl_produto) * qtd;
      const isDev = String(row?.tp_operacao).trim() === 'E';
      if (isDev) {
        totalLiquido -= Math.abs(liq);
        totalBruto -= Math.abs(bru);
        totalDevolucoes += Math.abs(liq);
        totalCMV -= Math.abs(cmv);
      } else {
        totalLiquido += liq;
        totalBruto += bru;
        totalCMV += cmv;
      }
      totalFrete += frete;
    }
    return { totalLiquido, totalBruto, totalDevolucoes, totalCMV, totalFrete };
  };

  // Aplicar filtro mensal também aos dados do Varejo
  const dadosVarejoFiltrados = useMemo(() => {
    return aplicarFiltroMensal(dadosVarejo || [], filtroMensal, filtroDia);
  }, [dadosVarejo, filtroMensal, filtroDia]);

  const totaisPorSegmento = useMemo(() => {
    // Classificações fixas: 2 MULTIMARCAS, 3 REVENDA, 4 FRANQUIA
    const byClass = (cls) =>
      (dadosFiltrados || []).filter(
        (r) => Number(r?.cd_classificacao) === Number(cls),
      );
    const multimarcas = aggregateTotais(byClass(2));
    const revenda = aggregateTotais(byClass(3));
    const franquia = aggregateTotais(byClass(4));
    const varejo = aggregateVarejo(dadosVarejoFiltrados);
    // Consolidado = soma dos 4
    const soma = (a, b) => ({
      totalLiquido: a.totalLiquido + b.totalLiquido,
      totalBruto: a.totalBruto + b.totalBruto,
      totalDevolucoes: a.totalDevolucoes + b.totalDevolucoes,
      totalCMV: a.totalCMV + b.totalCMV,
      totalFrete: a.totalFrete + b.totalFrete,
    });
    const consolidado = soma(
      soma(multimarcas, revenda),
      soma(franquia, varejo),
    );
    return { consolidado, multimarcas, franquia, revenda, varejo };
  }, [dadosFiltrados, dadosVarejoFiltrados]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <PageTitle
        title="CMV CONSOLIDADO"
        subtitle="Consulta do CMV Consolidado dos canais MULTIMARCAS, REVENDA, FRANQUIA e VAREJO"
        icon={ChartLineUp}
        iconColor="text-indigo-600"
      />

      <div className="bg-white rounded-lg shadow p-3 mb-4 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filtros.dt_inicio}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dt_inicio: e.target.value }))
              }
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Data Fim</label>
            <input
              type="date"
              value={filtros.dt_fim}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dt_fim: e.target.value }))
              }
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          {/* Filtro por Período - estilo pills */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Cd Empresa
            </label>
            <input
              type="text"
              value={filtros.cd_empresa}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, cd_empresa: e.target.value }))
              }
              placeholder="Ex.: 11"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Nr Transação
            </label>
            <input
              type="text"
              value={filtros.nr_transacao}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, nr_transacao: e.target.value }))
              }
              placeholder="Ex.: 685924"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Cd Pessoa
            </label>
            <input
              type="text"
              value={filtros.cd_pessoa}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, cd_pessoa: e.target.value }))
              }
              placeholder="Ex.: 19295"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={buscar}
              disabled={loading || !filtros.dt_inicio || !filtros.dt_fim}
              className="bg-indigo-600 text-white text-xs px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
        {erro && <div className="mt-2 text-xs text-red-600">{erro}</div>}
      </div>

      {/* Filtro por Período - estilo pills (igual Contas a Receber) */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 border border-gray-200">
        <div className="flex flex-wrap gap-1">
          {/* Botão ANO */}
          <button
            onClick={() => handleFiltroMensalChange('ANO')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filtroMensal === 'ANO'
                ? 'bg-[#000638] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ANO
          </button>

          {/* Botões dos meses */}
          {[
            'JAN',
            'FEV',
            'MAR',
            'ABR',
            'MAI',
            'JUN',
            'JUL',
            'AGO',
            'SET',
            'OUT',
            'NOV',
            'DEZ',
          ].map((mes) => (
            <button
              key={mes}
              onClick={() => handleFiltroMensalChange(mes)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filtroMensal === mes
                  ? 'bg-[#000638] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {mes}
            </button>
          ))}
        </div>

        {/* Informação do filtro ativo */}
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Filtro ativo:</span> {filtroMensal}
          {filtroDia && <span className="ml-1">- Dia {filtroDia}</span>}
          <span className="ml-2">
            ({dadosFiltrados.length + dadosVarejoFiltrados.length} registro
            {dadosFiltrados.length + dadosVarejoFiltrados.length !== 1
              ? 's'
              : ''}
            )
          </span>
        </div>

        {/* Filtro por Dia - aparece apenas quando um mês está selecionado */}
        {filtroMensal !== 'ANO' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-bold text-xs text-[#000638] font-barlow">
                Filtro por Dia - {filtroMensal}
              </h4>
            </div>

            <div className="flex flex-wrap gap-0.5">
              {/* Botão "Todos os Dias" */}
              <button
                onClick={() => setFiltroDia(null)}
                className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                  filtroDia === null
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                TODOS
              </button>

              {/* Botões dos dias */}
              {Array.from(
                { length: obterDiasDoMes(filtroMensal) },
                (_, i) => i + 1,
              ).map((dia) => (
                <button
                  key={dia}
                  onClick={() => setFiltroDia(dia)}
                  className={`px-1.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                    filtroDia === dia
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {dia}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Seção CONSOLIDADO */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          CONSOLIDADO
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-3">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Liq + Imp</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totaisPorSegmento.consolidado.totalLiquido)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Bruta</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrency(totaisPorSegmento.consolidado.totalBruto)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Devoluções</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totaisPorSegmento.consolidado.totalDevolucoes)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.consolidado.totalCMV)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.consolidado.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  (totaisPorSegmento.consolidado.totalCMV / denom) * 100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Margem %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.consolidado.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  ((totaisPorSegmento.consolidado.totalLiquido -
                    totaisPorSegmento.consolidado.totalCMV) /
                    denom) *
                  100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Markup</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.consolidado.totalCMV) || 0;
                if (!denom) return '—';
                const factor =
                  totaisPorSegmento.consolidado.totalLiquido / denom;
                return `${factor.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}x`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Frete</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.consolidado.totalFrete)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção VAREJO */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">VAREJO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-3">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Liq + Imp</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totaisPorSegmento.varejo.totalLiquido)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Bruta</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrency(totaisPorSegmento.varejo.totalBruto)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Devoluções</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totaisPorSegmento.varejo.totalDevolucoes)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.varejo.totalCMV)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.varejo.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc = (totaisPorSegmento.varejo.totalCMV / denom) * 100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Margem %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.varejo.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  ((totaisPorSegmento.varejo.totalLiquido -
                    totaisPorSegmento.varejo.totalCMV) /
                    denom) *
                  100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Markup</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom = Math.abs(totaisPorSegmento.varejo.totalCMV) || 0;
                if (!denom) return '—';
                const factor = totaisPorSegmento.varejo.totalLiquido / denom;
                return `${factor.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}x`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Frete</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.varejo.totalFrete)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção REVENDA */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">REVENDA</h3>
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-3">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Liq + Imp</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totaisPorSegmento.revenda.totalLiquido)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Bruta</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrency(totaisPorSegmento.revenda.totalBruto)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Devoluções</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totaisPorSegmento.revenda.totalDevolucoes)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.revenda.totalCMV)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.revenda.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc = (totaisPorSegmento.revenda.totalCMV / denom) * 100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Margem %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.revenda.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  ((totaisPorSegmento.revenda.totalLiquido -
                    totaisPorSegmento.revenda.totalCMV) /
                    denom) *
                  100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Markup</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom = Math.abs(totaisPorSegmento.revenda.totalCMV) || 0;
                if (!denom) return '—';
                const factor = totaisPorSegmento.revenda.totalLiquido / denom;
                return `${factor.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}x`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Frete</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.revenda.totalFrete)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção FRANQUIA */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">FRANQUIA</h3>
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-3">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Liq + Imp</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totaisPorSegmento.franquia.totalLiquido)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Bruta</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrency(totaisPorSegmento.franquia.totalBruto)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Devoluções</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totaisPorSegmento.franquia.totalDevolucoes)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.franquia.totalCMV)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.franquia.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  (totaisPorSegmento.franquia.totalCMV / denom) * 100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Margem %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.franquia.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  ((totaisPorSegmento.franquia.totalLiquido -
                    totaisPorSegmento.franquia.totalCMV) /
                    denom) *
                  100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Markup</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.franquia.totalCMV) || 0;
                if (!denom) return '—';
                const factor = totaisPorSegmento.franquia.totalLiquido / denom;
                return `${factor.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}x`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Frete</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.franquia.totalFrete)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção MULTIMARCAS */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          MULTIMARCAS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-9 gap-3">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Liq + Imp</div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totaisPorSegmento.multimarcas.totalLiquido)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Receita Bruta</div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrency(totaisPorSegmento.multimarcas.totalBruto)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Devoluções</div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totaisPorSegmento.multimarcas.totalDevolucoes)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.multimarcas.totalCMV)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">CMV %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.multimarcas.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  (totaisPorSegmento.multimarcas.totalCMV / denom) * 100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Margem %</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.multimarcas.totalLiquido) || 0;
                if (!denom) return '0,00%';
                const perc =
                  ((totaisPorSegmento.multimarcas.totalLiquido -
                    totaisPorSegmento.multimarcas.totalCMV) /
                    denom) *
                  100;
                return `${perc.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Markup</div>
            <div className="text-lg font-semibold">
              {(() => {
                const denom =
                  Math.abs(totaisPorSegmento.multimarcas.totalCMV) || 0;
                if (!denom) return '—';
                const factor =
                  totaisPorSegmento.multimarcas.totalLiquido / denom;
                return `${factor.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}x`;
              })()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Frete</div>
            <div className="text-lg font-semibold">
              {formatCurrency(totaisPorSegmento.multimarcas.totalFrete)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMVConsolidado;
