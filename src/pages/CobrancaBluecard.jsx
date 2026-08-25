// Cobrança BlueCard — boletos do crediário BlueCard que estão VENCIDOS ou
// que vencem nos próximos N dias. Lê os títulos do TOTVS espelhados em
// bluecard_titulos e mostra cliente, telefone, parcela, valor e vencimento
// para o time de cobrança acionar o cliente (WhatsApp) antes/depois do venc.
import React, { useState, useEffect, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_BASE_URL } from '../config/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Barcode,
  Funnel,
  DownloadSimple,
  WhatsappLogo,
  User,
  Warning,
  Clock,
} from '@phosphor-icons/react';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const OPCOES_DIAS = [
  { value: 3, label: '3 dias' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
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

const fmtCpf = (c) => {
  const d = String(c || '').replace(/\D/g, '');
  if (d.length !== 11) return c || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const linkWhatsapp = (telefone) => {
  if (!telefone) return null;
  let num = String(telefone).replace(/\D/g, '');
  if (!num) return null;
  if (num.length <= 11) num = '55' + num;
  return `https://wa.me/${num}`;
};

const CobrancaBluecard = () => {
  const [dias, setDias] = useState(7);
  const [resumo, setResumo] = useState(null);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [buscou, setBuscou] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('todos'); // todos | vencido | a_vencer

  const buscar = async () => {
    setLoading(true);
    setErro('');
    try {
      const url = new URL('/api/crm/bluecard-cobranca', API_BASE_URL);
      url.searchParams.append('dias', String(dias));
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
            'Erro ao buscar cobrança BlueCard',
        );
      }
      const result = await response.json();
      const data = result?.data || {};
      setResumo({
        vencido_qtd: data.vencido_qtd || 0,
        a_vencer_qtd: data.a_vencer_qtd || 0,
        total_vencido: data.total_vencido || 0,
        total_a_vencer: data.total_a_vencer || 0,
      });
      setLista(data.titulos || []);
      setBuscou(true);
    } catch (e) {
      console.error('❌ Erro ao buscar cobrança BlueCard:', e);
      setErro(e.message || 'Erro ao buscar cobrança BlueCard');
      setLista([]);
      setResumo(null);
    } finally {
      setLoading(false);
    }
  };

  // Busca ao entrar na página
  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dadosFiltrados = useMemo(() => {
    const termo = filtroNome.trim().toLowerCase();
    return lista.filter((d) => {
      if (filtroSituacao !== 'todos' && d.situacao !== filtroSituacao)
        return false;
      if (!termo) return true;
      return (
        (d.nome || '').toLowerCase().includes(termo) ||
        String(d.cpf || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '')) ||
        String(d.documento || '').includes(termo)
      );
    });
  }, [lista, filtroNome, filtroSituacao]);

  const handleExportExcel = () => {
    if (dadosFiltrados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }
    const linhas = dadosFiltrados.map((d) => ({
      Situação: d.situacao === 'vencido' ? 'Vencido' : 'A vencer',
      Cliente: d.nome || '',
      CPF: fmtCpf(d.cpf),
      Telefone: d.telefone || '',
      Documento: d.documento || '',
      Parcela: d.parcela || '',
      'Valor (R$)': Number(d.valor || 0).toFixed(2).replace('.', ','),
      Vencimento: fmtData(d.vencimento),
      'Dias p/ vencer': d.dias_para_vencer,
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranca BlueCard');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `cobranca-bluecard-${dias}dias.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Cobrança BlueCard"
        subtitle="Boletos do crediário BlueCard vencidos e a vencer — para acionar o cliente"
        icon={Barcode}
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
              Mostra boletos já vencidos + os que vencem no período escolhido.
            </span>
          </div>

          {erro && (
            <div className="mb-3 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-1">
            {/* Janela de vencimento */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                A vencer em até
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

            {/* Situação */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação
              </label>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="todos">Todos</option>
                <option value="vencido">Vencidos</option>
                <option value="a_vencer">A vencer</option>
              </select>
            </div>

            {/* Buscar por nome */}
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                <span className="flex items-center gap-1">
                  <User size={12} weight="bold" />
                  Buscar
                </span>
              </label>
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Nome, CPF ou documento..."
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs placeholder:text-gray-400"
              />
            </div>

            {/* Botão Atualizar */}
            <div className="flex items-end">
              <button
                onClick={buscar}
                disabled={loading}
                className="flex items-center justify-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full"
              >
                <span>Atualizar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-2 gap-3 mb-4 max-w-2xl">
          <div className="bg-white border border-rose-200 rounded-xl p-3 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-rose-100">
              <Warning size={20} weight="bold" className="text-rose-600" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                Vencidos ({resumo.vencido_qtd})
              </div>
              <div className="text-xl font-extrabold text-rose-600">
                R$ {fmtBRL(resumo.total_vencido)}
              </div>
            </div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
              <Clock size={20} weight="bold" className="text-amber-600" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                A vencer ({resumo.a_vencer_qtd})
              </div>
              <div className="text-xl font-extrabold text-amber-600">
                R$ {fmtBRL(resumo.total_a_vencer)}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : buscou ? (
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 w-full max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
            <span className="font-bold text-[#000638] flex items-center gap-1 text-sm">
              <Barcode size={16} weight="bold" className="text-rose-600" />
              {dadosFiltrados.length} boleto(s)
            </span>
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
                Nenhum boleto vencido ou a vencer no período.
              </p>
              <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
                A integração BlueCard alimenta esta lista automaticamente
                conforme os boletos são gerados. Se ainda está em fase inicial,
                poucos títulos aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2 text-left font-semibold">
                      Situação
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-3 py-2 text-left font-semibold">CPF</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Telefone
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Doc.</th>
                    <th className="px-3 py-2 text-right font-semibold">Valor</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Vencimento
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      WhatsApp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((d, idx) => {
                    const wpp = linkWhatsapp(d.telefone);
                    const vencido = d.situacao === 'vencido';
                    return (
                      <tr
                        key={`${d.documento}-${d.vencimento}-${idx}`}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              vencido
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {vencido
                              ? `Vencido há ${Math.abs(d.dias_para_vencer)}d`
                              : `Vence em ${d.dias_para_vencer}d`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-800">{d.nome || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap font-mono">
                          {fmtCpf(d.cpf)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fmtTel(d.telefone)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono">
                          {d.documento || '—'}
                          {d.parcela ? `/${d.parcela}` : ''}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                            vencido ? 'text-rose-700' : 'text-gray-800'
                          }`}
                        >
                          R$ {fmtBRL(d.valor)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {fmtData(d.vencimento)}
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
      ) : null}
    </div>
  );
};

export default CobrancaBluecard;
