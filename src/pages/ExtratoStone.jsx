// Página: Financeiro → Extrato Stone (OFX → CNAB 240)
// A Stone só exporta o extrato da conta em OFX pelo app. Aqui o usuário sobe
// o OFX, vê o extrato classificado (cartão, PIX, tarifa, pagamento…) e baixa
// o CNAB 240 FEBRABAN (extrato p/ conciliação) para importar no TOTVS.
// Backend: /api/extrato-stone (routes/extratoStone.routes.js).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import {
  Bank,
  UploadSimple,
  FileArrowDown,
  Warning,
  Info,
  X,
  ArrowsClockwise,
  Buildings,
  MagnifyingGlass,
  CreditCard,
  ArrowsLeftRight,
  Receipt,
  Export,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const API = `${API_BASE_URL}/api/extrato-stone`;

const fmt = (v) =>
  v != null && !Number.isNaN(Number(v))
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtCnpj = (c) =>
  String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

const GRUPOS = {
  cartao: { label: 'Cartão', cor: 'bg-blue-100 text-blue-800 border-blue-300', icon: CreditCard },
  antecipacao: { label: 'Antecipação', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: CreditCard },
  pix: { label: 'PIX', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: ArrowsLeftRight },
  transferencia: { label: 'TED/DOC', cor: 'bg-teal-100 text-teal-800 border-teal-300', icon: ArrowsLeftRight },
  boleto: { label: 'Boleto', cor: 'bg-violet-100 text-violet-800 border-violet-300', icon: Receipt },
  pagamento: { label: 'Pagamento', cor: 'bg-orange-100 text-orange-800 border-orange-300', icon: Receipt },
  tarifa: { label: 'Tarifa', cor: 'bg-red-100 text-red-800 border-red-300', icon: Receipt },
  outros: { label: 'Outros', cor: 'bg-gray-100 text-gray-700 border-gray-300', icon: Receipt },
};

