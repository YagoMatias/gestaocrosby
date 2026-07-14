// Antecipação (BlueCred) — busca um cliente e lista seus títulos/boletos em
// aberto no TOTVS (accounts-receivable). Permite abrir/baixar o PDF do boleto
// (bank-slip) e copiar a linha digitável. Reaproveita a mesma fonte do
// Portal de Títulos.
import React, { useState } from 'react';
import {
  Barcode,
  MagnifyingGlass,
  Spinner,
  Warning,
  User,
  IdentificationCard,
  Copy,
  FileArrowDown,
  CalendarBlank,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';

// Filiais padrão pra buscar títulos (mesma lista do Portal de Títulos).
const BRANCHES_PADRAO = [1, 2, 6, 100, 101, 99, 990, 200, 400, 4, 850, 85];

function fmtBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return s;
  }
}

function fmtDoc(s) {
  if (!s) return '—';
  const d = String(s).replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return s;
}

// Converte base64 (PDF) em Blob e abre em nova aba.
function abrirPDF(base64) {
  const clean = String(base64).replace(/^data:application\/pdf;base64,/, '');
  try {
    const bytes = atob(clean);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    /* base64 inválido */
  }
}

function extrairBase64(data) {
  if (typeof data === 'string') return data;
  if (data?.data?.base64) return typeof data.data.base64 === 'string' ? data.data.base64 : data.data.base64.content;
  if (data?.data && typeof data.data === 'string') return data.data;
  if (data?.base64) return typeof data.base64 === 'string' ? data.base64 : data.base64.content;
  return '';
}

