// Clientes Inativos (Minha Franquia) — clientes que já compraram na(s)
// filial(is) selecionada(s) mas estão há N meses sem comprar. Para a missão
// de reativação: retorna código, nome, telefone, última compra e dias sem
// comprar, para o franqueado entrar em contato e trazer o cliente de volta.
import React, { useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  ArrowCounterClockwise,
  Funnel,
  MagnifyingGlass,
  DownloadSimple,
  WhatsappLogo,
  User,
} from '@phosphor-icons/react';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const OPCOES_MESES = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
];

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

const ClientesInativosFranquia = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [meses, setMeses] = useState(6);
  const [mesesBuscado, setMesesBuscado] = useState(6);
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
      const url = new URL('/api/crm/clientes-inativos', API_BASE_URL);
      url.searchParams.append('meses', String(meses));
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
            'Erro ao buscar clientes inativos',
        );
      }
      const result = await response.json();
      setLista(result?.data?.clientes || []);
      setMesesBuscado(meses);
      setBuscou(true);
    } catch (e) {
      console.error('❌ Erro ao buscar clientes inativos:', e);
      setErro(e.message || 'Erro ao buscar clientes inativos');
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  const dadosFiltrados = useMemo(() => {
    const termo = filtroNome.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (d) =>
        (d.nome || '').toLowerCase().includes(termo) ||
        String(d.code || '').includes(termo) ||
        String(d.telefone || '').replace(/\D/g, '').includes(termo),
    );
  }, [lista, filtroNome]);

  const handleExportExcel = () => {
    if (dadosFiltrados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const linhas = dadosFiltrados.map((d) => ({
      Código: d.code || '',
      Nome: d.nome || '',
      Telefone: d.telefone || '',
      'Última compra': fmtData(d.ultima_compra),
      'Dias sem comprar': d.dias_sem_comprar ?? '',
      'Total de compras': d.total_compras ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inativos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `clientes-inativos-${mesesBuscado}meses.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Clientes Inativos"
        subtitle="Quem já comprou mas está há meses sem voltar — para a missão de reativação"
        icon={ArrowCounterClockwise}
        iconColor="text-rose-600"
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
              Selecione a empresa e há quantos meses o cliente não compra.
              Considera o histórico dos últimos 24 meses.
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

            {/* Meses sem comprar */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Sem comprar há
              </label>
              <div className="flex gap-1">
                {OPCOES_MESES.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setMeses(op.value)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      meses === op.value
                        ? 'bg-[#000638] text-white border-[#000638]'
                        : 'bg-[#f8f9fb] text-[#000638] border-[#000638]/30 hover:bg-gray-100'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
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
                placeholder="Nome, código ou telefone..."
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
                <ArrowCounterClockwise
                  size={16}
                  weight="bold"
                  className="text-rose-600"
                />
                {dadosFiltrados.length} cliente(s) inativo(s)
              </span>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                há {mesesBuscado}+ meses sem comprar
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
            <div className="text-center text-gray-500 py-10 text-sm px-4">
              <p className="font-semibold text-gray-600">
                Nenhum cliente inativo há {mesesBuscado}+ meses nesta(s) loja(s).
              </p>
              <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
                Só aparecem clientes com cadastro (nome/telefone). Se sua loja
                tem vendas mas nada aparece, a sincronização com o TOTVS pode
                estar atrasada — avise o suporte.
              </p>
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
                      Última compra
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Dias sem comprar
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Compras
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      WhatsApp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((d, idx) => {
                    const wpp = linkWhatsapp(d.telefone);
                    return (
                      <tr
                        key={`${d.code}-${idx}`}
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
                          {fmtData(d.ultima_compra)}
                        </td>
                        <td className="px-3 py-2 text-center text-rose-700 font-semibold whitespace-nowrap">
                          {d.dias_sem_comprar}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">
                          {d.total_compras}
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
          Selecione uma empresa, o período e clique em Buscar.
        </div>
      )}
    </div>
  );
};

export default ClientesInativosFranquia;
