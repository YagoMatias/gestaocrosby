// Configuração fiscal por empresa (PDV Crosby → emissão direta):
// ambiente, séries, numeração, CSC (NFC-e), alíquota ICMS e texto de infCpl.
// Mostra também o emitente (TOTVS) e o certificado A1 resolvido pela raiz do CNPJ.
import React, { useEffect, useState } from 'react';
import { X, Spinner, CheckCircle, Warning, Certificate, Broadcast } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import { fetchSefaz } from '../../utils/fetchSefaz';

const inputCls =
  'w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1';

const fmtCnpj = (c) => String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export default function FiscalConfigModal({ empresa, empresaNome, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(null); // { emitente, certificado, aliqPadrao }
  const [form, setForm] = useState({
    ativo: true,
    ambiente: 2,
    serie_nfce: 9,
    serie_nfe: 9,
    prox_num_nfce: 1,
    prox_num_nfe: 1,
    csc_id_hom: '',
    csc_token_hom: '',
    csc_id_prod: '',
    csc_token_prod: '',
    aliq_icms: '',
    info_complementar: '',
  });
  const [tokensSet, setTokensSet] = useState({ hom: false, prod: false });
  const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config/${empresa}`);
        const j = await r.json();
        const c = j?.data?.config;
        setInfo(j?.data || null);
        if (c) {
          setForm({
            ativo: c.ativo,
            ambiente: c.ambiente,
            serie_nfce: c.serie_nfce,
            serie_nfe: c.serie_nfe,
            prox_num_nfce: c.prox_num_nfce,
            prox_num_nfe: c.prox_num_nfe,
            csc_id_hom: c.csc_id_hom || '',
            csc_token_hom: '',
            csc_id_prod: c.csc_id_prod || '',
            csc_token_prod: '',
            aliq_icms: c.aliq_icms ?? '',
            info_complementar: c.info_complementar || '',
          });
          setTokensSet({ hom: !!c.csc_token_hom_set, prod: !!c.csc_token_prod_set });
        }
      } catch (e) {
        setMsg({ type: 'erro', text: `Falha ao carregar: ${e.message}` });
      } finally {
        setLoading(false);
      }
    })();
  }, [empresa]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body = { ...form, cnpj: info?.emitente?.cnpj || undefined };
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/config/${empresa}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao salvar');
      setTokensSet({ hom: !!j.data.csc_token_hom_set, prod: !!j.data.csc_token_prod_set });
      setForm((f) => ({ ...f, csc_token_hom: '', csc_token_prod: '' }));
      setMsg({ type: 'ok', text: 'Configuração salva' });
      onSaved?.(j.data);
    } catch (e) {
      setMsg({ type: 'erro', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const testarSefaz = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const { r, j } = await fetchSefaz(
        `${API_BASE_URL}/api/pdv-crosby/status-sefaz?empresa=${empresa}&modelo=65`,
      );
      setStatus(r.ok && j.success ? { ok: j.data.cStat === '107', text: `${j.data.cStat} — ${j.data.xMotivo} (UF ${j.data.uf}, ${j.data.ambiente === 1 ? 'produção' : 'homologação'})` } : { ok: false, text: j?.message || 'Falha' });
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally {
      setChecking(false);
    }
  };

  const emit = info?.emitente;
  const cert = info?.certificado;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#000638]">
            Configuração fiscal — empresa {empresa} {empresaNome ? `· ${empresaNome}` : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">
            <Spinner size={22} className="animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Emitente + certificado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2.5">
                <p className="font-semibold text-gray-600 mb-1">Emitente (cadastro TOTVS)</p>
                {emit?.erro ? (
                  <p className="text-rose-600">{emit.erro}</p>
                ) : emit ? (
                  <>
                    <p className="font-medium text-[#000638]">{emit.xNome}</p>
                    <p>CNPJ {fmtCnpj(emit.cnpj)} · IE {emit.ie || '—'} · UF {emit.uf}</p>
                    <p className="text-gray-500">
                      {[emit.endereco?.xLgr, emit.endereco?.nro, emit.endereco?.xBairro, emit.endereco?.xMun].filter(Boolean).join(', ')}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400">—</p>
                )}
              </div>
              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-2.5">
                <p className="font-semibold text-gray-600 mb-1 inline-flex items-center gap-1">
                  <Certificate size={13} /> Certificado A1 (raiz do CNPJ)
                </p>
                {cert?.erro ? (
                  <p className="text-rose-600">{cert.erro}</p>
                ) : cert ? (
                  <>
                    <p className="font-medium text-[#000638]">{cert.razaoSocial}</p>
                    <p>CNPJ {fmtCnpj(cert.cnpj)} · {cert.arquivo}</p>
                    <p className={new Date(cert.validade) < new Date() ? 'text-rose-600 font-semibold' : 'text-gray-500'}>
                      Válido até {new Date(cert.validade).toLocaleDateString('pt-BR')}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400">—</p>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className={lbl}>Ambiente</label>
                <select value={form.ambiente} onChange={(e) => upd('ambiente', parseInt(e.target.value, 10))} className={`${inputCls} ${form.ambiente === 1 ? 'ring-2 ring-rose-300' : ''}`}>
                  <option value={2}>2 — Homologação (teste)</option>
                  <option value={1}>1 — Produção</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Emissão ativa</label>
                <select value={form.ativo ? '1' : '0'} onChange={(e) => upd('ativo', e.target.value === '1')} className={inputCls}>
                  <option value="1">Sim</option>
                  <option value="0">Não</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Alíquota ICMS %</label>
                <input type="number" step="0.01" value={form.aliq_icms} onChange={(e) => upd('aliq_icms', e.target.value)} placeholder={info?.aliqPadrao != null ? `padrão UF: ${info.aliqPadrao}` : ''} className={inputCls} />
              </div>
              <div />
              <div>
                <label className={lbl}>Série NFC-e</label>
                <input type="number" min="1" value={form.serie_nfce} onChange={(e) => upd('serie_nfce', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>Próx. nº NFC-e</label>
                <input type="number" min="1" value={form.prox_num_nfce} onChange={(e) => upd('prox_num_nfce', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>Série NF-e</label>
                <input type="number" min="1" value={form.serie_nfe} onChange={(e) => upd('serie_nfe', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>Próx. nº NF-e</label>
                <input type="number" min="1" value={form.prox_num_nfe} onChange={(e) => upd('prox_num_nfe', e.target.value)} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 -mt-2">
              Use uma série diferente da usada pelo TOTVS (ele emite na série 3) para não colidir a numeração.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className={lbl}>CSC id (homolog.)</label>
                <input value={form.csc_id_hom} onChange={(e) => upd('csc_id_hom', e.target.value)} placeholder="ex.: 1" className={inputCls} />
              </div>
              <div>
                <label className={lbl}>CSC token (homolog.)</label>
                <input value={form.csc_token_hom} onChange={(e) => upd('csc_token_hom', e.target.value)} placeholder={tokensSet.hom ? 'já cadastrado ••••' : 'token'} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>CSC id (produção)</label>
                <input value={form.csc_id_prod} onChange={(e) => upd('csc_id_prod', e.target.value)} placeholder="ex.: 1" className={inputCls} />
              </div>
              <div>
                <label className={lbl}>CSC token (produção)</label>
                <input value={form.csc_token_prod} onChange={(e) => upd('csc_token_prod', e.target.value)} placeholder={tokensSet.prod ? 'já cadastrado ••••' : 'token'} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 -mt-2">
              O CSC é obrigatório para o QR Code da NFC-e. Cadastre no portal da SEFAZ da UF (o TOTVS usa o id 1). O token só é sobrescrito quando preenchido.
            </p>

            <div>
              <label className={lbl}>Informação complementar (infCpl)</label>
              <textarea value={form.info_complementar} onChange={(e) => upd('info_complementar', e.target.value)} rows={2} placeholder="Ex.: PROCON NATAL - R ULISSES CALDAS, 181, CIDADE ALTA/NATAL/RN TEL:3232-9050 LEI MUNICIPAL N 6216/2011" className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30" />
            </div>

            {msg && (
              <p className={`text-xs rounded-lg px-2 py-1.5 ring-1 inline-flex items-center gap-1 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
                {msg.type === 'ok' ? <CheckCircle size={14} weight="bold" /> : <Warning size={14} weight="bold" />} {msg.text}
              </p>
            )}
            {status && (
              <p className={`text-xs rounded-lg px-2 py-1.5 ring-1 ${status.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                SEFAZ: {status.text}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={salvar} disabled={saving} className="flex-1 h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90 disabled:opacity-40">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              <button onClick={testarSefaz} disabled={checking} className="h-10 px-3 rounded-xl text-sm font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1">
                <Broadcast size={15} /> {checking ? 'Consultando…' : 'Testar SEFAZ'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
