import React, { useState, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { TotvsURL } from '../config/constants';
import {
  UserPlus,
  User,
  Buildings,
  Plus,
  Trash,
  CheckCircle,
  XCircle,
  FloppyDisk,
  Warning,
  IdentificationCard,
  Phone,
  EnvelopeSimple,
  MapPin,
  Bank,
  Star,
  Users,
  CreditCard,
  Note,
  FileArrowUp,
  FileText,
  FolderOpen,
  Truck,
  MagnifyingGlass,
  Spinner,
} from '@phosphor-icons/react';

const BUCKET_DOCS = 'clientes-confianca';

// Mesmas categorias usadas no ClientePerfilModal (Clientes MTM)
const CATEGORIAS_DOCUMENTOS = [
  { key: 'cartao_cnpj', label: 'Cartão CNPJ', onlyPJ: true },
  { key: 'google_maps', label: 'Google Maps da Loja' },
  { key: 'comprovante_qsa', label: 'Comprovante QSA', onlyPJ: true },
  { key: 'rg_cpf_socios', label: 'RG e CPF dos Sócios' },
  { key: 'comprovante_endereco', label: 'Comprov. Endereço' },
  { key: 'score_cnpj', label: 'Score SPC/Serasa CNPJ', onlyPJ: true },
  { key: 'score_socios', label: 'Score SPC/Serasa Sócios' },
  { key: 'doc_retirada_rastreio', label: 'Doc. Retirada / Rastreio / Taxista' },
  { key: 'declaracao_fiador', label: 'Declaração Resp. e Fiador' },
  { key: 'nf_outros_fornecedores', label: 'NFs de Outros Fornecedores' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Enums (do schema TOTVS)
// ──────────────────────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Female', label: 'Feminino' },
  { value: 'Male', label: 'Masculino' },
];
const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Single', label: 'Solteiro(a)' },
  { value: 'Married', label: 'Casado(a)' },
  { value: 'Widowed', label: 'Viúvo(a)' },
  { value: 'Cohabitating', label: 'Amasiado(a)' },
  { value: 'Separated', label: 'Desquitado(a)' },
  { value: 'Divorced', label: 'Divorciado(a)' },
  { value: 'NotDeclared', label: 'Não declarado' },
];
const ADDRESS_TYPE_OPTIONS = [
  { value: 'Commercial', label: 'Comercial' },
  { value: 'Residential', label: 'Residencial' },
  { value: 'Billing', label: 'Cobrança' },
  { value: 'Shopping', label: 'Compras' },
  { value: 'Delivery', label: 'Entrega' },
  { value: 'Mailing', label: 'Correspondência' },
  { value: 'ShowRoom', label: 'Show room' },
  { value: 'PickUp', label: 'Retirada' },
  { value: 'CommercialPrevious', label: 'Comercial anterior' },
  { value: 'ResidentialPrevious', label: 'Residencial anterior' },
];
const STATE_OPTIONS = [
  '',
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
  'EX',
];
const REGISTRATION_STATUS_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Normal', label: 'Normal' },
  { value: 'InAnalysis', label: 'Em análise' },
];
const FREIGHT_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'CIF', label: 'CIF' },
  { value: 'FOB', label: 'FOB' },
  { value: 'ThirdParty', label: 'Terceiros' },
  { value: 'NoOccurrence', label: 'Sem ocorrência' },
  { value: 'OwnSender', label: 'Próprio Remetente' },
  { value: 'OwnRecipient', label: 'Próprio Destinatário' },
];
const NUMBER_EMPLOYER_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'UpTo10', label: 'Até 10' },
  { value: 'From11To50', label: 'De 11 a 50' },
  { value: 'From51To100', label: 'De 51 a 100' },
  { value: 'From101To500', label: 'De 101 a 500' },
  { value: 'From501To1000', label: 'De 501 a 1000' },
  { value: 'AboveThan1001', label: 'Acima de 1001' },
];
const TAX_REGIME_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Normal', label: 'Normal' },
  { value: 'MicroBranch', label: 'Micro empresa' },
  { value: 'Epp', label: 'EPP' },
  { value: 'RealProfit', label: 'Lucro real' },
  { value: 'PresumedProfit', label: 'Lucro presumido' },
  { value: 'Mei', label: 'MEI' },
  { value: 'Eireli', label: 'Eireli' },
  { value: 'Others', label: 'Outros' },
];
const SUBTRIBUTARY_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Calculate', label: 'Calcula' },
  { value: 'NotCalculate', label: 'Não calcula' },
];
const EDUCATION_LEVEL_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Illiterate', label: 'Analfabeto' },
  { value: 'IncompleteElementaryEducation', label: 'Fundamental incompleto' },
  { value: 'ElementarySchool', label: 'Fundamental' },
  { value: 'IncompleteHighSchool', label: 'Médio incompleto' },
  { value: 'HighSchool', label: 'Médio' },
  { value: 'IncompleteHigherEducation', label: 'Superior incompleto' },
  { value: 'HigherEducation', label: 'Superior' },
  { value: 'PostGraduation', label: 'Pós-graduação' },
  { value: 'Masters', label: 'Mestrado' },
  { value: 'Doctorate', label: 'Doutorado' },
];
const HOME_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Owned', label: 'Própria' },
  { value: 'Rented', label: 'Alugada' },
  { value: 'Ceded', label: 'Cedida' },
  { value: 'Others', label: 'Outros' },
  { value: 'Parentes', label: 'Pais' },
  { value: 'Financed', label: 'Financiada' },
];
const CAR_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'DontHave', label: 'Não possui' },
  { value: 'Financed', label: 'Financiado' },
  { value: 'PaidOff', label: 'Quitado' },
];
const DRIVER_LICENSE_CATEGORY_OPTIONS = [
  { value: '', label: 'Não informado' },
  'A',
  'B',
  'C',
  'D',
  'E',
  'AB',
  'AD',
  'AE',
].map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'CurrentAccount', label: 'Conta Corrente' },
  { value: 'SavingsAccount', label: 'Conta Poupança' },
  { value: 'SalaryAccount', label: 'Conta Salário' },
  { value: 'PaymentAccount', label: 'Conta de Pagamento' },
  { value: 'JointCurrentAccount', label: 'CC Conjunta' },
  { value: 'JointSavingsAccount', label: 'Poupança Conjunta' },
  { value: 'JointJudicialDepositAccount', label: 'Dep. Judicial Conjunta' },
];
const BANK_ACCOUNT_PURPOSE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'ElectronicScheduling', label: 'Agendamento eletrônico' },
  { value: 'SalaryScheduling', label: 'Agendamento de salário' },
  { value: 'PIXTransfer', label: 'PIX Transferência' },
];
const BANK_ACCOUNT_CHECK_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Common', label: 'Comum' },
  { value: 'banking', label: 'Bancário' },
  { value: 'salary', label: 'Salário' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'CPMF', label: 'CPMF' },
];
const PIX_KEY_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Phone', label: 'Telefone' },
  { value: 'Email', label: 'E-mail' },
  { value: 'CPF_CNPJ', label: 'CPF/CNPJ' },
  { value: 'Random', label: 'Aleatória' },
];
const PERSON_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Individual', label: 'Física' },
  { value: 'Legal', label: 'Jurídica' },
];
const REFERENCE_TYPE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Banking', label: 'Bancária' },
  { value: 'Commercial', label: 'Comercial' },
  { value: 'Others', label: 'Outros' },
  { value: 'Personal', label: 'Pessoal' },
  { value: 'ConsSci', label: 'Cons. SCI' },
];
const MILITARY_CERTIFICATE_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'ReservistFirstCategory', label: 'Reservista 1ª Categoria' },
  { value: 'ReservistSecondCategory', label: 'Reservista 2ª Categoria' },
  { value: 'IncorporationDispensation', label: 'Dispensa de incorporação' },
  { value: 'MilitaryServiceExemption', label: 'Isenção do serviço militar' },
];
const MILITARY_CATEGORY_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'Army', label: 'Exército' },
  { value: 'Navy', label: 'Marinha' },
  { value: 'AirForce', label: 'Aeronáutica' },
];
const ADDITIONAL_FIELD_TYPE_OPTIONS = [
  { value: 'String', label: 'String' },
  { value: 'Number', label: 'Número' },
  { value: 'Date', label: 'Data' },
];
const SUFRAMA_DESC_OPTIONS = [
  { value: '', label: 'Não informado' },
  { value: 'VerifyParameter', label: 'Verificar parâmetro' },
  { value: 'Icms', label: 'ICMS' },
  { value: 'IcmsPisConfins', label: 'ICMS/PIS/COFINS' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de UI
// ──────────────────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-transparent bg-white';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';
const sectionCardCls =
  'bg-white border border-gray-200 rounded-lg p-4 shadow-sm';

const Field = ({ label, children, span = 1, required = false }) => (
  <div
    className={
      span === 2
        ? 'col-span-2'
        : span === 3
          ? 'col-span-3'
          : span === 4
            ? 'col-span-4'
            : 'col-span-1'
    }
  >
    <label className={labelCls}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const Section = ({ title, icon: Icon, children, actions }) => (
  <div className={sectionCardCls}>
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
      <h3 className="text-sm font-bold text-[#000638] flex items-center gap-2">
        {Icon && <Icon size={18} weight="bold" />}
        {title}
      </h3>
      {actions}
    </div>
    {children}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ──────────────────────────────────────────────────────────────────────────────
const emptyPhone = () => ({
  typeCode: '',
  number: '',
  branchLine: '',
  isDefault: false,
});
const emptyEmail = () => ({ typeCode: '', email: '', isDefault: false });
const emptyAddress = () => ({
  addressType: 'Commercial',
  sequence: '',
  postOfficeBox: '',
  cityCode: '',
  cityName: '',
  stateAbbreviation: '',
  countryCode: '',
  publicPlace: '',
  address: '',
  number: '',
  complement: '',
  reference: '',
  zipCode: '',
  neighborhood: '',
});
const emptyContact = () => ({
  sequence: '',
  typeCode: '',
  name: '',
  function: '',
  phoneNumber: '',
  cellNumber: '',
  email: '',
  birthDate: '',
  isDefault: false,
});
const emptyReference = () => ({
  sequence: '',
  type: '',
  description: '',
  phoneNumber: '',
  responsiblePersonName: '',
  isInactive: false,
});
const emptyObservation = () => ({
  sequence: '',
  observation: '',
  isMaintenance: false,
});
const emptyLimit = () => ({
  branchCode: '',
  saleLimitValue: '',
  monthlyLimitValue: '',
});
const emptySocial = () => ({
  sequence: '',
  typeCode: '',
  typeName: '',
  address: '',
});
const emptyClassification = () => ({
  classificationTypeCode: '',
  classificationCode: '',
});
const emptyBankAccount = () => ({
  holderName: '',
  additionalData: '',
  bankNumber: '',
  branchNumber: '',
  accountNumber: '',
  accountDigit: '',
  personType: '',
  accountType: '',
  purposeType: '',
  compensationType: '',
  checkType: '',
  pixKeyType: '',
  pixKey: '',
});
const emptyAdditionalField = () => ({ code: '', value: '' });
const emptyFamiliar = () => ({
  name: '',
  birthDate: '',
  gender: '',
  kinshipDescription: '',
});
const emptyPartner = () => ({
  cpfPartner: '',
  partnerCode: '',
  percentageParticipation: '',
});

const baseCommonState = () => ({
  branchInsertCode: '',
  insertDate: new Date().toISOString().slice(0, 10),
  name: '',
  isInactive: false,
  homePage: '',
  registrationStatus: '',
  isBloqued: false,
  isFinalCNSR: false,
  isSupplier: false,
  suframaCode: '',
  taxCodeNumber: '',
  // listas
  phones: [],
  addresses: [],
  emails: [],
  contacts: [],
  references: [],
  observations: [],
  limits: [],
  socialNetworks: [],
  classifications: [],
  bankAccounts: [],
  additionalFields: [],
  // preferences
  preferences: {
    paymentConditionCode: '',
    shippingCompanyCode: '',
    freightType: '',
    bridgeShippingCompanyCode: '',
    maximumAverageTerm: '',
    priceTableCode: '',
    orderPriority: '',
    bearerCode: '',
  },
});

const initialIndividualState = () => ({
  ...baseCommonState(),
  // PF specific
  cpf: '',
  rg: '',
  rgFederalAgency: '',
  birthDate: '',
  gender: '',
  maritalStatus: '',
  motherName: '',
  fatherName: '',
  nationality: '',
  homeTown: '',
  monthlyIncome: '',
  occupation: '',
  hireDate: '',
  workPlace: '',
  ctps: '',
  ctpsSerial: '',
  employee: '',
  employeeIsInactive: false,
  familiars: [],
  individualAdditionals: {
    educationLevel: '',
    numberOfChildren: '',
    numberOfDependents: '',
    residenceMonths: '',
    workMonths: '',
    previousWorkPlace: '',
    residingSinceDate: '',
    homeType: '',
    carType: '',
    score: '',
    risk: '',
    spcUpdateDate: '',
    isStreetVendor: false,
    streetVendorNumber: '',
    rgType: '',
    rgIssueDate: '',
    passportNumber: '',
    passportCountryCode: '',
    driverLicenseNumber: '',
    driverLicenseExpirationDate: '',
    firstDriverLicenseDate: '',
    driverLicenseAgency: '',
    driverLicenseCategory: '',
    voterRegistrationNumber: '',
    voterZone: '',
    voterSection: '',
    militaryCertificateType: '',
    militaryCategory: '',
    militaryDispensation: '',
    nitNumber: '',
    ctpsState: '',
    isInformalWorker: false,
    pisNumber: '',
    pisIssueDate: '',
    pisState: '',
    ruralProducerRegistration: '',
    ruralProducerState: '',
    cifIssuer: '',
    cifState: '',
    cifNumber: '',
    birthState: '',
    passportIssuer: '',
    passportState: '',
    passportIssueDate: '',
    passportExpirationDate: '',
    ricNumber: '',
    ricState: '',
    ricIssuer: '',
    ricCityCode: '',
    ricIssueDate: '',
    ricExpirationDate: '',
    foreignDocumentNumber: '',
    nickname: '',
    crcNumber: '',
    driverLicenseSecurityNumber: '',
    driverLicenseRegistrationNumber: '',
    crcRegistrationDate: '',
    crcExpirationDate: '',
    socialName: '',
    homeTown: '',
  },
});

const initialLegalState = () => ({
  ...baseCommonState(),
  // PJ specific
  cnpj: '',
  fantasyName: '',
  uf: '',
  numberStateRegistration: '',
  dateFoundation: '',
  codeActivity: '',
  numberEmployees: '',
  monthlyInvoicing: '',
  shareCapital: '',
  codeActivityCnae: '',
  codeActivityCnae2: '',
  typeTaxRegime: '',
  typeSubTributary: '',
  registrationMunicipal: '',
  descriptionJuntaCial: '',
  dateRegJuntaCial: '',
  foreignIdentification: '',
  initialDateActivity: '',
  finalDateActivity: '',
  isCommercialExp: false,
  typeDescriptionSuFrama: '',
  partners: [],
});

// ──────────────────────────────────────────────────────────────────────────────
// Construção do payload removendo vazios
// ──────────────────────────────────────────────────────────────────────────────
function cleanValue(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (typeof v === 'number' && Number.isNaN(v)) return undefined;
  return v;
}

function cleanObject(obj) {
  if (Array.isArray(obj)) {
    const arr = obj.map(cleanObject).filter((x) => x !== undefined);
    return arr.length ? arr : undefined;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const c = cleanObject(v);
      if (c !== undefined && c !== false && c !== '') {
        // Mantém booleans true; já filtramos string vazia acima
        out[k] = c;
      } else if (typeof v === 'boolean') {
        out[k] = v; // mantém boolean (true ou false explicitamente marcado)
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return cleanValue(obj);
}

function toIntOrUndef(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}
function toFloatOrUndef(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────────────────────────────────────
export default function CadastrarCliente() {
  const { user } = useAuth();
  const [tipoPessoa, setTipoPessoa] = useState('PF'); // 'PF' ou 'PJ'
  const [pf, setPf] = useState(initialIndividualState);
  const [pj, setPj] = useState(initialLegalState);
  const [tabAtiva, setTabAtiva] = useState('formulario');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, message, data? }
  // Documentos extras (mesmas categorias do módulo Clientes MTM)
  // { [categoria]: File } — selecionados localmente antes do submit
  const [documentosPendentes, setDocumentosPendentes] = useState({});
  const [uploadStatus, setUploadStatus] = useState({}); // { [categoria]: 'ok'|'err'|'enviando' }
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjBuscaErro, setCnpjBuscaErro] = useState(null);

  const state = tipoPessoa === 'PF' ? pf : pj;
  const setState = tipoPessoa === 'PF' ? setPf : setPj;

  const updateField = useCallback(
    (field, value) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    [setState],
  );

  const updateNested = useCallback(
    (group, field, value) => {
      setState((prev) => ({
        ...prev,
        [group]: { ...prev[group], [field]: value },
      }));
    },
    [setState],
  );

  const updateList = useCallback(
    (listName, idx, field, value) => {
      setState((prev) => {
        const arr = [...prev[listName]];
        arr[idx] = { ...arr[idx], [field]: value };
        return { ...prev, [listName]: arr };
      });
    },
    [setState],
  );

  const addToList = useCallback(
    (listName, factory) => {
      setState((prev) => ({
        ...prev,
        [listName]: [...prev[listName], factory()],
      }));
    },
    [setState],
  );

  const removeFromList = useCallback(
    (listName, idx) => {
      setState((prev) => {
        const arr = prev[listName].filter((_, i) => i !== idx);
        return { ...prev, [listName]: arr };
      });
    },
    [setState],
  );

  // ─── Busca dados da empresa via CNPJ (BrasilAPI) e preenche o form (PJ) ─────
  const buscarDadosCnpj = useCallback(async () => {
    const digits = String(pj.cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) {
      setCnpjBuscaErro('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    setCnpjBuscaErro(null);
    setBuscandoCnpj(true);
    try {
      const resp = await fetch(`${TotvsURL}cnpj/${digits}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const d = json?.data;
      if (!d) throw new Error('CNPJ não encontrado na base pública.');

      const cep = String(d.cep || '').replace(/\D/g, '');
      const endereco = [d.descricao_tipo_de_logradouro, d.logradouro]
        .filter(Boolean)
        .join(' ')
        .trim();
      const novoEndereco =
        endereco || cep
          ? {
              ...emptyAddress(),
              addressType: 'Commercial',
              address: endereco,
              number: d.numero || '',
              complement: d.complemento || '',
              neighborhood: d.bairro || '',
              cityName: d.municipio || '',
              stateAbbreviation: d.uf || '',
              zipCode: cep,
            }
          : null;

      const tel = String(d.ddd_telefone_1 || '').replace(/\D/g, '');
      const novoTelefone =
        tel.length >= 10
          ? { ...emptyPhone(), number: tel, isDefault: true }
          : null;
      const novoEmail = d.email
        ? { ...emptyEmail(), email: d.email, isDefault: true }
        : null;

      setPj((prev) => ({
        ...prev,
        name: prev.name || d.razao_social || '',
        fantasyName: prev.fantasyName || d.nome_fantasia || '',
        uf: prev.uf || d.uf || '',
        dateFoundation: prev.dateFoundation || d.data_inicio_atividade || '',
        initialDateActivity:
          prev.initialDateActivity || d.data_inicio_atividade || '',
        shareCapital:
          prev.shareCapital ||
          (d.capital_social != null ? String(d.capital_social) : ''),
        codeActivityCnae:
          prev.codeActivityCnae ||
          (d.cnae_fiscal != null ? String(d.cnae_fiscal) : ''),
        addresses: novoEndereco ? [novoEndereco] : prev.addresses,
        phones: novoTelefone ? [novoTelefone] : prev.phones,
        emails: novoEmail ? [novoEmail] : prev.emails,
      }));
    } catch (err) {
      setCnpjBuscaErro(`Não foi possível consultar o CNPJ: ${err.message}`);
    } finally {
      setBuscandoCnpj(false);
    }
  }, [pj.cnpj]);

  // ─── Construção do payload final ───────────────────────────────────────────
  const buildPayload = useCallback(() => {
    const s = state;
    const common = {
      branchInsertCode: toIntOrUndef(s.branchInsertCode),
      insertDate: s.insertDate
        ? new Date(s.insertDate + 'T00:00:00').toISOString()
        : undefined,
      name: cleanValue(s.name),
      isInactive: s.isInactive ? true : undefined,
      homePage: cleanValue(s.homePage),
      registrationStatus: cleanValue(s.registrationStatus),
      isBloqued: s.isBloqued ? true : undefined,
      isFinalCNSR: s.isFinalCNSR ? true : undefined,
      isSupplier: s.isSupplier ? true : undefined,
      suframaCode: toIntOrUndef(s.suframaCode),
      taxCodeNumber: cleanValue(s.taxCodeNumber),
      phones: s.phones.map((p) => ({
        typeCode: toIntOrUndef(p.typeCode),
        number: cleanValue(p.number),
        branchLine: toIntOrUndef(p.branchLine),
        isDefault: p.isDefault || undefined,
      })),
      emails: s.emails.map((e) => ({
        typeCode: toIntOrUndef(e.typeCode),
        email: cleanValue(e.email),
        isDefault: e.isDefault || undefined,
      })),
      addresses: s.addresses
        .filter((a) => cleanValue(a.zipCode)) // só envia endereços com CEP preenchido
        .map((a) => ({
          addressType: cleanValue(a.addressType),
          sequence: toIntOrUndef(a.sequence),
          postOfficeBox: toIntOrUndef(a.postOfficeBox),
          cityCode: toIntOrUndef(a.cityCode),
          cityName: cleanValue(a.cityName),
          stateAbbreviation: cleanValue(a.stateAbbreviation),
          countryCode: toIntOrUndef(a.countryCode),
          publicPlace: cleanValue(a.publicPlace),
          address: cleanValue(a.address),
          number: toIntOrUndef(a.number),
          complement: cleanValue(a.complement),
          reference: cleanValue(a.reference),
          cep: cleanValue(a.zipCode), // TOTVS espera "cep", não "zipCode"
          neighborhood: cleanValue(a.neighborhood),
        })),
      contacts: s.contacts.map((c) => ({
        sequence: toIntOrUndef(c.sequence),
        typeCode: toIntOrUndef(c.typeCode),
        name: cleanValue(c.name),
        function: cleanValue(c.function),
        phoneNumber: cleanValue(c.phoneNumber),
        cellNumber: cleanValue(c.cellNumber),
        email: cleanValue(c.email),
        birthDate: c.birthDate
          ? new Date(c.birthDate + 'T00:00:00').toISOString()
          : undefined,
        isDefault: c.isDefault || undefined,
      })),
      references: s.references.map((r) => ({
        sequence: toIntOrUndef(r.sequence),
        type: cleanValue(r.type),
        description: cleanValue(r.description),
        phoneNumber: cleanValue(r.phoneNumber),
        responsiblePersonName: cleanValue(r.responsiblePersonName),
        isInactive: r.isInactive || undefined,
      })),
      observations: s.observations.map((o) => ({
        sequence: toIntOrUndef(o.sequence),
        observation: cleanValue(o.observation),
        isMaintenance: o.isMaintenance || undefined,
      })),
      limits: s.limits.map((l) => ({
        branchCode: toIntOrUndef(l.branchCode),
        saleLimitValue: toFloatOrUndef(l.saleLimitValue),
        monthlyLimitValue: toFloatOrUndef(l.monthlyLimitValue),
      })),
      socialNetworks: s.socialNetworks.map((sn) => ({
        sequence: toIntOrUndef(sn.sequence),
        typeCode: toIntOrUndef(sn.typeCode),
        typeName: cleanValue(sn.typeName),
        address: cleanValue(sn.address),
      })),
      classifications: s.classifications.map((c) => ({
        classificationTypeCode: toIntOrUndef(c.classificationTypeCode),
        classificationCode: cleanValue(c.classificationCode),
      })),
      bankAccounts: s.bankAccounts.map((b) => ({
        holderName: cleanValue(b.holderName),
        additionalData: cleanValue(b.additionalData),
        bankNumber: toIntOrUndef(b.bankNumber),
        branchNumber: toIntOrUndef(b.branchNumber),
        accountNumber: cleanValue(b.accountNumber),
        accountDigit: cleanValue(b.accountDigit),
        personType: cleanValue(b.personType),
        accountType: cleanValue(b.accountType),
        purposeType: cleanValue(b.purposeType),
        compensationType: toIntOrUndef(b.compensationType),
        checkType: cleanValue(b.checkType),
        pixKeyType: cleanValue(b.pixKeyType),
        pixKey: cleanValue(b.pixKey),
      })),
      additionalFields: s.additionalFields.map((f) => ({
        code: toIntOrUndef(f.code),
        value: cleanValue(f.value),
      })),
      preferences: {
        paymentConditionCode: toIntOrUndef(s.preferences.paymentConditionCode),
        shippingCompanyCode: toIntOrUndef(s.preferences.shippingCompanyCode),
        freightType: cleanValue(s.preferences.freightType),
        bridgeShippingCompanyCode: toIntOrUndef(
          s.preferences.bridgeShippingCompanyCode,
        ),
        maximumAverageTerm: toIntOrUndef(s.preferences.maximumAverageTerm),
        priceTableCode: toIntOrUndef(s.preferences.priceTableCode),
        orderPriority: toIntOrUndef(s.preferences.orderPriority),
        bearerCode: toIntOrUndef(s.preferences.bearerCode),
      },
    };

    if (tipoPessoa === 'PF') {
      return cleanObject({
        ...common,
        cpf: cleanValue(s.cpf)?.replace(/\D/g, ''),
        rg: cleanValue(s.rg),
        rgFederalAgency: cleanValue(s.rgFederalAgency),
        birthDate: s.birthDate || undefined,
        gender: cleanValue(s.gender),
        maritalStatus: cleanValue(s.maritalStatus),
        motherName: cleanValue(s.motherName),
        fatherName: cleanValue(s.fatherName),
        nationality: cleanValue(s.nationality),
        homeTown: cleanValue(s.homeTown),
        monthlyIncome: toFloatOrUndef(s.monthlyIncome),
        occupation: cleanValue(s.occupation),
        hireDate: s.hireDate || undefined,
        workPlace: cleanValue(s.workPlace),
        ctps: toIntOrUndef(s.ctps),
        ctpsSerial: toIntOrUndef(s.ctpsSerial),
        employee: toIntOrUndef(s.employee),
        employeeIsInactive: s.employeeIsInactive ? true : undefined,
        familiars: s.familiars.map((f) => ({
          name: cleanValue(f.name),
          birthDate: f.birthDate
            ? new Date(f.birthDate + 'T00:00:00').toISOString()
            : undefined,
          gender: cleanValue(f.gender),
          kinshipDescription: cleanValue(f.kinshipDescription),
        })),
        individualAdditionals: {
          ...s.individualAdditionals,
          numberOfChildren: toIntOrUndef(
            s.individualAdditionals.numberOfChildren,
          ),
          numberOfDependents: toIntOrUndef(
            s.individualAdditionals.numberOfDependents,
          ),
          residenceMonths: toIntOrUndef(
            s.individualAdditionals.residenceMonths,
          ),
          workMonths: toIntOrUndef(s.individualAdditionals.workMonths),
          score: toFloatOrUndef(s.individualAdditionals.score),
          risk: toFloatOrUndef(s.individualAdditionals.risk),
          rgType: toIntOrUndef(s.individualAdditionals.rgType),
          passportCountryCode: toIntOrUndef(
            s.individualAdditionals.passportCountryCode,
          ),
          ricCityCode: toIntOrUndef(s.individualAdditionals.ricCityCode),
          homeTown: toIntOrUndef(s.individualAdditionals.homeTown),
        },
      });
    } else {
      return cleanObject({
        ...common,
        cnpj: cleanValue(s.cnpj)?.replace(/\D/g, ''),
        fantasyName: cleanValue(s.fantasyName),
        uf: cleanValue(s.uf),
        numberStateRegistration: cleanValue(s.numberStateRegistration),
        dateFoundation: s.dateFoundation || undefined,
        codeActivity: toIntOrUndef(s.codeActivity),
        numberEmployees: cleanValue(s.numberEmployees),
        monthlyInvoicing: toFloatOrUndef(s.monthlyInvoicing),
        shareCapital: toFloatOrUndef(s.shareCapital),
        codeActivityCnae: toIntOrUndef(s.codeActivityCnae),
        codeActivityCnae2: toIntOrUndef(s.codeActivityCnae2),
        typeTaxRegime: cleanValue(s.typeTaxRegime),
        typeSubTributary: cleanValue(s.typeSubTributary),
        registrationMunicipal: cleanValue(s.registrationMunicipal),
        descriptionJuntaCial: cleanValue(s.descriptionJuntaCial),
        dateRegJuntaCial: s.dateRegJuntaCial || undefined,
        foreignIdentification: cleanValue(s.foreignIdentification),
        initialDateActivity: s.initialDateActivity || undefined,
        finalDateActivity: s.finalDateActivity || undefined,
        isCommercialExp: s.isCommercialExp ? true : undefined,
        typeDescriptionSuFrama: cleanValue(s.typeDescriptionSuFrama),
        partners: s.partners.map((p) => ({
          cpfPartner: cleanValue(p.cpfPartner)?.replace(/\D/g, ''),
          partnerCode: toIntOrUndef(p.partnerCode),
          percentageParticipation: toFloatOrUndef(p.percentageParticipation),
        })),
      });
    }
  }, [state, tipoPessoa]);

  // ─── Envio ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setResultado(null);

    // Validações básicas
    const errors = [];
    if (!state.branchInsertCode)
      errors.push('Empresa de cadastro (branchInsertCode) é obrigatória');
    if (!state.name) errors.push('Nome é obrigatório');
    if (tipoPessoa === 'PF' && !state.cpf) errors.push('CPF é obrigatório');
    if (tipoPessoa === 'PJ' && !state.cnpj) errors.push('CNPJ é obrigatório');

    if (errors.length) {
      setResultado({ ok: false, message: errors.join('\n') });
      return;
    }

    const payload = buildPayload();
    const url =
      tipoPessoa === 'PF'
        ? `${TotvsURL}cliente/individual-customer`
        : `${TotvsURL}cliente/legal-customer`;

    setEnviando(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setResultado({
          ok: false,
          message:
            data.message ||
            'Erro ao cadastrar cliente. Verifique os dados informados.',
          details: data.details || data,
        });
      } else {
        const customerCode =
          data.data?.customerCode ||
          data.data?.data?.customerCode ||
          data.customerCode;

        // Upload de documentos extras para o Supabase (mesmo bucket/tabela do módulo Clientes MTM)
        const personCode = parseInt(customerCode);
        let docsResumo = null;
        if (personCode && Object.keys(documentosPendentes).length > 0) {
          docsResumo = await uploadDocumentosSupabase(personCode);
        }

        const partes = [
          `Cliente cadastrado com sucesso${customerCode ? ` (código: ${customerCode})` : ''}.`,
        ];
        if (docsResumo) {
          if (docsResumo.ok > 0)
            partes.push(
              `${docsResumo.ok} documento(s) anexado(s) no Supabase.`,
            );
          if (docsResumo.err > 0)
            partes.push(
              `${docsResumo.err} documento(s) falharam no upload (ver "Documentos").`,
            );
        }
        setResultado({
          ok: true,
          message: partes.join('\n'),
          data: data.data || data,
        });
      }
    } catch (e) {
      setResultado({
        ok: false,
        message: `Erro de comunicação: ${e.message}`,
      });
    } finally {
      setEnviando(false);
    }
  }, [state, tipoPessoa, buildPayload, documentosPendentes]);

  // ─── Upload de documentos extras no Supabase ──────────────────────────────
  const uploadDocumentosSupabase = useCallback(
    async (personCode) => {
      setUploadingDocs(true);
      let ok = 0;
      let err = 0;
      const novoStatus = { ...uploadStatus };
      for (const [categoria, file] of Object.entries(documentosPendentes)) {
        if (!file) continue;
        novoStatus[categoria] = 'enviando';
        setUploadStatus({ ...novoStatus });
        try {
          const uid =
            (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
            String(Date.now());
          const safeName = file.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `documentos/${personCode}/${categoria}/${uid}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET_DOCS)
            .upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase
            .from('clientes_confianca_documentos')
            .insert({
              person_code: personCode,
              nome_arquivo: file.name,
              file_path: path,
              tipo: file.type,
              uploaded_by: user?.id || null,
              categoria,
            });
          if (insErr) throw insErr;
          novoStatus[categoria] = 'ok';
          ok += 1;
        } catch (e) {
          console.error('Erro upload doc', categoria, e);
          novoStatus[categoria] = 'err';
          err += 1;
        }
        setUploadStatus({ ...novoStatus });
      }
      setUploadingDocs(false);
      return { ok, err };
    },
    [documentosPendentes, uploadStatus, user],
  );

  const limparFormulario = useCallback(() => {
    if (tipoPessoa === 'PF') setPf(initialIndividualState());
    else setPj(initialLegalState());
    setResultado(null);
    setDocumentosPendentes({});
    setUploadStatus({});
  }, [tipoPessoa]);

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = useMemo(
    () => [
      { id: 'formulario', label: 'Formulário', icon: IdentificationCard },
      { id: 'documentos', label: 'Documentos', icon: FolderOpen },
    ],
    [],
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageTitle
        title="Cadastrar Cliente"
        subtitle="Cadastro completo de clientes Pessoa Física e Jurídica no TOTVS"
        icon={UserPlus}
      />

      {/* Toggle PF/PJ */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTipoPessoa('PF')}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
              tipoPessoa === 'PF'
                ? 'bg-[#000638] text-white shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User size={18} weight="bold" />
            Pessoa Física
          </button>
          <button
            onClick={() => setTipoPessoa('PJ')}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
              tipoPessoa === 'PJ'
                ? 'bg-[#000638] text-white shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Buildings size={18} weight="bold" />
            Pessoa Jurídica
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tabAtiva === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTabAtiva(t.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1 ${
                active
                  ? 'border-[#000638] text-[#000638]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={14} weight="bold" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das tabs */}
      <div className="space-y-4">
        {tabAtiva === 'formulario' && (
          <Section title="Dados Básicos" icon={IdentificationCard}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Empresa de cadastro (código)" required>
                <input
                  type="number"
                  className={inputCls}
                  value={state.branchInsertCode}
                  onChange={(e) =>
                    updateField('branchInsertCode', e.target.value)
                  }
                  placeholder="Ex: 1"
                />
              </Field>
              <Field label="Data de cadastro">
                <input
                  type="date"
                  className={inputCls}
                  value={state.insertDate}
                  onChange={(e) => updateField('insertDate', e.target.value)}
                />
              </Field>
              <Field label="Nome" required span={2}>
                <input
                  type="text"
                  className={inputCls}
                  value={state.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  maxLength={60}
                />
              </Field>

              {tipoPessoa === 'PF' ? (
                <>
                  <Field label="CPF" required>
                    <input
                      type="text"
                      className={inputCls}
                      value={state.cpf}
                      onChange={(e) => updateField('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </Field>
                  <Field label="RG">
                    <input
                      type="text"
                      className={inputCls}
                      value={state.rg}
                      onChange={(e) => updateField('rg', e.target.value)}
                      maxLength={20}
                    />
                  </Field>
                  <Field label="Órgão expedidor RG">
                    <input
                      type="text"
                      className={inputCls}
                      value={state.rgFederalAgency}
                      onChange={(e) =>
                        updateField('rgFederalAgency', e.target.value)
                      }
                      maxLength={10}
                    />
                  </Field>
                  <Field label="Data de nascimento">
                    <input
                      type="date"
                      className={inputCls}
                      value={state.birthDate}
                      onChange={(e) => updateField('birthDate', e.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="CNPJ" required>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className={inputCls}
                        value={state.cnpj}
                        onChange={(e) => updateField('cnpj', e.target.value)}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                      <button
                        type="button"
                        onClick={buscarDadosCnpj}
                        disabled={
                          buscandoCnpj ||
                          String(state.cnpj || '').replace(/\D/g, '').length !==
                            14
                        }
                        className="shrink-0 flex items-center gap-1.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                        title="Preencher dados automaticamente pela Receita (BrasilAPI)"
                      >
                        {buscandoCnpj ? (
                          <Spinner size={14} className="animate-spin" />
                        ) : (
                          <MagnifyingGlass size={14} weight="bold" />
                        )}
                        Buscar
                      </button>
                    </div>
                    {cnpjBuscaErro && (
                      <p className="mt-1 text-[10px] text-red-600 font-semibold">
                        {cnpjBuscaErro}
                      </p>
                    )}
                  </Field>
                  <Field label="Nome fantasia">
                    <input
                      type="text"
                      className={inputCls}
                      value={state.fantasyName}
                      onChange={(e) =>
                        updateField('fantasyName', e.target.value)
                      }
                      maxLength={60}
                    />
                  </Field>
                  <Field label="UF">
                    <select
                      className={inputCls}
                      value={state.uf}
                      onChange={(e) => updateField('uf', e.target.value)}
                    >
                      {STATE_OPTIONS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf || '— Selecione —'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Inscrição estadual">
                    <input
                      type="text"
                      className={inputCls}
                      value={state.numberStateRegistration}
                      onChange={(e) =>
                        updateField('numberStateRegistration', e.target.value)
                      }
                      maxLength={18}
                    />
                  </Field>
                </>
              )}

              <Field label="Status do cadastro">
                <select
                  className={inputCls}
                  value={state.registrationStatus}
                  onChange={(e) =>
                    updateField('registrationStatus', e.target.value)
                  }
                >
                  {REGISTRATION_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Home page">
                <input
                  type="text"
                  className={inputCls}
                  value={state.homePage}
                  onChange={(e) => updateField('homePage', e.target.value)}
                  maxLength={100}
                />
              </Field>
              <Field label="Suframa">
                <input
                  type="number"
                  className={inputCls}
                  value={state.suframaCode}
                  onChange={(e) => updateField('suframaCode', e.target.value)}
                />
              </Field>
              <Field label="Código fiscal">
                <input
                  type="text"
                  className={inputCls}
                  value={state.taxCodeNumber}
                  onChange={(e) => updateField('taxCodeNumber', e.target.value)}
                  maxLength={20}
                />
              </Field>

              <div className="col-span-full flex flex-wrap gap-4 pt-2 border-t border-gray-100 mt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={state.isInactive}
                    onChange={(e) =>
                      updateField('isInactive', e.target.checked)
                    }
                  />
                  Inativo
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={state.isBloqued}
                    onChange={(e) => updateField('isBloqued', e.target.checked)}
                  />
                  Bloqueado
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={state.isFinalCNSR}
                    onChange={(e) =>
                      updateField('isFinalCNSR', e.target.checked)
                    }
                  />
                  Consumidor Final
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                  <input
                    type="checkbox"
                    checked={state.isSupplier}
                    onChange={(e) =>
                      updateField('isSupplier', e.target.checked)
                    }
                  />
                  <Truck size={14} weight="bold" /> Também é Fornecedor
                </label>
              </div>
            </div>
          </Section>
        )}

        {tabAtiva === 'formulario' && tipoPessoa === 'PF' && (
          <>
            <Section title="Dados Pessoa Física" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Sexo">
                  <select
                    className={inputCls}
                    value={state.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                  >
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado civil">
                  <select
                    className={inputCls}
                    value={state.maritalStatus}
                    onChange={(e) =>
                      updateField('maritalStatus', e.target.value)
                    }
                  >
                    {MARITAL_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nacionalidade">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.nationality}
                    onChange={(e) => updateField('nationality', e.target.value)}
                    maxLength={30}
                  />
                </Field>
                <Field label="Local de nascimento">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.homeTown}
                    onChange={(e) => updateField('homeTown', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="Nome da mãe" span={2}>
                  <input
                    type="text"
                    className={inputCls}
                    value={state.motherName}
                    onChange={(e) => updateField('motherName', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="Nome do pai" span={2}>
                  <input
                    type="text"
                    className={inputCls}
                    value={state.fatherName}
                    onChange={(e) => updateField('fatherName', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="Renda mensal">
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    value={state.monthlyIncome}
                    onChange={(e) =>
                      updateField('monthlyIncome', e.target.value)
                    }
                  />
                </Field>
                <Field label="Cargo">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.occupation}
                    onChange={(e) => updateField('occupation', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="Data admissão">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.hireDate}
                    onChange={(e) => updateField('hireDate', e.target.value)}
                  />
                </Field>
                <Field label="Local trabalho">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.workPlace}
                    onChange={(e) => updateField('workPlace', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="CTPS Nº">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.ctps}
                    onChange={(e) => updateField('ctps', e.target.value)}
                  />
                </Field>
                <Field label="CTPS Série">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.ctpsSerial}
                    onChange={(e) => updateField('ctpsSerial', e.target.value)}
                  />
                </Field>
                <Field label="Código funcionário">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.employee}
                    onChange={(e) => updateField('employee', e.target.value)}
                  />
                </Field>
                <div className="col-span-full flex flex-wrap gap-4 pt-2 border-t border-gray-100 mt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={state.employeeIsInactive}
                      onChange={(e) =>
                        updateField('employeeIsInactive', e.target.checked)
                      }
                    />
                    Funcionário inativo
                  </label>
                </div>
              </div>
            </Section>

            <Section
              title="Dados Adicionais PF (PESFM020)"
              icon={IdentificationCard}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Escolaridade">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.educationLevel}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'educationLevel',
                        e.target.value,
                      )
                    }
                  >
                    {EDUCATION_LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Qtde filhos">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.numberOfChildren}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'numberOfChildren',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Qtde dependentes">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.numberOfDependents}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'numberOfDependents',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Tipo de moradia">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.homeType}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'homeType',
                        e.target.value,
                      )
                    }
                  >
                    {HOME_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de veículo">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.carType}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'carType',
                        e.target.value,
                      )
                    }
                  >
                    {CAR_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Meses residência">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.residenceMonths}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'residenceMonths',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Meses trabalho">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.workMonths}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'workMonths',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Trabalho anterior">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.previousWorkPlace}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'previousWorkPlace',
                        e.target.value,
                      )
                    }
                    maxLength={60}
                  />
                </Field>
                <Field label="Reside desde">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.residingSinceDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'residingSinceDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Score">
                  <input
                    type="number"
                    step="0.001"
                    className={inputCls}
                    value={state.individualAdditionals.score}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'score',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Risco">
                  <input
                    type="number"
                    step="0.001"
                    className={inputCls}
                    value={state.individualAdditionals.risk}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'risk',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Atualização SPC">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.spcUpdateDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'spcUpdateDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Tipo RG">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.rgType}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'rgType',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Data expedição RG">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.rgIssueDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'rgIssueDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Nome social">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.socialName}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'socialName',
                        e.target.value,
                      )
                    }
                    maxLength={70}
                  />
                </Field>
                <Field label="Apelido">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.nickname}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'nickname',
                        e.target.value,
                      )
                    }
                    maxLength={40}
                  />
                </Field>
                <Field label="Passaporte Nº">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.passportNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'passportNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Passaporte país (cód)">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.passportCountryCode}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'passportCountryCode',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Passaporte UF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.passportState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'passportState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="Passaporte emissão">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.passportIssueDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'passportIssueDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Passaporte validade">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.passportExpirationDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'passportExpirationDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CNH Nº">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.driverLicenseNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CNH categoria">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.driverLicenseCategory}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseCategory',
                        e.target.value,
                      )
                    }
                  >
                    {DRIVER_LICENSE_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="CNH órgão">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.driverLicenseAgency}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseAgency',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="CNH validade">
                  <input
                    type="date"
                    className={inputCls}
                    value={
                      state.individualAdditionals.driverLicenseExpirationDate
                    }
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseExpirationDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="1ª CNH">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.firstDriverLicenseDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'firstDriverLicenseDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CNH Nº segurança">
                  <input
                    type="text"
                    className={inputCls}
                    value={
                      state.individualAdditionals.driverLicenseSecurityNumber
                    }
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseSecurityNumber',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="CNH Nº registro">
                  <input
                    type="text"
                    className={inputCls}
                    value={
                      state.individualAdditionals
                        .driverLicenseRegistrationNumber
                    }
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'driverLicenseRegistrationNumber',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="Título eleitoral">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.voterRegistrationNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'voterRegistrationNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Zona eleitoral">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.voterZone}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'voterZone',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Seção eleitoral">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.voterSection}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'voterSection',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Certificado militar">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.militaryCertificateType}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'militaryCertificateType',
                        e.target.value,
                      )
                    }
                  >
                    {MILITARY_CERTIFICATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Categoria militar">
                  <select
                    className={inputCls}
                    value={state.individualAdditionals.militaryCategory}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'militaryCategory',
                        e.target.value,
                      )
                    }
                  >
                    {MILITARY_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dispensa militar">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.militaryDispensation}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'militaryDispensation',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="NIT">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.nitNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'nitNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CTPS UF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.ctpsState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ctpsState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="PIS Nº">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.pisNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'pisNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="PIS UF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.pisState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'pisState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="PIS emissão">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.pisIssueDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'pisIssueDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Insc. Estadual PF">
                  <input
                    type="text"
                    className={inputCls}
                    value={
                      state.individualAdditionals.ruralProducerRegistration
                    }
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ruralProducerRegistration',
                        e.target.value,
                      )
                    }
                    maxLength={18}
                  />
                </Field>
                <Field label="UF Insc. PF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.ruralProducerState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ruralProducerState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="CIF emissor">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.cifIssuer}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'cifIssuer',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="CIF UF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.cifState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'cifState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="CIF número">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.cifNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'cifNumber',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="UF nascimento">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.birthState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'birthState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="RIC número">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.ricNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="RIC UF">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.ricState}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricState',
                        e.target.value,
                      )
                    }
                    maxLength={2}
                  />
                </Field>
                <Field label="RIC emissor">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.ricIssuer}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricIssuer',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="RIC município (cód)">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.ricCityCode}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricCityCode',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="RIC expedição">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.ricIssueDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricIssueDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="RIC validade">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.ricExpirationDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'ricExpirationDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Doc. estrangeiro">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.foreignDocumentNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'foreignDocumentNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Nº ambulante">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.streetVendorNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'streetVendorNumber',
                        e.target.value,
                      )
                    }
                    maxLength={20}
                  />
                </Field>
                <Field label="CRC Nº">
                  <input
                    type="text"
                    className={inputCls}
                    value={state.individualAdditionals.crcNumber}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'crcNumber',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CRC inscrição">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.crcRegistrationDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'crcRegistrationDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="CRC validade">
                  <input
                    type="date"
                    className={inputCls}
                    value={state.individualAdditionals.crcExpirationDate}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'crcExpirationDate',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <Field label="Local nascimento (cód.)">
                  <input
                    type="number"
                    className={inputCls}
                    value={state.individualAdditionals.homeTown}
                    onChange={(e) =>
                      updateNested(
                        'individualAdditionals',
                        'homeTown',
                        e.target.value,
                      )
                    }
                  />
                </Field>
                <div className="col-span-full flex flex-wrap gap-4 pt-2 border-t border-gray-100 mt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={state.individualAdditionals.isStreetVendor}
                      onChange={(e) =>
                        updateNested(
                          'individualAdditionals',
                          'isStreetVendor',
                          e.target.checked,
                        )
                      }
                    />
                    Trabalho informal (ambulante)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={state.individualAdditionals.isInformalWorker}
                      onChange={(e) =>
                        updateNested(
                          'individualAdditionals',
                          'isInformalWorker',
                          e.target.checked,
                        )
                      }
                    />
                    Ambulante
                  </label>
                </div>
              </div>
            </Section>
          </>
        )}

        {tabAtiva === 'formulario' && tipoPessoa === 'PJ' && (
          <Section title="Dados Pessoa Jurídica" icon={Buildings}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Data de fundação">
                <input
                  type="date"
                  className={inputCls}
                  value={state.dateFoundation}
                  onChange={(e) =>
                    updateField('dateFoundation', e.target.value)
                  }
                />
              </Field>
              <Field label="Código de atividade">
                <input
                  type="number"
                  className={inputCls}
                  value={state.codeActivity}
                  onChange={(e) => updateField('codeActivity', e.target.value)}
                />
              </Field>
              <Field label="Nº de funcionários">
                <select
                  className={inputCls}
                  value={state.numberEmployees}
                  onChange={(e) =>
                    updateField('numberEmployees', e.target.value)
                  }
                >
                  {NUMBER_EMPLOYER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Faturamento mensal">
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={state.monthlyInvoicing}
                  onChange={(e) =>
                    updateField('monthlyInvoicing', e.target.value)
                  }
                />
              </Field>
              <Field label="Capital social">
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={state.shareCapital}
                  onChange={(e) => updateField('shareCapital', e.target.value)}
                />
              </Field>
              <Field label="CNAE">
                <input
                  type="number"
                  className={inputCls}
                  value={state.codeActivityCnae}
                  onChange={(e) =>
                    updateField('codeActivityCnae', e.target.value)
                  }
                />
              </Field>
              <Field label="2º CNAE">
                <input
                  type="number"
                  className={inputCls}
                  value={state.codeActivityCnae2}
                  onChange={(e) =>
                    updateField('codeActivityCnae2', e.target.value)
                  }
                />
              </Field>
              <Field label="Regime tributário">
                <select
                  className={inputCls}
                  value={state.typeTaxRegime}
                  onChange={(e) => updateField('typeTaxRegime', e.target.value)}
                >
                  {TAX_REGIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Substituição tributária">
                <select
                  className={inputCls}
                  value={state.typeSubTributary}
                  onChange={(e) =>
                    updateField('typeSubTributary', e.target.value)
                  }
                >
                  {SUBTRIBUTARY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Desc. SUFRAMA">
                <select
                  className={inputCls}
                  value={state.typeDescriptionSuFrama}
                  onChange={(e) =>
                    updateField('typeDescriptionSuFrama', e.target.value)
                  }
                >
                  {SUFRAMA_DESC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Inscrição municipal">
                <input
                  type="text"
                  className={inputCls}
                  value={state.registrationMunicipal}
                  onChange={(e) =>
                    updateField('registrationMunicipal', e.target.value)
                  }
                  maxLength={18}
                />
              </Field>
              <Field label="Junta comercial / CVM">
                <input
                  type="text"
                  className={inputCls}
                  value={state.descriptionJuntaCial}
                  onChange={(e) =>
                    updateField('descriptionJuntaCial', e.target.value)
                  }
                  maxLength={20}
                />
              </Field>
              <Field label="Dt. reg. junta com.">
                <input
                  type="date"
                  className={inputCls}
                  value={state.dateRegJuntaCial}
                  onChange={(e) =>
                    updateField('dateRegJuntaCial', e.target.value)
                  }
                />
              </Field>
              <Field label="ID. estrangeiro">
                <input
                  type="text"
                  className={inputCls}
                  value={state.foreignIdentification}
                  onChange={(e) =>
                    updateField('foreignIdentification', e.target.value)
                  }
                  maxLength={20}
                />
              </Field>
              <Field label="Início atividade">
                <input
                  type="date"
                  className={inputCls}
                  value={state.initialDateActivity}
                  onChange={(e) =>
                    updateField('initialDateActivity', e.target.value)
                  }
                />
              </Field>
              <Field label="Fim atividade">
                <input
                  type="date"
                  className={inputCls}
                  value={state.finalDateActivity}
                  onChange={(e) =>
                    updateField('finalDateActivity', e.target.value)
                  }
                />
              </Field>
              <div className="col-span-full flex flex-wrap gap-4 pt-2 border-t border-gray-100 mt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={state.isCommercialExp}
                    onChange={(e) =>
                      updateField('isCommercialExp', e.target.checked)
                    }
                  />
                  Comercial exportadora
                </label>
              </div>
            </div>
          </Section>
        )}

        {tabAtiva === 'formulario' && (
          <Section
            title="Endereços"
            icon={MapPin}
            actions={
              <button
                onClick={() => addToList('addresses', emptyAddress)}
                className="text-xs font-semibold px-2 py-1 rounded bg-[#000638] text-white flex items-center gap-1 hover:bg-[#001A6B]"
              >
                <Plus size={14} /> Adicionar
              </button>
            }
          >
            {state.addresses.length === 0 && (
              <p className="text-xs text-gray-500">
                Nenhum endereço adicionado.
              </p>
            )}
            <div className="space-y-3">
              {state.addresses.map((a, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-6 gap-2 p-2 border rounded bg-gray-50"
                >
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={a.addressType}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'addressType',
                          e.target.value,
                        )
                      }
                    >
                      {ADDRESS_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="CEP">
                    <input
                      type="text"
                      className={inputCls}
                      value={a.zipCode}
                      onChange={(e) =>
                        updateList('addresses', idx, 'zipCode', e.target.value)
                      }
                      maxLength={8}
                    />
                  </Field>
                  <Field label="Logradouro" span={2}>
                    <input
                      type="text"
                      className={inputCls}
                      value={a.address}
                      onChange={(e) =>
                        updateList('addresses', idx, 'address', e.target.value)
                      }
                      maxLength={60}
                    />
                  </Field>
                  <Field label="Número">
                    <input
                      type="number"
                      className={inputCls}
                      value={a.number}
                      onChange={(e) =>
                        updateList('addresses', idx, 'number', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Complemento">
                    <input
                      type="text"
                      className={inputCls}
                      value={a.complement}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'complement',
                          e.target.value,
                        )
                      }
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Bairro">
                    <input
                      type="text"
                      className={inputCls}
                      value={a.neighborhood}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'neighborhood',
                          e.target.value,
                        )
                      }
                      maxLength={60}
                    />
                  </Field>
                  <Field label="Cidade">
                    <input
                      type="text"
                      className={inputCls}
                      value={a.cityName}
                      onChange={(e) =>
                        updateList('addresses', idx, 'cityName', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Cidade (cód.)">
                    <input
                      type="number"
                      className={inputCls}
                      value={a.cityCode}
                      onChange={(e) =>
                        updateList('addresses', idx, 'cityCode', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="UF">
                    <select
                      className={inputCls}
                      value={a.stateAbbreviation}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'stateAbbreviation',
                          e.target.value,
                        )
                      }
                    >
                      {STATE_OPTIONS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf || '— —'}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="País (cód.)">
                    <input
                      type="number"
                      className={inputCls}
                      value={a.countryCode}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'countryCode',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Caixa postal">
                    <input
                      type="number"
                      className={inputCls}
                      value={a.postOfficeBox}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'postOfficeBox',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Tipo logradouro">
                    <input
                      type="text"
                      className={inputCls}
                      value={a.publicPlace}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'publicPlace',
                          e.target.value,
                        )
                      }
                      maxLength={10}
                    />
                  </Field>
                  <Field label="Referência" span={2}>
                    <input
                      type="text"
                      className={inputCls}
                      value={a.reference}
                      onChange={(e) =>
                        updateList(
                          'addresses',
                          idx,
                          'reference',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Sequência">
                    <input
                      type="number"
                      className={inputCls}
                      value={a.sequence}
                      onChange={(e) =>
                        updateList('addresses', idx, 'sequence', e.target.value)
                      }
                    />
                  </Field>
                  <div className="col-span-full flex justify-end">
                    <button
                      onClick={() => removeFromList('addresses', idx)}
                      className="text-red-600 text-xs flex items-center gap-1 hover:underline"
                    >
                      <Trash size={14} /> Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tabAtiva === 'formulario' && (
          <Section
            title="Telefones"
            icon={Phone}
            actions={
              <button
                onClick={() => addToList('phones', emptyPhone)}
                className="text-xs font-semibold px-2 py-1 rounded bg-[#000638] text-white flex items-center gap-1 hover:bg-[#001A6B]"
              >
                <Plus size={14} /> Adicionar
              </button>
            }
          >
            {state.phones.length === 0 && (
              <p className="text-xs text-gray-500">
                Nenhum telefone adicionado.
              </p>
            )}
            <div className="space-y-3">
              {state.phones.map((p, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 border rounded bg-gray-50"
                >
                  <Field label="Tipo (cód.)">
                    <input
                      type="number"
                      className={inputCls}
                      value={p.typeCode}
                      onChange={(e) =>
                        updateList('phones', idx, 'typeCode', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Número" span={2}>
                    <input
                      type="text"
                      className={inputCls}
                      value={p.number}
                      onChange={(e) =>
                        updateList('phones', idx, 'number', e.target.value)
                      }
                      maxLength={20}
                    />
                  </Field>
                  <Field label="Ramal">
                    <input
                      type="number"
                      className={inputCls}
                      value={p.branchLine}
                      onChange={(e) =>
                        updateList('phones', idx, 'branchLine', e.target.value)
                      }
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={p.isDefault}
                        onChange={(e) =>
                          updateList(
                            'phones',
                            idx,
                            'isDefault',
                            e.target.checked,
                          )
                        }
                      />
                      Padrão
                    </label>
                    <button
                      onClick={() => removeFromList('phones', idx)}
                      className="text-red-600 text-xs flex items-center gap-1 hover:underline ml-auto"
                    >
                      <Trash size={14} /> Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tabAtiva === 'formulario' && (
          <Section
            title="E-mails"
            icon={EnvelopeSimple}
            actions={
              <button
                onClick={() => addToList('emails', emptyEmail)}
                className="text-xs font-semibold px-2 py-1 rounded bg-[#000638] text-white flex items-center gap-1 hover:bg-[#001A6B]"
              >
                <Plus size={14} /> Adicionar
              </button>
            }
          >
            {state.emails.length === 0 && (
              <p className="text-xs text-gray-500">Nenhum e-mail adicionado.</p>
            )}
            <div className="space-y-3">
              {state.emails.map((e, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 border rounded bg-gray-50"
                >
                  <Field label="Tipo (cód.)">
                    <input
                      type="number"
                      className={inputCls}
                      value={e.typeCode}
                      onChange={(ev) =>
                        updateList('emails', idx, 'typeCode', ev.target.value)
                      }
                    />
                  </Field>
                  <Field label="E-mail" span={3}>
                    <input
                      type="email"
                      className={inputCls}
                      value={e.email}
                      onChange={(ev) =>
                        updateList('emails', idx, 'email', ev.target.value)
                      }
                      maxLength={60}
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={e.isDefault}
                        onChange={(ev) =>
                          updateList(
                            'emails',
                            idx,
                            'isDefault',
                            ev.target.checked,
                          )
                        }
                      />
                      Padrão
                    </label>
                    <button
                      onClick={() => removeFromList('emails', idx)}
                      className="text-red-600 text-xs flex items-center gap-1 hover:underline ml-auto"
                    >
                      <Trash size={14} /> Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tabAtiva === 'formulario' && (
          <Section
            title="Contas Bancárias"
            icon={Bank}
            actions={
              <button
                onClick={() => addToList('bankAccounts', emptyBankAccount)}
                className="text-xs font-semibold px-2 py-1 rounded bg-[#000638] text-white flex items-center gap-1 hover:bg-[#001A6B]"
              >
                <Plus size={14} /> Adicionar
              </button>
            }
          >
            {state.bankAccounts.length === 0 && (
              <p className="text-xs text-gray-500">Nenhuma conta adicionada.</p>
            )}
            <div className="space-y-3">
              {state.bankAccounts.map((b, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2 border rounded bg-gray-50"
                >
                  <Field label="Titular" span={2}>
                    <input
                      type="text"
                      className={inputCls}
                      value={b.holderName}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'holderName',
                          e.target.value,
                        )
                      }
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Dados adicionais" span={2}>
                    <input
                      type="text"
                      className={inputCls}
                      value={b.additionalData}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'additionalData',
                          e.target.value,
                        )
                      }
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Banco">
                    <input
                      type="number"
                      className={inputCls}
                      value={b.bankNumber}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'bankNumber',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Agência">
                    <input
                      type="number"
                      className={inputCls}
                      value={b.branchNumber}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'branchNumber',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Conta">
                    <input
                      type="text"
                      className={inputCls}
                      value={b.accountNumber}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'accountNumber',
                          e.target.value,
                        )
                      }
                      maxLength={20}
                    />
                  </Field>
                  <Field label="Dígito">
                    <input
                      type="text"
                      className={inputCls}
                      value={b.accountDigit}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'accountDigit',
                          e.target.value,
                        )
                      }
                      maxLength={2}
                    />
                  </Field>
                  <Field label="Tipo pessoa">
                    <select
                      className={inputCls}
                      value={b.personType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'personType',
                          e.target.value,
                        )
                      }
                    >
                      {PERSON_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tipo conta">
                    <select
                      className={inputCls}
                      value={b.accountType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'accountType',
                          e.target.value,
                        )
                      }
                    >
                      {BANK_ACCOUNT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Finalidade">
                    <select
                      className={inputCls}
                      value={b.purposeType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'purposeType',
                          e.target.value,
                        )
                      }
                    >
                      {BANK_ACCOUNT_PURPOSE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tipo cheque">
                    <select
                      className={inputCls}
                      value={b.checkType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'checkType',
                          e.target.value,
                        )
                      }
                    >
                      {BANK_ACCOUNT_CHECK_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tipo compensação">
                    <input
                      type="number"
                      className={inputCls}
                      value={b.compensationType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'compensationType',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Tipo chave PIX">
                    <select
                      className={inputCls}
                      value={b.pixKeyType}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'pixKeyType',
                          e.target.value,
                        )
                      }
                    >
                      {PIX_KEY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Chave PIX" span={3}>
                    <input
                      type="text"
                      className={inputCls}
                      value={b.pixKey}
                      onChange={(e) =>
                        updateList(
                          'bankAccounts',
                          idx,
                          'pixKey',
                          e.target.value,
                        )
                      }
                      maxLength={100}
                    />
                  </Field>
                  <div className="col-span-full flex justify-end">
                    <button
                      onClick={() => removeFromList('bankAccounts', idx)}
                      className="text-red-600 text-xs flex items-center gap-1 hover:underline"
                    >
                      <Trash size={14} /> Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tabAtiva === 'documentos' && (
          <Section
            title="Documentos extras (anexos do perfil)"
            icon={FolderOpen}
          >
            <p className="text-xs text-gray-600 mb-3">
              Anexe os documentos abaixo para enriquecer o perfil do cliente.
              Após o cadastro ser confirmado na TOTVS, os arquivos serão
              enviados ao Supabase (bucket <code>{BUCKET_DOCS}</code>) e ficarão
              disponíveis no módulo <strong>Clientes MTM</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CATEGORIAS_DOCUMENTOS.filter(
                (c) => !(c.onlyPJ && tipoPessoa !== 'PJ'),
              ).map((cat) => {
                const file = documentosPendentes[cat.key];
                const status = uploadStatus[cat.key];
                return (
                  <div
                    key={cat.key}
                    className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gray-600" />
                        <span className="text-xs font-semibold text-gray-800">
                          {cat.label}
                        </span>
                      </div>
                      {status === 'ok' && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                          ENVIADO
                        </span>
                      )}
                      {status === 'enviando' && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                          ENVIANDO...
                        </span>
                      )}
                      {status === 'err' && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                          ERRO
                        </span>
                      )}
                    </div>
                    {file ? (
                      <div className="flex items-center justify-between gap-2 bg-white border rounded px-2 py-1">
                        <span
                          className="text-xs text-gray-700 truncate"
                          title={file.name}
                        >
                          {file.name}{' '}
                          <span className="text-gray-400">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDocumentosPendentes((prev) => {
                              const next = { ...prev };
                              delete next[cat.key];
                              return next;
                            })
                          }
                          className="text-red-600 hover:text-red-800"
                          title="Remover seleção"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-2 py-1.5 bg-white border border-dashed border-gray-300 rounded cursor-pointer hover:bg-blue-50 text-xs text-gray-600">
                        <FileArrowUp size={14} />
                        <span>Selecionar arquivo...</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setDocumentosPendentes((prev) => ({
                              ...prev,
                              [cat.key]: f,
                            }));
                            setUploadStatus((prev) => {
                              const next = { ...prev };
                              delete next[cat.key];
                              return next;
                            });
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            {uploadingDocs && (
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-700">
                <span className="inline-block w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></span>
                Enviando documentos ao Supabase...
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Feedback */}
      {resultado && (
        <div
          className={`mt-4 p-3 rounded-lg border ${
            resultado.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {resultado.ok ? (
              <CheckCircle
                size={20}
                weight="fill"
                className="text-green-600 mt-0.5"
              />
            ) : (
              <XCircle
                size={20}
                weight="fill"
                className="text-red-600 mt-0.5"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold whitespace-pre-line">
                {resultado.message}
              </p>
              {resultado.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold">
                    Detalhes técnicos
                  </summary>
                  <pre className="text-xs mt-1 max-h-60 overflow-auto bg-white p-2 rounded border">
                    {JSON.stringify(resultado.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 mt-6 -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex flex-wrap items-center justify-end gap-2 shadow-md">
        <button
          type="button"
          onClick={limparFormulario}
          disabled={enviando}
          className="px-4 py-2 text-sm font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={enviando}
          className="px-6 py-2 text-sm font-semibold rounded bg-[#000638] text-white hover:bg-[#001A6B] disabled:opacity-50 flex items-center gap-2"
        >
          {enviando ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Enviando...
            </>
          ) : (
            <>
              <FloppyDisk size={16} weight="bold" />
              {tipoPessoa === 'PF'
                ? 'Cadastrar Pessoa Física'
                : 'Cadastrar Pessoa Jurídica'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
