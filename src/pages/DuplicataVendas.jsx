import React, { useState, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  MagnifyingGlass,
  SpinnerGap,
  Receipt,
  Warning,
  Package,
  User,
  Calendar,
  CurrencyDollar,
  Storefront,
  Tag,
  CaretDown,
  CaretRight,
  Wallet,
  CheckCircle,
  Clock,
  Printer,
} from '@phosphor-icons/react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatCurrency = (value) => {
  if (value == null || value === '') return '--';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatDateBR = (isoDate) => {
  if (!isoDate) return '--';
  try {
    const [datePart] = String(isoDate).split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return '--';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } catch {
    return '--';
  }
};

const InfoRow = ({ icon: Icon, label, value, color = 'text-gray-700' }) => (
  <div className="flex items-center gap-2 py-1.5">
    {Icon && <Icon size={16} className={`${color} flex-shrink-0`} />}
    <span className="text-sm text-gray-500 min-w-[120px]">{label}:</span>
    <span className="text-sm font-medium text-gray-900">{value || '--'}</span>
  </div>
);

const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {Icon && <Icon size={18} className="text-gray-600" />}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {open ? (
          <CaretDown size={14} className="ml-auto" />
        ) : (
          <CaretRight size={14} className="ml-auto" />
        )}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};

const DuplicataVendas = () => {
  const [branchCode, setBranchCode] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [transactionDate, setTransactionDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [contasReceber, setContasReceber] = useState(null);
  const [loadingCR, setLoadingCR] = useState(false);
  const [clienteData, setClienteData] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const buscarCliente = useCallback(async (customerCode) => {
    try {
      // Tenta PJ primeiro
      const resPJ = await fetch(`${API_BASE}/api/totvs/legal-entity/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personCode: Number(customerCode) }),
      });
      if (resPJ.ok) {
        const jsonPJ = await resPJ.json();
        const items = jsonPJ?.data?.items ?? [];
        if (items.length > 0) {
          setClienteData({ ...items[0], tipo: 'PJ' });
          return;
        }
      }
      // Fallback PF
      const resPF = await fetch(`${API_BASE}/api/totvs/individual/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personCode: Number(customerCode) }),
      });
      if (resPF.ok) {
        const jsonPF = await resPF.json();
        const items = jsonPF?.data?.items ?? [];
        if (items.length > 0) {
          setClienteData({ ...items[0], tipo: 'PF' });
        }
      }
    } catch (err) {
      console.error('[DuplicataVendas] Erro ao buscar cliente:', err.message);
    }
  }, []);

  const buscarContasReceber = useCallback(
    async (customerCode, issueDate, filialCode, receivableCode) => {
      setLoadingCR(true);
      try {
        const filter = {
          customerCodeList: [Number(customerCode)],
        };
        if (filialCode) filter.branchCodeList = [Number(filialCode)];

        const response = await fetch(
          `${API_BASE}/api/totvs/accounts-receivable/search-all`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filter,
              expand: 'invoice,calculateValue',
              order: '-expiredDate',
              maxPages: 5,
            }),
          },
        );

        if (!response.ok) {
          console.error(
            '[DuplicataVendas] Erro ao buscar contas a receber:',
            response.status,
          );
          return;
        }

        const json = await response.json();
        const data = json?.data ?? json;
        setContasReceber(data?.items ?? []);
        console.log(
          `[DuplicataVendas] ${data?.items?.length ?? 0} documentos de contas a receber encontrados`,
        );
      } catch (err) {
        console.error('[DuplicataVendas] Erro contas a receber:', err.message);
      } finally {
        setLoadingCR(false);
      }
    },
    [],
  );

  const buscarTransacao = useCallback(async () => {
    if (!transactionCode.trim()) {
      setErro('Informe o código da transação.');
      return;
    }
    if (!transactionDate) {
      setErro('Informe a data da transação.');
      return;
    }

    setLoading(true);
    setErro('');
    setDados(null);
    setContasReceber(null);
    setClienteData(null);

    try {
      const params = new URLSearchParams();
      if (branchCode.trim()) params.append('BranchCode', branchCode.trim());
      params.append('TransactionCode', transactionCode.trim());
      if (transactionDate) params.append('TransactionDate', transactionDate);
      params.append('Expand', 'itemPromotionalEngines, originDestination');

      const url = `${API_BASE}/api/totvs/transactions?${params.toString()}`;
      console.log('[DuplicataVendas] Buscando:', url);
      const response = await fetch(url, {
        method: 'GET',
      });
      console.log(
        '[DuplicataVendas] Status:',
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        console.error('[DuplicataVendas] Erro resposta:', errData);
        throw new Error(
          errData?.message ||
            errData?.error ||
            `Erro ${response.status}: ${response.statusText}`,
        );
      }

      const json = await response.json();
      const transData = json?.data ?? json;
      setDados(transData);

      // Após obter a transação, buscar contas a receber e dados do cliente
      const custCode = transData?.customerCode;
      const txDate = transData?.transactionDate ?? transData?.date;
      const receivableCode =
        transData?.receivableCode ??
        transData?.invoiceNumber ??
        transData?.billCode;
      if (custCode) {
        const dateOnly = txDate ? String(txDate).split('T')[0] : null;
        buscarContasReceber(
          custCode,
          dateOnly,
          transData?.branchCode,
          receivableCode,
        );
        buscarCliente(custCode);
      }
    } catch (err) {
      setErro(err.message || 'Erro ao buscar transação.');
    } finally {
      setLoading(false);
    }
  }, [
    branchCode,
    transactionCode,
    transactionDate,
    buscarContasReceber,
    buscarCliente,
  ]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') buscarTransacao();
  };

  const gerarDuplicata = useCallback(() => {
    if (!dados) return;
    const d = dados;
    const cli = clienteData || {};

    const nomeCliente =
      cli.tipo === 'PJ'
        ? (cli.corporateName ??
          cli.tradeName ??
          d.customerName ??
          d.customerDescription ??
          '')
        : (cli.name ??
          cli.fullName ??
          d.customerName ??
          d.customerDescription ??
          '');
    const docCliente =
      cli.cnpj ?? cli.cpf ?? d.customerCpfCnpj ?? d.cpfCnpj ?? '';
    const enderecoCliente = [
      cli.address ?? cli.streetName ?? '',
      cli.addressNumber ? `, ${cli.addressNumber}` : '',
      cli.complement ? ` - ${cli.complement}` : '',
      cli.neighborhood ? ` - ${cli.neighborhood}` : '',
    ].join('');
    const cidadeUF = [
      cli.cityDescription ?? cli.city ?? '',
      cli.stateAbbreviation ?? cli.state ?? '',
    ]
      .filter(Boolean)
      .join('/');

    const nfNumero =
      d.invoiceNumber ??
      d.fiscalDocumentNumber ??
      d.transactionCode ??
      transactionCode;
    const dataEmissao = formatDateBR(d.transactionDate ?? d.date);
    const valorTotal = formatCurrency(
      d.totalAmountTransaction ?? d.totalValue ?? d.netValue,
    );

    // Montar linhas dos boletos a partir das contas a receber
    let boletoRows = '';
    let totalBoletos = 0;
    const parcelas =
      contasReceber && contasReceber.length > 0
        ? contasReceber
        : (d.paymentPlanItems ?? d.payments ?? d.installments ?? []);

    parcelas.forEach((p, idx) => {
      const numBoleto =
        p.receivableCode ?? p.ourNumber ?? p.documentNumber ?? '';
      const venc = formatDateBR(p.expiredDate ?? p.dueDate ?? p.maturityDate);
      const val = p.installmentValue ?? p.netValue ?? p.value ?? p.amount ?? 0;
      totalBoletos += Number(val) || 0;
      boletoRows += `
        <tr>
          <td>${String(idx + 1).padStart(2, '0')}</td>
          <td>${numBoleto}</td>
          <td>${venc}</td>
          <td>${formatCurrency(val)}</td>
        </tr>`;
    });

    if (parcelas.length === 0) {
      boletoRows =
        '<tr><td colspan="4" style="text-align:center;color:#999;">Nenhuma parcela encontrada</td></tr>';
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Duplicata - Transação ${transactionCode}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; line-height: 1.5; padding: 20px; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #222; padding-bottom: 8px; }
  h2 { font-size: 13px; margin: 18px 0 8px 0; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .field { margin: 4px 0; }
  .field b { display: inline-block; min-width: 200px; }
  .line { border-bottom: 1px solid #999; display: inline-block; min-width: 300px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; font-size: 11px; }
  th { background: #f0f0f0; font-weight: bold; }
  .declaracao { margin-top: 24px; text-align: justify; font-size: 11px; line-height: 1.6; }
  .assinatura { margin-top: 40px; text-align: center; }
  .assinatura .linha { border-top: 1px solid #222; width: 350px; margin: 0 auto; padding-top: 6px; }
  .assinatura-gov { margin-top: 30px; text-align: center; padding: 15px; border: 2px dashed #1351B4; border-radius: 8px; }
  .assinatura-gov .titulo { font-size: 12px; font-weight: bold; color: #1351B4; }
  .assinatura-gov .subtitulo { font-size: 10px; color: #666; margin-top: 4px; }
  .total-row { font-weight: bold; background: #f9f9f9; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>

<h1>DUPLICATA / CONFIRMAÇÃO DE COMPRA A PRAZO</h1>

<h2>DADOS DO VENDEDOR</h2>
<div class="field"><b>Razão Social:</b> FERREIRA COMERCIO E CONFECCOES LTDA</div>
<div class="field"><b>Nome Fantasia:</b> CROSBY</div>
<div class="field"><b>CNPJ:</b> 17.177.680/0001-16</div>

<h2>DADOS DO COMPRADOR</h2>
<div class="field"><b>Razão Social:</b> ${nomeCliente || '<span class="line"></span>'}</div>
<div class="field"><b>CNPJ/CPF:</b> ${docCliente || '<span class="line"></span>'}</div>
<div class="field"><b>Endereço:</b> ${enderecoCliente || '<span class="line"></span>'}</div>
<div class="field"><b>Cidade/UF:</b> ${cidadeUF || '<span class="line"></span>'}</div>
<div class="field"><b>Responsável pela Compra:</b> <span class="line"></span></div>
<div class="field"><b>CPF do Responsável:</b> <span class="line"></span></div>

<h2>DADOS DA VENDA</h2>
<div class="field"><b>Número da Nota Fiscal:</b> ${nfNumero}</div>
<div class="field"><b>Data de Emissão:</b> ${dataEmissao}</div>
<div class="field"><b>Valor Total da Compra:</b> ${valorTotal}</div>

<h2>RELAÇÃO DOS BOLETOS</h2>
<table>
  <thead>
    <tr>
      <th style="width:60px;">Parcela</th>
      <th>Número do Boleto</th>
      <th style="width:110px;">Vencimento</th>
      <th style="width:120px;">Valor</th>
    </tr>
  </thead>
  <tbody>
    ${boletoRows}
    <tr class="total-row">
      <td colspan="3" style="text-align:right;">Valor Total dos Boletos:</td>
      <td>${formatCurrency(totalBoletos)}</td>
    </tr>
  </tbody>
</table>

<div class="declaracao">
  <h2>DECLARAÇÃO</h2>
  <p>Declaro que recebi e conferi as mercadorias constantes na Nota Fiscal acima identificada,
  bem como estou ciente e de acordo com as condições de pagamento descritas nos boletos
  relacionados neste documento.</p>
  <br/>
  <p>Reconheço a realização da compra e assumo integral responsabilidade pelo pagamento das
  parcelas nos respectivos vencimentos.</p>
</div>

<div class="assinatura">
  <div class="linha">Assinatura do Comprador</div>
</div>

<div class="assinatura-gov">
  <div class="titulo">ASSINATURA ELETRÔNICA GOV.BR</div>
  <div class="subtitulo">Espaço reservado para assinatura eletrônica via plataforma gov.br</div>
</div>

</body>
</html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }, [dados, clienteData, contasReceber, transactionCode]);

  const renderItems = (items) => {
    if (!items || items.length === 0)
      return <p className="text-sm text-gray-400">Sem itens</p>;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-600">Seq</th>
              <th className="px-3 py-2 font-medium text-gray-600">Código</th>
              <th className="px-3 py-2 font-medium text-gray-600">
                Referência
              </th>
              <th className="px-3 py-2 font-medium text-gray-600">Descrição</th>
              <th className="px-3 py-2 font-medium text-gray-600">Cor</th>
              <th className="px-3 py-2 font-medium text-gray-600">Tamanho</th>
              <th className="px-3 py-2 font-medium text-gray-600">Qtd</th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">
                Valor Unit.
              </th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">
                Desconto
              </th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-blue-50/30">
                <td className="px-3 py-2 text-gray-600">
                  {item.sequence ?? item.itemSequence ?? idx + 1}
                </td>
                <td className="px-3 py-2 font-mono text-gray-700">
                  {item.productCode ?? item.itemCode ?? '--'}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {item.referenceCode ?? item.productReference ?? '--'}
                </td>
                <td className="px-3 py-2 text-gray-900">
                  {item.productDescription ?? item.description ?? '--'}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {item.colorDescription ?? item.color ?? '--'}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {item.sizeDescription ?? item.size ?? '--'}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {item.quantity ?? '--'}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatCurrency(item.unitPrice ?? item.unitaryValue)}
                </td>
                <td className="px-3 py-2 text-right text-red-600">
                  {formatCurrency(item.discountValue ?? item.discount)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">
                  {formatCurrency(
                    item.totalValue ?? item.totalItem ?? item.netValue,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPayments = (payments) => {
    if (!payments || payments.length === 0)
      return <p className="text-sm text-gray-400">Sem parcelas</p>;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2 font-medium text-gray-600">Parcela</th>
              <th className="px-3 py-2 font-medium text-gray-600">
                Vencimento
              </th>
              <th className="px-3 py-2 font-medium text-gray-600">
                Forma Pgto
              </th>
              <th className="px-3 py-2 font-medium text-gray-600 text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((p, idx) => (
              <tr key={idx} className="hover:bg-blue-50/30">
                <td className="px-3 py-2 text-gray-600">
                  {p.installment ?? p.sequence ?? idx + 1}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {formatDateBR(p.dueDate ?? p.maturityDate)}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {p.paymentMethodDescription ?? p.paymentMethod ?? '--'}
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">
                  {formatCurrency(p.value ?? p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDados = () => {
    if (!dados) return null;
    const d = dados;

    return (
      <div className="space-y-4 mt-6">
        {/* Cabeçalho da transação */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt size={20} className="text-blue-600" />
                Transação #{d.transactionCode ?? d.code ?? transactionCode}
              </CardTitle>
              <button
                onClick={gerarDuplicata}
                disabled={loadingCR}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-semibold"
              >
                <Printer size={18} />
                GERAR DUPLICATA
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
              <InfoRow
                icon={Storefront}
                label="Filial"
                value={`${d.branchCode ?? '--'} - ${d.branchDescription ?? d.branchName ?? ''}`}
                color="text-purple-600"
              />
              <InfoRow
                icon={Calendar}
                label="Data"
                value={formatDateBR(d.transactionDate ?? d.date)}
                color="text-blue-600"
              />
              <InfoRow
                icon={Tag}
                label="Operação"
                value={`${d.operationCode ?? ''} - ${d.operationDescription ?? ''}`}
                color="text-indigo-600"
              />
              <InfoRow
                icon={User}
                label="Cliente"
                value={`${d.customerCode ?? ''} - ${d.customerName ?? d.customerDescription ?? ''}`}
                color="text-green-600"
              />
              <InfoRow
                icon={User}
                label="CPF/CNPJ"
                value={d.customerCpfCnpj ?? d.cpfCnpj ?? '--'}
                color="text-green-600"
              />
              <InfoRow
                icon={User}
                label="Vendedor"
                value={`${d.sellerCode ?? ''} - ${d.sellerName ?? d.sellerDescription ?? ''}`}
                color="text-orange-600"
              />
              <InfoRow
                icon={Tag}
                label="Status"
                value={d.statusDescription ?? d.status ?? '--'}
                color="text-gray-600"
              />
              <InfoRow
                icon={Tag}
                label="Cond. Pagamento"
                value={`${d.paymentConditionCode ?? ''} - ${d.paymentConditionDescription ?? ''}`}
                color="text-gray-600"
              />
              <InfoRow
                icon={CurrencyDollar}
                label="Valor Total"
                value={formatCurrency(
                  d.totalAmountTransaction ?? d.totalValue ?? d.netValue,
                )}
                color="text-emerald-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Itens */}
        <CollapsibleSection
          title="Itens da Transação"
          icon={Package}
          defaultOpen
        >
          {renderItems(d.items ?? d.transactionItems ?? [])}
        </CollapsibleSection>

        {/* Parcelas / Pagamento */}
        <CollapsibleSection title="Plano de Pagamento" icon={CurrencyDollar}>
          {renderPayments(
            d.paymentPlanItems ?? d.payments ?? d.installments ?? [],
          )}
        </CollapsibleSection>

        {/* Contas a Receber */}
        <CollapsibleSection
          title="Contas a Receber (Duplicatas)"
          icon={Wallet}
          defaultOpen
        >
          {loadingCR ? (
            <div className="flex items-center gap-2 py-4">
              <SpinnerGap size={18} className="animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">
                Buscando contas a receber...
              </span>
            </div>
          ) : contasReceber && contasReceber.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Duplicata
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Parcela
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Emissão
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Vencimento
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Pagamento
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Status
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Portador
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      Tipo Cobrança
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">
                      Valor
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-600 text-right">
                      Valor Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contasReceber.map((doc, idx) => {
                    const isPaid = doc.paymentDate != null;
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-blue-50/30 ${isPaid ? 'bg-green-50/30' : ''}`}
                      >
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {doc.receivableCode ?? '--'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {doc.installmentCode ?? '--'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatDateBR(doc.issueDate)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatDateBR(doc.expiredDate)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {formatDateBR(doc.paymentDate)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                          >
                            {isPaid ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {isPaid ? 'Pago' : 'Aberto'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {doc.bearerName ?? doc.bearerCode ?? '--'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {doc.chargeType ?? '--'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          {formatCurrency(doc.installmentValue ?? doc.netValue)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">
                          {formatCurrency(doc.paidValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : contasReceber ? (
            <p className="text-sm text-gray-400">
              Nenhum documento encontrado para este cliente/data.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Será buscado automaticamente após a consulta da transação.
            </p>
          )}
        </CollapsibleSection>

        {/* Observações */}
        {(d.observations || d.invoiceObservations) && (
          <CollapsibleSection title="Observações" icon={Receipt}>
            {d.observations && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Observações:
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {typeof d.observations === 'string'
                    ? d.observations
                    : JSON.stringify(d.observations, null, 2)}
                </p>
              </div>
            )}
            {d.invoiceObservations && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Observações da NF:
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {typeof d.invoiceObservations === 'string'
                    ? d.invoiceObservations
                    : JSON.stringify(d.invoiceObservations, null, 2)}
                </p>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* JSON completo (debug) */}
        <CollapsibleSection title="Dados Completos (JSON)" icon={Tag}>
          <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
            {JSON.stringify(d, null, 2)}
          </pre>
        </CollapsibleSection>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <PageTitle title="Duplicata de Vendas" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consultar Transação TOTVS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código Filial
              </label>
              <input
                type="number"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código da Transação <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Transação <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={buscarTransacao}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
            >
              {loading ? (
                <SpinnerGap size={18} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={18} />
              )}
              Buscar
            </button>
          </div>

          {erro && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <Warning size={18} />
              <span className="text-sm">{erro}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <SpinnerGap size={32} className="animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Buscando transação...</span>
        </div>
      )}

      {renderDados()}
    </div>
  );
};

export default DuplicataVendas;
