// Pós-Vendas (Minha Franquia) — clientes que compraram há 7 dias (D-7) na(s)
// filial(is) selecionada(s). Retorna código, nome e telefone para o franqueado
// fazer o contato de pós-venda uma semana após a compra.
import React, { useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Headset,
  Funnel,
  MagnifyingGlass,
  DownloadSimple,
  WhatsappLogo,
  User,
  CalendarBlank,
} from '@phosphor-icons/react';

const API_KEY = import.meta.env.VITE_API_KEY || '';

// Data de 7 dias atrás no formato YYYY-MM-DD (horário local).
const seteDiasAtras = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
};

const fmtData = (s) => {
  if (!s) return '—';
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split('-');
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y}`;
};

const fmtTel = (t) => {
  if (!t) return '—';
  const d = String(t).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
};

// Normaliza telefone para link do WhatsApp (só dígitos, com DDI 55).
const linkWhatsapp = (telefone) => {
  if (!telefone) return null;
  let num = String(telefone).replace(/\D/g, '');
  if (!num) return null;
  if (num.length <= 11) num = '55' + num;
  return `https://wa.me/${num}`;
};

const PosVendasFranquia = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [data, setData] = useState(seteDiasAtras());
  const [lista, setLista] = useState([]);
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
      const url = new URL('/api/crm/pos-vendas', API_BASE_URL);
      if (data) url.searchParams.append('date', data);
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
            'Erro ao buscar pós-vendas',
        );
      }
      const result = await response.json();
      setLista(result?.data?.clientes || []);
      setBuscou(true);
    } catch (e) {
      console.error('❌ Erro ao buscar pós-vendas:', e);
      setErro(e.message || 'Erro ao buscar pós-vendas');
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  const empresaNomeMap = useMemo(() => {
    const m = new Map();
    empresasSelecionadas.forEach((e) =>
      m.set(String(e.cd_empresa), e.nm_grupoempresa || e.nm_fantasia || ''),
    );
    return m;
  }, [empresasSelecionadas]);

  const dadosFiltrados = useMemo(() => {
    const termo = filtroNome.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (d) =>
        (d.nome || '').toLowerCase().includes(termo) ||
        String(d.code || '').includes(termo),
    );
  }, [lista, filtroNome]);

  const handleExportExcel = () => {
    if (dadosFiltrados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const linhas = dadosFiltrados.map((d) => ({
      'Código': d.code || '',
      Nome: d.nome || '',
      Telefone: d.telefone || '',
      Empresa: empresaNomeMap.get(String(d.branch_code))
        ? `${d.branch_code} - ${empresaNomeMap.get(String(d.branch_code))}`
        : d.branch_code || '',
      'Data da compra': fmtData(d.data_compra),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pos-Vendas');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `pos-vendas-${data}.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Pós-Vendas"
        subtitle="Clientes que compraram há 7 dias — para o contato de pós-venda"
        icon={Headset}
        iconColor="text-amber-600"
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
              Selecione a empresa. A data já vem preenchida com 7 dias atrás
              (pode ajustar).
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

            {/* Data da compra */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                <span className="flex items-center gap-1">
                  <CalendarBlank size={12} weight="bold" />
                  Data da compra (D-7)
                </span>
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>

            {/* Buscar por nome */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                <span className="flex items-center gap-1">
                  <User size={12} weight="bold" />
                  Buscar na lista
                </span>
              </label>
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Nome ou código..."
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
                <Headset size={16} weight="bold" className="text-amber-600" />
                {dadosFiltrados.length} cliente(s)
              </span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                compras de {fmtData(data)}
              </span>
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
              Nenhum cliente comprou nessa data nas empresas selecionadas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2 text-left font-semibold">Código</th>
                    <th className="px-3 py-2 text-left font-semibold">Nome</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Telefone
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Empresa
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      WhatsApp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((d, idx) => {
                    const wpp = linkWhatsapp(d.telefone);
                    const nomeEmpresa = empresaNomeMap.get(
                      String(d.branch_code),
                    );
                    return (
                      <tr
                        key={`${d.branch_code}-${d.code}-${idx}`}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                          {d.code}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{d.nome}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fmtTel(d.telefone)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {nomeEmpresa
                            ? `${d.branch_code} - ${nomeEmpresa}`
                            : d.branch_code}
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
          Selecione uma empresa e clique em Buscar.
        </div>
      )}
    </div>
  );
};

export default PosVendasFranquia;
