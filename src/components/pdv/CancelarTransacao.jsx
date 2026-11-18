// CANCELAMENTO DE TRANSAÇÃO (Yago, 17/11/2026).
// Cancela tudo de uma vez: a nota fiscal na SEFAZ, a transação e os títulos do
// contas a receber. Lista as transações do PDV da empresa no período; ao
// escolher uma, mostra o que ela tem (nota, pagamentos, títulos) e os avisos;
// com o motivo escrito, cancela.
// Usado em dois lugares:
//  • PÁGINA Financeiro › Cancelamento de Transação (variante "pagina"): todas
//    as transações; VENDA atendida acima de R$ 1.000 pede e-mail e senha de
//    alguém do financeiro (o servidor confere).
//  • PDV Crosby (modal, somenteAndamento): só as transações EM ANDAMENTO — sem
//    nota autorizada — que o caixa cancela direto.
// Na página (18/11/2026) entram todos os tipos: PDV Crosby, Faturamento,
// Faturamento Brejinho, Transferência, Devolução (todas são transações do
// HeadCoach, canceladas pela mesma rota) e Entrada de mercadoria (recebimento das
// lojas: estorna o estoque e a transferência volta para "a receber").
// Regra do servidor: com nota autorizada a SEFAZ decide — se ela recusa, nada
// é cancelado. Credev/adiantamento usados voltam para o cliente; o Credev que
// uma troca gerou sai (e a troca só cancela com esse Credev inteiro).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Spinner, ArrowsClockwise, Prohibit, MagnifyingGlass, CheckCircle, XCircle, Warning, LockKey } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { fetchSefaz } from '../../utils/fetchSefaz';
import { apiJson } from '../../utils/apiAuth';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmtHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDia = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const TIPO = { nfce: 'NFC-e', nfe: 'NF-e', troca: 'TROCA' };
const FORMA = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Cartão crédito', debito: 'Cartão débito', credito_loja: 'Credev', adiantamento: 'Adiantamento', bluecard: 'BlueCard', vale_troca: 'Vale-troca', boleto: 'Boleto', saldo_bonus: 'Saldo bônus' };
const STATUS = {
  registrada: 'bg-gray-100 text-gray-600 ring-gray-200',
  emitindo: 'bg-amber-50 text-amber-700 ring-amber-200',
  autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejeitada: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-200',
};
const SIT_TITULO = { pago: 'text-emerald-700', aberto: 'text-amber-700', cancelado: 'text-gray-400 line-through' };
const JUST_MIN = 15;
// tipos de transação (o servidor devolve v.grupo)
const GRUPOS = [
  { k: 'todas', label: 'Todas as transações' },
  { k: 'pdv', label: 'PDV Crosby' },
  { k: 'faturamento', label: 'Faturamento' },
  { k: 'brejinho', label: 'Faturamento Brejinho' },
  { k: 'transferencia', label: 'Transferência' },
  { k: 'devolucao', label: 'Devolução' },
  { k: 'entrada', label: 'Entrada de mercadoria' },
];
const GRUPO_TAG = {
  pdv: { label: 'PDV', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  faturamento: { label: 'FATURAMENTO', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  brejinho: { label: 'BREJINHO', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  transferencia: { label: 'TRANSFERÊNCIA', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  devolucao: { label: 'DEVOLUÇÃO', cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  entrada: { label: 'ENTRADA', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};
const DA_MATRIZ = ['faturamento', 'brejinho', 'transferencia']; // saem da empresa 99

const EM_ANDAMENTO = (v) => v.status !== 'autorizada' && v.status !== 'cancelada';

export default function CancelarTransacao({ empresa, empresaNome, por, onClose, onCancelada, showToast, variante = 'modal', somenteAndamento = false, empresas = null, onEmpresa = null }) {
  const [de, setDe] = useState(hoje());
  const [ate, setAte] = useState(hoje());
  const [busca, setBusca] = useState('');
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);
  const [selId, setSelId] = useState(null);
  const [previa, setPrevia] = useState(null); // { venda, nota, titulos, avisos, bloqueio, podeCancelar, vaiCancelar }
  const [previaLoading, setPreviaLoading] = useState(false);
  const [just, setJust] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, mensagem, passos }
  const [aut, setAut] = useState({ email: '', senha: '' }); // financeiro que autoriza (venda > R$ 1.000)
  const pagina = variante === 'pagina';
  // na página: todos os tipos; no PDV (modal): só o PDV Crosby
  const [grupo, setGrupo] = useState(pagina ? 'todas' : 'pdv');
  const ehEntrada = grupo === 'entrada';

  const carregar = useCallback(async () => {
    if (!empresa) {
      setLista([]);
      return;
    }
    setLoading(true);
    try {
      if (grupo === 'entrada') {
        const j = await apiJson(`/api/recebimento-mercadoria/entradas?empresa=${empresa}&de=${de}&ate=${ate}`);
        setLista((j.data?.entradas || []).map((x) => ({ ...x, grupo: 'entrada' })));
      } else {
        const filtro = !pagina ? '&origem=pdv' : grupo !== 'todas' ? `&grupo=${grupo}` : '';
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas?empresa=${empresa}&de=${de}&ate=${ate}${filtro}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao listar as transações');
        let itens = j.data?.items || [];
        // devolução com NOTA DO CLIENTE (recebimento FISFP082): fica no registro das Devoluções
        if (pagina && (grupo === 'todas' || grupo === 'devolucao')) {
          const rd = await fetch(`${API_BASE_URL}/api/devolucoes/transacoes?empresa=${empresa}&de=${de}&ate=${ate}`);
          const jd = await rd.json().catch(() => null);
          const nf = (jd?.data?.items || [])
            .filter((d) => d.origem === 'fisfp082')
            .map((d) => ({ ...d, id: `D${d.id}`, trxId: d.id, grupo: 'devolucao_nf', status: Number(d.transacao_status) === 6 ? 'cancelada' : 'autorizada' }));
          itens = [...itens, ...nf].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
        }
        setLista(itens);
      }
    } catch (e) {
      showToast?.('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [empresa, de, ate, showToast, grupo, pagina]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = useCallback(
    async (id) => {
      setSelId(id);
      if (grupo === 'entrada' || String(id).startsWith('D')) {
        setPrevia(null);
        setPreviaLoading(false);
        return;
      }
      setPrevia(null);
      setJust('');
      setConfirmando(false);
      setResultado(null);
      setAut({ email: '', senha: '' });
      setPreviaLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${id}/cancelamento`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir a transação');
        setPrevia(j.data);
      } catch (e) {
        showToast?.('erro', e.message);
        setSelId(null);
      } finally {
        setPreviaLoading(false);
      }
    },
    [showToast, grupo],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((v) => {
      if (v.grupo === 'entrada') {
        if (!mostrarCanceladas && v.canceladoEm && v.id !== selId) return false;
        if (!q) return true;
        return [v.id, v.nf, v.transferenciaId, v.recebidoPor, v.empresaOrigem].some((x) => String(x ?? '').toLowerCase().includes(q));
      }
      if (somenteAndamento && !EM_ANDAMENTO(v) && v.id !== selId) return false;
      if (!mostrarCanceladas && v.status === 'cancelada' && v.id !== selId) return false;
      if (!q) return true;
      return [v.id, v.nota?.numero, v.cliente_nome, v.cliente_code, v.vendedor_nome, v.numero_site].some((x) => String(x ?? '').toLowerCase().includes(q));
    });
  }, [lista, busca, mostrarCanceladas, selId, somenteAndamento]);

  // trocou a empresa ou o tipo: começa do zero
  useEffect(() => {
    setSelId(null);
    setPrevia(null);
    setResultado(null);
  }, [empresa, grupo]);

  const precisaAut = !!previa?.precisaAutorizacao;
  const autOk = !precisaAut || (aut.email.trim().length > 3 && aut.senha.length > 0);
  // no PDV só se cancela o que está em andamento; o resto é na página do Financeiro
  const foraDoPdv = somenteAndamento && previa && !EM_ANDAMENTO(previa.venda) && previa.venda.status !== 'cancelada';

  const cancelar = async () => {
    if (!previa?.podeCancelar || foraDoPdv || just.trim().length < JUST_MIN || !autOk) return;
    setBusy(true);
    try {
      const { r, j } = await fetchSefaz(`${API_BASE_URL}/api/pdv-crosby/vendas/${previa.venda.id}/cancelar-transacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: just.trim(), por: por || null, ...(precisaAut ? { autorizador: { email: aut.email.trim(), senha: aut.senha } } : {}) }),
      });
      if (!r.ok || !j?.success) {
        setResultado({ ok: false, mensagem: j?.message || 'Não foi possível cancelar', passos: j?.details?.passos || [] });
        showToast?.('erro', j?.message || 'Não foi possível cancelar');
        return;
      }
      setResultado({ ok: true, mensagem: j.message || 'Transação cancelada', passos: j.data?.passos || [] });
      setAut({ email: '', senha: '' });
      showToast?.('ok', `Transação nº ${previa.venda.id} cancelada`);
      onCancelada?.(previa.venda.id);
      carregar();
      // recarrega a ficha (agora cancelada), mantendo o resultado na tela
      const rp = await fetch(`${API_BASE_URL}/api/pdv-crosby/vendas/${previa.venda.id}/cancelamento`);
      const jp = await rp.json();
      if (rp.ok && jp.success) setPrevia(jp.data);
    } catch (e) {
      setResultado({ ok: false, mensagem: e.message, passos: [] });
      showToast?.('erro', e.message);
    } finally {
      setBusy(false);
      setConfirmando(false);
    }
  };

  const v = previa?.venda;
  const nota = previa?.nota;
  const titulosAtivos = (previa?.titulos || []).filter((t) => t.situacao !== 'cancelado');

  const entradaSel = ehEntrada ? lista.find((x) => x.id === selId) || null : null;
  const devNfSel = String(selId || '').startsWith('D') ? lista.find((x) => x.id === selId) || null : null;
  const painel = (
      <div className={pagina ? 'bg-white rounded-xl border border-gray-200 shadow-sm w-full h-[calc(100vh-190px)] min-h-[560px] flex flex-col' : 'bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[92vh] flex flex-col'}>
        {/* cabeçalho */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Prohibit size={20} weight="bold" className="text-rose-600" />
          <div className="mr-auto">
            <h3 className="text-base font-bold text-[#000638] leading-tight">{somenteAndamento ? 'Cancelar transação em andamento' : 'Cancelamento de transação'}</h3>
            <p className="text-[11px] text-gray-500">
              {empresa ? `Empresa ${empresa}${empresaNome ? ` — ${empresaNome}` : ''} · ` : ''}
              {somenteAndamento
                ? 'transações que ainda não têm nota autorizada (registrada ou rejeitada). Venda já atendida se cancela em Financeiro › Cancelamento de Transação'
                : 'cancela a nota fiscal, a transação e o contas a receber de uma vez'}
            </p>
          </div>
          {pagina && (
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="h-8 max-w-[14rem] rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-[#000638]"
              title="Tipo de transação"
            >
              {GRUPOS.map((g) => (
                <option key={g.k} value={g.k}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
          {empresas && (
            <select
              value={empresa || ''}
              onChange={(e) => onEmpresa?.(e.target.value)}
              className="h-8 max-w-[16rem] rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-[#000638]"
              title="Empresa"
            >
              <option value="">Empresa…</option>
              {empresas.map((b) => (
                <option key={b.cd_empresa} value={b.cd_empresa}>
                  {b.cd_empresa} — {b.nm_grupoempresa}
                </option>
              ))}
            </select>
          )}
          <label className="text-[11px] text-gray-500">
            De{' '}
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className="ml-1 h-8 px-2 rounded-lg border border-gray-300 text-xs" />
          </label>
          <label className="text-[11px] text-gray-500">
            até{' '}
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className="ml-1 h-8 px-2 rounded-lg border border-gray-300 text-xs" />
          </label>
          <button onClick={carregar} className="h-8 px-2 rounded-lg text-xs ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1">
            <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          {!pagina && (
            <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 disabled:opacity-40" title="Fechar">
              <X size={18} weight="bold" />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* lista */}
          <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nº da transação, nº da nota, cliente ou vendedor"
                  className="w-full h-9 pl-8 pr-2 mb-0 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                />
              </div>
              {!somenteAndamento && (
                <label className="inline-flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} /> ver canceladas
                </label>
              )}
            </div>
            {pagina && DA_MATRIZ.includes(grupo) && String(empresa) !== '99' && (
              <p className="mx-3 mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 ring-1 ring-amber-200">
                {GRUPOS.find((g) => g.k === grupo)?.label} sai da empresa 99 (matriz).
                {(empresas || []).some((b) => String(b.cd_empresa) === '99') && (
                  <button onClick={() => onEmpresa?.('99')} className="ml-1 font-bold underline">
                    Ver a empresa 99
                  </button>
                )}
              </p>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading && lista.length === 0 ? (
                <p className="p-6 text-center text-xs text-gray-400">
                  <Spinner size={16} className="inline animate-spin" /> Carregando…
                </p>
              ) : filtradas.length === 0 ? (
                <p className="p-6 text-center text-xs text-gray-400">
                  {!empresa
                    ? 'Escolha a empresa.'
                    : somenteAndamento
                      ? 'Nenhuma transação em andamento neste período.'
                      : ehEntrada
                        ? 'Nenhuma entrada de mercadoria neste período.'
                        : `Nenhuma transação${grupo !== 'todas' ? ` de ${GRUPOS.find((g) => g.k === grupo)?.label}` : ''} neste período.`}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtradas.map((x) => {
                    const sel = x.id === selId;
                    if (x.grupo === 'entrada') {
                      const canc = !!x.canceladoEm;
                      return (
                        <li key={`e${x.id}`}>
                          <button
                            type="button"
                            onClick={() => abrir(x.id)}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 ${sel ? 'bg-rose-50 border-l-4 border-rose-500' : 'border-l-4 border-transparent hover:bg-gray-50'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-[13px] font-semibold text-[#000638] ${canc ? 'line-through text-gray-400' : ''}`}>
                                <span className={`mr-1 inline-flex px-1.5 rounded text-[9px] font-bold ring-1 align-middle ${GRUPO_TAG.entrada.cls}`}>{GRUPO_TAG.entrada.label}</span>
                                nº {x.id}
                                {x.nf ? ` · NF ${x.nf}` : ''} · de {x.empresaOrigem}
                              </p>
                              <p className="truncate text-[11px] text-gray-500">
                                {fmtHora(x.recebidoEm)} · {x.recebidoPor || '—'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[13px] font-bold tabular-nums ${canc ? 'text-gray-400 line-through' : 'text-[#000638]'}`}>{x.qtdRecebida} pç</p>
                              <span className={`inline-flex px-1.5 rounded-full text-[10px] font-semibold ring-1 ${canc ? STATUS.cancelada : STATUS.autorizada}`}>{canc ? 'cancelada' : 'recebida'}</span>
                            </div>
                          </button>
                        </li>
                      );
                    }
                    if (x.grupo === 'devolucao_nf') {
                      const canc = x.status === 'cancelada';
                      return (
                        <li key={x.id}>
                          <button
                            type="button"
                            onClick={() => abrir(x.id)}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 ${sel ? 'bg-rose-50 border-l-4 border-rose-500' : 'border-l-4 border-transparent hover:bg-gray-50'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`text-[13px] font-semibold text-[#000638] ${canc ? 'line-through text-gray-400' : ''}`}>
                                <span className={`mr-1 inline-flex px-1.5 rounded text-[9px] font-bold ring-1 align-middle ${GRUPO_TAG.devolucao.cls}`}>DEVOLUÇÃO · NF DO CLIENTE</span>
                                nº {x.trxId}
                                {x.nf_numero ? ` · NF ${x.nf_numero}/${x.nf_serie || 1}` : ''}
                              </p>
                              <p className="truncate text-[11px] text-gray-500">
                                {fmtHora(x.criado_em)} · {x.cliente_nome || '—'} · {x.criado_por || '—'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[13px] font-bold tabular-nums ${canc ? 'text-gray-400 line-through' : 'text-purple-700'}`}>{fmtBRL(x.total)}</p>
                              <span className={`inline-flex px-1.5 rounded-full text-[10px] font-semibold ring-1 ${canc ? STATUS.cancelada : STATUS.autorizada}`}>{canc ? 'cancelada' : 'lançada'}</span>
                            </div>
                          </button>
                        </li>
                      );
                    }
                    const cancelada = x.status === 'cancelada';
                    const tag = GRUPO_TAG[x.grupo];
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => abrir(x.id)}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 ${sel ? 'bg-rose-50 border-l-4 border-rose-500' : 'border-l-4 border-transparent hover:bg-gray-50'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-semibold text-[#000638] ${cancelada ? 'line-through text-gray-400' : ''}`}>
                              {pagina && tag && <span className={`mr-1 inline-flex px-1.5 rounded text-[9px] font-bold ring-1 align-middle ${tag.cls}`}>{tag.label}</span>}
                              nº {x.id} · {TIPO[x.tipo_venda] || x.tipo_venda}
                              {x.nota?.numero ? ` ${x.nota.numero}/${x.nota.serie}` : ''}
                            </p>
                            <p className="truncate text-[11px] text-gray-500">
                              {fmtHora(x.criado_em)} · {x.numero_site ? `${x.numero_site} · ` : ''}
                              {x.cliente_nome || 'consumidor'} · {x.vendedor_nome || '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-[13px] font-bold tabular-nums ${cancelada ? 'text-gray-400 line-through' : x.tipo_venda === 'troca' ? 'text-purple-700' : 'text-[#000638]'}`}>{fmtBRL(x.total)}</p>
                            <span className={`inline-flex px-1.5 rounded-full text-[10px] font-semibold ring-1 ${STATUS[x.status] || STATUS.registrada}`}>{x.status}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ficha da transação */}
          <div className="min-h-0 overflow-y-auto p-4">
            {devNfSel ? (
              <FichaDevolucaoNf
                key={devNfSel.id}
                item={devNfSel}
                por={por}
                showToast={showToast}
                onCancelada={() => {
                  onCancelada?.(devNfSel.trxId);
                  carregar();
                }}
              />
            ) : selId && ehEntrada ? (
              entradaSel ? (
                <FichaEntrada
                  key={entradaSel.id}
                  entrada={entradaSel}
                  showToast={showToast}
                  onCancelada={() => {
                    onCancelada?.(entradaSel.id);
                    carregar();
                  }}
                />
              ) : null
            ) : !selId ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                <Prohibit size={36} className="mb-2" />
                <p className="text-sm">Escolha a transação que vai cancelar.</p>
                <p className="mt-1 max-w-sm text-[11px]">
                  {somenteAndamento
                    ? 'Aqui só entram as transações sem nota autorizada: nada vai à SEFAZ, a transação é cancelada na hora.'
                    : 'Com nota autorizada, a SEFAZ precisa aceitar o cancelamento (prazo normal: 30 minutos para NFC-e e 24 horas para NF-e). Se ela recusar, nada é cancelado. Venda atendida acima de R$ 1.000,00 pede a senha do financeiro.'}
                </p>
              </div>
            ) : previaLoading || !previa ? (
              <p className="p-6 text-center text-xs text-gray-400">
                <Spinner size={16} className="inline animate-spin" /> Abrindo a transação…
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-lg font-bold text-[#000638]">Transação nº {v.id}</h4>
                  {GRUPO_TAG[v.grupo] && <span className={`inline-flex px-2 rounded-full text-[10px] font-bold ring-1 ${GRUPO_TAG[v.grupo].cls}`}>{GRUPO_TAG[v.grupo].label}</span>}
                  <span className={`inline-flex px-2 rounded-full text-[11px] font-semibold ring-1 ${STATUS[v.status] || STATUS.registrada}`}>{v.status}</span>
                  <span className="ml-auto text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(v.total)}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {TIPO[v.tipo_venda] || v.tipo_venda} · {fmtHora(v.criado_em)} · {v.qtd_pecas ?? (v.itens || []).reduce((s, i) => s + Number(i.quantidade || 0), 0)} pç · cliente{' '}
                  <b>{v.cliente_nome || 'consumidor'}</b> · vendedor <b>{v.vendedor_nome || '—'}</b>
                  {previa.caixa ? ` · caixa nº ${previa.caixa.id} (${fmtDia(previa.caixa.data_caixa)})` : ''}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* nota */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Nota fiscal</p>
                    {nota ? (
                      <>
                        <p className="text-[13px] font-semibold text-[#000638]">
                          {Number(nota.modelo) === 65 ? 'NFC-e' : 'NF-e'} {nota.numero}/{nota.serie}
                        </p>
                        <p className={`text-[11px] font-semibold ${nota.status === 'autorizada' ? 'text-emerald-700' : nota.status === 'cancelada' ? 'text-gray-400' : 'text-rose-600'}`}>{nota.status}</p>
                        {nota.dh_autorizacao && <p className="text-[11px] text-gray-500">autorizada {fmtHora(nota.dh_autorizacao)}</p>}
                        {nota.cancel_em && <p className="text-[11px] text-gray-500">cancelada {fmtHora(nota.cancel_em)}</p>}
                      </>
                    ) : (
                      <p className="text-[11px] text-gray-500">sem nota</p>
                    )}
                  </div>
                  {/* pagamentos */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Pagamento</p>
                    {(v.pagamentos || []).map((p) => (
                      <p key={p.id} className="flex justify-between text-[12px] text-gray-700">
                        <span>{FORMA[p.forma] || p.forma}</span>
                        <span className="tabular-nums font-semibold">{fmtBRL(Number(p.valor) - Number(p.troco || 0))}</span>
                      </p>
                    ))}
                  </div>
                  {/* contas a receber */}
                  <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Contas a receber</p>
                    {(previa.titulos || []).length === 0 ? (
                      <p className="text-[11px] text-gray-500">sem títulos</p>
                    ) : (
                      previa.titulos.map((t) => (
                        <p key={t.id} className={`flex justify-between text-[12px] ${SIT_TITULO[t.situacao] || 'text-gray-700'}`}>
                          <span>
                            {t.fatura}/{t.parcela} · {FORMA[t.forma] || t.forma}
                          </span>
                          <span className="tabular-nums font-semibold">
                            {fmtBRL(t.valor)} · {t.situacao}
                          </span>
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* peças */}
                <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Peças</p>
                  {(v.itens || []).map((i) => (
                    <p key={i.id} className="flex justify-between gap-2 text-[12px] text-gray-700">
                      <span className="truncate">
                        {i.quantidade}× {i.nome} <span className="text-gray-400">cód. {i.product_code}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{fmtBRL(i.total)}</span>
                    </p>
                  ))}
                </div>

                {/* resultado */}
                {resultado && (
                  <div className={`rounded-xl p-3 ring-1 ${resultado.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
                    <p className={`text-sm font-bold inline-flex items-center gap-1.5 ${resultado.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {resultado.ok ? <CheckCircle size={18} weight="fill" /> : <XCircle size={18} weight="fill" />} {resultado.ok ? 'Transação cancelada' : 'Não cancelou'}
                    </p>
                    {!resultado.ok && <p className="mt-1 text-xs text-rose-700">{resultado.mensagem}</p>}
                    {!resultado.ok && <p className="mt-1 text-[11px] text-rose-700/80">Nada foi cancelado: a nota, a transação e o contas a receber continuam como estavam.</p>}
                    <ul className="mt-1.5 space-y-0.5">
                      {resultado.passos.map((p) => (
                        <li key={p.nome} className={`text-xs inline-flex w-full items-start gap-1 ${p.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {p.ok ? <CheckCircle size={14} weight="fill" className="mt-px shrink-0" /> : <XCircle size={14} weight="fill" className="mt-px shrink-0" />}
                          <span>
                            <b>{p.nome}:</b> {p.detalhe}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* bloqueio / avisos */}
                {previa.bloqueio && !resultado?.ok && (
                  <p className="rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{previa.bloqueio}</p>
                )}
                {foraDoPdv && (
                  <p className="rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    Esta transação já foi atendida (tem nota autorizada). O cancelamento dela é feito em Financeiro › Cancelamento de Transação.
                  </p>
                )}
                {previa.podeCancelar && !foraDoPdv && (
                  <>
                    <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
                      <p className="text-xs font-bold text-rose-800">Ao cancelar, de uma vez:</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-rose-800 space-y-0.5">
                        <li>{previa.vaiCancelar.nota ? `${previa.vaiCancelar.nota} é cancelada na SEFAZ` : 'não há nota autorizada para cancelar na SEFAZ'}</li>
                        <li>a transação nº {v.id} fica cancelada e sai do faturamento da loja e do caixa</li>
                        <li>
                          {titulosAtivos.length
                            ? `${titulosAtivos.length} título(s) do contas a receber ${titulosAtivos.length > 1 ? 'são cancelados' : 'é cancelado'} (${fmtBRL(titulosAtivos.reduce((s, t) => s + Number(t.valor), 0))})`
                            : 'não há título no contas a receber'}
                        </li>
                      </ul>
                    </div>
                    {previa.avisos.length > 0 && (
                      <ul className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 space-y-1">
                        {previa.avisos.map((a) => (
                          <li key={a} className="text-xs text-amber-900 inline-flex w-full items-start gap-1">
                            <Warning size={13} weight="bold" className="mt-px shrink-0" /> <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Motivo do cancelamento (vai para a SEFAZ, mínimo {JUST_MIN} caracteres)</label>
                      <textarea
                        value={just}
                        onChange={(e) => {
                          setJust(e.target.value.slice(0, 255));
                          setConfirmando(false);
                        }}
                        rows={2}
                        placeholder="Ex.: cliente desistiu da compra antes de sair da loja"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      <p className="text-[10px] text-gray-400">{just.trim().length}/255</p>
                    </div>

                    {precisaAut && (
                      <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-200">
                        <p className="text-xs font-bold text-indigo-900 inline-flex items-center gap-1">
                          <LockKey size={14} weight="fill" /> Autorização do financeiro
                        </p>
                        <p className="mt-0.5 text-[11px] text-indigo-900/80">
                          Venda atendida acima de {fmtBRL(previa.limiteSemAutorizacao || 1000)}: alguém do financeiro (ou admin/owner) digita o e-mail e a senha do HeadCoach para liberar.
                        </p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="email"
                            value={aut.email}
                            onChange={(e) => setAut((a) => ({ ...a, email: e.target.value }))}
                            placeholder="E-mail do financeiro"
                            autoComplete="off"
                            className="h-10 w-full mb-0 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          <input
                            type="password"
                            value={aut.senha}
                            onChange={(e) => setAut((a) => ({ ...a, senha: e.target.value }))}
                            placeholder="Senha"
                            autoComplete="new-password"
                            className="h-10 w-full mb-0 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                      </div>
                    )}

                    {!confirmando ? (
                      <button
                        onClick={() => setConfirmando(true)}
                        disabled={busy || just.trim().length < JUST_MIN || !autOk}
                        className="w-full h-12 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                      >
                        <Prohibit size={16} weight="bold" /> CANCELAR TRANSAÇÃO
                      </button>
                    ) : (
                      <div className="rounded-xl ring-2 ring-rose-500 p-3">
                        <p className="text-sm font-bold text-rose-700">Confirma o cancelamento da transação nº {v.id}, de {fmtBRL(v.total)}? Não dá para desfazer.</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button onClick={() => setConfirmando(false)} disabled={busy} className="h-11 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                            Voltar
                          </button>
                          <button onClick={cancelar} disabled={busy} className="h-11 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                            {busy ? (
                              <>
                                <Spinner size={15} className="animate-spin" /> Cancelando…
                              </>
                            ) : (
                              'Sim, cancelar tudo'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  );
  return pagina ? painel : <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">{painel}</div>;
}

// ─── DEVOLUÇÃO COM NOTA DO CLIENTE (recebimento FISFP082) ────────────────────
// Não tem transação no TOTVS: cancelar marca a devolução como cancelada e tira o
// Credev que ela gerou (até o que ainda estiver no saldo do cliente).
function FichaDevolucaoNf({ item, por, showToast, onCancelada }) {
  const [p, setP] = useState(null);
  const [erro, setErro] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const carregarPrevia = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/devolucoes/transacoes/${item.trxId}/cancelamento`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao abrir a devolução');
      setP(j.data);
    } catch (e) {
      setErro(e.message);
    }
  }, [item.trxId]);
  useEffect(() => {
    carregarPrevia();
  }, [carregarPrevia]);
  const cancelar = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/devolucoes/transacoes/${item.trxId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim(), por: por || null }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Não foi possível cancelar');
      setResultado({ ok: true, passos: j.data?.passos || [] });
      showToast?.('ok', `Devolução nº ${item.trxId} cancelada`);
      onCancelada?.();
      carregarPrevia();
    } catch (e) {
      setResultado({ ok: false, mensagem: e.message, passos: [] });
      showToast?.('erro', e.message);
    } finally {
      setBusy(false);
      setConfirmando(false);
    }
  };
  if (erro) return <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>;
  if (!p)
    return (
      <p className="p-6 text-center text-xs text-gray-400">
        <Spinner size={16} className="inline animate-spin" /> Abrindo a devolução…
      </p>
    );
  const t = p.trx;
  const cancelada = Number(t.transacao_status) === 6;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-lg font-bold text-[#000638]">Devolução nº {t.id}</h4>
        <span className={`inline-flex px-2 rounded-full text-[10px] font-bold ring-1 ${GRUPO_TAG.devolucao.cls}`}>NOTA DO CLIENTE</span>
        <span className={`inline-flex px-2 rounded-full text-[11px] font-semibold ring-1 ${cancelada ? STATUS.cancelada : STATUS.autorizada}`}>{cancelada ? 'cancelada' : 'lançada'}</span>
        <span className="ml-auto text-xl font-bold tabular-nums text-[#000638]">{fmtBRL(t.total)}</span>
      </div>
      <p className="text-xs text-gray-600">
        Empresa {t.empresa} · cliente <b>{t.cliente_nome || t.cliente_code}</b> · NF {t.nf_numero}/{t.nf_serie || 1} do cliente ({fmtDia(t.nf_data)}) · registrada {fmtHora(t.criado_em)} por <b>{t.criado_por || '—'}</b>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Peças recebidas</p>
          {(t.recebidos || []).map((i) => (
            <p key={`${i.productCode}-${i.name}`} className="flex justify-between gap-2 text-[12px] text-gray-700">
              <span className="truncate">
                {i.quantidade}× {i.name}
              </span>
              <span className="tabular-nums font-semibold">{fmtBRL(i.total)}</span>
            </p>
          ))}
        </div>
        <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Credev do cliente</p>
          <p className="text-[12px] text-gray-700">gerado por esta devolução: <b>{fmtBRL(p.credev.creditado)}</b></p>
          <p className="text-[12px] text-gray-700">saldo de Credev agora: <b>{p.credev.saldo == null ? '—' : fmtBRL(p.credev.saldo)}</b></p>
          {!cancelada && <p className="text-[12px] text-rose-700">sai ao cancelar: <b>{fmtBRL(p.credev.vaiSair)}</b></p>}
        </div>
      </div>
      {resultado && (
        <div className={`rounded-xl p-3 ring-1 ${resultado.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
          <p className={`text-sm font-bold inline-flex items-center gap-1.5 ${resultado.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
            {resultado.ok ? <CheckCircle size={18} weight="fill" /> : <XCircle size={18} weight="fill" />} {resultado.ok ? 'Devolução cancelada' : 'Não cancelou'}
          </p>
          {!resultado.ok && <p className="mt-1 text-xs text-rose-700">{resultado.mensagem}</p>}
          <ul className="mt-1.5 space-y-0.5">
            {resultado.passos.map((x) => (
              <li key={x.nome} className={`text-xs inline-flex w-full items-start gap-1 ${x.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
                {x.ok ? <CheckCircle size={14} weight="fill" className="mt-px shrink-0" /> : <XCircle size={14} weight="fill" className="mt-px shrink-0" />}
                <span>
                  <b>{x.nome}:</b> {x.detalhe}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.bloqueio && !resultado?.ok && <p className="rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{p.bloqueio}</p>}
      {p.podeCancelar && (
        <>
          {p.avisos.length > 0 && (
            <ul className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 space-y-1">
              {p.avisos.map((a) => (
                <li key={a} className="text-xs text-amber-900 inline-flex w-full items-start gap-1">
                  <Warning size={13} weight="bold" className="mt-px shrink-0" /> <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <label className="text-[11px] font-semibold text-gray-600">Motivo do cancelamento (mínimo {JUST_MIN} caracteres)</label>
            <textarea
              value={motivo}
              onChange={(ev) => {
                setMotivo(ev.target.value.slice(0, 255));
                setConfirmando(false);
              }}
              rows={2}
              placeholder="Ex.: devolução registrada em duplicidade / não foi lançada no TOTVS"
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              disabled={busy || motivo.trim().length < JUST_MIN}
              className="w-full h-12 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Prohibit size={16} weight="bold" /> CANCELAR DEVOLUÇÃO
            </button>
          ) : (
            <div className="rounded-xl ring-2 ring-rose-500 p-3">
              <p className="text-sm font-bold text-rose-700">Confirma o cancelamento da devolução nº {t.id}, de {fmtBRL(t.total)}? Sai {fmtBRL(p.credev.vaiSair)} de Credev do cliente.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmando(false)} disabled={busy} className="h-11 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  Voltar
                </button>
                <button onClick={cancelar} disabled={busy} className="h-11 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                  {busy ? (
                    <>
                      <Spinner size={15} className="animate-spin" /> Cancelando…
                    </>
                  ) : (
                    'Sim, cancelar a devolução'
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ENTRADA DE MERCADORIA (recebimento da loja) ─────────────────────────────
// Cancelar: as peças saem do estoque da loja (estorno), as etiquetas deixam de
// estar lá e a transferência volta para "a receber" — a loja pode receber de novo.
function FichaEntrada({ entrada: e, showToast, onCancelada }) {
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null);
  const cancelada = !!e.canceladoEm;
  const cancelar = async () => {
    setBusy(true);
    try {
      const j = await apiJson(`/api/recebimento-mercadoria/entradas/${e.id}/cancelar`, { method: 'POST', body: { motivo: motivo.trim() } });
      setResultado({ ok: true, passos: j.data?.passos || [] });
      showToast?.('ok', `Entrada de mercadoria nº ${e.id} cancelada`);
      onCancelada?.();
    } catch (err) {
      setResultado({ ok: false, mensagem: err.message, passos: [] });
      showToast?.('erro', err.message);
    } finally {
      setBusy(false);
      setConfirmando(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-lg font-bold text-[#000638]">Entrada de mercadoria nº {e.id}</h4>
        <span className={`inline-flex px-2 rounded-full text-[10px] font-bold ring-1 ${GRUPO_TAG.entrada.cls}`}>{GRUPO_TAG.entrada.label}</span>
        <span className={`inline-flex px-2 rounded-full text-[11px] font-semibold ring-1 ${cancelada ? STATUS.cancelada : STATUS.autorizada}`}>{cancelada ? 'cancelada' : 'recebida'}</span>
        <span className="ml-auto text-xl font-bold tabular-nums text-[#000638]">{e.qtdRecebida} pç</span>
      </div>
      <p className="text-xs text-gray-600">
        Loja <b>{e.empresa}</b> recebeu de <b>{e.empresaOrigem}</b>
        {e.nf ? ` · NF ${e.nf}` : ''} · transferência nº {e.transferenciaId} · {fmtHora(e.recebidoEm)} por <b>{e.recebidoPor || '—'}</b>
      </p>
      <p className="text-xs text-gray-600">
        Enviadas {e.qtdEsperada} · recebidas {e.qtdRecebida}
        {e.qtdFaltando ? ` · faltaram ${e.qtdFaltando}` : ''}
        {e.qtdFora ? ` · ${e.qtdFora} etiqueta(s) de fora` : ''}
        {e.observacao ? ` · "${e.observacao}"` : ''}
      </p>
      {cancelada && (
        <p className="rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
          Cancelada por {e.canceladoPor || '—'} em {fmtHora(e.canceladoEm)}
          {e.cancelamentoMotivo ? `: ${e.cancelamentoMotivo}` : ''}.
        </p>
      )}
      <div className="rounded-xl ring-1 ring-gray-200 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Peças</p>
        {(e.itens || []).map((i) => (
          <p key={i.productCode} className={`flex justify-between gap-2 text-[12px] ${i.recebido < i.esperado ? 'text-amber-800' : 'text-gray-700'}`}>
            <span className="truncate">
              {i.name || i.productCode} <span className="text-gray-400">cód. {i.productCode}</span>
            </span>
            <span className="tabular-nums font-semibold">
              {i.recebido}/{i.esperado}
            </span>
          </p>
        ))}
      </div>
      {resultado && (
        <div className={`rounded-xl p-3 ring-1 ${resultado.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
          <p className={`text-sm font-bold inline-flex items-center gap-1.5 ${resultado.ok ? 'text-emerald-800' : 'text-rose-700'}`}>
            {resultado.ok ? <CheckCircle size={18} weight="fill" /> : <XCircle size={18} weight="fill" />} {resultado.ok ? 'Entrada cancelada' : 'Não cancelou'}
          </p>
          {!resultado.ok && <p className="mt-1 text-xs text-rose-700">{resultado.mensagem}</p>}
          <ul className="mt-1.5 space-y-0.5">
            {resultado.passos.map((p) => (
              <li key={p.nome} className="text-xs inline-flex w-full items-start gap-1 text-emerald-800">
                <CheckCircle size={14} weight="fill" className="mt-px shrink-0" />
                <span>
                  <b>{p.nome}:</b> {p.detalhe}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!cancelada && !resultado?.ok && (
        <>
          <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
            <p className="text-xs font-bold text-rose-800">Ao cancelar a entrada:</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-rose-800 space-y-0.5">
              <li>as {e.qtdRecebida} peça(s) saem do estoque da loja {e.empresa}</li>
              <li>as etiquetas deixam de constar na loja</li>
              <li>a transferência volta para "a receber" e a loja pode receber de novo</li>
              <li>a nota da transferência continua valendo (para cancelar a transferência, cancele-a depois, no tipo Transferência)</li>
            </ul>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-600">Motivo do cancelamento (mínimo {JUST_MIN} caracteres)</label>
            <textarea
              value={motivo}
              onChange={(ev) => {
                setMotivo(ev.target.value.slice(0, 255));
                setConfirmando(false);
              }}
              rows={2}
              placeholder="Ex.: entrada feita na loja errada / conferência refeita"
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              disabled={busy || motivo.trim().length < JUST_MIN}
              className="w-full h-12 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Prohibit size={16} weight="bold" /> CANCELAR ENTRADA DE MERCADORIA
            </button>
          ) : (
            <div className="rounded-xl ring-2 ring-rose-500 p-3">
              <p className="text-sm font-bold text-rose-700">Confirma o cancelamento da entrada nº {e.id} ({e.qtdRecebida} peças da loja {e.empresa})?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmando(false)} disabled={busy} className="h-11 rounded-lg ring-1 ring-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  Voltar
                </button>
                <button onClick={cancelar} disabled={busy} className="h-11 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                  {busy ? (
                    <>
                      <Spinner size={15} className="animate-spin" /> Cancelando…
                    </>
                  ) : (
                    'Sim, cancelar a entrada'
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