export default function AntecipacaoBoletos() {
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState(null);

  const [titulos, setTitulos] = useState([]);
  const [carregandoTitulos, setCarregandoTitulos] = useState(false);
  const [erroTitulos, setErroTitulos] = useState('');

  const [boletoLoadingKey, setBoletoLoadingKey] = useState(null);
  const [copiado, setCopiado] = useState(null);

  // ── Busca de cliente (Supabase pes_pessoa + fallback TOTVS por código/CPF) ──
  const buscarCliente = async () => {
    const q = termo.trim();
    if (!q) return;
    setBuscando(true);
    setErro('');
    setClientes([]);
    setCliente(null);
    setTitulos([]);
    setErroTitulos('');
    try {
      const soDigitos = q.replace(/\D/g, '');
      const params = new URLSearchParams();
      if (/^\d+$/.test(q) && q.length <= 8) params.append('code', q);
      else if (soDigitos.length === 11 || soDigitos.length === 14) params.append('cnpj', soDigitos);
      else params.append('nome', q);
      const resp = await fetch(`${TotvsURL}clientes/search-name?${params.toString()}`);
      const json = await resp.json();
      const lista = json?.data?.clientes || [];
      if (lista.length === 0) {
        setErro('Nenhum cliente encontrado.');
      } else if (lista.length === 1) {
        selecionarCliente(lista[0]);
      } else {
        setClientes(lista);
      }
    } catch (e) {
      setErro(`Erro na busca: ${e.message}`);
    } finally {
      setBuscando(false);
    }
  };

  const selecionarCliente = async (cli) => {
    setCliente(cli);
    setClientes([]);
    await carregarTitulos(cli.code);
  };

  // ── Títulos em aberto do cliente (accounts-receivable) ──
  const carregarTitulos = async (code) => {
    setCarregandoTitulos(true);
    setErroTitulos('');
    setTitulos([]);
    try {
      const resp = await fetch(`${TotvsURL}accounts-receivable/search-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            branchCodeList: BRANCHES_PADRAO,
            customerCodeList: [Number(code)],
            hasOpenInvoices: true,
            dischargeTypeList: [0],
          },
          expand: 'invoice,calculateValue',
          order: '-expiredDate',
          maxPages: 20,
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.message || `Erro HTTP ${resp.status}`);
      }
      const json = await resp.json();
      const items = (json.data?.items || []).map((it) => ({
        branchCode: it.branchCode,
        customerCode: it.customerCode,
        receivableCode: it.receivableCode,
        installmentCode: it.installmentCode,
        vencimento: it.expiredDate,
        emissao: it.issueDate,
        valor: it.installmentValue,
        valorAtualizado: it.calculatedValues?.updatedValue ?? it.netValue ?? it.installmentValue,
        diasAtraso: it.calculatedValues?.daysLate,
        status: it.status,
        linhaDigitavel: it.digitableLine,
        codBarras: it.barCode,
      }));
      setTitulos(items);
      if (items.length === 0) setErroTitulos('Nenhum título em aberto para este cliente.');
    } catch (e) {
      setErroTitulos(`Erro ao buscar títulos: ${e.message}`);
    } finally {
      setCarregandoTitulos(false);
    }
  };

  // ── Boleto (bank-slip) → abre PDF ──
  const abrirBoleto = async (t) => {
    const key = `${t.receivableCode}-${t.installmentCode}`;
    setBoletoLoadingKey(key);
    try {
      const resp = await fetch(`${TotvsURL}bank-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: parseInt(t.branchCode) || 0,
          customerCode: t.customerCode || '',
          receivableCode: parseInt(t.receivableCode) || 0,
          installmentNumber: parseInt(t.installmentCode) || 0,
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.message || 'Erro ao gerar boleto');
      }
      const data = await resp.json();
      const base64 = extrairBase64(data);
      if (base64) abrirPDF(base64);
      else alert('Boleto não disponível para este título.');
    } catch (e) {
      alert(`Erro ao gerar boleto: ${e.message}`);
    } finally {
      setBoletoLoadingKey(null);
    }
  };

  const copiarLinha = (linha, key) => {
    if (!linha) return;
    navigator.clipboard?.writeText(String(linha).replace(/\D/g, ''));
    setCopiado(key);
    setTimeout(() => setCopiado(null), 1500);
  };

  const totalAberto = titulos.reduce((s, t) => s + Number(t.valor || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <PageTitle
          title="Antecipação — Boletos"
          subtitle="Busque um cliente e veja/baixe os boletos em aberto (BlueCred)"
          icon={Barcode}
          iconColor="text-blue-600"
        />

        {/* Busca */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
            Cliente (nome, CPF/CNPJ ou código)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarCliente())}
              placeholder="Ex: João Silva  /  123.456.789-00  /  12345"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={buscarCliente}
              disabled={buscando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {buscando ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              Buscar
            </button>
          </div>
          {erro && (
            <p className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 flex items-center gap-1">
              <Warning size={14} weight="fill" /> {erro}
            </p>
          )}
        </div>

        {/* Resultados da busca (mais de 1) */}
        {clientes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b border-gray-100 text-xs font-bold text-blue-800">
              {clientes.length} clientes encontrados — selecione
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {clientes.map((c) => (
                <button
                  key={c.code}
                  onClick={() => selecionarCliente(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 flex items-center gap-3"
                >
                  <User size={16} className="text-blue-600" />
                  <span className="font-mono text-xs text-gray-500 w-16">#{c.code}</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{c.nm_pessoa || c.fantasy_name}</span>
                  <span className="text-xs font-mono text-gray-500">{fmtDoc(c.cpf)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cliente selecionado + títulos */}
        {cliente && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <IdentificationCard size={18} className="text-blue-700" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{cliente.nm_pessoa || cliente.fantasy_name}</p>
                  <p className="text-xs text-gray-500 font-mono">#{cliente.code} · {fmtDoc(cliente.cpf)}</p>
                </div>
              </div>
              {titulos.length > 0 && (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total em aberto</p>
                  <p className="text-lg font-extrabold text-blue-700">{fmtBRL(totalAberto)}</p>
                </div>
              )}
            </div>

            {carregandoTitulos ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <Spinner size={18} className="animate-spin" />
                <span className="text-sm">Buscando títulos...</span>
              </div>
            ) : erroTitulos ? (
              <div className="text-center py-10 text-gray-500 text-sm flex flex-col items-center gap-2">
                <Warning size={28} className="text-amber-500" weight="duotone" />
                {erroTitulos}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b">
                      <th className="py-2.5 px-3">Título / Parcela</th>
                      <th className="py-2.5 px-3"><CalendarBlank size={11} className="inline mr-1" />Vencimento</th>
                      <th className="py-2.5 px-3 text-right"><CurrencyDollar size={11} className="inline mr-0.5" />Valor</th>
                      <th className="py-2.5 px-3 text-right">Atraso</th>
                      <th className="py-2.5 px-3">Linha Digitável</th>
                      <th className="py-2.5 px-3 text-center">Boleto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulos.map((t) => {
                      const key = `${t.receivableCode}-${t.installmentCode}`;
                      const atrasado = Number(t.diasAtraso) > 0;
                      return (
                        <tr key={key} className="border-b border-gray-100 hover:bg-blue-50/30">
                          <td className="py-2 px-3 font-mono text-xs text-gray-700">
                            {t.receivableCode}/{t.installmentCode}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-700">{fmtData(t.vencimento)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-800">{fmtBRL(t.valor)}</td>
                          <td className={`py-2 px-3 text-right tabular-nums text-xs font-bold ${atrasado ? 'text-rose-600' : 'text-gray-400'}`}>
                            {atrasado ? `${t.diasAtraso}d` : '—'}
                          </td>
                          <td className="py-2 px-3">
                            {t.linhaDigitavel ? (
                              <button
                                onClick={() => copiarLinha(t.linhaDigitavel, key)}
                                title="Copiar linha digitável"
                                className="flex items-center gap-1 text-xs font-mono text-gray-600 hover:text-blue-700 max-w-[240px] truncate"
                              >
                                <Copy size={12} className="shrink-0" />
                                {copiado === key ? <span className="text-emerald-600 font-bold">Copiado!</span> : <span className="truncate">{t.linhaDigitavel}</span>}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => abrirBoleto(t)}
                              disabled={boletoLoadingKey === key}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
                            >
                              {boletoLoadingKey === key ? <Spinner size={12} className="animate-spin" /> : <FileArrowDown size={12} weight="bold" />}
                              Boleto
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
