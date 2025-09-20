import React, { useState, useMemo } from 'react';
import PageTitle from '../components/ui/PageTitle';
import {
  CaretDown,
  CaretRight,
  Dot,
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Folder,
  FileText,
} from '@phosphor-icons/react';

const DRE = () => {
  const [expandedNodes, setExpandedNodes] = useState({
    'vendas-bruta': true,
    'deducoes-vendas': true,
    'impostos-vendas': true,
    'receita-liquida': true,
    'lucro-bruto': true,
    'despesas-operacionais': true,
    'resultado-operacional': true,
    'outras-receitas-despesas': true,
    'lucro-antes-impostos': true,
    'impostos-lucro': true,
    'lucro-liquido': true,
  });

  // Dados mockados para demonstração
  const dreData = useMemo(
    () => [
      {
        id: 'vendas-bruta',
        label: 'Vendas Brutas',
        description: 'Quanto você vendeu no período (sem tirar nada ainda).',
        value: 1500000.0,
        type: 'receita',
        children: [],
      },
      {
        id: 'deducoes-vendas',
        label: 'Deduções sobre Vendas',
        description:
          'Devoluções, descontos concedidos e impostos sobre vendas.',
        value: -180000.0,
        type: 'deducao',
        children: [
          {
            id: 'devolucoes',
            label: 'Devoluções',
            description: 'Clientes devolveram mercadorias',
            value: -25000.0,
            type: 'deducao',
          },
          {
            id: 'descontos',
            label: 'Descontos Concedidos',
            description: 'Descontos dados aos clientes',
            value: -45000.0,
            type: 'deducao',
          },
          {
            id: 'impostos-vendas',
            label: 'Impostos sobre Vendas',
            description: 'ICMS, PIS, COFINS e outros impostos sobre vendas.',
            value: -110000.0,
            type: 'deducao',
            children: [
              {
                id: 'icms',
                label: 'ICMS',
                description:
                  'Imposto sobre Circulação de Mercadorias e Serviços',
                value: -65000.0,
                type: 'deducao',
              },
              {
                id: 'pis',
                label: 'PIS',
                description: 'Programa de Integração Social',
                value: -25000.0,
                type: 'deducao',
              },
              {
                id: 'cofins',
                label: 'COFINS',
                description:
                  'Contribuição para o Financiamento da Seguridade Social',
                value: -20000.0,
                type: 'deducao',
              },
            ],
          },
        ],
      },
      {
        id: 'receita-liquida',
        label: 'Receita Líquida de Vendas',
        description: 'É o que realmente ficou das vendas.',
        value: 1320000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'cmv',
        label: 'Custos da Mercadoria Vendida (CMV)',
        description:
          'Quanto custou comprar ou produzir o que você vendeu (matéria-prima, mercadorias para revenda, mão de obra da produção).',
        value: -720000.0,
        type: 'custo',
        children: [],
      },
      {
        id: 'lucro-bruto',
        label: 'Lucro Bruto',
        description: 'Receita Líquida – CMV',
        value: 600000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'despesas-operacionais',
        label: 'Despesas Operacionais',
        description: 'Despesas comerciais, administrativas e financeiras.',
        value: -420000.0,
        type: 'despesa',
        children: [
          {
            id: 'despesas-comerciais',
            label: 'Despesas Comerciais/Vendas',
            description: 'Comissão, marketing, frete sobre vendas',
            value: -180000.0,
            type: 'despesa',
            children: [
              {
                id: 'comissoes',
                label: 'Comissões',
                description: 'Comissões pagas aos vendedores',
                value: -95000.0,
                type: 'despesa',
              },
              {
                id: 'marketing',
                label: 'Marketing',
                description: 'Gastos com publicidade e marketing',
                value: -65000.0,
                type: 'despesa',
              },
              {
                id: 'frete-vendas',
                label: 'Frete sobre Vendas',
                description: 'Custos de frete nas vendas',
                value: -20000.0,
                type: 'despesa',
              },
            ],
          },
          {
            id: 'despesas-administrativas',
            label: 'Despesas Administrativas',
            description: 'Salários administrativos, aluguel, energia',
            value: -180000.0,
            type: 'despesa',
            children: [
              {
                id: 'salarios-admin',
                label: 'Salários Administrativos',
                description: 'Salários da área administrativa',
                value: -120000.0,
                type: 'despesa',
              },
              {
                id: 'aluguel',
                label: 'Aluguel',
                description: 'Aluguel do escritório',
                value: -35000.0,
                type: 'despesa',
              },
              {
                id: 'energia',
                label: 'Energia do Escritório',
                description: 'Conta de energia elétrica',
                value: -25000.0,
                type: 'despesa',
              },
            ],
          },
          {
            id: 'despesas-financeiras',
            label: 'Despesas Financeiras',
            description: 'Juros pagos em empréstimos, tarifas bancárias',
            value: -60000.0,
            type: 'despesa',
            children: [
              {
                id: 'juros-emprestimos',
                label: 'Juros de Empréstimos',
                description: 'Juros pagos em empréstimos',
                value: -45000.0,
                type: 'despesa',
              },
              {
                id: 'tarifas-bancarias',
                label: 'Tarifas Bancárias',
                description: 'Tarifas e taxas bancárias',
                value: -15000.0,
                type: 'despesa',
              },
            ],
          },
        ],
      },
      {
        id: 'resultado-operacional',
        label: 'Resultado Operacional',
        description: 'O que sobrou depois das despesas.',
        value: 180000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'outras-receitas-despesas',
        label: 'Outras Receitas e Despesas',
        description:
          'Venda de bens da empresa, ganhos ou perdas não recorrentes.',
        value: 15000.0,
        type: 'outro',
        children: [
          {
            id: 'venda-bens',
            label: 'Venda de Bens',
            description: 'Venda de equipamentos da empresa',
            value: 25000.0,
            type: 'receita',
          },
          {
            id: 'perdas-nao-recorrentes',
            label: 'Perdas Não Recorrentes',
            description: 'Perdas eventuais não recorrentes',
            value: -10000.0,
            type: 'despesa',
          },
        ],
      },
      {
        id: 'lucro-antes-impostos',
        label: 'Lucro Antes do IR/CSLL',
        description: 'Resultado antes dos impostos sobre o lucro.',
        value: 195000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'impostos-lucro',
        label: 'Impostos sobre o Lucro (IR/CSLL)',
        description: 'Se a empresa paga esse tipo de imposto.',
        value: -58500.0,
        type: 'imposto',
        children: [
          {
            id: 'irpj',
            label: 'IRPJ',
            description: 'Imposto de Renda Pessoa Jurídica',
            value: -39000.0,
            type: 'imposto',
          },
          {
            id: 'csll',
            label: 'CSLL',
            description: 'Contribuição Social sobre o Lucro Líquido',
            value: -19500.0,
            type: 'imposto',
          },
        ],
      },
      {
        id: 'lucro-liquido',
        label: 'Lucro Líquido do Exercício',
        description: 'O resultado final: lucro ou prejuízo.',
        value: 136500.0,
        type: 'resultado-final',
        children: [],
      },
    ],
    [],
  );

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getValueColor = (value, type) => {
    if (type === 'resultado-final') {
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (type === 'resultado') {
      return value >= 0 ? 'text-blue-600' : 'text-red-600';
    }
    return value < 0 ? 'text-red-500' : 'text-green-600';
  };

  const getIcon = (type, value) => {
    if (type === 'resultado-final') {
      return value >= 0 ? (
        <TrendUp className="w-2 h-2" />
      ) : (
        <TrendDown className="w-2 h-2" />
      );
    }
    if (type === 'resultado') {
      return value >= 0 ? (
        <Dot className="w-2 h-2" />
      ) : (
        <Dot className="w-2 h-2" />
      );
    }
    if (value < 0) {
      return <Dot className="w-2 h-2" />;
    }
    return <Dot className="w-2 h-2" />;
  };

  const getFolderIcon = (type) => {
    switch (type) {
      case 'receita':
        return <CurrencyDollar className="w-4 h-4 text-green-600" />;
      case 'deducao':
        return <Dot className="w-4 h-4 text-red-500" />;
      case 'custo':
        return <Dot className="w-4 h-4 text-orange-500" />;
      case 'despesa':
        return <Dot className="w-4 h-4 text-red-600" />;
      case 'imposto':
        return <Dot className="w-4 h-4 text-purple-600" />;
      case 'resultado':
        return <Dot className="w-4 h-4 text-blue-600" />;
      case 'resultado-final':
        return <TrendUp className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderTreeItem = (
    item,
    level = 0,
    isLastInSection = false,
    isEven = true,
  ) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedNodes[item.id];
    const isLeaf = !hasChildren;

    if (isLeaf) {
      return (
        <div
          key={item.id}
          className="ms-3 ps-3 relative before:absolute before:top-0 before:start-0 before:w-0.5 before:-ms-px before:h-full before:bg-gray-100"
        >
          <div
            className={`hs-accordion-selectable hs-accordion-selected:bg-gray-100 px-2 rounded-md cursor-pointer hover:bg-gray-100/50 transition-colors ${
              isEven ? 'bg-gray-50/30' : 'bg-white'
            }`}
            role="treeitem"
          >
            <div className="flex items-center gap-x-3 py-1">
              {getFolderIcon(item.type)}
              <div className="grow flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-800 font-medium">
                    {item.label}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${getValueColor(
                    item.value,
                    item.type,
                  )}`}
                >
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
          </div>
          {/* Divider after leaf items */}
          {isLastInSection && (
            <div className="border-b border-gray-200 my-2"></div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`hs-accordion ${isExpanded ? 'active' : ''}`}
        role="treeitem"
        aria-expanded={isExpanded}
      >
        {/* Accordion Heading */}
        <div className="hs-accordion-heading py-0.5 flex items-center gap-x-0.5 w-full">
          <button
            className="hs-accordion-toggle size-6 flex justify-center items-center hover:bg-gray-100 rounded-md focus:outline-hidden focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
            aria-expanded={isExpanded}
            aria-controls={`dre-${item.id}`}
            onClick={() => toggleNode(item.id)}
          >
            <svg
              className="size-4 text-gray-800"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path
                className={isExpanded ? 'hidden' : 'block'}
                d="M12 5v14"
              ></path>
            </svg>
          </button>

          <div
            className={`grow hs-accordion-selectable hs-accordion-selected:bg-gray-100 px-1.5 rounded-md cursor-pointer hover:bg-gray-100/40 transition-colors ${
              isEven ? 'bg-gray-50/20' : 'bg-white'
            }`}
          >
            <div className="flex items-center gap-x-3">
              {getFolderIcon(item.type)}
              <div className="grow flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-800 font-medium">
                    {item.label}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${getValueColor(
                    item.value,
                    item.type,
                  )}`}
                >
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Content */}
        <div
          id={`dre-${item.id}`}
          className={`hs-accordion-content w-full overflow-hidden transition-[height] duration-300 ${
            isExpanded ? '' : 'hidden'
          }`}
          role="group"
          aria-labelledby={`dre-${item.id}`}
        >
          <div className="hs-accordion-group ps-7 relative before:absolute before:top-0 before:start-3 before:w-0.5 before:-ms-px before:h-full before:bg-gray-100">
            {item.children.map((child, index) =>
              renderTreeItem(
                child,
                level + 1,
                index === item.children.length - 1,
                (index + 1) % 2 === 0,
              ),
            )}
          </div>
          {/* Divider after accordion items */}
          {isLastInSection && (
            <div className="border-b border-gray-200 my-2"></div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <PageTitle
        title="DRE - Demonstrativo de Resultado do Exercício"
        subtitle="Análise detalhada dos resultados financeiros do período"
        icon={TrendUp}
      />

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Inicial
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="2024-01-01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Final
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="2024-12-31"
            />
          </div>
          <div className="flex items-end">
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              Atualizar DRE
            </button>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Demonstrativo de Resultado do Exercício
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Período: Janeiro a Dezembro de 2024
          </p>
        </div>

        {/* Tree Root */}
        <div
          className="hs-accordion-treeview-root"
          role="tree"
          aria-orientation="vertical"
        >
          <div
            className="hs-accordion-group"
            role="group"
            data-hs-accordion-always-open=""
          >
            <div className="p-4">
              {dreData.map((item, index) => {
                const isLastInSection = index === dreData.length - 1;
                const isEven = (index + 1) % 2 === 0;
                return (
                  <div key={item.id}>
                    {renderTreeItem(item, 0, isLastInSection, isEven)}
                    {/* Divider between main sections */}
                    {!isLastInSection && (
                      <div className="border-b border-gray-300 my-3"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumo Final */}
        <div className="bg-blue-50 px-4 py-4 border-t-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendUp className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-lg font-semibold text-blue-900">
                Resultado Final do Exercício
              </span>
            </div>
            <span className="text-xl font-bold text-green-600">
              {formatCurrency(136500.0)}
            </span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Lucro líquido do período - Demonstra um resultado positivo para a
            empresa
          </p>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-yellow-800 text-xs font-bold">!</span>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Dados de Demonstração
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Os valores apresentados são dados mockados para demonstração.
              Quando implementado com dados reais, esta página se conectará
              automaticamente às suas bases de dados financeiras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DRE;
