import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlass,
  Spinner,
  X,
  FileText,
  IdentificationCard,
  User,
  Phone,
  Envelope,
  MapPin,
  Buildings,
  WarningCircle,
  ClipboardText,
  CheckCircle,
  WhatsappLogo,
  ArrowSquareOut,
  Copy,
  LinkSimple,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';

// ─── helpers ────────────────────────────────────────────────────────────────
const formatFiscal = (v) => {
  if (!v) return '—';
  const n = String(v).replace(/\D/g, '');
  if (n.length === 14)
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (n.length === 11)
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v;
};

const formatPhone = (v) => {
  if (!v) return '—';
  const n = String(v).replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
};

// Traduções dos enums do TOTVS (vêm em inglês) para pt-BR.
const GENERO = { Male: 'Masculino', Female: 'Feminino' };
const ESTADO_CIVIL = {
  Single: 'Solteiro(a)',
  Married: 'Casado(a)',
  Divorced: 'Divorciado(a)',
  Widowed: 'Viúvo(a)',
  Separated: 'Separado(a)',
  StableUnion: 'União Estável',
  CommonLaw: 'União Estável',
};
const traduzGenero = (g) =>
  !g || g === 'NotInformed' ? null : GENERO[g] || g;
const traduzEstadoCivil = (m) =>
  !m || m === 'NotInformed' ? null : ESTADO_CIVIL[m] || m;

// Cliente é BlueCred se tiver a classificação correspondente no TOTVS.
const isBluecred = (c) =>
  Array.isArray(c?.classifications) &&
  c.classifications.some((cl) =>
    /blue/i.test(`${cl?.name || ''} ${cl?.typeName || ''}`),
  );

// ─── sub-componentes ─────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-medium text-[#000638]">{value || '—'}</span>
    </div>
  );
}

