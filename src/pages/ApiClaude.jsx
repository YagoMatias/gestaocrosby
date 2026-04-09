import React, { useState, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import {
  Copy,
  Check,
  X,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Code,
  Play,
  Spinner,
  Warning,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';

// ==========================================
// DOCUMENTAÇÃO DAS ROTAS DE CONSULTA TOTVS
// ==========================================

const ROUTE_CATEGORIES = [
  {
    id: 'clientes',
    name: 'Dados Clientes',
    description:
      'Consultas de dados de pessoas físicas (PF) e jurídicas (PJ) na API TOTVS',
    icon: '👤',
    routes: [
      {
        name: 'Buscar PJ por Código',
        method: 'POST',
        path: '/api/totvs/legal-entity/search',
        description:
          'Busca dados completos de uma pessoa jurídica na API TOTVS pelo código da pessoa.',
        params: {
          body: {
            personCode: {
              type: 'number',
              required: true,
              description: 'Código da pessoa no TOTVS',
              placeholder: '180',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [{
      "code": 180, "name": "EMPRESA EXEMPLO LTDA", "fantasyName": "EXEMPLO",
      "cnpj": "12345678000190", "isCustomer": true, "customerStatus": "Normal",
      "phones": [...], "emails": [...], "addresses": [...]
    }],
    "hasNext": false, "total": 1
  }
}`,
      },
      {
        name: 'Buscar PJ por Nome',
        method: 'POST',
        path: '/api/totvs/legal-entity/search-by-name',
        description:
          'Busca PJs pelo nome fantasia. Percorre múltiplas páginas e filtra localmente.',
        params: {
          body: {
            fantasyName: {
              type: 'string',
              required: true,
              description: 'Nome fantasia (mín. 2 caracteres)',
              placeholder: 'EXEMPLO',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas (default: 50)',
              placeholder: '50',
            },
          },
        },
      },
      {
        name: 'Buscar PJ por Telefone',
        method: 'POST',
        path: '/api/totvs/legal-entity/search-by-phone',
        description:
          'Busca PJ pelo número de telefone. Percorre páginas e filtra localmente.',
        params: {
          body: {
            phoneNumber: {
              type: 'string',
              required: true,
              description: 'Telefone (apenas números, mín. 8 dígitos)',
              placeholder: '85999991234',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas (default: 30)',
              placeholder: '30',
            },
          },
        },
      },
      {
        name: 'Buscar PF por Código',
        method: 'POST',
        path: '/api/totvs/individual/search',
        description:
          'Busca dados completos de uma pessoa física na API TOTVS pelo código.',
        params: {
          body: {
            personCode: {
              type: 'number',
              required: true,
              description: 'Código da pessoa no TOTVS',
              placeholder: '500',
            },
          },
        },
      },
      {
        name: 'Buscar PF por Nome',
        method: 'POST',
        path: '/api/totvs/individual/search-by-name',
        description:
          'Busca PFs pelo nome. Percorre múltiplas páginas e filtra localmente.',
        params: {
          body: {
            name: {
              type: 'string',
              required: true,
              description: 'Nome para buscar (mín. 2 caracteres)',
              placeholder: 'FULANO',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas (default: 50)',
              placeholder: '50',
            },
          },
        },
      },
      {
        name: 'Buscar PF por Telefone',
        method: 'POST',
        path: '/api/totvs/individual/search-by-phone',
        description:
          'Busca PF pelo número de telefone na API TOTVS.',
        params: {
          body: {
            phoneNumber: {
              type: 'string',
              required: true,
              description: 'Telefone (apenas números, mín. 8 dígitos)',
              placeholder: '85999991234',
            },
          },
        },
      },
      {
        name: 'Batch Lookup (Busca em lote)',
        method: 'POST',
        path: '/api/totvs/persons/batch-lookup',
        description:
          'Busca nome, fantasia, telefone e UF de múltiplas pessoas (PJ + PF em paralelo).',
        params: {
          body: {
            personCodes: {
              type: 'number[]',
              required: true,
              description: 'Array de códigos de pessoa',
              placeholder: '[180, 500, 300]',
            },
          },
        },
      },
      {
        name: 'Buscar Clientes (Supabase)',
        method: 'GET',
        path: '/api/totvs/clientes/search-name',
        description:
          'Busca clientes na tabela pes_pessoa do Supabase por nome, fantasia ou CPF/CNPJ. Retorno rápido.',
        params: {
          query: {
            nome: {
              type: 'string',
              required: false,
              description: 'Termo para buscar no nome',
              placeholder: 'EXEMPLO',
            },
            fantasia: {
              type: 'string',
              required: false,
              description: 'Termo para buscar no nome fantasia',
              placeholder: '',
            },
            cnpj: {
              type: 'string',
              required: false,
              description: 'CPF ou CNPJ',
              placeholder: '12345678000190',
            },
          },
        },
      },
      {
        name: 'Todos os Clientes (TOTVS)',
        method: 'GET',
        path: '/api/totvs/clientes/fetch-all',
        description:
          'Busca todos os clientes (PF + PJ) do TOTVS com paginação. Cache 10 min.',
        params: {
          query: {
            startDate: { type: 'string', required: false, description: 'Data início (YYYY-MM-DD)', placeholder: '2024-01-01' },
            endDate: { type: 'string', required: false, description: 'Data fim (YYYY-MM-DD)', placeholder: '2024-12-31' },
            personCode: { type: 'string', required: false, description: 'Código(s) (ex: 180 ou 180,200)', placeholder: '180' },
            page: { type: 'number', required: false, description: 'Página (default: 1)', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (default: 1000, máx: 5000)', placeholder: '100' },
          },
        },
      },
      {
        name: 'Clientes por Faixa de Códigos',
        method: 'GET',
        path: '/api/totvs/clientes/fetch-batch',
        description: 'Busca PF + PJ por faixa de códigos. Máx 1000 por vez.',
        params: {
          query: {
            startCode: { type: 'number', required: false, description: 'Código inicial (default: 1)', placeholder: '1' },
            endCode: { type: 'number', required: false, description: 'Código final (default: +499)', placeholder: '500' },
          },
        },
      },
      {
        name: 'Estatísticas do Cliente',
        method: 'POST',
        path: '/api/totvs/person-statistics',
        description: 'Estatísticas financeiras/comerciais de um cliente por filial.',
        params: {
          body: {
            personCode: { type: 'number', required: true, description: 'Código da pessoa', placeholder: '180' },
            branchCode: { type: 'number', required: false, description: 'Filial (default: 1)', placeholder: '1' },
          },
        },
      },
    ],
  },
  {
    id: 'financeiro',
    name: 'Contas a Receber',
    description: 'Consultas de títulos, faturas e saldos financeiros',
    icon: '💰',
    routes: [
      {
        name: 'Contas a Receber (1 página)',
        method: 'POST',
        path: '/api/totvs/accounts-receivable/search',
        description: 'Busca documentos de contas a receber. Retorna uma página por vez.',
        params: {
          body: {
            filter: { type: 'object', required: false, description: 'Filtros (ex: { customerCodeList: [180] })', placeholder: '{"customerCodeList": [180]}' },
            page: { type: 'number', required: false, description: 'Página (default: 1)', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (default: 100)', placeholder: '100' },
          },
        },
      },
      {
        name: 'Contas a Receber (todas páginas)',
        method: 'POST',
        path: '/api/totvs/accounts-receivable/search-all',
        description: 'Busca TODAS as páginas de contas a receber automaticamente.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Filtros (ex: { customerCodeList: [180] })', placeholder: '{"customerCodeList": [180]}' },
          },
        },
      },
      {
        name: 'Contas a Receber (v3 otimizado)',
        method: 'GET',
        path: '/api/totvs/accounts-receivable/filter',
        description: 'Rota otimizada: páginas em paralelo, lookup de nomes em batch, cache de branchCodes.',
        params: { query: {} },
      },
      {
        name: 'PMR (Prazo Médio Recebimento)',
        method: 'GET',
        path: '/api/totvs/accounts-receivable/pmr',
        description: 'Calcula o Prazo Médio de Recebimento.',
        params: { query: {} },
      },
      {
        name: 'Saldo Financeiro Franquias',
        method: 'POST',
        path: '/api/totvs/franchise-financial-balance',
        description: 'Saldo financeiro de clientes franquia.',
        params: {
          body: {
            customerCodeList: { type: 'number[]', required: true, description: 'Códigos dos clientes', placeholder: '[180, 200]' },
            branchCodeList: { type: 'number[]', required: false, description: 'Filiais', placeholder: '[1, 2]' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (default: 200, máx: 500)', placeholder: '200' },
          },
        },
      },
    ],
  },
  {
    id: 'contas-pagar',
    name: 'Contas a Pagar',
    description: 'Consulta de duplicatas de contas a pagar',
    icon: '💳',
    routes: [
      {
        name: 'Buscar Contas a Pagar',
        method: 'POST',
        path: '/api/totvs/accounts-payable/search',
        description: 'Busca duplicatas de contas a pagar. Paginação paralela.',
        params: {
          body: {
            dt_inicio: { type: 'string', required: true, description: 'Data início (YYYY-MM-DD)', placeholder: '2024-01-01' },
            dt_fim: { type: 'string', required: true, description: 'Data fim (YYYY-MM-DD)', placeholder: '2024-01-31' },
            branches: { type: 'number[]', required: true, description: 'Empresas', placeholder: '[1, 2, 5]' },
            modo: { type: 'string', required: false, description: "vencimento | emissao | liquidacao", placeholder: 'vencimento' },
            situacao: { type: 'string', required: false, description: "TODAS | N | C | A | D | L | Q", placeholder: 'N' },
            previsao: { type: 'string', required: false, description: "TODOS | PREVISAO | REAL | CONSIGNADO", placeholder: 'TODOS' },
            supplierCodeList: { type: 'number[]', required: false, description: 'Fornecedores', placeholder: '' },
          },
        },
      },
    ],
  },
  {
    id: 'notas-fiscais',
    name: 'Notas Fiscais / DANFE',
    description: 'Consultas de notas fiscais, geração de DANFE e XML',
    icon: '🧾',
    routes: [
      {
        name: 'NFs (proxy direto)',
        method: 'POST',
        path: '/api/totvs/invoices-search',
        description: 'Proxy para fiscal/v2/invoices/search. Retorna uma página.',
        params: {
          body: {
            filter: { type: 'object', required: false, description: 'Filtros', placeholder: '{"change": {}}' },
            page: { type: 'number', required: false, description: 'Página (default: 1)', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (default: 100)', placeholder: '100' },
          },
        },
      },
      {
        name: 'NFs otimizado (cache + paralelo)',
        method: 'POST',
        path: '/api/totvs/invoices/search',
        description: 'Todas as NFs com pageSize 500, 10 páginas paralelas, cache 10min.',
        params: {
          body: {
            startDate: { type: 'string', required: true, description: 'Data início (YYYY-MM-DD)', placeholder: '2024-01-01' },
            endDate: { type: 'string', required: true, description: 'Data fim (YYYY-MM-DD)', placeholder: '2024-01-31' },
            branchCodeList: { type: 'number[]', required: false, description: 'Filiais', placeholder: '[1, 2, 5]' },
            operationType: { type: 'string', required: false, description: 'Tipo de operação', placeholder: '' },
            personCodeList: { type: 'number[]', required: false, description: 'Códigos de pessoa', placeholder: '' },
            noCache: { type: 'boolean', required: false, description: 'Bypass do cache', placeholder: 'false' },
          },
        },
      },
      {
        name: 'Buscar DANFE',
        method: 'POST',
        path: '/api/totvs/danfe-search',
        description: 'Gera DANFE a partir da chave XML da NF.',
        params: {
          body: {
            mainInvoiceXml: { type: 'string', required: true, description: 'Chave XML da NF', placeholder: '' },
            nfeDocumentType: { type: 'string', required: false, description: 'Tipo (default: NFeNormal)', placeholder: 'NFeNormal' },
          },
        },
      },
      {
        name: 'DANFE a partir de Invoice',
        method: 'POST',
        path: '/api/totvs/danfe-from-invoice',
        description: 'Busca NF e gera DANFE automaticamente (2 em 1).',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Payload do invoices-search', placeholder: '{"change": {}}' },
          },
        },
      },
      {
        name: 'DANFE em Lote',
        method: 'POST',
        path: '/api/totvs/danfe-batch',
        description: 'Gera DANFE para múltiplas NFs de um cliente.',
        params: {
          body: {
            personCode: { type: 'number', required: true, description: 'Código do cliente', placeholder: '180' },
            branchCodeList: { type: 'number[]', required: false, description: 'Filiais', placeholder: '[1, 2]' },
            issueDates: { type: 'string[]', required: true, description: 'Datas de emissão', placeholder: '["2024-01-15", "2024-02-20"]' },
          },
        },
      },
      {
        name: 'XML por Chave de Acesso',
        method: 'GET',
        path: '/api/totvs/xml-contents/:accessKey',
        description: 'Retorna o conteúdo XML de uma NF pela chave de acesso.',
        params: {
          url: {
            accessKey: { type: 'string', required: true, description: 'Chave de acesso da NF-e', placeholder: '' },
          },
        },
      },
    ],
  },
  {
    id: 'boletos',
    name: 'Boletos',
    description: 'Geração de boletos bancários',
    icon: '🏦',
    routes: [
      {
        name: 'Gerar Boleto Bancário',
        method: 'POST',
        path: '/api/totvs/bank-slip',
        description: 'Gera boleto em base64 a partir dos dados do título.',
        params: {
          body: {
            branchCode: { type: 'number', required: true, description: 'Filial (máx 4 dígitos)', placeholder: '1' },
            customerCode: { type: 'number', required: false, description: 'Código cliente (se não informar CPF/CNPJ)', placeholder: '180' },
            customerCpfCnpj: { type: 'string', required: false, description: 'CPF/CNPJ (se não informar código)', placeholder: '' },
            receivableCode: { type: 'number', required: true, description: 'Código do título', placeholder: '12345' },
            installmentNumber: { type: 'number', required: true, description: 'Parcela', placeholder: '1' },
          },
        },
      },
    ],
  },
  {
    id: 'empresas',
    name: 'Empresas / Filiais',
    description: 'Consulta de empresas e filiais do TOTVS',
    icon: '🏢',
    routes: [
      {
        name: 'Listar Filiais',
        method: 'GET',
        path: '/api/totvs/branches',
        description: 'Lista empresas/filiais cadastradas no TOTVS.',
        params: {
          query: {
            branchCodePool: { type: 'number', required: false, description: 'Empresa base', placeholder: '' },
            page: { type: 'number', required: false, description: 'Página', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág', placeholder: '1000' },
          },
        },
      },
      {
        name: 'Clientes Franquia',
        method: 'GET',
        path: '/api/totvs/franchise-clients',
        description: 'Códigos de clientes FRANQUIA. Cache 60 min.',
        params: {
          query: {
            refresh: { type: 'string', required: false, description: '"true" para forçar recarga', placeholder: '' },
          },
        },
      },
      {
        name: 'Clientes Multimarcas',
        method: 'GET',
        path: '/api/totvs/multibrand-clients',
        description: 'Códigos de clientes MULTIMARCAS. Cache 60 min.',
        params: {
          query: {
            refresh: { type: 'string', required: false, description: '"true" para forçar recarga', placeholder: '' },
          },
        },
      },
    ],
  },
  {
    id: 'faturamento',
    name: 'Faturamento / Fiscal',
    description: 'Movimentos fiscais, ranking e produtos mais vendidos',
    icon: '📊',
    routes: [
      {
        name: 'Movimentos Fiscais',
        method: 'POST',
        path: '/api/totvs/fiscal-movement/search',
        description: 'Movimentos fiscais: ranking de faturamento por empresa e vendedor.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: '{ branchCodeList, startMovementDate, endMovementDate }', placeholder: '{"branchCodeList": [1, 2], "startMovementDate": "2024-01-01T00:00:00", "endMovementDate": "2024-01-31T23:59:59"}' },
            page: { type: 'number', required: false, description: 'Página', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (máx: 1000)', placeholder: '500' },
          },
        },
      },
      {
        name: 'Produtos Mais Vendidos',
        method: 'POST',
        path: '/api/totvs/best-selling-products',
        description: 'Ranking de produtos mais vendidos num período.',
        params: {
          body: {
            branchs: { type: 'number[]', required: true, description: 'Filiais', placeholder: '[1, 2]' },
            datemin: { type: 'string', required: true, description: 'Data início', placeholder: '2024-01-01' },
            datemax: { type: 'string', required: true, description: 'Data fim', placeholder: '2024-01-31' },
          },
        },
      },
    ],
  },
  {
    id: 'painel-vendas',
    name: 'Painel de Vendas',
    description: 'Faturamento total, ranking por filial e vendedores',
    icon: '🏪',
    routes: [
      {
        name: 'Faturamento Total',
        method: 'POST',
        path: '/api/totvs/sale-panel/totals',
        description: 'Totais de faturamento para o Painel de Vendas.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Filtros de período e filiais', placeholder: '{"branchCodeList": [1], "startMovementDate": "2024-01-01T00:00:00", "endMovementDate": "2024-01-31T23:59:59"}' },
          },
        },
      },
      {
        name: 'Ranking por Filial',
        method: 'POST',
        path: '/api/totvs/sale-panel/ranking-faturamento',
        description: 'Ranking de faturamento por filial no período.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Filtros de período e filiais', placeholder: '{"branchCodeList": [1, 2], "startMovementDate": "2024-01-01T00:00:00", "endMovementDate": "2024-01-31T23:59:59"}' },
          },
        },
      },
      {
        name: 'Vendedores por Filial',
        method: 'POST',
        path: '/api/totvs/sale-panel/sellers',
        description: 'Vendedores e dados de vendas por filial.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Filtros de período e filiais', placeholder: '{"branchCodeList": [1], "startMovementDate": "2024-01-01T00:00:00", "endMovementDate": "2024-01-31T23:59:59"}' },
          },
        },
      },
    ],
  },
  {
    id: 'estoque',
    name: 'Estoque',
    description: 'Consultas de saldo de estoque',
    icon: '📦',
    routes: [
      {
        name: 'Saldo de Estoque',
        method: 'POST',
        path: '/api/totvs/product-balances',
        description: 'Saldos de produtos (estoque). Filtros: código, referência, nome, grupo, barcode, classificação.',
        params: {
          body: {
            filter: { type: 'object', required: true, description: 'Filtros de produto', placeholder: '{"hasStock": true, "branchStockCode": 1, "stockCode": 1}' },
            option: { type: 'object', required: true, description: 'balances com branchCode e stockCodeList', placeholder: '{"balances": [{"branchCode": 1, "stockCodeList": [1]}]}' },
            page: { type: 'number', required: false, description: 'Página', placeholder: '1' },
            pageSize: { type: 'number', required: false, description: 'Itens/pág (máx: 1000)', placeholder: '100' },
          },
        },
        response: `{
  "success": true,
  "data": {
    "data": [{ "productCode": 12345, "productName": "CAMISETA POLO M", "stock": 150, "available": 135, "colorDescription": "BRANCO", "sizeCode": "M" }],
    "total": 500, "count": 100, "totalPages": 5, "hasNext": true
  }
}`,
      },
    ],
  },
  {
    id: 'vouchers',
    name: 'Vouchers',
    description: 'Consulta de vouchers',
    icon: '🎫',
    routes: [
      {
        name: 'Buscar Vouchers',
        method: 'GET',
        path: '/api/totvs/vouchers/search',
        description: 'Busca vouchers disponíveis.',
        params: { query: {} },
      },
    ],
  },
  {
    id: 'token',
    name: 'Autenticação',
    description: 'Token da API TOTVS',
    icon: '🔑',
    routes: [
      {
        name: 'Obter Token Atual',
        method: 'GET',
        path: '/api/totvs/token',
        description: 'Retorna o token TOTVS atual (renovado a cada 6 horas).',
        params: {},
      },
    ],
  },
];

// ==========================================
// CAMPOS pes_pessoa (Supabase)
// ==========================================
const PES_PESSOA_FIELDS = [
  { campo: 'code', tipo: 'number', descricao: 'Código da pessoa (PK)' },
  { campo: 'cd_empresacad', tipo: 'number', descricao: 'Empresa de cadastro' },
  { campo: 'tipo_pessoa', tipo: 'string', descricao: '"PF" ou "PJ"' },
  { campo: 'nm_pessoa', tipo: 'string', descricao: 'Nome / Razão social' },
  { campo: 'fantasy_name', tipo: 'string', descricao: 'Nome fantasia' },
  { campo: 'uf', tipo: 'string', descricao: 'Estado (UF)' },
  { campo: 'insert_date', tipo: 'string', descricao: 'Data cadastro TOTVS' },
  { campo: 'cpf', tipo: 'string', descricao: 'CPF ou CNPJ' },
  { campo: 'is_inactive', tipo: 'boolean', descricao: 'Inativo' },
  { campo: 'is_customer', tipo: 'boolean', descricao: 'É cliente' },
  { campo: 'customer_status', tipo: 'string', descricao: 'Status cliente' },
  { campo: 'telefone', tipo: 'string', descricao: 'Telefone principal' },
  { campo: 'email', tipo: 'string', descricao: 'E-mail principal' },
  { campo: 'phones', tipo: 'json[]', descricao: 'Todos os telefones' },
  { campo: 'emails', tipo: 'json[]', descricao: 'Todos os e-mails' },
  { campo: 'addresses', tipo: 'json[]', descricao: 'Endereços' },
  { campo: 'classifications', tipo: 'json[]', descricao: 'Classificações' },
  { campo: 'updated_at', tipo: 'string', descricao: 'Última sincronização' },
];

// ==========================================
// UTILS
// ==========================================

function parseParamValue(value, type) {
  if (!value && value !== 0 && value !== false) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  if (type === 'number') { const n = Number(str); return isNaN(n) ? undefined : n; }
  if (type === 'boolean') return str === 'true';
  if (type === 'number[]' || type === 'string[]' || type === 'object') {
    try { return JSON.parse(str); } catch { return undefined; }
  }
  return str;
}

function buildRequestUrl(route, paramValues) {
  let url = `${API_BASE_URL}${route.path}`;
  if (route.params?.url) {
    for (const [name] of Object.entries(route.params.url)) {
      const val = paramValues[name];
      if (val) url = url.replace(`:${name}`, encodeURIComponent(val));
    }
    url = url.replace(/\/:[^/]+\??/g, '');
  }
  if (route.params?.query) {
    const sp = new URLSearchParams();
    for (const [name] of Object.entries(route.params.query)) {
      const val = paramValues[name];
      if (val !== undefined && val !== '') sp.set(name, val);
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

function buildRequestBody(route, paramValues) {
  if (!route.params?.body) return null;
  const body = {};
  for (const [name, info] of Object.entries(route.params.body)) {
    const val = parseParamValue(paramValues[name], info.type);
    if (val !== undefined) body[name] = val;
  }
  return Object.keys(body).length > 0 ? body : null;
}

// ==========================================
// COMPONENTES
// ==========================================

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Copiar">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-green-100 text-green-800 border-green-300',
    POST: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[method] || 'bg-gray-100 text-gray-800'}`}>
      {method}
    </span>
  );
}

function ParamInputs({ params, values, onChange }) {
  if (!params) return null;
  const allParams = [];
  for (const [location, fields] of Object.entries(params)) {
    for (const [name, info] of Object.entries(fields)) {
      allParams.push({ location, name, ...info });
    }
  }
  if (allParams.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-semibold uppercase">Parâmetros</p>
      {allParams.map((p) => (
        <div key={`${p.location}-${p.name}`}>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-mono text-blue-700 font-semibold">{p.name}</label>
            <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-500">{p.location}</span>
            <span className="text-[10px] text-gray-400">{p.type}</span>
            {p.required && <span className="text-[10px] text-red-500 font-bold">obrigatório</span>}
          </div>
          {p.description && <p className="text-[11px] text-gray-400 mb-1">{p.description}</p>}
          {p.type === 'object' || p.type === 'number[]' || p.type === 'string[]' ? (
            <textarea
              value={values[p.name] || ''}
              onChange={(e) => onChange(p.name, e.target.value)}
              placeholder={p.placeholder || ''}
              rows={2}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50 resize-y"
            />
          ) : (
            <input
              type="text"
              value={values[p.name] || ''}
              onChange={(e) => onChange(p.name, e.target.value)}
              placeholder={p.placeholder || ''}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ResponseViewer({ response, loading, error, duration }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Spinner size={18} className="animate-spin text-indigo-500" />
        <span className="text-sm text-gray-500">Executando consulta...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <Warning size={16} className="text-red-500" />
          <span className="text-sm font-semibold text-red-700">Erro</span>
        </div>
        <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{error}</pre>
      </div>
    );
  }
  if (response === null) return null;

  const jsonStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500 font-semibold uppercase">Resposta</p>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            response.status >= 200 && response.status < 300
              ? 'bg-green-100 text-green-700'
              : response.status >= 400
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
          }`}>
            {response.status}
          </span>
          {duration && <span className="text-[10px] text-gray-400">{duration}ms</span>}
        </div>
        <CopyButton text={jsonStr} />
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
        <code>{jsonStr}</code>
      </pre>
    </div>
  );
}

function RouteConsole({ route, onClose }) {
  const [paramValues, setParamValues] = useState({});
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(null);

  if (!route) return null;

  const handleParamChange = (name, value) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const executeRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setDuration(null);
    const start = performance.now();
    try {
      const url = buildRequestUrl(route, paramValues);
      const body = buildRequestBody(route, paramValues);
      const options = {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (route.method === 'POST' && body) {
        options.body = JSON.stringify(body);
      }
      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - start);
      setDuration(elapsed);
      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      setResponse({ status: res.status, data });
    } catch (err) {
      setDuration(Math.round(performance.now() - start));
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const allParams = [];
  if (route.params) {
    for (const [location, fields] of Object.entries(route.params)) {
      for (const [name, info] of Object.entries(fields)) {
        allParams.push({ location, name, ...info });
      }
    }
  }
  const missingRequired = allParams
    .filter((p) => p.required)
    .filter((p) => !paramValues[p.name] || String(paramValues[p.name]).trim() === '');

  const curlUrl = buildRequestUrl(route, paramValues);
  const curlBody = buildRequestBody(route, paramValues);
  let curlCmd = `curl -X ${route.method} "${curlUrl}"`;
  if (route.method === 'POST' && curlBody) {
    curlCmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(curlBody)}'`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <MethodBadge method={route.method} />
            <h2 className="text-lg font-bold text-gray-800">{route.name}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Endpoint */}
          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
            <MethodBadge method={route.method} />
            <code className="text-sm font-mono text-gray-700 break-all flex-1">{API_BASE_URL}{route.path}</code>
            <CopyButton text={`${API_BASE_URL}${route.path}`} />
          </div>

          <p className="text-sm text-gray-600">{route.description}</p>

          {/* Params */}
          <ParamInputs params={route.params} values={paramValues} onChange={handleParamChange} />

          {/* Execute */}
          <div className="flex items-center gap-3">
            <button
              onClick={executeRequest}
              disabled={loading || missingRequired.length > 0}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                loading || missingRequired.length > 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              }`}
            >
              {loading ? <Spinner size={16} className="animate-spin" /> : <Play size={16} weight="fill" />}
              {loading ? 'Executando...' : 'Executar Consulta'}
            </button>
            {missingRequired.length > 0 && (
              <span className="text-xs text-red-500">Preencha: {missingRequired.map((p) => p.name).join(', ')}</span>
            )}
          </div>

          {/* cURL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400 font-semibold uppercase">cURL</p>
              <CopyButton text={curlCmd} />
            </div>
            <pre className="bg-gray-900 text-gray-300 p-3 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">{curlCmd}</pre>
          </div>

          {/* Response */}
          <ResponseViewer response={response} loading={loading} error={error} duration={duration} />

          {/* Doc example */}
          {route.response && !response && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400 font-semibold uppercase">Exemplo de Resposta</p>
                <CopyButton text={route.response} />
              </div>
              <pre className="bg-gray-800 text-gray-300 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                <code>{route.response}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, onSelectRoute }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-2xl">{category.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800">{category.name}</h3>
          <p className="text-xs text-gray-500 truncate">{category.description}</p>
        </div>
        <span className="text-xs text-gray-400 mr-2">{category.routes.length} rota(s)</span>
        {expanded ? <CaretDown size={18} className="text-gray-400 flex-shrink-0" /> : <CaretRight size={18} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t divide-y divide-gray-100">
          {category.id === 'clientes' && (
            <div className="px-5 py-3 bg-blue-50">
              <details className="group">
                <summary className="text-xs font-semibold text-blue-700 cursor-pointer flex items-center gap-1">
                  <CaretRight size={12} className="group-open:rotate-90 transition-transform" />
                  Campos da tabela pes_pessoa (Supabase)
                </summary>
                <div className="overflow-x-auto mt-2 max-h-52 overflow-y-auto border rounded-lg bg-white">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-100">
                        <th className="text-left p-2 border-b font-semibold">Campo</th>
                        <th className="text-left p-2 border-b font-semibold">Tipo</th>
                        <th className="text-left p-2 border-b font-semibold">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PES_PESSOA_FIELDS.map((f, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-blue-50">
                          <td className="p-2 font-mono text-blue-700">{f.campo}</td>
                          <td className="p-2 text-gray-500">{f.tipo}</td>
                          <td className="p-2 text-gray-600">{f.descricao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
          {category.routes.map((route, idx) => (
            <button
              key={idx}
              onClick={() => onSelectRoute(route)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-indigo-50 transition-colors text-left group"
            >
              <MethodBadge method={route.method} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 flex-1 min-w-0">{route.name}</span>
              <code className="text-[11px] text-gray-400 font-mono hidden md:block truncate max-w-[250px]">{route.path}</code>
              <Play size={14} weight="fill" className="text-gray-300 group-hover:text-indigo-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function ApiClaude() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  if (!user || user.role !== 'owner') {
    return (
      <div className="p-8 text-red-600 font-bold text-center">
        <Code size={48} className="mx-auto mb-4 text-red-500" />
        <p>Acesso restrito ao Proprietário.</p>
      </div>
    );
  }

  const filteredCategories = ROUTE_CATEGORIES.filter((cat) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cat.name.toLowerCase().includes(term) ||
      cat.description.toLowerCase().includes(term) ||
      cat.routes.some((r) => r.name.toLowerCase().includes(term) || r.path.toLowerCase().includes(term))
    );
  });

  const totalRoutes = ROUTE_CATEGORIES.reduce((acc, c) => acc + c.routes.length, 0);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Code size={32} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-800">API Console</h1>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 border border-amber-300">SOMENTE CONSULTA</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Console de consulta da API TOTVS Moda — {totalRoutes} rotas em {ROUTE_CATEGORIES.length} categorias
      </p>

      <div className="relative mb-6">
        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar rota, categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-700">
              <strong>Base URL:</strong>{' '}
              <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs">{API_BASE_URL}</code>
            </p>
            <p className="text-xs text-indigo-600 mt-1">
              Prefixo <code className="bg-indigo-100 px-1 rounded">/api/totvs/</code> · Token auto-gerenciado · Clique numa rota para executar
            </p>
          </div>
          <CopyButton text={API_BASE_URL} />
        </div>
      </div>

      <div className="space-y-3">
        {filteredCategories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} onSelectRoute={(route) => setSelectedRoute(route)} />
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <MagnifyingGlass size={48} className="mx-auto mb-3" />
          <p>Nenhuma rota encontrada para "{searchTerm}"</p>
        </div>
      )}

      {selectedRoute && (
        <RouteConsole route={selectedRoute} onClose={() => setSelectedRoute(null)} />
      )}
    </div>
  );
}
