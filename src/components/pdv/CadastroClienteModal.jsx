// Cadastro rápido de cliente (CPF ou CNPJ) direto do PDV Crosby.
// Grava no TOTVS pelas mesmas rotas da página Cadastrar Cliente
// (POST /api/totvs/cliente/individual-customer | legal-customer) só com os
// dados básicos — todos obrigatórios, exceto o complemento do endereço.
import React, { useState } from 'react';
import { X, Spinner, UserPlus, Warning } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const inputCls =
  'w-full h-9 px-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1';

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const mascCpf = (v) =>
  soDigitos(v)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
const mascFone = (v) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const mascCnpj = (v) =>
  soDigitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
const mascCep = (v) => soDigitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

export default function CadastroClienteModal({ empresa, onClose, onCriado }) {
  const [tipo, setTipo] = useState('PF'); // PF (CPF) | PJ (CNPJ)
  const [docBusy, setDocBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    fantasyName: '',
    cpf: '',
    cnpj: '',
    uf: '',
    birthDate: '',
    phone: '',
    email: '',
    gender: '',
    cep: '',
    address: '',
    number: '',
    neighborhood: '',
    complement: '',
    cidade: '',
  });
  const [saving, setSaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Preenche rua, bairro e cidade pelo CEP
  const buscarCep = async (valor) => {
    const cep = soDigitos(valor);
    if (cep.length !== 8) return;
    setCepBusy(true);
    try {
      const j = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (!j.erro) {
        setForm((f) => ({
          ...f,
          address: f.address || j.logradouro || '',
          neighborhood: f.neighborhood || j.bairro || '',
          cidade: [j.localidade, j.uf].filter(Boolean).join(' / '),
          uf: j.uf || f.uf,
        }));
      }
    } catch {
      /* ViaCEP fora do ar: o operador digita o endereço */
    } finally {
      setCepBusy(false);
    }
  };

  // CNPJ completo: traz razão social, fantasia, fundação, contato e endereço
  const buscarCnpj = async (valor) => {
    const cnpj = soDigitos(valor);
    if (cnpj.length !== 14) return;
    setDocBusy(true);
    try {
      const j = await fetch(`${API_BASE_URL}/api/totvs/cnpj/${cnpj}`).then((r) => r.json());
      const d = j?.data;
      if (d) {
        const tel = soDigitos(d.ddd_telefone_1);
        setForm((f) => ({
          ...f,
          name: f.name || d.razao_social || '',
          fantasyName: f.fantasyName || d.nome_fantasia || '',
          birthDate: f.birthDate || d.data_inicio_atividade || '',
          phone: f.phone || (tel.length >= 10 ? mascFone(tel) : ''),
          email: f.email || (d.email || '').toLowerCase(),
          cep: f.cep || mascCep(d.cep),
          address: f.address || [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '),
          number: f.number || soDigitos(d.numero),
          neighborhood: f.neighborhood || d.bairro || '',
          complement: f.complement || d.complemento || '',
          cidade: f.cidade || [d.municipio, d.uf].filter(Boolean).join(' / '),
          uf: f.uf || d.uf || '',
        }));
      }
    } catch {
      /* consulta pública fora do ar: o operador digita os dados */
    } finally {
      setDocBusy(false);
    }
  };

  const pj = tipo === 'PJ';

  const salvar = async (e) => {
    e.preventDefault();
    setErro(null);
    const nome = form.name.trim().toUpperCase();
    const fantasia = form.fantasyName.trim().toUpperCase();
    const doc = soDigitos(pj ? form.cnpj : form.cpf);
    const fone = soDigitos(form.phone);
    const cep = soDigitos(form.cep);
    const numero = soDigitos(form.number);
    if (!empresa) return setErro('Escolha a empresa da venda antes de cadastrar.');
    if (pj) {
      if (doc.length !== 14) return setErro('CNPJ precisa ter 14 dígitos.');
      if (!nome) return setErro('Informe a razão social.');
      if (!fantasia) return setErro('Informe o nome fantasia.');
      if (!form.birthDate) return setErro('Informe a data de fundação.');
    } else {
      if (nome.split(/\s+/).length < 2) return setErro('Informe nome e sobrenome.');
      if (doc.length !== 11) return setErro('CPF precisa ter 11 dígitos.');
      if (!form.birthDate) return setErro('Informe o aniversário.');
      if (!form.gender) return setErro('Informe o gênero.');
    }
    if (fone.length < 10) return setErro('Informe o telefone com DDD.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErro('Informe um e-mail válido.');
    if (cep.length !== 8) return setErro('Informe o CEP com 8 dígitos.');
    if (!form.address.trim()) return setErro('Informe a rua do endereço.');
    if (!numero) return setErro('Informe o número do endereço (use 0 se não houver).');
    if (!form.neighborhood.trim()) return setErro('Informe o bairro.');

    const payload = {
      branchInsertCode: parseInt(empresa, 10),
      name: nome,
      ...(pj
        ? { cnpj: doc, fantasyName: fantasia, dateFoundation: form.birthDate, ...(form.uf ? { uf: form.uf } : {}) }
        : { cpf: doc, birthDate: new Date(`${form.birthDate}T00:00:00`).toISOString(), gender: form.gender }),
      phones: [{ typeCode: 1, number: fone, isDefault: true }],
      emails: [{ typeCode: 1, email: form.email.trim().toLowerCase(), isDefault: true }],
      addresses: [
        {
          addressType: pj ? 'Commercial' : 'Residential',
          sequence: 1,
          cep,
          address: form.address.trim().toUpperCase(),
          number: parseInt(numero, 10),
          neighborhood: form.neighborhood.trim().toUpperCase(),
          ...(form.complement.trim() ? { complement: form.complement.trim().toUpperCase() } : {}),
        },
      ],
    };

    setSaving(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/totvs/cliente/${pj ? 'legal-customer' : 'individual-customer'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j.success === false) {
        const det = Array.isArray(j?.details) ? j.details.map((d) => d.message).filter(Boolean).join(' · ') : '';
        setErro([j?.message || 'O TOTVS recusou o cadastro.', det].filter(Boolean).join(' — '));
        return;
      }
      const code = parseInt(j?.data?.customerCode || j?.data?.data?.customerCode || j?.data?.personCode || j?.customerCode, 10);
      if (!code) {
        setErro('Cadastro enviado, mas o TOTVS não devolveu o código. Busque o cliente pelo documento no campo Cliente.');
        return;
      }
      onCriado({ code, name: nome });
    } catch (er) {
      setErro(`Falha de conexão: ${er.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#000638] inline-flex items-center gap-2">
            <UserPlus size={18} weight="bold" /> Cadastrar cliente
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-0.5">
          {[
            { id: 'PF', label: 'CPF — pessoa física' },
            { id: 'PJ', label: 'CNPJ — empresa' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTipo(t.id);
                setErro(null);
              }}
              className={`h-8 px-3 rounded-md text-xs font-bold transition-colors ${tipo === t.id ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          {pj ? (
            <>
              <div className="sm:col-span-2 relative">
                <label className={lbl}>CNPJ *</label>
                <input
                  autoFocus
                  value={form.cnpj}
                  onChange={(e) => {
                    const v = mascCnpj(e.target.value);
                    set('cnpj', v);
                    buscarCnpj(v);
                  }}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  className={inputCls}
                />
                {docBusy && <Spinner size={14} className="absolute right-2.5 bottom-2.5 text-gray-400 animate-spin" />}
              </div>
              <div className="sm:col-span-4">
                <label className={lbl}>Razão social *</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-4">
                <label className={lbl}>Nome fantasia *</label>
                <input value={form.fantasyName} onChange={(e) => set('fantasyName', e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Data de fundação *</label>
                <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
              </div>
            </>
          ) : (
            <>
              <div className="sm:col-span-4">
                <label className={lbl}>Nome completo *</label>
                <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>CPF *</label>
                <input value={form.cpf} onChange={(e) => set('cpf', mascCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
              </div>
              <div className="sm:col-span-3">
                <label className={lbl}>Aniversário *</label>
                <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-3">
                <label className={lbl}>Gênero *</label>
                <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
                  <option value="">Selecione…</option>
                  <option value="Female">Feminino</option>
                  <option value="Male">Masculino</option>
                </select>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={lbl}>Telefone *</label>
            <input value={form.phone} onChange={(e) => set('phone', mascFone(e.target.value))} inputMode="numeric" placeholder="(00) 00000-0000" className={inputCls} />
          </div>
          <div className="sm:col-span-4">
            <label className={lbl}>E-mail *</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </div>

          <p className="sm:col-span-6 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-t border-gray-100 pt-2">Endereço</p>
          <div className="sm:col-span-2 relative">
            <label className={lbl}>CEP *</label>
            <input
              value={form.cep}
              onChange={(e) => {
                const v = mascCep(e.target.value);
                set('cep', v);
                buscarCep(v);
              }}
              inputMode="numeric"
              placeholder="00000-000"
              className={inputCls}
            />
            {cepBusy && <Spinner size={14} className="absolute right-2.5 bottom-2.5 text-gray-400 animate-spin" />}
          </div>
          <div className="sm:col-span-4">
            <label className={lbl}>Cidade</label>
            <input value={form.cidade} readOnly tabIndex={-1} placeholder="preenchida pelo CEP" className={`${inputCls} bg-gray-50 text-gray-500`} />
          </div>
          <div className="sm:col-span-4">
            <label className={lbl}>Rua *</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Número *</label>
            <input value={form.number} onChange={(e) => set('number', e.target.value)} inputMode="numeric" className={inputCls} />
          </div>
          <div className="sm:col-span-3">
            <label className={lbl}>Bairro *</label>
            <input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-3">
            <label className={lbl}>Complemento</label>
            <input value={form.complement} onChange={(e) => set('complement', e.target.value)} className={inputCls} />
          </div>
        </div>

        {erro && (
          <p className="mt-3 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200 flex items-start gap-1.5">
            <Warning size={14} weight="bold" className="shrink-0 mt-0.5" /> {erro}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-xs font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Spinner size={14} className="animate-spin" /> : <UserPlus size={14} weight="bold" />}
            {saving ? 'Cadastrando…' : 'CADASTRAR E USAR NA VENDA'}
          </button>
        </div>
      </form>
    </div>
  );
}
