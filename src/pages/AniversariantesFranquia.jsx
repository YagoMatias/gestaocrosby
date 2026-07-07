import React, { useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Cake,
  Funnel,
  MagnifyingGlass,
  DownloadSimple,
  WhatsappLogo,
  User,
  Gift,
} from '@phosphor-icons/react';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

// Normaliza telefone para link do WhatsApp (só dígitos, com DDI 55).
const linkWhatsapp = (telefone) => {
  if (!telefone) return null;
  let num = String(telefone).replace(/\D/g, '');
  if (!num) return null;
  if (num.length <= 11) num = '55' + num;
  return `https://wa.me/${num}`;
};

const AniversariantesFranquia = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [buscou, setBuscou] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');

  const buscar = async () => {
    if (empresasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma empresa.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const url = new URL('/api/crm/aniversariantes-mes', API_BASE_URL);
      url.searchParams.append('month', mes);
      empresasSelecionadas.forEach((emp) =>
        url.searchParams.append('empresas', emp.cd_empresa),
      );

      const response = await fetch(url.toString(), {
        headers: API_KEY ? { 'x-api-key': API_KEY } : {},
      });
      if (!response.ok) {
        let body = null;
        try {
          body = await response.json();
        } catch {}
        throw new Error(
          (body && (body.message || body.error)) ||
            'Erro ao buscar aniversariantes',
        );
      }
      const result = await response.json();
      const lista = result?.data?.aniversariantes || [];
      setDados(lista);
      setBuscou(true);
    } catch (e) {
      console.error('❌ Erro ao buscar aniversariantes:', e);
      setErro(e.message || 'Erro ao buscar aniversariantes');
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  // Mapa cd_empresa → nome do grupo para exibir na tabela
  const empresaNomeMap = useMemo(() => {
    const m = new Map();
    empresasSelecionadas.forEach((e) =>
      m.set(String(e.cd_empresa), e.nm_grupoempresa || e.nm_fantasia || ''),
    );
    return m;
  }, [empresasSelecionadas]);

  const dadosFiltrados = useMemo(() => {
    const termo = filtroNome.trim().toLowerCase();
    if (!termo) return dados;
    return dados.filter((d) => (d.nome || '').toLowerCase().includes(termo));
  }, [dados, filtroNome]);

  const totalHoje = useMemo(
    () => dados.filter((d) => d.is_hoje).length,
    [dados],
  );

  const handleExportExcel = () => {
    if (dadosFiltrados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const linhas = dadosFiltrados.map((d) => ({
      Dia: d.dia || '',
      Nome: d.nome || '',
      Empresa: empresaNomeMap.get(String(d.cd_empresa))
        ? `${d.cd_empresa} - ${empresaNomeMap.get(String(d.cd_empresa))}`
        : d.cd_empresa || '',
      Telefone: d.telefone || '',
      'E-mail': d.email || '',
      Idade: d.idade ?? '',
      'Código Cliente': d.code || '',
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aniversariantes');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const nomeMes = MESES.find((m) => m.value === mes)?.label || mes;
    saveAs(blob, `aniversariantes-${nomeMes}.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Aniversariantes"
        subtitle="Clientes que fazem aniversário no mês, por empresa"
        icon={Cake}
        iconColor="text-pink-600"
      />

      {/* Filtros */}
      <div className="mb-4">
        <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-7xl mx-auto border border-[#000638]/10">
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Selecione a empresa e o mês para consultar os aniversariantes
            </span>
          </div>

          {erro && (
            <div className="mb-3 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-1">
            {/* Empresa */}
            <div>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>

            {/* Mês */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Mês
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscar por nome */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                <span className="flex items-center gap-1">
                  <User size={12} weight="bold" />
                  Buscar por nome
                </span>
              </label>
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Filtrar na lista..."
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs placeholder:text-gray-400"
              />
            </div>

            {/* Botão Buscar */}
            <div className="flex items-end">
              <button
                onClick={buscar}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full"
              >
                <MagnifyingGlass
                  size={12}
                  weight="bold"
                  className={loading ? 'animate-pulse' : ''}
                />
                <span>Buscar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : buscou ? (
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 w-full max-w-7xl mx-auto">
          {/* Cabeçalho da lista */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-[#000638] flex items-center gap-1">
                <Gift size={16} weight="bold" className="text-pink-600" />
                {dadosFiltrados.length} aniversariante(s)
              </span>
              {totalHoje > 0 && (
                <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                  {totalHoje} hoje 🎉
                </span>
              )}
            </div>
            <button
              onClick={handleExportExcel}
              disabled={dadosFiltrados.length === 0}
              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold"
            >
              <DownloadSimple size={12} weight="bold" />
              Excel
            </button>
          </div>

          {dadosFiltrados.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-sm">
              Nenhum aniversariante encontrado para o período/empresa
              selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2 text-left font-semibold">Dia</th>
                    <th className="px-3 py-2 text-left font-semibold">Nome</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Empresa
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Telefone
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Idade
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      WhatsApp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((d, idx) => {
                    const wpp = linkWhatsapp(d.telefone);
                    const nomeEmpresa = empresaNomeMap.get(String(d.cd_empresa));
                    return (
                      <tr
                        key={`${d.cd_empresa}-${d.code}-${idx}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          d.is_hoje ? 'bg-pink-50' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-[#000638] whitespace-nowrap">
                          {String(d.dia || '').padStart(2, '0')}
                          {d.is_hoje && <span className="ml-1">🎂</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{d.nome}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {nomeEmpresa
                            ? `${d.cd_empresa} - ${nomeEmpresa}`
                            : d.cd_empresa}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {d.telefone || '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {d.idade ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {wpp ? (
                            <a
                              href={wpp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-green-600 hover:text-green-700"
                              title="Enviar WhatsApp"
                            >
                              <WhatsappLogo size={18} weight="fill" />
                            </a>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-10 text-sm">
          Selecione uma empresa e um mês e clique em Buscar.
        </div>
      )}
    </div>
  );
};

export default AniversariantesFranquia;