const Kpi = ({ label, value, sub, tone = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-base md:text-xl font-bold mt-0.5 ${tone}`}>{value}</p>
    {sub && <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const ExtratoStone = () => {
  const inputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [empresaCod, setEmpresaCod] = useState('');
  const [nomeBanco, setNomeBanco] = useState('STONE PAGAMENTOS');

  const [lendo, setLendo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [extrato, setExtrato] = useState(null);
  const [cnab, setCnab] = useState(null);

  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [filtroNatureza, setFiltroNatureza] = useState('todas');
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('lancamentos');

  // empresas do TOTVS (para escolher o titular da conta Stone)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/empresas`);
        const j = await r.json();
        if (j?.success) setEmpresas(j.data || []);
      } catch (e) {
        console.error('empresas TOTVS:', e);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem('extratoStone.empresa');
      if (salvo) setEmpresaCod(salvo);
    } catch {
      /* ignore */
    }
  }, []);

  const empresa = empresas.find((e) => String(e.codigo) === String(empresaCod)) || null;

  // PDF traz o titular: pré-seleciona a empresa do TOTVS com o mesmo CNPJ
  const titular = extrato?.titular || null;
  const empresaDoTitular = useMemo(
    () => (titular?.cnpj ? empresas.find((e) => e.cnpj === titular.cnpj) || null : null),
    [titular, empresas],
  );
  useEffect(() => {
    if (empresaDoTitular) setEmpresaCod(String(empresaDoTitular.codigo));
  }, [empresaDoTitular]);
  const cnpjDivergente =
    !!(titular?.cnpj && empresa && empresa.cnpj !== titular.cnpj);

  // ─── leitura do OFX ────────────────────────────────────────
  const lerArquivo = async (file) => {
    if (!file) return;
    setArquivo(file);
    setErro(null);
    setCnab(null);
    setLendo(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await fetch(`${API}/ler`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Não foi possível ler o arquivo.');
      setExtrato(j.data);
      setAba('lancamentos');
    } catch (e) {
      setErro(e.message);
      setExtrato(null);
    } finally {
      setLendo(false);
    }
  };

  const onDrop = (ev) => {
    ev.preventDefault();
    setArrastando(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) lerArquivo(f);
  };

  // ─── geração do CNAB ───────────────────────────────────────
  const gerarCnab = async () => {
    if (!arquivo) return setErro('Envie o PDF ou OFX primeiro.');
    // OFX não traz o titular: a empresa é obrigatória. No PDF, se nada for
    // escolhido, o backend usa o titular impresso no próprio extrato.
    if (!empresa && !titular?.cnpj)
      return setErro('Escolha a empresa titular da conta Stone (é ela que o TOTVS usa na conciliação).');
    setGerando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      if (empresa) {
        fd.append('cnpj', empresa.cnpj);
        fd.append('empresa', empresa.nome);
      }
      if (nomeBanco) fd.append('nomeBanco', nomeBanco);
      const r = await fetch(`${API}/converter`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao gerar o CNAB 240.');
      setCnab(j.data.cnab);
      setAba('cnab');
      try {
        if (empresa) localStorage.setItem('extratoStone.empresa', String(empresa.codigo));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  };

  const baixarCnab = () => {
    if (!cnab) return;
    // latin1 puro: o conteúdo já é ASCII, então o Blob em texto simples basta
    saveAs(new Blob([cnab.conteudo], { type: 'text/plain;charset=latin1' }), cnab.nomeArquivo);
  };

  const exportarExcel = () => {
    if (!extrato) return;
    const rows = extrato.lancamentos.map((l) => ({
      Data: l.data,
      Hora: l.hora,
      Tipo: l.natureza === 'C' ? 'Crédito' : 'Débito',
      Grupo: GRUPOS[l.grupo]?.label || l.grupo,
      Histórico: l.descricao,
      Contraparte: l.contraparte || '',
      Bandeira: l.bandeira || '',
      Valor: l.valor,
      'Memo Stone': l.memo,
      Categoria: l.categoria,
      'Cód. histórico': l.historico,
      FITID: l.fitid,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Extrato Stone');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        extrato.dias.map((d) => ({ Data: d.data, Lançamentos: d.qtd, Créditos: d.creditos, Débitos: d.debitos, Saldo: d.saldo })),
      ),
      'Por dia',
    );
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `extrato_stone_${extrato.periodo.inicio}_${extrato.periodo.fim}.xlsx`);
  };

  // ─── filtros ───────────────────────────────────────────────
  const lancamentos = useMemo(() => {
    if (!extrato) return [];
    const q = busca.trim().toLowerCase();
    return extrato.lancamentos.filter((l) => {
      if (filtroGrupo !== 'todos' && l.grupo !== filtroGrupo) return false;
      if (filtroNatureza === 'C' && l.natureza !== 'C') return false;
      if (filtroNatureza === 'D' && l.natureza !== 'D') return false;
      if (q && !`${l.memo} ${l.descricao} ${l.contraparte || ''} ${l.valor}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [extrato, filtroGrupo, filtroNatureza, busca]);

  const totalFiltro = useMemo(
    () => ({
      c: +lancamentos.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0).toFixed(2),
      d: +lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s - l.valor, 0).toFixed(2),
    }),
    [lancamentos],
  );

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle
        title="Extrato Stone"
        subtitle="Suba o OFX exportado do app da Stone, confira a movimentação da conta e gere o CNAB 240 para importar no TOTVS"
        icon={Bank}
      />

      {/* Upload + empresa */}
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`md:col-span-2 cursor-pointer rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition-colors ${
            arrastando ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.ofx,.qfx,.txt,.xml"
            className="hidden"
            onChange={(e) => lerArquivo(e.target.files?.[0])}
          />
          {lendo ? (
            <ArrowsClockwise size={28} className="animate-spin text-blue-600 mb-2" />
          ) : (
            <UploadSimple size={28} className="text-blue-600 mb-2" />
          )}
          <p className="text-sm font-medium text-gray-700">
            {arquivo ? arquivo.name : 'Arraste o PDF "Comprovante de Extrato" (ou o OFX) aqui, ou clique para escolher'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            No app da Stone: Extrato › Exportar. Prefira o <strong>PDF</strong>: é o único que traz nome, CNPJ e conta do
            titular. O arquivo é lido só no servidor do HeadCoach.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 flex flex-col gap-2.5">
          <label className="block text-xs font-medium text-gray-500 flex items-center gap-1">
            <Buildings size={13} /> Empresa titular da conta (TOTVS)
          </label>
          {titular && (
            <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${cnpjDivergente ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <p className="font-semibold">Titular no PDF: {titular.nome}</p>
              <p>
                CNPJ {fmtCnpj(titular.cnpj)} · ag {titular.agencia} · cc {titular.conta}-{titular.contaDv}
              </p>
              {empresaDoTitular ? (
                <p className="mt-0.5">
                  TOTVS: empresa {empresaDoTitular.codigo} · {empresaDoTitular.nome}
                </p>
              ) : (
                <p className="mt-0.5 text-amber-700">Nenhuma empresa do TOTVS com este CNPJ. Escolha abaixo.</p>
              )}
              {cnpjDivergente && <p className="mt-0.5 font-semibold">Atenção: a empresa escolhida tem CNPJ diferente do titular do extrato.</p>}
            </div>
          )}
          <select
            value={empresaCod}
            onChange={(e) => setEmpresaCod(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{empresas.length ? 'Selecione…' : 'Carregando empresas…'}</option>
            {empresas.map((e) => (
              <option key={`${e.codigo}-${e.cnpj}`} value={e.codigo}>
                {e.codigo} · {e.nome} — {fmtCnpj(e.cnpj)}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-gray-500 mt-1">Nome do banco no arquivo</label>
          <input
            value={nomeBanco}
            onChange={(e) => setNomeBanco(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {extrato?.origem === 'ofx' && (
            <p className="text-[11px] text-amber-700">
              O OFX não informa o titular. Escolha a empresa com cuidado, ou use o PDF.
            </p>
          )}
          <button
            onClick={gerarCnab}
            disabled={!extrato || gerando}
            className="mt-auto flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {gerando ? <ArrowsClockwise size={16} className="animate-spin" /> : <FileArrowDown size={16} weight="bold" />}
            Gerar CNAB 240
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-800">
        <Info size={18} className="shrink-0 mt-0.5" />
        <span>
          O CNAB sai no layout FEBRABAN de <strong>extrato para conciliação</strong> (lote 04, segmento E), o mesmo do arquivo
          do Sicredi que o TOTVS já importa. Banco 197 (Stone), agência e conta vêm do próprio OFX; CNPJ e razão social vêm da
          empresa escolhida acima. O saldo inicial é calculado a partir do saldo final informado pela Stone.
        </span>
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {extrato?.avisos?.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Warning size={16} className="shrink-0 mt-0.5" />
          <span>{extrato.avisos.join(' · ')}</span>
        </div>
      )}
      {extrato?.conferencia && extrato.conferencia.inconsistencias === 0 && (
        <div className="px-4 py-2 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          Saldo corrente conferido lançamento a lançamento: {extrato.qtd} linhas do PDF ({extrato.paginas} páginas) fecham com a
          coluna SALDO da Stone.
        </div>
      )}

      {extrato && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 md:gap-3 mb-4">
            <Kpi label="Conta" value={`${extrato.conta.numero}-${extrato.conta.dv}`} sub={`Banco ${extrato.banco.codigo} · ag ${extrato.conta.agencia}`} />
            <Kpi label="Período" value={`${fmtData(extrato.periodo.inicio)} a ${fmtData(extrato.periodo.fim)}`} sub={`${extrato.qtd} lançamentos`} />
            <Kpi label="Saldo inicial" value={fmt(extrato.saldo.inicial)} sub={`antes de ${fmtData(extrato.periodo.inicio)}`} />
            <Kpi label="Créditos" value={fmt(extrato.saldo.totalCreditos)} tone="text-green-600" />
            <Kpi label="Débitos" value={fmt(extrato.saldo.totalDebitos)} tone="text-red-600" />
            <Kpi label="Saldo final" value={fmt(extrato.saldo.final)} sub={`em ${fmtData(extrato.saldo.finalEm)} (Stone)`} tone="text-blue-700" />
          </div>

          {/* Resumo por grupo */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFiltroGrupo('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${filtroGrupo === 'todos' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300'}`}
            >
              Todos ({extrato.qtd})
            </button>
            {extrato.porGrupo.map((g) => {
              const cfg = GRUPOS[g.grupo] || GRUPOS.outros;
              const ativo = filtroGrupo === g.grupo;
              return (
                <button
                  key={g.grupo}
                  onClick={() => setFiltroGrupo(ativo ? 'todos' : g.grupo)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${ativo ? 'ring-2 ring-offset-1 ring-blue-400' : ''} ${cfg.cor}`}
                  title={`Créditos ${fmt(g.creditos)} · Débitos ${fmt(g.debitos)}`}
                >
                  {cfg.label} ({g.qtd}) {g.creditos ? `+${fmt(g.creditos)}` : ''} {g.debitos ? `−${fmt(g.debitos)}` : ''}
                </button>
              );
            })}
          </div>

          {/* Abas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
              {[
                { id: 'lancamentos', label: `Lançamentos (${lancamentos.length})` },
                { id: 'dias', label: `Por dia (${extrato.dias.length})` },
                { id: 'cnab', label: cnab ? `CNAB 240 (${cnab.linhas} linhas)` : 'CNAB 240' },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg ${aba === a.id ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {a.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                {aba === 'lancamentos' && (
                  <>
                    <select
                      value={filtroNatureza}
                      onChange={(e) => setFiltroNatureza(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="todas">Créditos e débitos</option>
                      <option value="C">Só créditos</option>
                      <option value="D">Só débitos</option>
                    </select>
                    <div className="relative">
                      <MagnifyingGlass size={13} className="absolute left-2 top-2 text-gray-400" />
                      <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar nome, valor…"
                        className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg w-44"
                      />
                    </div>
                  </>
                )}
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Export size={14} /> Excel
                </button>
                {cnab && (
                  <button
                    onClick={baixarCnab}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FileArrowDown size={14} /> Baixar CNAB
                  </button>
                )}
              </div>
            </div>

            {aba === 'lancamentos' && (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                        <th className="px-3 py-2 text-left font-semibold">Data</th>
                        <th className="px-3 py-2 text-left font-semibold">Grupo</th>
                        <th className="px-3 py-2 text-left font-semibold">Histórico</th>
                        <th className="px-3 py-2 text-left font-semibold">Contraparte / detalhe</th>
                        <th className="px-3 py-2 text-left font-semibold">Memo Stone</th>
                        <th className="px-3 py-2 text-right font-semibold">Crédito</th>
                        <th className="px-3 py-2 text-right font-semibold">Débito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((l) => {
                        const cfg = GRUPOS[l.grupo] || GRUPOS.outros;
                        return (
                          <tr key={l.fitid || l.seq} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {fmtData(l.data)} <span className="text-gray-400">{l.hora?.slice(0, 5)}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.cor}`}>{cfg.label}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{l.descricao}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                              {l.contraparte || (l.bandeira ? `${l.bandeira} · ${l.tipoCartao}` : '—')}
                            </td>
                            <td className="px-3 py-2 text-gray-400 max-w-[280px] truncate" title={l.memo}>
                              {l.memo}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700 whitespace-nowrap">{l.valor > 0 ? fmt(l.valor) : ''}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-600 whitespace-nowrap">{l.valor < 0 ? fmt(-l.valor) : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 text-xs font-semibold">
                        <td colSpan={5} className="px-3 py-2 text-right text-gray-500">
                          Total do filtro ({lancamentos.length})
                        </td>
                        <td className="px-3 py-2 text-right text-green-700">{fmt(totalFiltro.c)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{fmt(totalFiltro.d)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-gray-100">
                  {lancamentos.map((l) => {
                    const cfg = GRUPOS[l.grupo] || GRUPOS.outros;
                    return (
                      <div key={l.fitid || l.seq} className="p-3">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800">{l.descricao}</p>
                            <p className="text-[11px] text-gray-500 truncate">{l.contraparte || l.memo}</p>
                          </div>
                          <p className={`text-sm font-bold whitespace-nowrap ${l.valor < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {l.valor < 0 ? '−' : '+'}
                            {fmt(Math.abs(l.valor))}
                          </p>
                        </div>
                        <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                          <span>
                            {fmtData(l.data)} {l.hora?.slice(0, 5)}
                          </span>
                          <span className={`px-1.5 rounded-full border ${cfg.cor}`}>{cfg.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {aba === 'dias' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                      <th className="px-3 py-2 text-left font-semibold">Dia</th>
                      <th className="px-3 py-2 text-right font-semibold">Lançamentos</th>
                      <th className="px-3 py-2 text-right font-semibold">Créditos</th>
                      <th className="px-3 py-2 text-right font-semibold">Débitos</th>
                      <th className="px-3 py-2 text-right font-semibold">Saldo do dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extrato.dias.map((d) => (
                      <tr key={d.data} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
                        <td className="px-3 py-2">{fmtData(d.data)}</td>
                        <td className="px-3 py-2 text-right">{d.qtd}</td>
                        <td className="px-3 py-2 text-right text-green-700">{fmt(d.creditos)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{fmt(d.debitos)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${d.saldo < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(d.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {aba === 'cnab' && (
              <div className="p-3">
                {!cnab ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Escolha a empresa titular e clique em <strong>Gerar CNAB 240</strong>.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Arquivo</p>
                        <p className="font-mono font-medium break-all">{cnab.nomeArquivo}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Empresa</p>
                        <p className="font-medium">
                          {cnab.resumo.empresa} · {fmtCnpj(cnab.resumo.cnpj)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Banco / agência / conta</p>
                        <p className="font-medium">
                          {cnab.resumo.banco} / {cnab.resumo.agencia} / {cnab.resumo.conta}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Registros</p>
                        <p className="font-medium">
                          {cnab.resumo.qtdLancamentos} lançamentos · {cnab.resumo.qtdRegistros} linhas · saldo {fmt(cnab.resumo.saldoInicial)} → {fmt(cnab.resumo.saldoFinal)}
                        </p>
                      </div>
                    </div>
                    <pre className="bg-gray-900 text-green-200 text-[11px] leading-4 rounded-lg p-3 overflow-auto max-h-[420px] font-mono whitespace-pre">
                      {cnab.conteudo}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!extrato && !lendo && !erro && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <Bank size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Envie o OFX da Stone para ver o extrato e gerar o CNAB 240.</p>
        </div>
      )}
    </div>
  );
};

export default ExtratoStone;
