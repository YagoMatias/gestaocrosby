// Página: Financeiro → Conciliação → Pró-labore
// Transferências feitas aos sócios (pessoa física) em TODAS as contas do
// grupo, somadas por mês: quanto cada um recebeu, em que banco, com a
// conciliação de cada lançamento (duplicata PROLABORE do Contas a Pagar,
// Liberação, pró-labore automático ou marcado), justificativa e comprovante.
// Os dados vêm de GET /api/fluxo-caixa-ext/pro-labore?de&ate (mesma leitura
// do Extrato Bancário + conciliação); as ações (justificar, anexar, desfazer)
// usam as mesmas rotas da Conciliação.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, Bank, CalendarBlank, MagnifyingGlass, Warning, X } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { PainelProLabore, DetalheConciliacao, uploadAnexo, headersUsuario, API, fmt, fmtDoc, bancoCfg, PESSOAS_PRO_LABORE, MESES, iso, ultimoDia } from './Conciliacao';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const rotuloMes = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${NOMES_MES[m - 1]} ${y}`;
};

const ProLabore = () => {
  const hoje = new Date();
  const [ano] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(MESES[hoje.getMonth()]);
  const [deForm, setDeForm] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const [ateForm, setAteForm] = useState(iso(hoje.getFullYear(), hoje.getMonth() + 1, ultimoDia(hoje.getFullYear(), hoje.getMonth() + 1)));
  const [periodo, setPeriodo] = useState(null); // { de, ate } aplicado
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [filtroPessoa, setFiltroPessoa] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  const escolherMes = (m) => {
    setMes(m);
    if (m === 'ANO') {
      setDeForm(iso(ano, 1, 1));
      setAteForm(iso(ano, 12, 31));
      return;
    }
    const n = MESES.indexOf(m) + 1;
    setDeForm(iso(ano, n, 1));
    setAteForm(iso(ano, n, ultimoDia(ano, n)));
  };
  const buscar = () => {
    if (!deForm || !ateForm) return;
    if (deForm > ateForm) {
      setErro('A data inicial não pode ser maior que a final.');
      return;
    }
    setErro(null);
    setPeriodo({ de: deForm, ate: ateForm });
  };

  const carregar = useCallback(async () => {
    if (!periodo) return;
    setCarregando(true);
    try {
      const r = await fetch(`${API}/pro-labore?${new URLSearchParams(periodo)}`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao buscar o pró-labore.');
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── ações (mesmas rotas da Conciliação) ──
  const apiConc = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...headersUsuario(), ...(opts.headers || {}) } });
    const j = await r.json();
    if (!j?.success) throw new Error(j?.message || 'Falha na conciliação.');
    return j;
  };
  const salvar = async (lancamentoId, origem, referencia, justificativa, pontuacao) => {
    const j = await apiConc(`${API}/conciliacao`, { method: 'POST', body: JSON.stringify({ lancamentoId, origem, referencia, justificativa, pontuacao }) });
    await carregar();
    return j?.data || null;
  };
  const justificar = async (id, justificativa) => {
    await apiConc(`${API}/conciliacao/${id}/justificativa`, { method: 'PATCH', body: JSON.stringify({ justificativa }) });
    await carregar();
  };
  const desfazer = async (id) => {
    await apiConc(`${API}/conciliacao/${id}`, { method: 'DELETE' });
    await carregar();
  };
  const abrirDetalhe = async (l) => {
    if (!l.conciliacao) return;
    let conc = l.conciliacao;
    if (!conc.id && conc.origem === 'PRO_LABORE') {
      try {
        const row = await salvar(l.id, 'PRO_LABORE', { pessoaId: conc.referencia?.pessoaId, cpf: conc.referencia?.cpf }, null, null);
        if (row?.id) conc = { ...conc, id: row.id };
      } catch (e) {
        setErro(e.message);
        return;
      }
    }
    if (!conc.id) {
      setDetalhe({ lancamento: l, carregando: false, dados: null, transferencia: conc });
      return;
    }
    setDetalhe({ lancamento: l, carregando: true, dados: null });
    try {
      const r = await fetch(`${API}/conciliacao/${conc.id}/detalhe`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao carregar o detalhe.');
      setDetalhe({ lancamento: l, carregando: false, dados: j.data });
    } catch (e) {
      setErro(e.message);
      setDetalhe(null);
    }
  };
  const anexar = async (tipo, file) => {
    if (!file || !detalhe?.dados?.conciliacao?.id) return;
    const cid = detalhe.dados.conciliacao.id;
    setDetalhe((d) => ({ ...d, enviando: tipo }));
    try {
      const url = await uploadAnexo(file, `conciliacao/${cid}`);
      const usuario = headersUsuario()['x-user-name'] || null;
      const anexos = [...(detalhe.dados.conciliacao.anexos || []), { tipo, url, nome: file.name, em: new Date().toISOString(), usuario }];
      const j = await apiConc(`${API}/conciliacao/${cid}/anexos`, { method: 'PATCH', body: JSON.stringify({ anexos }) });
      setDetalhe((d) => ({ ...d, enviando: null, dados: { ...d.dados, conciliacao: { ...d.dados.conciliacao, anexos: j.data.anexos } } }));
      carregar();
    } catch (e) {
      setErro(e.message);
      setDetalhe((d) => (d ? { ...d, enviando: null } : d));
    }
  };
  const removerAnexo = async (idx) => {
    const cid = detalhe?.dados?.conciliacao?.id;
    if (!cid) return;
    const anexos = (detalhe.dados.conciliacao.anexos || []).filter((_, i) => i !== idx);
    const j = await apiConc(`${API}/conciliacao/${cid}/anexos`, { method: 'PATCH', body: JSON.stringify({ anexos }) });
    setDetalhe((d) => ({ ...d, dados: { ...d.dados, conciliacao: { ...d.dados.conciliacao, anexos: j.data.anexos } } }));
    carregar();
  };

  // ── agregações ──
  const pessoaDe = (l) => l.proLabore?.pessoaId || l.conciliacao?.referencia?.pessoaId || PESSOAS_PRO_LABORE.find((p) => p.cpf === l.conciliacao?.referencia?.cpf)?.id || null;
  const linhas = useMemo(() => (dados?.lancamentos || []).filter((l) => !filtroPessoa || pessoaDe(l) === filtroPessoa), [dados, filtroPessoa]);
  const todas = dados?.lancamentos || [];
  const totalPessoa = (lista, id) => lista.filter((l) => pessoaDe(l) === id).reduce((s, l) => s + Math.abs(l.valor), 0);
  const meses = useMemo(() => {
    const m = new Map();
    for (const l of linhas) {
      const ym = String(l.data).slice(0, 7);
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym).push(l);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([ym, ls]) => {
      const bancos = new Map();
      for (const l of ls) {
        const k = `${l.banco}|${l.conta_apelido || l.conta_id}`;
        if (!bancos.has(k)) bancos.set(k, { banco: l.banco, apelido: l.conta_apelido || '', titular: l.conta_titular || '', total: 0, porPessoa: {} });
        const b = bancos.get(k);
        b.total += Math.abs(l.valor);
        const pid = pessoaDe(l) || 'outros';
        b.porPessoa[pid] = (b.porPessoa[pid] || 0) + Math.abs(l.valor);
      }
      return { ym, linhas: ls.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)), total: ls.reduce((s, l) => s + Math.abs(l.valor), 0), bancos: [...bancos.values()].sort((a, b) => b.total - a.total) };
    });
  }, [linhas]);

  const chip = (ativo, cor = 'bg-[#000638] text-white') => `px-2.5 py-1.5 text-[0.7rem] font-medium rounded-md transition-colors border ${ativo ? `${cor} border-transparent` : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-300'}`;
  const inp = 'w-full h-9 px-2 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]';
  const lbl = 'block h-4 text-xs font-semibold mb-0.5 text-[#000638] leading-4';

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6 relative">
      <PageTitle title="Pró-labore" subtitle="Transferências aos sócios em todas as contas do grupo, somadas por mês, com conciliação, justificativa e comprovante" icon={Bank} />

      <div className="bg-white rounded-lg shadow-lg border border-[#000638]/10 p-3 md:p-4 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-2.5 items-center">
          <div className="lg:col-span-2">
            <label className={lbl}>
              <CalendarBlank size={12} className="inline mr-1" />De
            </label>
            <input type="date" value={deForm} onChange={(e) => { setDeForm(e.target.value); setMes(null); }} onKeyDown={(e) => e.key === 'Enter' && buscar()} className={inp} />
          </div>
          <div className="lg:col-span-2">
            <label className={lbl}>Até</label>
            <input type="date" value={ateForm} onChange={(e) => { setAteForm(e.target.value); setMes(null); }} onKeyDown={(e) => e.key === 'Enter' && buscar()} className={inp} />
          </div>
          <div className="col-span-2 lg:col-span-6">
            <label className={lbl}>Período ({ano})</label>
            <div className="flex flex-wrap gap-1 min-h-9 items-center">
              <button onClick={() => escolherMes('ANO')} className={`${chip(mes === 'ANO')} px-3`}>ANO</button>
              {MESES.map((m) => (
                <button key={m} onClick={() => escolherMes(m)} className={chip(mes === m)}>{m}</button>
              ))}
            </div>
          </div>
          <div className="col-span-2 lg:col-span-2">
            <label className={lbl} aria-hidden="true">&nbsp;</label>
            <button onClick={buscar} disabled={carregando || !deForm || !ateForm} className="w-full h-9 px-4 text-xs rounded-lg bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-50 flex items-center justify-center gap-1 font-semibold">
              {carregando ? <ArrowsClockwise size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} {carregando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {!dados && !carregando && <p className="text-sm text-gray-400 text-center py-10">Escolha o período e clique em Buscar.</p>}
      {carregando && !dados && <p className="text-sm text-gray-400 text-center py-10">Lendo os extratos de todas as contas…</p>}

      {dados && (
        <>
          {/* totais do período: clique filtra o sócio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <button onClick={() => setFiltroPessoa(null)} className={`text-left rounded-xl border px-4 py-3 ${!filtroPessoa ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-300' : 'border-purple-200 bg-purple-50/60 hover:bg-purple-50'}`}>
              <p className="text-[10px] uppercase tracking-wide text-purple-700">Pró-labore no período · todos os bancos</p>
              <p className="text-2xl font-bold text-purple-900">{fmt(todas.reduce((s, l) => s + Math.abs(l.valor), 0))}</p>
              <p className="text-[11px] text-purple-700">{todas.length} transferência(s) · {meses.length} mês(es)</p>
            </button>
            {PESSOAS_PRO_LABORE.map((p) => (
              <button key={p.id} onClick={() => setFiltroPessoa(filtroPessoa === p.id ? null : p.id)} className={`text-left rounded-xl border px-4 py-3 ${filtroPessoa === p.id ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-300' : 'border-gray-200 bg-white hover:bg-gray-50'}`} title="Clique para ver só este sócio">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.pessoa}</p>
                <p className="text-2xl font-bold text-gray-800">{fmt(totalPessoa(todas, p.id))}</p>
                <p className="text-[11px] text-gray-500">{fmtDoc(p.cpf)} · {todas.filter((l) => pessoaDe(l) === p.id).length} transferência(s)</p>
              </button>
            ))}
          </div>

          {meses.length === 0 && <p className="text-sm text-gray-400 text-center py-10">Nenhuma transferência aos sócios no período.</p>}

          {meses.map((m) => (
            <div key={m.ym} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div className="mr-auto">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Mês</p>
                  <p className="text-base font-bold text-gray-900">{rotuloMes(m.ym)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">Total no mês</p>
                  <p className="text-base font-bold text-purple-900">{fmt(m.total)}</p>
                </div>
                {PESSOAS_PRO_LABORE.filter((p) => !filtroPessoa || filtroPessoa === p.id).map((p) => (
                  <div key={p.id}>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.curto}</p>
                    <p className="text-base font-semibold text-gray-800">{fmt(totalPessoa(m.linhas, p.id))}</p>
                  </div>
                ))}
              </div>
              {/* por banco */}
              <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-2">
                {m.bancos.map((b) => (
                  <div key={`${b.banco}|${b.apelido}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${bancoCfg(b.banco).cor}`}>{bancoCfg(b.banco).label}</span>
                    <span className="ml-1 text-gray-700">{b.apelido}</span>
                    <span className="block text-[10px] text-gray-400 truncate max-w-[220px]">{b.titular}</span>
                    <span className="block font-semibold text-gray-900">{fmt(b.total)}</span>
                    <span className="block text-[10px] text-gray-500">
                      {PESSOAS_PRO_LABORE.filter((p) => b.porPessoa[p.id]).map((p) => `${p.curto} ${fmt(b.porPessoa[p.id])}`).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-4">
                <PainelProLabore linhas={m.linhas} salvar={salvar} justificar={justificar} desfazer={desfazer} setErro={setErro} onDetalhe={abrirDetalhe} semCards filtroExterno={filtroPessoa} />
              </div>
            </div>
          ))}
        </>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-50">
          <DetalheConciliacao detalhe={detalhe} onClose={() => setDetalhe(null)} onAnexar={anexar} onRemoverAnexo={removerAnexo} />
        </div>
      )}
    </div>
  );
};

export default ProLabore;
