import React, { useState, useCallback } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../components/ui/cards';
import {
  Ticket,
  MagnifyingGlass,
  CircleNotch,
  User,
  IdentificationCard,
  CheckCircle,
  WarningCircle,
  Copy,
  Check,
} from '@phosphor-icons/react';

// Configuração padrão do voucher (espelha VAREJO_VOUCHER_CONFIG no backend)
const VOUCHER_CONFIG = {
  prefixo: 'PROMO',
  desconto: 50,
  compraMinima: 100,
  validadeDias: 1,
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
};

// Formata CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
const formatDocument = (doc) => {
  if (!doc) return '—';
  const d = String(doc).replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

const VoucherVarejo = () => {
  const { apiMutate } = useApiClient();

  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [erroBusca, setErroBusca] = useState(null);

  const [gerando, setGerando] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [erroGeracao, setErroGeracao] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const resetResultados = () => {
    setCliente(null);
    setVoucher(null);
    setErroBusca(null);
    setErroGeracao(null);
    setCopiado(false);
  };

  const buscarCliente = useCallback(async () => {
    const termo = query.trim();
    if (!termo) {
      setErroBusca('Informe o CPF, CNPJ ou código do cliente.');
      return;
    }
    setBuscando(true);
    resetResultados();
    try {
      const result = await apiMutate(
        '/api/totvs/vouchers/varejo/customer-lookup',
        'POST',
        { query: termo },
      );
      const c = result?.data?.customer;
      if (!c) {
        setErroBusca('Cliente não encontrado.');
        return;
      }
      setCliente(c);
    } catch (error) {
      setErroBusca(error.message || 'Erro ao buscar cliente.');
    } finally {
      setBuscando(false);
    }
  }, [query, apiMutate]);

  const gerarVoucher = useCallback(async () => {
    if (!cliente) return;
    setGerando(true);
    setErroGeracao(null);
    setVoucher(null);
    setCopiado(false);
    try {
      const result = await apiMutate(
        '/api/totvs/vouchers/varejo/generate',
        'POST',
        {
          customerCode: cliente.code,
          cpfCnpj: cliente.document,
          customerName: cliente.name,
        },
      );
      const data = result?.data;
      if (!data) {
        setErroGeracao('Resposta inesperada ao gerar o voucher.');
        return;
      }
      setVoucher(data);
    } catch (error) {
      setErroGeracao(error.message || 'Erro ao gerar o voucher.');
    } finally {
      setGerando(false);
    }
  }, [cliente, apiMutate]);

  const copiarCodigo = useCallback((codigo) => {
    if (!codigo) return;
    try {
      navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }, []);

  const codigoVoucher =
    voucher?.voucher?.voucherCode || voucher?.baseVoucherCode || null;

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <PageTitle
        title="Voucher Varejo"
        subtitle="Gere um voucher de desconto e vincule ao cliente pela API TOTVS"
        icon={Ticket}
        iconColor="text-purple-600"
      />

      {/* Regras do voucher */}
      <Card className="shadow-lg rounded-xl bg-white mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-[#000638]" />
            <CardTitle className="text-sm font-bold text-[#000638]">
              Regras do voucher
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Desconto
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {formatCurrency(VOUCHER_CONFIG.desconto)}
              </p>
            </div>
            <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Compra mínima
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {formatCurrency(VOUCHER_CONFIG.compraMinima)}
              </p>
            </div>
            <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Validade
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {VOUCHER_CONFIG.validadeDias} dia
              </p>
            </div>
            <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Prefixo
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {VOUCHER_CONFIG.prefixo}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            O voucher só é válido para compras acima de{' '}
            {formatCurrency(VOUCHER_CONFIG.compraMinima)}.
          </p>
        </CardContent>
      </Card>

      {/* Busca do cliente */}
      <Card className="shadow-lg rounded-xl bg-white mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={18} className="text-[#000638]" />
            <CardTitle className="text-sm font-bold text-[#000638]">
              Cliente
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Pesquise pelo CPF, CNPJ ou código do cliente
          </CardDescription>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscarCliente();
              }}
              placeholder="CPF, CNPJ ou código"
              className="flex-1 border border-[#000638]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-sm"
            />
            <button
              onClick={buscarCliente}
              disabled={buscando || !query.trim()}
              className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors justify-center text-sm"
            >
              {buscando ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={16} />
                  Buscar
                </>
              )}
            </button>
          </div>

          {erroBusca && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              <span>{erroBusca}</span>
            </div>
          )}

          {cliente && (
            <div className="mt-4 border border-[#000638]/15 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#000638]/10 text-[#000638]">
                  {cliente.personType === 'PJ'
                    ? 'Pessoa Jurídica'
                    : 'Pessoa Física'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-[#000638] shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      Nome
                    </p>
                    <p className="text-sm font-semibold text-[#000638]">
                      {cliente.name || '—'}
                    </p>
                    {cliente.fantasyName && (
                      <p className="text-xs text-gray-500">
                        {cliente.fantasyName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IdentificationCard
                    size={18}
                    className="text-[#000638] shrink-0"
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {cliente.documentType}
                    </p>
                    <p className="text-sm font-semibold text-[#000638]">
                      {formatDocument(cliente.document)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Código: {cliente.code}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={gerarVoucher}
                disabled={gerando}
                className="mt-4 w-full flex items-center gap-2 bg-[#fe0000] text-white px-4 py-2.5 rounded-lg hover:bg-[#c50000] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors justify-center text-sm"
              >
                {gerando ? (
                  <>
                    <CircleNotch size={18} className="animate-spin" />
                    Gerando voucher...
                  </>
                ) : (
                  <>
                    <Ticket size={18} />
                    GERAR VOUCHER
                  </>
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado da geração */}
      {erroGeracao && (
        <Card className="shadow-lg rounded-xl bg-white mb-6 border border-red-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-red-700 text-sm">
              <WarningCircle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível gerar o voucher</p>
                <p className="text-red-600">{erroGeracao}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {voucher && (
        <Card className="shadow-lg rounded-xl bg-white mb-6 border border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" weight="fill" />
              <CardTitle className="text-sm font-bold text-green-700">
                Voucher gerado com sucesso
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col items-center text-center">
              <p className="text-[10px] uppercase tracking-wide text-green-700">
                Código do voucher
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-extrabold tracking-wider text-green-800">
                  {codigoVoucher || '—'}
                </p>
                {codigoVoucher && (
                  <button
                    onClick={() => copiarCodigo(codigoVoucher)}
                    className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 transition-colors"
                    title="Copiar código"
                  >
                    {copiado ? (
                      <Check size={18} weight="bold" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                )}
              </div>
              {voucher.voucher?.voucherNumber && (
                <p className="text-xs text-green-700 mt-1">
                  Nº {voucher.voucher.voucherNumber}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Desconto
                </p>
                <p className="text-sm font-bold text-[#000638]">
                  {formatCurrency(voucher.config?.value)}
                </p>
              </div>
              <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Compra mínima
                </p>
                <p className="text-sm font-bold text-[#000638]">
                  {formatCurrency(voucher.config?.minPurchase)}
                </p>
              </div>
              <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Início
                </p>
                <p className="text-sm font-bold text-[#000638]">
                  {formatDate(voucher.config?.startDate)}
                </p>
              </div>
              <div className="bg-[#f8f9fb] rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  Validade
                </p>
                <p className="text-sm font-bold text-[#000638]">
                  {formatDate(voucher.config?.endDate)}
                </p>
              </div>
            </div>

            {cliente && (
              <p className="text-xs text-gray-500 mt-3">
                Vinculado a{' '}
                <span className="font-semibold text-[#000638]">
                  {cliente.name}
                </span>{' '}
                ({cliente.documentType} {formatDocument(cliente.document)}).
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VoucherVarejo;
