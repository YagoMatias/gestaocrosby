import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  UserPlus,
  Buildings,
  Spinner,
  MagnifyingGlass,
  FloppyDisk,
  Warning,
  CheckCircle,
  Phone,
  EnvelopeSimple,
  MapPin,
  Truck,
} from '@phosphor-icons/react';
import { TotvsURL } from '../config/constants';

// =====================================================================
// Modal reutilizável para cadastrar um FORNECEDOR (PF ou PJ) no TOTVS.
// Props:
//   cpfCnpj   — string (apenas dígitos ou formatado) já digitada pelo usuário
//   onClose() — fecha o modal sem cadastrar
//   onSuccess({ name, code, cpfCnpj }) — chamado após cadastro com sucesso
// =====================================================================

const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

const formatCnpjCpf = (v) => {
  const d = onlyDigits(v);
  if (!d) return '';
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const inputCls =
  'w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#000638] transition-colors';

const LabelField = ({ label, required, children }) => (
  <div>
    <label className="text-xs font-bold text-[#000638] block mb-1.5">
      {label}
      {required && ' *'}
    </label>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 pt-1 pb-0.5 border-b border-gray-100">
    <Icon size={15} weight="bold" className="text-[#000638]" />
    <span className="text-xs font-bold text-[#000638] uppercase tracking-wide">
      {title}
    </span>
  </div>
);

export default function CadastrarFornecedorModal({
  cpfCnpj,
  onClose,
  onSuccess,
}) {
  const digitsIniciais = onlyDigits(cpfCnpj);
  const tipoInicial = digitsIniciais.length === 11 ? 'PF' : 'PJ';

  const [tipoPessoa, setTipoPessoa] = useState(tipoInicial);
  const [doc, setDoc] = useState(digitsIniciais);
  const [branchInsertCode, setBranchInsertCode] = useState('1');
  const [name, setName] = useState('');
  const [fantasyName, setFantasyName] = useState('');
  const [uf, setUf] = useState('');
  const [isSupplier, setIsSupplier] = useState(true);
  const [isCustomer, setIsCustomer] = useState(false);
  const [dadosCnpj, setDadosCnpj] = useState(null);

  // Endereço
  const [addrLogradouro, setAddrLogradouro] = useState('');
  const [addrNumero, setAddrNumero] = useState('');
  const [addrComplemento, setAddrComplemento] = useState('');
  const [addrBairro, setAddrBairro] = useState('');
  const [addrCidade, setAddrCidade] = useState('');
  const [addrUf, setAddrUf] = useState('');
  const [addrCep, setAddrCep] = useState('');

  // Telefone / E-mail
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const docDigits = useMemo(() => onlyDigits(doc), [doc]);
  const docValido =
    (tipoPessoa === 'PF' && docDigits.length === 11) ||
    (tipoPessoa === 'PJ' && docDigits.length === 14);

  // ── Autofill via BrasilAPI (somente PJ) ────────────────────────────
  const buscarDadosCnpj = async () => {
    if (tipoPessoa !== 'PJ' || docDigits.length !== 14) return;
    setBuscandoCnpj(true);
    setErro(null);
    try {
      const resp = await fetch(`${TotvsURL}cnpj/${docDigits}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const d = json?.data;
      if (!d) throw new Error('CNPJ não encontrado na base pública.');
      setDadosCnpj(d);
      if (!name) setName(d.razao_social || '');
      if (!fantasyName) setFantasyName(d.nome_fantasia || '');
      if (!uf) setUf(d.uf || '');
      // endereço
      const logr = [d.descricao_tipo_de_logradouro, d.logradouro]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!addrLogradouro) setAddrLogradouro(logr);
      if (!addrNumero) setAddrNumero(d.numero || '');
      if (!addrComplemento) setAddrComplemento(d.complemento || '');
      if (!addrBairro) setAddrBairro(d.bairro || '');
      if (!addrCidade) setAddrCidade(d.municipio || '');
      if (!addrUf) setAddrUf(d.uf || '');
      const cepDigits = onlyDigits(d.cep);
      if (!addrCep) setAddrCep(cepDigits);
      // telefone / email
      const tel = onlyDigits(d.ddd_telefone_1);
      if (!telefone && tel.length >= 10) setTelefone(tel);
      if (!email && d.email) setEmail(d.email);
    } catch (err) {
      setErro(`Não foi possível consultar o CNPJ: ${err.message}`);
    } finally {
      setBuscandoCnpj(false);
    }
  };

  // ── Monta payload e envia ao TOTVS ─────────────────────────────────
  const handleCadastrar = async () => {
    setErro(null);
    if (!branchInsertCode) {
      setErro('Informe a empresa de cadastro (código).');
      return;
    }
    if (!name.trim()) {
      setErro('Informe o nome.');
      return;
    }
    if (!docValido) {
      setErro(
        tipoPessoa === 'PF'
          ? 'CPF deve conter 11 dígitos.'
          : 'CNPJ deve conter 14 dígitos.',
      );
      return;
    }

    const common = {
      branchInsertCode: parseInt(branchInsertCode),
      insertDate: new Date().toISOString(),
      name: name.trim().slice(0, 60),
      isSupplier: isSupplier || undefined,
      isFinalCNSR: isCustomer || undefined,
    };

    // Endereço — só inclui se CEP estiver preenchido (TOTVS rejeita addresses sem cep)
    const cepDigits = onlyDigits(addrCep);
    if (cepDigits) {
      common.addresses = [
        {
          addressType: 'Commercial',
          address: addrLogradouro.trim() || undefined,
          number: addrNumero.trim() || undefined,
          complement: addrComplemento.trim() || undefined,
          neighborhood: addrBairro.trim() || undefined,
          cityName: addrCidade.trim() || undefined,
          stateAbbreviation: addrUf.trim() || undefined,
          cep: cepDigits, // TOTVS espera "cep", não "zipCode"
        },
      ];
    }

    // Telefone
    const telDigits = onlyDigits(telefone);
    if (telDigits.length >= 10) {
      common.phones = [{ typeCode: 1, number: telDigits, isDefault: true }];
    }

    // E-mail
    const emailTrimmed = email.trim();
    if (emailTrimmed) {
      common.emails = [{ email: emailTrimmed, isDefault: true }];
    }

    let payload;
    let url;
    if (tipoPessoa === 'PF') {
      payload = { ...common, cpf: docDigits };
      url = `${TotvsURL}cliente/individual-customer`;
    } else {
      payload = {
        ...common,
        cnpj: docDigits,
        fantasyName: fantasyName.trim().slice(0, 60) || undefined,
        uf: uf || undefined,
      };
      url = `${TotvsURL}cliente/legal-customer`;
    }

    setEnviando(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setErro(
          data.message ||
            'Erro ao cadastrar fornecedor no TOTVS. Verifique os dados.',
        );
        return;
      }
      const code =
        data.data?.customerCode ||
        data.data?.data?.customerCode ||
        data.customerCode ||
        null;
      onSuccess?.({ name: common.name, code, cpfCnpj: docDigits });
    } catch (e) {
      setErro(`Erro de comunicação: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#000638] text-white px-5 py-3.5 rounded-t-2xl flex items-center justify-between z-10">
          <h3 className="text-base font-bold flex items-center gap-2">
            <UserPlus size={20} weight="bold" />
            Cadastrar Fornecedor no TOTVS
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-red-300"
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Aviso */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
            <Warning
              size={18}
              weight="fill"
              className="shrink-0 text-amber-600"
            />
            <span>
              Fornecedor não encontrado no TOTVS. Preencha os dados abaixo e
              clique em <strong>Cadastrar</strong>.
            </span>
          </div>

          {/* Tipo PF/PJ */}
          <div className="flex gap-2">
            {[
              { id: 'PF', label: 'Pessoa Física', icon: User },
              { id: 'PJ', label: 'Pessoa Jurídica', icon: Buildings },
            ].map((t) => {
              const Icon = t.icon;
              const active = tipoPessoa === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipoPessoa(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${
                    active
                      ? 'bg-[#000638] text-white border-[#000638]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#000638]'
                  }`}
                >
                  <Icon size={16} weight="bold" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── IDENTIFICAÇÃO ── */}
          <div className="space-y-3">
            <SectionTitle icon={User} title="Identificação" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Documento */}
              <div>
                <label className="text-xs font-bold text-[#000638] block mb-1.5">
                  {tipoPessoa === 'PF' ? 'CPF *' : 'CNPJ *'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formatCnpjCpf(doc)}
                    onChange={(e) => setDoc(e.target.value)}
                    maxLength={tipoPessoa === 'PF' ? 14 : 18}
                    placeholder={
                      tipoPessoa === 'PF'
                        ? '000.000.000-00'
                        : '00.000.000/0000-00'
                    }
                    className={`${inputCls} font-mono`}
                  />
                  {tipoPessoa === 'PJ' && (
                    <button
                      type="button"
                      onClick={buscarDadosCnpj}
                      disabled={buscandoCnpj || docDigits.length !== 14}
                      className="shrink-0 flex items-center gap-1.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                      title="Preencher automaticamente pela Receita"
                    >
                      {buscandoCnpj ? (
                        <Spinner size={14} className="animate-spin" />
                      ) : (
                        <MagnifyingGlass size={14} weight="bold" />
                      )}
                      Buscar
                    </button>
                  )}
                </div>
                {dadosCnpj && (
                  <p className="mt-1 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle size={11} weight="fill" /> Dados da Receita
                    Federal aplicados
                  </p>
                )}
              </div>

              {/* Empresa cadastro */}
              <LabelField label="Empresa de cadastro (código)" required>
                <input
                  type="number"
                  value={branchInsertCode}
                  onChange={(e) => setBranchInsertCode(e.target.value)}
                  placeholder="Ex: 1"
                  className={inputCls}
                />
              </LabelField>

              {/* Nome / Razão social */}
              <LabelField
                label={tipoPessoa === 'PF' ? 'Nome completo' : 'Razão social'}
                required
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder="Nome do fornecedor"
                  className={inputCls}
                />
              </LabelField>

              {/* Nome fantasia (PJ) */}
              {tipoPessoa === 'PJ' && (
                <LabelField label="Nome fantasia">
                  <input
                    type="text"
                    value={fantasyName}
                    onChange={(e) => setFantasyName(e.target.value)}
                    maxLength={60}
                    placeholder="Nome fantasia"
                    className={inputCls}
                  />
                </LabelField>
              )}

              {/* UF (PJ) */}
              {tipoPessoa === 'PJ' && (
                <LabelField label="UF">
                  <input
                    type="text"
                    value={uf}
                    onChange={(e) =>
                      setUf(e.target.value.toUpperCase().slice(0, 2))
                    }
                    maxLength={2}
                    placeholder="Ex: PR"
                    className={inputCls}
                  />
                </LabelField>
              )}
            </div>

            {/* Checkboxes — funções no TOTVS */}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSupplier}
                  onChange={(e) => setIsSupplier(e.target.checked)}
                  className="accent-amber-600"
                />
                <Truck size={13} weight="bold" />
                Marcar como Fornecedor
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCustomer}
                  onChange={(e) => setIsCustomer(e.target.checked)}
                />
                Consumidor Final
              </label>
            </div>
          </div>

          {/* ── ENDEREÇO ── */}
          <div className="space-y-3">
            <SectionTitle icon={MapPin} title="Endereço (opcional)" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <LabelField label="Logradouro">
                  <input
                    type="text"
                    value={addrLogradouro}
                    onChange={(e) => setAddrLogradouro(e.target.value)}
                    placeholder="Rua, Av., etc."
                    className={inputCls}
                  />
                </LabelField>
              </div>
              <LabelField label="Número">
                <input
                  type="text"
                  value={addrNumero}
                  onChange={(e) => setAddrNumero(e.target.value)}
                  placeholder="123"
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="Complemento">
                <input
                  type="text"
                  value={addrComplemento}
                  onChange={(e) => setAddrComplemento(e.target.value)}
                  placeholder="Sala, Bloco..."
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="Bairro">
                <input
                  type="text"
                  value={addrBairro}
                  onChange={(e) => setAddrBairro(e.target.value)}
                  placeholder="Bairro"
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="Cidade">
                <input
                  type="text"
                  value={addrCidade}
                  onChange={(e) => setAddrCidade(e.target.value)}
                  placeholder="Curitiba"
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="UF">
                <input
                  type="text"
                  value={addrUf}
                  onChange={(e) =>
                    setAddrUf(e.target.value.toUpperCase().slice(0, 2))
                  }
                  maxLength={2}
                  placeholder="PR"
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="CEP">
                <input
                  type="text"
                  value={addrCep}
                  onChange={(e) => setAddrCep(e.target.value)}
                  maxLength={9}
                  placeholder="00000-000"
                  className={inputCls}
                />
              </LabelField>
            </div>
          </div>

          {/* ── CONTATO ── */}
          <div className="space-y-3">
            <SectionTitle icon={Phone} title="Contato (opcional)" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LabelField label="Telefone">
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  maxLength={20}
                  placeholder="(41) 99999-9999"
                  className={inputCls}
                />
              </LabelField>
              <LabelField label="E-mail">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className={inputCls}
                />
              </LabelField>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 whitespace-pre-wrap font-semibold">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex justify-end gap-2 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCadastrar}
            disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors disabled:opacity-60"
          >
            {enviando ? (
              <Spinner size={16} className="animate-spin" />
            ) : (
              <FloppyDisk size={16} weight="bold" />
            )}
            Cadastrar e continuar
          </button>
        </div>
      </div>
    </div>
  );
}