function ClientModal({ client, onClose, onSolicitar, solicitarLoading, gerarLinkLoading }) {
  const phones = client.phones || [];
  const emails = client.emails || [];
  const addresses = client.addresses || [];
  const observations = client.observations || [];

  // Monta endereço completo conforme schema TOTVS
  const formatAddress = (a) =>
    [
      [a.publicPlace, a.address].filter(Boolean).join(' '),
      a.addressNumber ? `nº ${a.addressNumber}` : null,
      a.complement,
      a.neighborhood,
      a.cityName && a.stateAbbreviation
        ? `${a.cityName} - ${a.stateAbbreviation}`
        : a.cityName || a.stateAbbreviation,
      a.cep ? `CEP ${a.cep}` : null,
      a.countryName && a.countryName !== 'BRASIL' ? a.countryName : null,
    ]
      .filter(Boolean)
      .join(', ');

  const addressTypeLabel = (a) =>
    a.addressType === 'Commercial'
      ? 'Comercial'
      : a.addressType === 'Residential'
        ? 'Residencial'
        : a.addressType || 'Endereço';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-blue-50">
              <User size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#000638] uppercase tracking-wide flex items-center gap-2">
                {client.name || '—'}
                {isBluecred(client) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold tracking-normal">
                    <IdentificationCard size={10} weight="fill" /> BlueCred
                  </span>
                )}
              </h2>
              {client.cpf && (
                <p className="text-[10px] text-gray-400">
                  CPF {formatFiscal(client.cpf)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Dados Cadastrais */}
          <div>
            <p className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
              <IdentificationCard size={14} /> Dados Cadastrais
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg">
              <InfoRow label="Código" value={client.code} />
              <InfoRow label="CPF" value={formatFiscal(client.cpf)} />
              <InfoRow label="Nome" value={client.name} />
              <InfoRow label="Status Cliente" value={client.customerStatus} />
              <InfoRow
                label="Situação"
                value={client.isInactive ? 'Inativo' : 'Ativo'}
              />
              <InfoRow
                label="Data Cadastro"
                value={
                  client.insertDate
                    ? new Date(client.insertDate).toLocaleDateString('pt-BR')
                    : null
                }
              />
              <InfoRow label="RG" value={client.rg} />
              <InfoRow label="Órgão Emissor" value={client.rgFederalAgency} />
              <InfoRow
                label="Data Nascimento"
                value={
                  client.birthDate
                    ? new Date(client.birthDate).toLocaleDateString('pt-BR')
                    : null
                }
              />
              <InfoRow label="Sexo" value={traduzGenero(client.gender)} />
              <InfoRow
                label="Estado Civil"
                value={traduzEstadoCivil(client.maritalStatus)}
              />
              <InfoRow label="Nacionalidade" value={client.nationality} />
              <InfoRow label="Naturalidade" value={client.homeTown} />
              <InfoRow label="Profissão" value={client.occupation} />
              <InfoRow label="Nome da Mãe" value={client.motherName} />
              <InfoRow label="Nome do Pai" value={client.fatherName} />
              <InfoRow label="Site" value={client.homePage} />
              <InfoRow
                label="Filial Cadastro"
                value={client.branchInsertCode}
              />
            </div>
          </div>

          {/* Telefones */}
          {phones.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
                <Phone size={14} /> Telefones
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {phones.map((p, i) => (
                  <div key={i} className="bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 block">
                      {p.typeName || `Tel ${i + 1}`}
                      {p.isDefault ? ' • Principal' : ''}
                    </span>
                    <span className="text-sm font-medium text-[#000638]">
                      {formatPhone(p.number)}
                      {p.branchLine ? ` r. ${p.branchLine}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E-mails */}
          {emails.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
                <Envelope size={14} /> E-mails
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {emails.map((e, i) => (
                  <div key={i} className="bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 block">
                      {e.typeName || `Email ${i + 1}`}
                      {e.isDefault ? ' • Principal' : ''}
                    </span>
                    <span className="text-sm font-medium text-[#000638] break-all">
                      {e.email || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Endereços */}
          {addresses.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
                <MapPin size={14} /> Endereços
              </p>
              <div className="space-y-2">
                {addresses.map((a, i) => (
                  <div key={i} className="bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 block mb-0.5">
                      {addressTypeLabel(a)}
                      {a.reference ? ` • ${a.reference}` : ''}
                    </span>
                    <span className="text-sm text-[#000638]">
                      {formatAddress(a) || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {observations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
                <Buildings size={14} /> Observações
              </p>
              <div className="space-y-2">
                {observations.map((o, i) => (
                  <div key={i} className="bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="text-[10px] text-gray-400 block">
                      Obs. {i + 1}
                      {o.isMaintenance ? ' • Manutenção' : ''}
                    </span>
                    <span className="text-sm text-[#000638]">
                      {o.observation || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end gap-2 flex-wrap">
          {/* Só gera o link do contrato (não envia por WhatsApp) */}
          <button
            onClick={() => onSolicitar(client, true)}
            disabled={solicitarLoading || gerarLinkLoading}
            title="Gera o contrato e devolve o link pra copiar, sem enviar ao cliente"
            className="flex items-center gap-2 border border-[#000638]/30 text-[#000638] px-5 py-2 rounded-lg hover:bg-[#000638]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold uppercase tracking-wide"
          >
            {gerarLinkLoading ? (
              <>
                <Spinner size={14} className="animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <LinkSimple size={14} />
                Gerar link
              </>
            )}
          </button>
          {/* Gera + envia (WhatsApp Meta ou Autentique) */}
          <button
            onClick={() => onSolicitar(client, false)}
            disabled={solicitarLoading || gerarLinkLoading}
            className="flex items-center gap-2 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold uppercase tracking-wide shadow-md"
          >
            {solicitarLoading ? (
              <>
                <Spinner size={14} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <ClipboardText size={14} />
                Solicitar e enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── componente principal ────────────────────────────────────────────────────
// ─── Modal de sucesso do Termo de Crédito ───────────────────────────────────
function SuccessModal({ result, onClose }) {
  const { document: doc, cliente } = result;
  const apenasLink = result?.apenas_link === true;
  const classif = result?.classificacao_bluecred || null;
  // O backend já devolve o link pronto em link_assinatura. Fallback: cava no
  // documento (Autentique usa "signatures"; "signers" é legado).
  const signatario = doc?.signatures?.[0] || doc?.signers?.[0];
  const linkAssinatura =
    result?.link_assinatura ||
    signatario?.link?.short_link ||
    signatario?.link?.url ||
    null;
  const [linkCopiado, setLinkCopiado] = useState(false);
  const copiarLink = () => {
    if (!linkAssinatura) return;
    navigator.clipboard?.writeText(linkAssinatura);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 1500);
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-100">
            <CheckCircle size={28} className="text-green-600" weight="fill" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#000638]">
              {apenasLink ? 'Link gerado!' : 'Termo enviado!'}
            </h2>
            <p className="text-xs text-gray-500">
              Documento criado na Autentique
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Cliente</span>
            <span className="font-semibold text-[#000638]">
              {cliente?.name}
            </span>
          </div>
          {cliente?.cpf && (
            <div className="flex justify-between">
              <span className="text-gray-500">CPF/CNPJ</span>
              <span className="font-mono text-[#000638]">{cliente.cpf}</span>
            </div>
          )}
          {cliente?.whatsappPhone && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">WhatsApp</span>
              <span className="flex items-center gap-1 font-semibold text-green-700">
                <WhatsappLogo size={14} weight="fill" />
                {cliente.whatsappPhone}
              </span>
            </div>
          )}
          {doc?.id && (
            <div className="flex justify-between">
              <span className="text-gray-500">ID Autentique</span>
              <span className="font-mono text-xs text-gray-600 truncate max-w-[180px]">
                {doc.id}
              </span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700 leading-relaxed">
          {apenasLink ? (
            <>
              Contrato gerado <strong>sem envio</strong>. Copie o link abaixo e
              compartilhe com o cliente. Ele precisará assinar com{' '}
              <strong>selfie + documento</strong> e um funcionário da Crosby
              <strong> aprova manualmente</strong> antes de finalizar.
            </>
          ) : (
            <>
              O cliente receberá o Termo de Crédito via WhatsApp e precisará
              realizar a verificação com <strong>selfie + documento</strong>. Um
              funcionário da Crosby precisará <strong>aprovar manualmente</strong>{' '}
              antes de finalizar.
            </>
          )}
        </div>

        {/* Classificação BlueCred no TOTVS */}
        {classif && classif.status === 'aplicada' && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-700">
            <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
            Cliente classificado como <strong>BlueCred</strong> no TOTVS.
          </div>
        )}
        {classif && classif.status === 'ja_bluecred' && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-xs text-gray-600">
            <CheckCircle size={16} weight="fill" className="text-gray-400 shrink-0" />
            Cliente já era <strong>BlueCred</strong> no TOTVS.
          </div>
        )}
        {classif && classif.status === 'conflito' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
            <WarningCircle size={16} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Cliente já tem a classificação varejo{' '}
              <strong>{classif.atual_nome}</strong> no TOTVS. Como esse tipo é
              único, ele <strong>não</strong> foi marcado como BlueCred
              automaticamente. Para substituir por BlueCred, é preciso trocar{' '}
              <strong>manualmente no TOTVS</strong> (a API não permite a troca).
            </span>
          </div>
        )}
        {classif && classif.status === 'erro' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
            <WarningCircle size={16} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Não foi possível classificar como BlueCred no TOTVS
              {classif.erro ? `: ${classif.erro}` : '.'} O contrato foi gerado
              normalmente.
            </span>
          </div>
        )}

        {/* Link do contrato — visível e copiável */}
        {linkAssinatura && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Link do contrato
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                readOnly
                value={linkAssinatura}
                onClick={(e) => e.target.select()}
                onFocus={(e) => e.target.select()}
                title="Clique para selecionar todo o link"
                className="flex-1 min-w-0 border border-[#000638]/20 rounded-lg px-3 py-2 bg-gray-50 text-xs font-mono text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638] cursor-pointer"
              />
              <button
                type="button"
                onClick={copiarLink}
                title="Copiar link do contrato"
                className="flex items-center gap-1 shrink-0 text-xs px-3 py-2 rounded-lg font-semibold transition-colors border border-[#000638]/30 text-[#000638] hover:bg-[#000638]/5"
              >
                {linkCopiado ? (
                  <>
                    <CheckCircle size={13} weight="fill" className="text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          {linkAssinatura && (
            <a
              href={linkAssinatura}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#000638] border border-[#000638]/30 px-4 py-2 rounded-lg hover:bg-[#000638]/5 transition-colors font-semibold"
            >
              <ArrowSquareOut size={13} />
              Ver no Autentique
            </a>
          )}
          <button
            onClick={onClose}
            className="text-xs bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition-colors font-bold uppercase tracking-wide"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentoBluecred() {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [clientes, setClientes] = useState(null);
  const [modalClient, setModalClient] = useState(null);
  const [solicitarLoading, setSolicitarLoading] = useState(false);
  const [gerarLinkLoading, setGerarLinkLoading] = useState(false);
  const [solicitarResult, setSolicitarResult] = useState(null);
  const [solicitarErro, setSolicitarErro] = useState('');

  // ─── Contas WhatsApp Meta (whatsapp_accounts) ────────────────────────────
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [templateName, setTemplateName] = useState('');

  // Fetch lista de contas WhatsApp na montagem
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/meta/accounts`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setWhatsappAccounts(j.data);
          // Pré-seleciona a primeira conta (se houver)
          if (j.data.length > 0 && !selectedAccountId) {
            setSelectedAccountId(j.data[0].id);
          }
        }
      })
      .catch((err) =>
        console.warn('[DocumentoBluecred] falha ao carregar contas WhatsApp:', err.message),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Criar template Meta WhatsApp (precisa aprovação ~24h) ───────────────
  const [criandoTemplate, setCriandoTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const criarTemplate = async () => {
    if (!selectedAccountId) {
      setTemplateMsg('Selecione uma conta WhatsApp antes.');
      return;
    }
    const nomeTemplate = templateName?.trim() || 'crosby_termo_credito';
    setCriandoTemplate(true);
    setTemplateMsg('');
    try {
      const body = {
        name: nomeTemplate,
        category: 'UTILITY',  // transacional — aprovação mais rápida
        language: 'pt_BR',
        allow_category_change: true,
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Termo de Crédito Crosby 📄',
          },
          {
            type: 'BODY',
            text: 'Olá {{1}}! 👋\n\nSegue o *Termo de Crédito Crosby* pra sua assinatura eletrônica.\n\n🔗 Clique no link abaixo para assinar:\n{{2}}\n\nQualquer dúvida estamos à disposição.',
            example: {
              body_text: [['João', 'https://app.autentique.com.br/assinar/exemplo']],
            },
          },
          {
            type: 'FOOTER',
            text: 'Crosby Confecções',
          },
        ],
      };
      const res = await fetch(
        `${API_BASE_URL}/api/meta/templates/${selectedAccountId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errMsg = json?.message || `Erro ${res.status}`;
        throw new Error(errMsg);
      }
      setTemplateName(nomeTemplate);
      setTemplateMsg(
        `✅ Template "${nomeTemplate}" criado e enviado para aprovação Meta. Status: ${json.data?.status || 'PENDING'}. Aguarde até 24h.`,
      );
    } catch (err) {
      setTemplateMsg(`❌ ${err.message}`);
    } finally {
      setCriandoTemplate(false);
    }
  };

  const [detalheLoading, setDetalheLoading] = useState(false);

  const handleInput = (e) => setInputValue(e.target.value);

  // Detalhe completo (phones/emails/addresses/classifications) via CPF/CNPJ.
  const buscarPorFiscal = async (digits) => {
    const res = await fetch(
      `${API_BASE_URL}/api/totvs/clientes/search-by-fiscal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalNumber: digits }),
      },
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Erro ao buscar cliente.');
    return json.data?.items || [];
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) {
      setErro('Digite nome, CPF/CNPJ ou código do cliente.');
      return;
    }
    setLoading(true);
    setErro('');
    setClientes(null);
    try {
      const digits = q.replace(/\D/g, '');
      // CPF/CNPJ → detalhe completo direto (cards já com dados)
      if (digits.length === 11 || digits.length === 14) {
        const items = await buscarPorFiscal(digits);
        if (!items.length) setErro('Nenhum cliente encontrado com esse CPF/CNPJ.');
        else setClientes(items.map((it) => ({ ...it, _full: true })));
      } else {
        // Nome ou código → busca básica (pes_pessoa). Detalhe é carregado ao abrir.
        const params = new URLSearchParams();
        if (/^\d+$/.test(q) && q.length <= 8) params.append('code', q);
        else params.append('nome', q);
        const res = await fetch(
          `${API_BASE_URL}/api/totvs/clientes/search-name?${params.toString()}`,
        );
        const json = await res.json();
        const lista = json?.data?.clientes || [];
        if (!lista.length) setErro('Nenhum cliente encontrado.');
        else
          setClientes(
            lista.map((c) => ({
              code: c.code,
              name: c.nm_pessoa,
              fantasyName: c.fantasy_name,
              cpf: c.cpf,
              _full: false,
            })),
          );
      }
    } catch (err) {
      setErro(err.message || 'Erro ao conectar com a API.');
    } finally {
      setLoading(false);
    }
  };

  // Abre o modal — se o card não tem detalhe completo (busca por nome/código),
  // busca a ficha completa por CPF antes.
  const abrirCliente = async (c) => {
    if (c._full) {
      setModalClient(c);
      return;
    }
    if (!c.cpf) {
      setErro('Cliente sem CPF/CNPJ cadastrado — não é possível carregar a ficha.');
      return;
    }
    setDetalheLoading(true);
    setErro('');
    try {
      const items = await buscarPorFiscal(String(c.cpf).replace(/\D/g, ''));
      if (!items.length) {
        setErro('Não foi possível carregar os detalhes do cliente.');
        return;
      }
      const full =
        items.find((it) => Number(it.code) === Number(c.code)) || items[0];
      setModalClient({ ...full, _full: true });
    } catch (err) {
      setErro(err.message || 'Erro ao carregar detalhes.');
    } finally {
      setDetalheLoading(false);
    }
  };

  // apenasLink=true → só gera o contrato e devolve o link (não envia WhatsApp).
  const handleSolicitar = async (client, apenasLink = false) => {
    const setLoading = apenasLink ? setGerarLinkLoading : setSolicitarLoading;
    setLoading(true);
    setSolicitarErro('');
    setSolicitarResult(null);
    try {
      const fiscalNumber = String(client.cpf || '').replace(/\D/g, '');
      const telPrimario =
        (client.phones || []).find((p) => p.isDefault)?.number ||
        (client.phones || [])[0]?.number ||
        '';
      const body = { fiscalNumber };
      if (telPrimario) body.phone = telPrimario;
      if (apenasLink) {
        body.apenasLink = true; // não envia — só devolve o link
      } else {
        if (selectedAccountId) body.accountId = selectedAccountId;
        if (templateName?.trim()) body.templateName = templateName.trim();
      }

      const res = await fetch(`${API_BASE_URL}/api/autentique/termo-credito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Erro ${res.status}`);
      }
      setSolicitarResult(json.data);
    } catch (err) {
      setSolicitarErro(err.message || 'Erro ao gerar o termo de crédito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch py-3 px-2 gap-4">
      <PageTitle
        title="Documentos Bluecred"
        subtitle="Consulta e solicitação de documentação • Varejo"
        icon={FileText}
        iconColor="text-blue-600"
      />

      {/* Busca */}
      <div className="bg-white p-4 rounded-lg shadow-md border border-[#000638]/10">
        <form
          onSubmit={handleBuscar}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Cliente (nome, CPF/CNPJ ou código)
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={handleInput}
              placeholder="Ex: João Silva  /  000.000.000-00  /  12345"
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold uppercase tracking-wide shadow-md h-9"
            >
              {loading ? (
                <>
                  <Spinner size={14} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={14} />
                  Buscar
                </>
              )}
            </button>
          </div>
        </form>

        {/* ─── Configuração de envio WhatsApp (Meta Cloud API oficial) ───── */}
        {whatsappAccounts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <WhatsappLogo size={14} weight="fill" className="text-green-600" />
              <span className="text-xs font-semibold text-[#000638]">
                Envio via WhatsApp oficial
              </span>
              <span className="text-[10px] text-gray-500">
                (escolha qual número Crosby enviará)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold mb-0.5 text-gray-700">
                  Conta WhatsApp
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-white text-[#000638] text-xs"
                >
                  <option value="">— Não enviar (Autentique envia)</option>
                  {whatsappAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.nr_telefone ? ` (${a.nr_telefone})` : ''}
                      {a.canal_venda ? ` · ${a.canal_venda}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-0.5 text-gray-700">
                  Template aprovado
                  <span className="text-[9px] text-gray-400 font-normal ml-1">
                    (opcional — texto simples se vazio)
                  </span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: crosby_termo_credito"
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-white text-[#000638] text-xs"
                  />
                  <button
                    type="button"
                    onClick={criarTemplate}
                    disabled={!selectedAccountId || criandoTemplate}
                    title="Cria o template no Meta WhatsApp (precisa aprovação ~24h)"
                    className="flex items-center gap-1 bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[10px] font-bold uppercase tracking-wide shadow-sm whitespace-nowrap"
                  >
                    {criandoTemplate ? (
                      <>
                        <Spinner size={11} className="animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <ClipboardText size={11} />
                        Criar template
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            {templateMsg && (
              <div
                className={`mt-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                  templateMsg.startsWith('✅')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {templateMsg}
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-1.5">
              💡 <strong>Sem template:</strong> envia mensagem de texto (cliente
              precisa ter conversado nas últimas 24h). <strong>Com template:</strong>{' '}
              envia template aprovado pelo Meta (funciona sempre). Template deve ter 2
              variáveis: <code>{`{{1}}`}</code> = nome,{' '}
              <code>{`{{2}}`}</code> = link assinatura. Clique em{' '}
              <strong>Criar template</strong> para gerar automaticamente
              (Meta aprova em até 24h).
            </p>
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <WarningCircle size={18} />
          {erro}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-16 gap-3 text-gray-500">
          <Spinner size={28} className="animate-spin text-[#000638]" />
          <span>Consultando TOTVS...</span>
        </div>
      )}

      {/* Estado inicial */}
      {!loading && !clientes && !erro && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm">
          Busque por nome, CPF/CNPJ ou código do cliente e clique em "Buscar".
        </div>
      )}

      {/* Resultados — cards */}
      {!loading && clientes && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {clientes.map((c) => (
            <button
              key={c.code}
              onClick={() => abrirCliente(c)}
              disabled={detalheLoading}
              className="text-left bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 hover:ring-2 hover:ring-[#000638]/30 hover:shadow-md transition-all flex items-center gap-3 disabled:opacity-60"
            >
              <div className="p-2 rounded-full bg-blue-50 shrink-0">
                {detalheLoading ? (
                  <Spinner size={22} className="animate-spin text-blue-600" />
                ) : (
                  <User size={22} className="text-blue-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#000638] truncate flex items-center gap-1.5">
                  {c.name || '—'}
                  {isBluecred(c) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold shrink-0">
                      BlueCred
                    </span>
                  )}
                </p>
                {c.fantasyName && c.fantasyName !== c.name && (
                  <p className="text-xs text-gray-500 truncate">
                    {c.fantasyName}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatFiscal(c.cpf)} &bull; Cód. {c.code}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de detalhes */}
      {modalClient && (
        <ClientModal
          client={modalClient}
          onClose={() => setModalClient(null)}
          onSolicitar={handleSolicitar}
          solicitarLoading={solicitarLoading}
          gerarLinkLoading={gerarLinkLoading}
        />
      )}

      {/* Erro do Solicitar */}
      {solicitarErro && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white rounded-xl px-5 py-3 shadow-xl text-sm font-medium max-w-sm">
          <WarningCircle size={18} weight="fill" />
          {solicitarErro}
          <button
            onClick={() => setSolicitarErro('')}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Modal de sucesso */}
      {solicitarResult && (
        <SuccessModal
          result={solicitarResult}
          onClose={() => {
            setSolicitarResult(null);
            setModalClient(null);
          }}
        />
      )}
    </div>
  );
}
