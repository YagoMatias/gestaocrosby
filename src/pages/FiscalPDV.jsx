// Página: Administração → Fiscal PDV
// Visão de todas as empresas do TOTVS com a configuração de emissão do PDV
// Crosby: certificado, ambiente, séries, numeração, CSC, alíquota e as
// operações de NFC-e / NF-e / TROCA. Permite editar na própria linha e
// aplicar a mesma configuração a várias empresas de uma vez.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  ArrowsClockwise,
  Spinner,
  MagnifyingGlass,
  CheckCircle,
  Warning,
  Certificate,
  Broadcast,
  FloppyDisk,
  Stack,
  X,
  Gear,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { fetchSefaz } from '../utils/fetchSefaz';

const fmtCnpj = (c) =>
  String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const inputCls =
  'h-8 px-1.5 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const lbl = 'block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1';

// Campos que a linha permite editar direto na tabela
const CAMPOS_LINHA = [
  'ambiente',
  'ativo',
  'serie_nfce',
  'prox_num_nfce',
  'serie_nfe',
  'prox_num_nfe',
  'operacao_nfce',
  'operacao_nfe',
  'operacao_troca',
  'aliq_icms',
];

function Chip({ ok, alerta, children, title }) {
  const cls = ok
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : alerta
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-rose-50 text-rose-700 ring-rose-200';
  return (
    <span title={title} className={`inline-flex px-1.5 py-0.5 rounded-full ring-1 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

const FiscalPDV = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [busca, setBusca] = useState('');
  const [somenteConfig, setSomenteConfig] = useState(false);
  const [rascunhos, setRascunhos] = useState({}); // empresa → patch
  const [salvando, setSalvando] = useState(null);
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [loteOpen, setLoteOpen] = useState(false);
  const [statusSefaz, setStatusSefaz] = useState({}); // empresa → { ok, texto }
  const [testando, setTestando] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((tipo, msg) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/admin/empresas`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao carregar');
      setItems(j.data.items || []);
      setResumo(j.data.resumo || null);
      setRascunhos({});
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((i) => {
      if (somenteConfig && !i.config) return false;
      if (!q) return true;
      return [i.empresa, i.nome, i.cnpj].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    });
  }, [items, busca, somenteConfig]);

  const valorDe = (item, campo) => {
    const r = rascunhos[item.empresa];
    if (r && r[campo] !== undefined) return r[campo];
    const cfg = item.config;
    if (cfg && cfg[campo] !== undefined && cfg[campo] !== null) return cfg[campo];
    // sem configuração: sugere a operação padrão da empresa
    if (campo === 'operacao_nfce') return item.operacoesPadrao?.nfce ?? '';
    if (campo === 'operacao_nfe') return item.operacoesPadrao?.nfe ?? '';
    if (campo === 'operacao_troca') return item.operacoesPadrao?.troca ?? '';
    if (campo === 'ambiente') return 2;
    if (campo === 'ativo') return true;
    if (campo === 'serie_nfce' || campo === 'serie_nfe') return 9;
    if (campo === 'prox_num_nfce' || campo === 'prox_num_nfe') return 1;
    return '';
  };

  const editar = (empresa, campo, valor) =>
    setRascunhos((r) => ({ ...r, [empresa]: { ...(r[empresa] || {}), [campo]: valor } }));

  const sujo = (empresa) => Object.keys(rascunhos[empresa] || {}).length > 0;

  const salvar = async (item) => {
    setSalvando(item.empresa);
    try {
      const corpo = { empresa_nome: item.nome };
      for (const campo of CAMPOS_LINHA) corpo[campo] = valorDe(item, campo);
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config/${item.empresa}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao salvar');
      setItems((prev) => prev.map((i) => (i.empresa === item.empresa ? { ...i, config: j.data } : i)));
      setRascunhos((prev) => {
        const c = { ...prev };
        delete c[item.empresa];
        return c;
      });
      showToast('ok', `Empresa ${item.empresa} salva`);
    } catch (e) {
      showToast('erro', e.message);
    } finally {
      setSalvando(null);
    }
  };

  const testar = async (item) => {
    setTestando(item.empresa);
    try {
      const { r, j } = await fetchSefaz(
        `${API_BASE_URL}/api/pdv-crosby/status-sefaz?empresa=${item.empresa}&modelo=65`,
      );
      const ok = r.ok && j.success && j.data.cStat === '107';
      setStatusSefaz((s) => ({
        ...s,
        [item.empresa]: {
          ok,
          texto: r.ok && j.success ? `${j.data.cStat} ${j.data.xMotivo}` : j?.message || 'Falha',
        },
      }));
    } catch (e) {
      setStatusSefaz((s) => ({ ...s, [item.empresa]: { ok: false, texto: e.message } }));
    } finally {
      setTestando(null);
    }
  };

  const alternar = (empresa) =>
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(empresa)) n.delete(empresa);
      else n.add(empresa);
      return n;
    });

  const todasVisiveisSelecionadas = visiveis.length > 0 && visiveis.every((i) => selecionadas.has(i.empresa));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="max-w-[1400px] mx-auto">
        <PageTitle
          title="Fiscal PDV"
          subtitle="Configuração de emissão de NFC-e e NF-e do PDV Crosby, por empresa"
          icon={Barcode}
        />

        {resumo && (
          <div className="mb-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Empresas', valor: resumo.empresas },
              { label: 'Configuradas', valor: resumo.configuradas },
              { label: 'Em produção', valor: resumo.producao, cor: resumo.producao > 0 ? 'text-rose-700' : 'text-[#000638]' },
              { label: 'Com certificado', valor: resumo.comCertificado, cor: 'text-emerald-700' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold tabular-nums ${c.cor || 'text-[#000638]'}`}>{c.valor}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Empresa, nome ou CNPJ…"
              className={`${inputCls} h-9 pl-8 w-64 text-sm`}
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={somenteConfig}
              onChange={(e) => setSomenteConfig(e.target.checked)}
              className="w-4 h-4 p-0 mb-0 accent-[#000638]"
            />
            Só as configuradas
          </label>
          <button
            onClick={carregar}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <div className="flex-1" />
          {selecionadas.size > 0 && (
            <button
              onClick={() => setLoteOpen(true)}
              className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 inline-flex items-center gap-1.5"
            >
              <Stack size={14} weight="bold" /> Configurar {selecionadas.size} empresa(s)
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={todasVisiveisSelecionadas}
                      onChange={(e) =>
                        setSelecionadas(e.target.checked ? new Set(visiveis.map((i) => i.empresa)) : new Set())
                      }
                      className="w-4 h-4 p-0 mb-0 accent-[#000638]"
                    />
                  </th>
                  <th className="px-2 py-2 text-left">Empresa</th>
                  <th className="px-2 py-2 text-left">Certificado</th>
                  <th className="px-2 py-2 text-left">Ambiente</th>
                  <th className="px-2 py-2 text-left">Série / próx. NFC-e</th>
                  <th className="px-2 py-2 text-left">Série / próx. NF-e</th>
                  <th className="px-2 py-2 text-left">Op. NFCE</th>
                  <th className="px-2 py-2 text-left">Op. NFE</th>
                  <th className="px-2 py-2 text-left">Op. TROCA</th>
                  <th className="px-2 py-2 text-left">ICMS %</th>
                  <th className="px-2 py-2 text-left">CSC</th>
                  <th className="px-2 py-2 text-left">SEFAZ</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && items.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-gray-400">
                      <Spinner size={20} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                )}
                {!loading && visiveis.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-gray-400">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                )}
                {visiveis.map((item) => {
                  const cfg = item.config;
                  const cert = item.certificado;
                  const st = statusSefaz[item.empresa];
                  const producao = Number(valorDe(item, 'ambiente')) === 1;
                  return (
                    <tr
                      key={item.empresa}
                      className={`hover:bg-gray-50/60 ${sujo(item.empresa) ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={selecionadas.has(item.empresa)}
                          onChange={() => alternar(item.empresa)}
                          className="w-4 h-4 p-0 mb-0 accent-[#000638]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="font-semibold text-[#000638]">
                          {item.empresa} — {item.nome}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {item.cnpj ? fmtCnpj(item.cnpj) : 'sem CNPJ'}
                          {cfg ? '' : ' · sem configuração'}
                        </p>
                      </td>
                      <td className="px-2 py-1.5">
                        {!cert ? (
                          <Chip>sem CNPJ</Chip>
                        ) : cert.erro ? (
                          <Chip title={cert.erro}>ausente</Chip>
                        ) : cert.vencido ? (
                          <Chip title={`${cert.arquivo} venceu em ${new Date(cert.validade).toLocaleDateString('pt-BR')}`}>
                            vencido
                          </Chip>
                        ) : (
                          <Chip
                            ok
                            title={`${cert.arquivo} · ${cert.razaoSocial} · vence ${new Date(cert.validade).toLocaleDateString('pt-BR')}`}
                          >
                            <Certificate size={10} className="mr-0.5" /> ok
                          </Chip>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={valorDe(item, 'ambiente')}
                          onChange={(e) => editar(item.empresa, 'ambiente', parseInt(e.target.value, 10))}
                          className={`${inputCls} ${producao ? 'ring-1 ring-rose-300 text-rose-700 font-semibold' : ''}`}
                        >
                          <option value={2}>Homologação</option>
                          <option value={1}>Produção</option>
                        </select>
                        <label className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!valorDe(item, 'ativo')}
                            onChange={(e) => editar(item.empresa, 'ativo', e.target.checked)}
                            className="w-3.5 h-3.5 p-0 mb-0 accent-emerald-600"
                          />
                          ativa
                        </label>
                      </td>
                      {[
                        ['serie_nfce', 'prox_num_nfce'],
                        ['serie_nfe', 'prox_num_nfe'],
                      ].map(([serie, prox]) => (
                        <td key={serie} className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={valorDe(item, serie)}
                              onChange={(e) => editar(item.empresa, serie, e.target.value)}
                              className={`${inputCls} w-12 text-center`}
                              title="Série"
                            />
                            <span className="text-gray-300">/</span>
                            <input
                              type="number"
                              min="1"
                              value={valorDe(item, prox)}
                              onChange={(e) => editar(item.empresa, prox, e.target.value)}
                              className={`${inputCls} w-20 text-center`}
                              title="Próximo número"
                            />
                          </div>
                          {String(valorDe(item, serie)) === '3' && (
                            <p className="text-[9px] text-amber-600 mt-0.5">série do TOTVS</p>
                          )}
                        </td>
                      ))}
                      {['operacao_nfce', 'operacao_nfe', 'operacao_troca'].map((campo) => (
                        <td key={campo} className="px-2 py-1.5">
                          <input
                            type="number"
                            value={valorDe(item, campo)}
                            onChange={(e) => editar(item.empresa, campo, e.target.value)}
                            className={`${inputCls} w-16 text-center`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={valorDe(item, 'aliq_icms') ?? ''}
                          onChange={(e) => editar(item.empresa, 'aliq_icms', e.target.value)}
                          placeholder="UF"
                          className={`${inputCls} w-16 text-center`}
                          title="Vazio usa a alíquota padrão da UF"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {cfg?.csc_token_prod_set ? (
                          <Chip ok title={`id ${cfg.csc_id_prod || '—'}`}>
                            prod
                          </Chip>
                        ) : cfg?.csc_token_hom_set ? (
                          <Chip alerta title={`id ${cfg.csc_id_hom || '—'}`}>
                            hom
                          </Chip>
                        ) : (
                          <Chip title="Sem CSC cadastrado — NFC-e não pode ser emitida">sem CSC</Chip>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {st ? (
                          <Chip ok={st.ok} alerta={!st.ok} title={st.texto}>
                            {st.texto.slice(0, 22)}
                          </Chip>
                        ) : (
                          <button
                            onClick={() => testar(item)}
                            disabled={testando === item.empresa}
                            className="text-[10px] font-semibold text-[#000638] hover:underline inline-flex items-center gap-1 disabled:opacity-40"
                          >
                            {testando === item.empresa ? (
                              <Spinner size={11} className="animate-spin" />
                            ) : (
                              <Broadcast size={11} />
                            )}
                            testar
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => salvar(item)}
                          disabled={salvando === item.empresa || (!sujo(item.empresa) && !!cfg)}
                          className="h-7 px-2 rounded-lg text-[10px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-30 inline-flex items-center gap-1"
                          title={cfg ? 'Salvar alterações' : 'Criar configuração'}
                        >
                          {salvando === item.empresa ? (
                            <Spinner size={11} className="animate-spin" />
                          ) : (
                            <FloppyDisk size={11} weight="bold" />
                          )}
                          {cfg ? 'salvar' : 'criar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-gray-500">
          O CSC é cadastrado no portal da SEFAZ da UF e só pode ser digitado na configuração em lote ou no modal Fiscal do
          PDV. Use uma série diferente da 3 para não colidir com a numeração do TOTVS.
        </p>

        {loteOpen && (
          <LoteModal
            empresas={[...selecionadas]}
            nomes={Object.fromEntries(items.map((i) => [i.empresa, i.nome]))}
            onClose={() => setLoteOpen(false)}
            onDone={(msg) => {
              setLoteOpen(false);
              setSelecionadas(new Set());
              showToast('ok', msg);
              carregar();
            }}
            onError={(msg) => showToast('erro', msg)}
          />
        )}

        {toast && (
          <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
              toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Configuração em lote ────────────────────────────────────────────────────
function LoteModal({ empresas, nomes, onClose, onDone, onError }) {
  const [form, setForm] = useState({
    ambiente: '',
    ativo: '',
    serie_nfce: '',
    serie_nfe: '',
    usarOperacoesPadrao: true,
    operacao_nfce: '',
    operacao_nfe: '',
    operacao_troca: '',
    aliq_icms: '',
    csc_id_hom: '',
    csc_token_hom: '',
    csc_id_prod: '',
    csc_token_prod: '',
    info_complementar: '',
  });
  const [busy, setBusy] = useState(false);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const aplicar = async () => {
    setBusy(true);
    try {
      const corpo = { empresas, nomes, usarOperacoesPadrao: form.usarOperacoesPadrao };
      for (const [k, v] of Object.entries(form)) {
        if (k === 'usarOperacoesPadrao') continue;
        if (v === '' || v === null) continue;
        corpo[k] = k === 'ativo' ? v === 'sim' : v;
      }
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config-lote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao aplicar');
      onDone(j.message || 'Configuração aplicada');
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-[#000638] inline-flex items-center gap-1.5">
            <Gear size={17} /> Configurar {empresas.length} empresa(s)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          Campos em branco não mudam nada. Empresas: {empresas.slice(0, 12).join(', ')}
          {empresas.length > 12 ? ` e mais ${empresas.length - 12}` : ''}.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className={lbl}>Ambiente</label>
            <select value={form.ambiente} onChange={(e) => upd('ambiente', e.target.value)} className={`${inputCls} w-full h-9`}>
              <option value="">não alterar</option>
              <option value="2">Homologação</option>
              <option value="1">Produção</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Emissão ativa</label>
            <select value={form.ativo} onChange={(e) => upd('ativo', e.target.value)} className={`${inputCls} w-full h-9`}>
              <option value="">não alterar</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Série NFC-e</label>
            <input type="number" min="1" value={form.serie_nfce} onChange={(e) => upd('serie_nfce', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
          <div>
            <label className={lbl}>Série NF-e</label>
            <input type="number" min="1" value={form.serie_nfe} onChange={(e) => upd('serie_nfe', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
        </div>

        <div className="mt-3 rounded-xl ring-1 ring-gray-200 p-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#000638] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={form.usarOperacoesPadrao}
              onChange={(e) => upd('usarOperacoesPadrao', e.target.checked)}
              className="w-4 h-4 p-0 mb-0 accent-[#000638]"
            />
            Preencher as operações com o padrão de cada empresa
          </label>
          <p className="text-[10px] text-gray-500 mt-0.5 mb-2">
            Padrão: NFCE 510, NFE 521, TROCA 1. Nas empresas 95 e 98: 545, 548 e 555. Preencher abaixo sobrescreve o padrão.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['operacao_nfce', 'Op. NFCE'],
              ['operacao_nfe', 'Op. NFE'],
              ['operacao_troca', 'Op. TROCA'],
            ].map(([k, l]) => (
              <div key={k}>
                <label className={lbl}>{l}</label>
                <input type="number" value={form[k]} onChange={(e) => upd(k, e.target.value)} className={`${inputCls} w-full h-9`} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className={lbl}>CSC id (hom.)</label>
            <input value={form.csc_id_hom} onChange={(e) => upd('csc_id_hom', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
          <div>
            <label className={lbl}>CSC token (hom.)</label>
            <input value={form.csc_token_hom} onChange={(e) => upd('csc_token_hom', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
          <div>
            <label className={lbl}>CSC id (prod.)</label>
            <input value={form.csc_id_prod} onChange={(e) => upd('csc_id_prod', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
          <div>
            <label className={lbl}>CSC token (prod.)</label>
            <input value={form.csc_token_prod} onChange={(e) => upd('csc_token_prod', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
        </div>
        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 ring-1 ring-amber-200 mt-2 inline-flex items-center gap-1">
          <Warning size={12} weight="bold" /> O CSC costuma ser diferente por CNPJ. Só aplique em lote para empresas do mesmo
          CNPJ.
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Alíquota ICMS %</label>
            <input type="number" step="0.01" value={form.aliq_icms} onChange={(e) => upd('aliq_icms', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
          <div>
            <label className={lbl}>Informação complementar</label>
            <input value={form.info_complementar} onChange={(e) => upd('info_complementar', e.target.value)} className={`${inputCls} w-full h-9`} />
          </div>
        </div>

        <button
          onClick={aplicar}
          disabled={busy}
          className="mt-4 w-full h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Spinner size={15} className="animate-spin" /> Aplicando…
            </>
          ) : (
            <>
              <CheckCircle size={15} weight="bold" /> Aplicar a {empresas.length} empresa(s)
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default FiscalPDV;
