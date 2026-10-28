// Balanço RFID — arquivos salvos pelo app Android (coletor Urovo + pistola).
// Cada contagem finalizada no app vira um "ARQUIVO BALANÇO LOJA X DATA HORA".
// Detalhe: resumo por produto (EPC SGTIN-96 → EAN → produto TOTVS), lista de
// EPCs e exportação em CSV.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Broadcast,
  ArrowsClockwise,
  Spinner,
  X,
  DownloadSimple,
  ListMagnifyingGlass,
  Package,
  Warning,
  MagnifyingGlass,
  DeviceMobile,
  Lock,
  Key,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';

const URL_APK = 'https://dorztqiunewggydvkjnf.supabase.co/storage/v1/object/public/pdv-updates/balanco-rfid/Balanco-RFID.apk';
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : '—');
const fmtDur = (s) => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};
const isoDia = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Recife' });
const inputCls = 'h-9 px-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

// salva a resposta CSV como arquivo (nome vem do Content-Disposition)
async function salvarResposta(r, nomePadrao) {
  const cd = r.headers.get('content-disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const nome = m ? decodeURIComponent(m[1]) : nomePadrao;
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Card({ label, valor, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-[#000638]">{valor}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

export default function BalancoRfidArquivos() {
  const { user } = useAuth();
  const [lojas, setLojas] = useState([]);
  const [empresa, setEmpresa] = useState('');
  const [de, setDe] = useState(() => isoDia(new Date(Date.now() - 30 * 86400000)));
  const [ate, setAte] = useState(() => isoDia(new Date()));
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState(null);

  const [aberto, setAberto] = useState(null); // arquivo completo
  const [abrindo, setAbrindo] = useState(false);
  const [aba, setAba] = useState('produtos');
  const [produtos, setProdutos] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [filtroEpc, setFiltroEpc] = useState('');
  // download bloqueado (passou de 48 h): pede e-mail + senha de gerente/admin/owner
  const [liberar, setLiberar] = useState(null); // { arquivo, tipo }
  const [credEmail, setCredEmail] = useState('');
  const [credSenha, setCredSenha] = useState('');
  const [liberando, setLiberando] = useState(false);
  const [erroLiberar, setErroLiberar] = useState(null);
  const [baixando, setBaixando] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/totvs/branches`)
      .then((r) => r.json())
      .then((j) => setLojas((j?.data?.data || []).filter((b) => b.cd_empresa)))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setAviso(null);
    try {
      const qs = new URLSearchParams({ de, ate });
      if (empresa) qs.set('empresa', empresa);
      if (busca.trim()) qs.set('busca', busca.trim());
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid?${qs}`);
      const j = await r.json();
      if (!r.ok || !j.success) {
        if (j?.error === 'MIGRATION_PENDING') {
          setAviso(j.message);
          setItens([]);
          return;
        }
        throw new Error(j?.message || 'Falha ao carregar');
      }
      setItens(j.data.items || []);
      setResumo(j.data.resumo || null);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setLoading(false);
    }
  }, [de, ate, empresa, busca]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, empresa]);

  const abrir = async (a) => {
    setAbrindo(true);
    setAberto({ ...a, epcs: null });
    setProdutos(null);
    setAba('produtos');
    setFiltroEpc('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid/${a.id}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir');
      setAberto(j.data);
      if (j.data.resumo_produtos) setProdutos(j.data.resumo_produtos);
    } catch (e) {
      setAviso(e.message);
      setAberto(null);
    } finally {
      setAbrindo(false);
    }
  };

  const gerarResumo = async (forcar = false) => {
    if (!aberto) return;
    setGerando(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid/${aberto.id}/resumo${forcar ? '?forcar=1' : ''}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha no resumo');
      setProdutos(j.data.itens || []);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setGerando(false);
    }
  };

  useEffect(() => {
    if (aberto?.id && aberto.epcs && !produtos && aba === 'produtos' && !gerando) gerarResumo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto?.id, aberto?.epcs, aba]);

  const epcsFiltrados = useMemo(() => {
    const l = aberto?.epcs || [];
    const f = filtroEpc.trim().toUpperCase();
    return (f ? l.filter((e) => e.includes(f)) : l).slice(0, 2000);
  }, [aberto?.epcs, filtroEpc]);

  const baixar = async (a, tipo = 'epcs') => {
    if (!a.download_liberado) {
      setLiberar({ arquivo: a, tipo });
      setErroLiberar(null);
      return;
    }
    setBaixando(`${a.id}-${tipo}`);
    try {
      const qs = new URLSearchParams({ tipo, por: user?.email || user?.name || '' });
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid/${a.id}/csv?${qs}`);
      if (r.status === 403) {
        setLiberar({ arquivo: { ...a, download_liberado: false }, tipo });
        setErroLiberar(null);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${r.status}`);
      }
      await salvarResposta(r, `${a.nome}.csv`);
      carregar();
    } catch (e) {
      setAviso(e.message);
    } finally {
      setBaixando(null);
    }
  };

  const confirmarLiberacao = async () => {
    if (!liberar) return;
    setLiberando(true);
    setErroLiberar(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid/${liberar.arquivo.id}/csv-autorizado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credEmail, senha: credSenha, tipo: liberar.tipo, por: user?.email || user?.name || null }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${r.status}`);
      }
      await salvarResposta(r, `${liberar.arquivo.nome}.csv`);
      setLiberar(null);
      setCredSenha('');
      carregar();
    } catch (e) {
      setErroLiberar(e.message);
    } finally {
      setLiberando(false);
    }
  };

  const semProduto = (produtos || []).filter((p) => !p.nome || p.ean === null).reduce((s, p) => s + p.qtd, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-6xl mx-auto">
        <PageTitle title="Balanço RFID" subtitle="Arquivos de contagem feitos no app Android (coletor Urovo + pistola RFID)" icon={Broadcast} />

        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 ring-1 ring-blue-200 px-3 py-2 text-xs text-[#000638]">
          <DeviceMobile size={16} weight="bold" />
          <span className="flex-1 min-w-[220px]">
            No coletor: instale o app, entre com o seu usuário do HeadCoach, escolha a loja e use <b>INICIAR → PAUSAR → FINALIZAR</b>. Cada contagem aparece aqui.
          </span>
          <a href={URL_APK} className="h-8 px-3 rounded-lg bg-[#000638] text-white font-bold inline-flex items-center gap-1.5">
            <DownloadSimple size={13} weight="bold" /> Baixar app (APK)
          </a>
        </div>

        {resumo && (
          <div className="mb-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card label="Arquivos" valor={resumo.arquivos} />
            <Card label="Peças contadas" valor={resumo.pecas.toLocaleString('pt-BR')} sub="soma dos arquivos" />
          </div>
        )}

        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Loja</label>
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={`${inputCls} w-auto max-w-[260px]`}>
              <option value="">Todas</option>
              {lojas.map((l) => (
                <option key={l.cd_empresa} value={l.cd_empresa}>
                  {l.cd_empresa} — {l.nm_grupoempresa}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar()} placeholder="Buscar pelo nome do arquivo…" className={`${inputCls} w-full pl-8`} />
          </div>
          <button onClick={carregar} className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5">
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        {aviso && (
          <p className="mb-2 text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200 flex items-start gap-1.5">
            <Warning size={14} weight="bold" className="shrink-0 mt-0.5" /> {aviso}
          </p>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Arquivo</th>
                  <th className="px-2 py-2 text-left">Setor</th>
                  <th className="px-2 py-2 text-left">Usuário</th>
                  <th className="px-2 py-2 text-left">Finalizado em</th>
                  <th className="px-2 py-2 text-right">Duração</th>
                  <th className="px-2 py-2 text-right">Peças</th>
                  <th className="px-2 py-2 text-right">Leituras</th>
                  <th className="px-2 py-2 text-left">Download</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && itens.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">
                      <Spinner size={20} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {!loading && itens.length === 0 && !aviso && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400">
                      <Package size={26} className="mx-auto mb-1.5 text-gray-300" />
                      Nenhum balanço no período.
                    </td>
                  </tr>
                )}
                {itens.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60">
                    <td className="px-3 py-1.5 font-semibold text-[#000638]">{a.nome}</td>
                    <td className="px-2 py-1.5">
                      {a.setor ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-[10px] font-bold">{a.setor}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-[180px]">{a.usuario_nome || a.usuario_email || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(a.finalizado_em)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtDur(a.duracao_seg)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[#000638]">{a.qtd_epcs.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{a.qtd_leituras.toLocaleString('pt-BR')}</td>
                    <td
                      className="px-2 py-1.5 whitespace-nowrap"
                      title={(a.downloads || [])
                        .map((d) => `${fmtDataHora(d.em)} · ${d.por || '?'}${d.liberadoPor ? ` (liberado por ${d.liberadoPor})` : ''}`)
                        .join('\n')}
                    >
                      {a.download_liberado ? (
                        <span className="text-emerald-700">até {fmtDataHora(a.download_ate).slice(0, 17)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold">
                          <Lock size={11} weight="bold" /> expirado
                        </span>
                      )}
                      {(a.downloads || []).length > 0 && (
                        <span className="ml-1 inline-flex px-1.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-bold">
                          baixado {a.downloads.length}×
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">
                      <button onClick={() => abrir(a)} className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1">
                        <ListMagnifyingGlass size={12} weight="bold" /> detalhar
                      </button>
                      <button
                        onClick={() => baixar(a, 'epcs')}
                        disabled={baixando === `${a.id}-epcs`}
                        className={`ml-1 p-1 inline-flex rounded hover:bg-gray-100 ${a.download_liberado ? 'text-[#000638]' : 'text-rose-600'}`}
                        title={a.download_liberado ? 'Baixar EPCs (CSV)' : 'Passou de 48 h — precisa da senha de um gerente, admin ou owner'}
                      >
                        {baixando === `${a.id}-epcs` ? <Spinner size={14} className="animate-spin" /> : a.download_liberado ? <DownloadSimple size={14} /> : <Lock size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-5 max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-base font-bold text-[#000638]">
                  {aberto.nome}
                  {aberto.setor && <span className="ml-2 align-middle inline-flex px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-[11px] font-bold">SETOR {aberto.setor}</span>}
                </h3>
                <p className="text-xs text-gray-500">
                  {aberto.usuario_nome || aberto.usuario_email || 'sem usuário'} · início {fmtDataHora(aberto.iniciado_em)} · fim {fmtDataHora(aberto.finalizado_em)} · {fmtDur(aberto.duracao_seg)}
                  {aberto.dispositivo?.modelo ? ` · ${aberto.dispositivo.modelo}` : ''}
                  {aberto.dispositivo?.potencia ? ` · ${aberto.dispositivo.potencia} dBm` : ''}
                </p>
              </div>
              <button onClick={() => setAberto(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <Card label="Peças (EPCs únicos)" valor={aberto.qtd_epcs.toLocaleString('pt-BR')} />
              <Card label="Produtos distintos" valor={produtos ? produtos.filter((p) => p.ean).length.toLocaleString('pt-BR') : '…'} />
              <Card label="Sem produto no TOTVS" valor={produtos ? semProduto.toLocaleString('pt-BR') : '…'} sub="EAN não cadastrado ou EPC fora do padrão" />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                {[
                  { id: 'produtos', label: 'Por produto' },
                  { id: 'epcs', label: 'EPCs' },
                ].map((t) => (
                  <button key={t.id} onClick={() => setAba(t.id)} className={`h-8 px-3 rounded-md text-xs font-bold ${aba === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-white'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {aba === 'produtos' && (
                <>
                  <button onClick={() => gerarResumo(true)} disabled={gerando} className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1">
                    <ArrowsClockwise size={12} className={gerando ? 'animate-spin' : ''} /> refazer com o TOTVS
                  </button>
                  <button onClick={() => baixar(aberto, 'produtos')} className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold text-white inline-flex items-center gap-1 ${aberto.download_liberado ? 'bg-[#000638]' : 'bg-rose-600'}`}>
                    {aberto.download_liberado ? <DownloadSimple size={12} /> : <Lock size={12} />} CSV por produto
                  </button>
                </>
              )}
              {aba === 'epcs' && (
                <>
                  <input value={filtroEpc} onChange={(e) => setFiltroEpc(e.target.value)} placeholder="Filtrar EPC…" className={`${inputCls} h-8 w-56 font-mono text-xs`} />
                  <button onClick={() => baixar(aberto, 'epcs')} className={`h-8 px-2.5 rounded-lg text-[11px] font-semibold text-white inline-flex items-center gap-1 ${aberto.download_liberado ? 'bg-[#000638]' : 'bg-rose-600'}`}>
                    {aberto.download_liberado ? <DownloadSimple size={12} /> : <Lock size={12} />} CSV dos EPCs
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-[14rem] rounded-xl ring-1 ring-gray-200">
              {abrindo || (aba === 'produtos' && gerando && !produtos) ? (
                <p className="py-10 text-center text-xs text-gray-400">
                  <Spinner size={20} className="animate-spin mx-auto mb-1.5" />
                  {abrindo ? 'Abrindo o arquivo…' : 'Agrupando as peças por produto no TOTVS…'}
                </p>
              ) : aba === 'produtos' ? (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">EAN</th>
                      <th className="px-2 py-1.5 text-left">Produto</th>
                      <th className="px-2 py-1.5 text-left">Cód.</th>
                      <th className="px-2 py-1.5 text-right">Peças</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(produtos || []).map((p, i) => (
                      <tr key={`${p.ean}-${i}`} className={!p.nome || p.ean === null ? 'bg-amber-50/60' : ''}>
                        <td className="px-2 py-1 font-mono">{p.ean || '—'}</td>
                        <td className="px-2 py-1">
                          {p.nome || <span className="text-amber-700">não encontrado no TOTVS</span>}
                          {p.referencia && <span className="text-gray-400"> · {p.referencia}</span>}
                        </td>
                        <td className="px-2 py-1 tabular-nums">{p.productCode || '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-bold">{p.qtd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 font-mono text-[11px] text-gray-700">
                  {epcsFiltrados.map((e) => (
                    <span key={e} className="truncate">
                      {e}
                    </span>
                  ))}
                  {(aberto.epcs || []).length > 2000 && !filtroEpc && (
                    <p className="col-span-full text-gray-400 py-2">Mostrando 2.000 de {aberto.epcs.length.toLocaleString('pt-BR')} — baixe o CSV para ver todos.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {liberar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => !liberando && setLiberar(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmarLiberacao();
            }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Key size={20} weight="bold" className="text-rose-600" />
              <h3 className="text-base font-bold text-[#000638]">Liberar download</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              <b>{liberar.arquivo.nome}</b> passou de 48 h. Para evitar importar o mesmo balanço duas vezes no TOTVS, só um gerente, admin ou owner libera — com o
              e-mail e a senha dele no HeadCoach.
              {(liberar.arquivo.downloads || []).length > 0 && (
                <span className="block mt-1 text-amber-700 font-semibold">
                  Já foi baixado {liberar.arquivo.downloads.length}× (último em {fmtDataHora(liberar.arquivo.downloads[liberar.arquivo.downloads.length - 1].em)}).
                </span>
              )}
            </p>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">E-mail do gerente / admin / owner</label>
            <input type="email" autoFocus value={credEmail} onChange={(e) => setCredEmail(e.target.value)} className={`${inputCls} w-full mb-2`} autoComplete="off" />
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Senha</label>
            <input type="password" value={credSenha} onChange={(e) => setCredSenha(e.target.value)} className={`${inputCls} w-full`} autoComplete="new-password" />
            {erroLiberar && <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200">{erroLiberar}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setLiberar(null)} disabled={liberando} className="h-10 rounded-lg ring-1 ring-gray-300 text-xs font-semibold text-gray-600">
                Cancelar
              </button>
              <button type="submit" disabled={liberando || !credEmail || !credSenha} className="h-10 rounded-lg bg-[#000638] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                {liberando ? <Spinner size={14} className="animate-spin" /> : <DownloadSimple size={14} weight="bold" />} Liberar e baixar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
