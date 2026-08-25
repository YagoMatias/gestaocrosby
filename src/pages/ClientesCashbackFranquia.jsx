// Clientes com Cashback (Minha Franquia) — clientes que compraram há 3, 30 ou
// 59 dias (dia exato) na(s) filial(is) selecionada(s) e que têm saldo de
// cashback no TOTVS. Retorna valor do cashback, código, nome e telefone —
// para o franqueado lembrar o cliente de usar o cashback antes de expirar.
import React, { useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Coins,
  Funnel,
  MagnifyingGlass,
  DownloadSimple,
  WhatsappLogo,
  User,
} from '@phosphor-icons/react';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const OPCOES_DIAS = [
  { value: 3, label: '3 dias' },
  { value: 30, label: '30 dias' },
  { value: 59, label: '59 dias' },
];

// Data de N dias atrás no formato YYYY-MM-DD (horário local).
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
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

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Normaliza telefone para link do WhatsApp (só dígitos, com DDI 55).
const linkWhatsapp = (telefone) => {
  if (!telefone) return null;
  let num = String(telefone).replace(/\D/g, '');
  if (!num) return null;
  if (num.length <= 11) num = '55' + num;
  return `https://wa.me/${num}`;
};

const ClientesCashbackFranquia = () => {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dias, setDias] = useState(3);
  const [dataAlvo, setDataAlvo] = useState('');
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
    const date = diasAtras(dias);
    setDataAlvo(date);
    try {
      const branchCodes = empresasSelecionadas.map((e) => Number(e.cd_empresa));

      // 1) Quem comprou no dia D-N nessas filiais
      const url = new URL('/api/crm/pos-vendas', API_BASE_URL);
      url.searchParams.append('date', date);
      empresasSelecionadas.forEach((emp) =>
        url.searchParams.append('empresas', emp.cd_empresa),
      );
      const r1 = await fetch(url.toString(), {
        headers: API_KEY ? { 'x-api-key': API_KEY } : {},
      });
      if (!r1.ok) throw new Error(`Erro ao buscar compradores (${r1.status})`);
      const j1 = await r1.json();
      const compradores = j1?.data?.clientes || [];
      if (compradores.length === 0) {
        setLista([]);
        setBuscou(true);
        return;
      }

      // 2) Saldo de cashback desses clientes
      const r2 = await fetch(`${API_BASE_URL}/api/crm/cashback-balances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        body: JSON.stringify({
          persons: compradores.map((c) => ({
            code: c.code,
            branches: branchCodes,
          })),
        }),
      });
      if (!r2.ok) throw new Error(`Erro ao buscar cashback (${r2.status})`);
      const j2 = await r2.json();
      const mapCashback = j2?.data?.clientes || {};

      // 3) Merge — só quem tem cashback > 0
      const compradorMap = new Map(compradores.map((c) => [c.code, c]));
      const out = Object.values(mapCashback).map((c) => {
        const comp = compradorMap.get(c.code) || {};
        return {
          code: c.code,
          nome: c.nome || comp.nome || `Cliente ${c.code}`,
          telefone: c.telefone || comp.telefone || '',
          cashback: c.balance || 0,
        };
      });
      out.sort((a, b) => b.cashback - a.cashback);
      setLista(out);
      setBuscou(true);
    } catch (e) {
      console.error('❌ Erro ao buscar clientes com cashback:', e);
      setErro(e.message || 'Erro ao buscar clientes com cashback');
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

  const totalCashback = useMemo(
    () => dadosFiltrados.reduce((s, c) => s + (c.cashback || 0), 0),
    [dadosFiltrados],
  );

  const handleExportExcel = () => {
    if (dadosFiltrados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const linhas = dadosFiltrados.map((d) => ({
      'Código': d.code || '',
      Nome: d.nome || '',
      Telefone: d.telefone || '',
      'Cashback (R$)': Number(d.cashback || 0).toFixed(2).replace('.', ','),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cashback');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `clientes-cashback-${dias}dias-${dataAlvo}.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Clientes com Cashback"
        subtitle="Quem comprou há 3, 30 ou 59 dias e tem cashback para usar"
        icon={Coins}
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
              Selecione a empresa e há quantos dias foi a compra. Mostra só
              clientes com saldo de cashback.
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

            {/* Dias após a compra */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Dias após a compra
              </label>
              <div className="flex gap-1">
                {OPCOES_DIAS.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setDias(op.value)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      dias === op.value
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
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <LoadingSpinner />
          <span className="text-xs text-gray-500">
            Consultando cashback no TOTVS…
          </span>
        </div>
      ) : buscou ? (
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 w-full max-w-7xl mx-auto">
          {/* Cabeçalho da lista */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-[#000638] flex items-center gap-1">
                <Coins size={16} weight="bold" className="text-amber-600" />
                {dadosFiltrados.length} cliente(s) com cashback
              </span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                compras de {fmtData(dataAlvo)} ({dias} dias)
              </span>
              {totalCashback > 0 && (
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  Total R$ {fmtBRL(totalCashback)}
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
            <div className="text-center text-gray-500 py-10 text-sm px-4">
              <p className="font-semibold text-gray-600">
                Nenhum cliente com cashback comprou em {fmtData(dataAlvo)} nesta(s)
                loja(s).
              </p>
              <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
                Só aparecem clientes com cadastro e com saldo de cashback. Tente
                outro período (3/30/59 dias). Se sua loja teve vendas nesse dia e
                nada aparece, a sincronização com o TOTVS pode estar atrasada —
                avise o suporte.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2 text-right font-semibold">
                      Cashback
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Código</th>
                    <th className="px-3 py-2 text-left font-semibold">Nome</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Telefone
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
                        <td className="px-3 py-2 text-right font-bold text-green-700 whitespace-nowrap">
                          R$ {fmtBRL(d.cashback)}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                          {d.code}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{d.nome}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fmtTel(d.telefone)}
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

export default ClientesCashbackFranquia;
