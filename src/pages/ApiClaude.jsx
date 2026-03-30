import React, { useState, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import {
  UserGear,
  Copy,
  Check,
  X,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Code,
  ArrowSquareOut,
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
        name: 'Buscar Pessoa Jurídica (PJ) por Código',
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
            },
          },
        },
        response: `// Retorna o objeto completo da API TOTVS:
{
  "success": true,
  "data": {
    "items": [{
      "code": 180,
      "name": "EMPRESA EXEMPLO LTDA",
      "fantasyName": "EXEMPLO",
      "cnpj": "12345678000190",
      "stateRegistration": "...",
      "insertDate": "2020-01-15",        // Data de cadastro
      "maxChangeFilterDate": "2024-03-01", // Última alteração
      "isInactive": false,
      "isCustomer": true,
      "customerStatus": "Normal",
      "uf": "CE",
      "phones": [{ "ddd": "85", "number": "999999999", "isDefault": true }],
      "emails": [{ "email": "contato@exemplo.com", "isDefault": true }],
      "addresses": [{ "street": "...", "city": "...", "uf": "CE" }],
      "classifications": [...],
      "contacts": [...],
      // ... demais campos TOTVS
    }],
    "hasNext": false,
    "total": 1
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/legal-entity/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personCode: 180 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Pessoa Jurídica (PJ) por Nome',
        method: 'POST',
        path: '/api/totvs/legal-entity/search-by-name',
        description:
          'Busca pessoas jurídicas pelo nome fantasia. Percorre múltiplas páginas automaticamente e filtra localmente.',
        params: {
          body: {
            fantasyName: {
              type: 'string',
              required: true,
              description: 'Nome fantasia para buscar (mín. 2 caracteres)',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas a percorrer (default: 50)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [
      {
        "code": 180,
        "name": "EMPRESA EXEMPLO LTDA",
        "fantasyName": "EXEMPLO",
        "cnpj": "12345678000190",
        "phones": [...],
        "emails": [...],
        "addresses": [...],
        "classifications": [...],
        "contacts": [...],
        "observations": [...]
      }
    ],
    "totalFiltered": 5,
    "totalFetched": 1200,
    "pagesSearched": 12,
    "hasMore": false
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/legal-entity/search-by-name', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fantasyName: "EXEMPLO", maxPages: 10 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Pessoa Jurídica (PJ) por Telefone',
        method: 'POST',
        path: '/api/totvs/legal-entity/search-by-phone',
        description:
          'Busca pessoa jurídica pelo número de telefone. Como a API TOTVS PJ não suporta filtro direto por telefone, esta rota percorre as páginas de clientes PJ e filtra localmente pelo número informado. Apenas telefones com no mínimo 8 dígitos numéricos são considerados na comparação (registros com telefone vazio ou inválido são ignorados). Pode ser mais lenta que a busca PF por telefone.',
        params: {
          body: {
            phoneNumber: {
              type: 'string',
              required: true,
              description:
                'Número de telefone (apenas números, mín. 8 dígitos). Ex: "85999991234"',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas a percorrer (default: 30)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [{
      "code": 180,
      "name": "EMPRESA EXEMPLO LTDA",
      "fantasyName": "EXEMPLO",
      "cnpj": "12345678000190",
      "isCustomer": true,
      "customerStatus": "Normal",
      "phones": [{ "typeCode": 1, "number": "85999991234", "isDefault": true }],
      "emails": [...],
      "addresses": [...],
      "contacts": [...],
      "classifications": [...]
    }],
    "totalFiltered": 1,
    "totalFetched": 5000,
    "pagesSearched": 10,
    "hasMore": false
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/legal-entity/search-by-phone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: "85999991234", maxPages: 20 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Pessoa Física (PF) por Código',
        method: 'POST',
        path: '/api/totvs/individual/search',
        description:
          'Busca dados completos de uma pessoa física na API TOTVS pelo código da pessoa.',
        params: {
          body: {
            personCode: {
              type: 'number',
              required: true,
              description: 'Código da pessoa no TOTVS',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [{
      "code": 500,
      "name": "FULANO DE TAL",
      "cpf": "12345678900",
      "rg": "...",
      "birthDate": "1990-05-20",
      "insertDate": "2021-03-10",
      "isInactive": false,
      "isCustomer": true,
      "customerStatus": "Normal",
      "uf": "CE",
      "phones": [{ "ddd": "85", "number": "988887777", "isDefault": true }],
      "emails": [{ "email": "fulano@email.com" }],
      "addresses": [...]
    }],
    "hasNext": false,
    "total": 1
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/individual/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personCode: 500 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Pessoa Física (PF) por Nome',
        method: 'POST',
        path: '/api/totvs/individual/search-by-name',
        description:
          'Busca pessoas físicas pelo nome. Percorre múltiplas páginas e filtra localmente.',
        params: {
          body: {
            name: {
              type: 'string',
              required: true,
              description: 'Nome para buscar (mín. 2 caracteres)',
            },
            maxPages: {
              type: 'number',
              required: false,
              description: 'Máximo de páginas a percorrer (default: 50)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [
      { "code": 500, "name": "FULANO DE TAL", "cpf": "...", "phones": [...] }
    ],
    "totalFiltered": 3,
    "totalFetched": 800,
    "pagesSearched": 8,
    "hasMore": false
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/individual/search-by-name', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: "FULANO", maxPages: 10 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Pessoa Física (PF) por Telefone',
        method: 'POST',
        path: '/api/totvs/individual/search-by-phone',
        description:
          'Busca pessoa física pelo número de telefone na API TOTVS. Envia apenas números (sem parênteses, traços ou espaços), mínimo 8 dígitos.',
        params: {
          body: {
            phoneNumber: {
              type: 'string',
              required: true,
              description:
                'Número de telefone (apenas números, mín. 8 dígitos). Ex: "85999991234"',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "items": [{
      "code": 500,
      "name": "FULANO DE TAL",
      "cpf": "12345678900",
      "birthDate": "1990-05-20",
      "isCustomer": true,
      "customerStatus": "Normal",
      "phones": [{ "typeCode": 1, "number": "85999991234", "isDefault": true }],
      "emails": [{ "email": "fulano@email.com" }],
      "addresses": [...],
      "classifications": [...],
      "observations": [...]
    }],
    "hasNext": false,
    "totalItems": 1
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/individual/search-by-phone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phoneNumber: "85999991234" })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Batch Lookup (Busca em lote)',
        method: 'POST',
        path: '/api/totvs/persons/batch-lookup',
        description:
          'Busca nome, nome fantasia, telefone e UF de múltiplas pessoas de uma vez (PJ + PF em paralelo). Ideal para popular tabelas.',
        params: {
          body: {
            personCodes: {
              type: 'number[]',
              required: true,
              description: 'Array de códigos de pessoa',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "180": {
      "name": "EMPRESA EXEMPLO LTDA",
      "fantasyName": "EXEMPLO",
      "phone": "(85) 999999999",
      "uf": "CE"
    },
    "500": {
      "name": "FULANO DE TAL",
      "fantasyName": "FULANO DE TAL",
      "phone": "(85) 988887777",
      "uf": "CE"
    }
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/persons/batch-lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personCodes: [180, 500, 300, 42] })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Clientes por Nome (Supabase)',
        method: 'GET',
        path: '/api/totvs/clientes/search-name',
        description:
          'Busca clientes na tabela pes_pessoa do Supabase por nome, nome fantasia ou CPF/CNPJ. Retorno rápido (banco local).',
        params: {
          query: {
            nome: {
              type: 'string',
              required: false,
              description: 'Termo para buscar no nome (ILIKE)',
            },
            fantasia: {
              type: 'string',
              required: false,
              description: 'Termo para buscar no nome fantasia (ILIKE)',
            },
            cnpj: {
              type: 'string',
              required: false,
              description: 'CPF ou CNPJ para buscar',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "clientes": [
      {
        "code": 180,
        "cd_empresacad": 1,
        "nm_pessoa": "EMPRESA EXEMPLO LTDA",
        "fantasy_name": "EXEMPLO",
        "cpf": "12345678000190",
        "tipo_pessoa": "PJ",
        "telefone": "(85) 999999999",
        "email": "contato@exemplo.com",
        "is_customer": true,
        "customer_status": "Normal",
        "person_status": "Ativo"
      }
    ],
    "total": 1
  }
}`,
        example: `// Por nome
fetch('${API_BASE_URL}/api/totvs/clientes/search-name?nome=EXEMPLO')
  .then(res => res.json())
  .then(data => console.log(data));

// Por CNPJ
fetch('${API_BASE_URL}/api/totvs/clientes/search-name?cnpj=12345678000190')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Buscar Todos os Clientes (TOTVS)',
        method: 'GET',
        path: '/api/totvs/clientes/fetch-all',
        description:
          'Busca todos os clientes (PF + PJ) do TOTVS com paginação. Primeira chamada busca da API TOTVS e cacheia por 10 min.',
        params: {
          query: {
            startDate: {
              type: 'string',
              required: false,
              description: 'Data início do cadastro (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              required: false,
              description: 'Data fim do cadastro (YYYY-MM-DD)',
            },
            personCode: {
              type: 'string',
              required: false,
              description: 'Código(s) da pessoa (ex: 180 ou 180,200)',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 1000, máx: 5000)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "clientes": [/* array de clientes mapeados */],
    "page": 1,
    "pageSize": 1000,
    "totalPages": 5,
    "totalItems": 4500,
    "totalPF": 2000,
    "totalPJ": 2500,
    "hasNext": true,
    "hasPrev": false,
    "duration": "3.2s",
    "fetchDuration": "3.2s"
  }
}`,
        example: `// Todos os clientes, página 1
fetch('${API_BASE_URL}/api/totvs/clientes/fetch-all?page=1&pageSize=100')
  .then(res => res.json())
  .then(data => console.log(data));

// Filtrar por data de cadastro
fetch('${API_BASE_URL}/api/totvs/clientes/fetch-all?startDate=2024-01-01&endDate=2024-12-31')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Buscar Clientes por Faixa de Códigos',
        method: 'GET',
        path: '/api/totvs/clientes/fetch-batch',
        description:
          'Busca PF + PJ por faixa de códigos (ex: 1-500). Usado para carga incremental em lotes. Máximo 1000 códigos por vez.',
        params: {
          query: {
            startCode: {
              type: 'number',
              required: false,
              description: 'Código inicial (default: 1)',
            },
            endCode: {
              type: 'number',
              required: false,
              description: 'Código final (default: startCode + 499)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "clientes": [/* array de clientes na faixa */],
    "totalPF": 150,
    "totalPJ": 200,
    "range": "1-500"
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/clientes/fetch-batch?startCode=1&endCode=500')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Estatísticas do Cliente',
        method: 'POST',
        path: '/api/totvs/person-statistics',
        description:
          'Busca estatísticas financeiras/comerciais de um cliente na API TOTVS (compras, faturamento, etc.) por filial.',
        params: {
          body: {
            personCode: {
              type: 'number',
              required: true,
              description: 'Código da pessoa',
            },
            branchCode: {
              type: 'number',
              required: false,
              description: 'Código da filial (default: 1)',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    // Dados de estatísticas do TOTVS person-statistics
    // (compras, última compra, valores, etc.)
  }
}`,
        example: `fetch('${API_BASE_URL}/api/totvs/person-statistics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personCode: 180 })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
    ],
  },
  {
    id: 'financeiro',
    name: 'Contas a Receber',
    description:
      'Consultas de títulos, faturas e saldos financeiros de clientes',
    icon: '💰',
    routes: [
      {
        name: 'Buscar Contas a Receber',
        method: 'POST',
        path: '/api/totvs/accounts-receivable/search',
        description:
          'Busca documentos de contas a receber (faturas) na API TOTVS. Retorna uma página por vez.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: false,
              description: 'Filtros (DocumentRequestModel TOTVS)',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 100)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/accounts-receivable/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: { customerCodeList: [180] },
    page: 1,
    pageSize: 50
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Buscar Todas as Contas a Receber',
        method: 'POST',
        path: '/api/totvs/accounts-receivable/search-all',
        description:
          'Busca TODAS as páginas de contas a receber automaticamente.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: true,
              description: 'Filtros (DocumentRequestModel TOTVS)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/accounts-receivable/search-all', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: { customerCodeList: [180] }
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Filtro de Contas a Receber (v3 otimizado)',
        method: 'GET',
        path: '/api/totvs/accounts-receivable/filter',
        description:
          'Rota otimizada para contas a receber. Páginas buscadas em paralelo, lookup de nomes em batch, cache de branchCodes.',
        params: {
          query: {
            // Consulte os query params na implementação
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/accounts-receivable/filter?...')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'PMR (Prazo Médio de Recebimento)',
        method: 'GET',
        path: '/api/totvs/accounts-receivable/pmr',
        description:
          'Calcula o Prazo Médio de Recebimento a partir dos dados de contas a receber.',
        params: { query: {} },
        example: `fetch('${API_BASE_URL}/api/totvs/accounts-receivable/pmr')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Saldo Financeiro de Franquias',
        method: 'POST',
        path: '/api/totvs/franchise-financial-balance',
        description:
          'Busca saldo financeiro de clientes franquia na API TOTVS.',
        params: {
          body: {
            customerCodeList: {
              type: 'number[]',
              required: true,
              description: 'Códigos dos clientes',
            },
            branchCodeList: {
              type: 'number[]',
              required: false,
              description: 'Códigos das filiais',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 200, máx: 500)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/franchise-financial-balance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customerCodeList: [180, 200] })
}).then(res => res.json()).then(data => console.log(data));`,
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
        name: 'Buscar Notas Fiscais (invoices-search)',
        method: 'POST',
        path: '/api/totvs/invoices-search',
        description:
          'Proxy direto para fiscal/v2/invoices/search da API TOTVS. Retorna uma página.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: false,
              description: 'Filtros da busca',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 100)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/invoices-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: { change: {} },
    page: 1,
    pageSize: 50,
    expand: 'person'
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Buscar NFs otimizado (cache + paralelo)',
        method: 'POST',
        path: '/api/totvs/invoices/search',
        description:
          'Busca TODAS as NFs com pageSize 500, 10 páginas paralelas, cache 10min. Usa change.startDate/endDate com margem ±3 dias.',
        params: {
          body: {
            startDate: {
              type: 'string',
              required: true,
              description: 'Data início (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              required: true,
              description: 'Data fim (YYYY-MM-DD)',
            },
            branchCodeList: {
              type: 'number[]',
              required: false,
              description: 'Filiais',
            },
            operationType: {
              type: 'string',
              required: false,
              description: 'Tipo de operação',
            },
            personCodeList: {
              type: 'number[]',
              required: false,
              description: 'Códigos de pessoa',
            },
            noCache: {
              type: 'boolean',
              required: false,
              description: 'Forçar bypass do cache',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/invoices/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    branchCodeList: [1, 2, 5]
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Buscar DANFE',
        method: 'POST',
        path: '/api/totvs/danfe-search',
        description: 'Gera DANFE a partir da chave XML da NF.',
        params: {
          body: {
            mainInvoiceXml: {
              type: 'string',
              required: true,
              description: 'Chave XML da NF',
            },
            nfeDocumentType: {
              type: 'string',
              required: false,
              description: 'Tipo documento (default: NFeNormal)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/danfe-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mainInvoiceXml: 'CHAVE_XML_AQUI'
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'DANFE a partir de Invoice',
        method: 'POST',
        path: '/api/totvs/danfe-from-invoice',
        description: 'Busca a NF e gera o DANFE automaticamente (2 em 1).',
        params: {
          body: {
            filter: {
              type: 'object',
              required: true,
              description: 'Mesmo payload do invoices-search',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/danfe-from-invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* payload invoices-search */ })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'DANFE em Lote',
        method: 'POST',
        path: '/api/totvs/danfe-batch',
        description: 'Busca + gera DANFE para múltiplas NFs de um cliente.',
        params: {
          body: {
            personCode: {
              type: 'number',
              required: true,
              description: 'Código do cliente',
            },
            branchCodeList: {
              type: 'number[]',
              required: false,
              description: 'Filiais',
            },
            issueDates: {
              type: 'string[]',
              required: true,
              description: 'Array de datas de emissão',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/danfe-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    personCode: 180,
    issueDates: ['2024-01-15', '2024-02-20']
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Conteúdo XML por Chave de Acesso',
        method: 'GET',
        path: '/api/totvs/xml-contents/:accessKey',
        description: 'Retorna o conteúdo XML de uma NF pela chave de acesso.',
        params: {
          url: {
            accessKey: {
              type: 'string',
              required: true,
              description: 'Chave de acesso da NF-e',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/xml-contents/CHAVE_ACESSO_AQUI')
  .then(res => res.json())
  .then(data => console.log(data));`,
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
        description:
          'Gera o boleto bancário em base64 a partir dos dados do título.',
        params: {
          body: {
            branchCode: {
              type: 'number',
              required: true,
              description: 'Código da filial (máx 4 dígitos)',
            },
            customerCode: {
              type: 'number',
              required: false,
              description:
                'Código do cliente (obrigatório se não informar CPF/CNPJ, máx 9 dígitos)',
            },
            customerCpfCnpj: {
              type: 'string',
              required: false,
              description:
                'CPF/CNPJ do cliente (obrigatório se não informar código, apenas números, máx 14)',
            },
            receivableCode: {
              type: 'number',
              required: true,
              description: 'Código do título (máx 10 dígitos)',
            },
            installmentNumber: {
              type: 'number',
              required: true,
              description: 'Número da parcela (máx 3 dígitos)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/bank-slip', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    branchCode: 1,
    customerCode: 180,
    receivableCode: 12345,
    installmentNumber: 1
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
    ],
  },
  {
    id: 'empresas',
    name: 'Empresas / Filiais',
    description: 'Consulta de empresas e filiais cadastradas no TOTVS',
    icon: '🏢',
    routes: [
      {
        name: 'Listar Filiais',
        method: 'GET',
        path: '/api/totvs/branches',
        description: 'Retorna lista de empresas/filiais cadastradas no TOTVS.',
        params: {
          query: {
            branchCodePool: {
              type: 'number',
              required: false,
              description: 'Código empresa base para filtro',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 1000)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/branches')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Clientes Franquia',
        method: 'GET',
        path: '/api/totvs/franchise-clients',
        description:
          'Retorna lista de códigos de clientes FRANQUIA (classificação TOTVS). Cache 60 min.',
        params: {
          query: {
            refresh: {
              type: 'string',
              required: false,
              description: '"true" para forçar recarga do cache',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/franchise-clients')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Clientes Multimarcas',
        method: 'GET',
        path: '/api/totvs/multibrand-clients',
        description:
          'Retorna lista de códigos de clientes MULTIMARCAS (classificação TOTVS). Cache 60 min.',
        params: {
          query: {
            refresh: {
              type: 'string',
              required: false,
              description: '"true" para forçar recarga do cache',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/multibrand-clients')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
    ],
  },
  {
    id: 'faturamento',
    name: 'Faturamento / Fiscal',
    description:
      'Movimentos fiscais, ranking de faturamento e produtos mais vendidos',
    icon: '📊',
    routes: [
      {
        name: 'Movimentos Fiscais',
        method: 'POST',
        path: '/api/totvs/fiscal-movement/search',
        description:
          'Busca movimentos fiscais na API TOTVS (ranking de faturamento). Retorna dados por empresa e vendedor.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: true,
              description:
                '{ branchCodeList: number[], startMovementDate: string, endMovementDate: string }',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (máx: 1000)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/fiscal-movement/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: {
      branchCodeList: [1, 2, 5],
      startMovementDate: '2024-01-01T00:00:00',
      endMovementDate: '2024-01-31T23:59:59'
    },
    page: 1,
    pageSize: 500
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
      {
        name: 'Produtos Mais Vendidos',
        method: 'POST',
        path: '/api/totvs/best-selling-products',
        description: 'Busca ranking de produtos mais vendidos num período.',
        params: {
          body: {
            branchs: {
              type: 'number[]',
              required: true,
              description: 'Filiais',
            },
            datemin: {
              type: 'string',
              required: true,
              description: 'Data início',
            },
            datemax: {
              type: 'string',
              required: true,
              description: 'Data fim',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/best-selling-products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    branchs: [1, 2],
    datemin: '2024-01-01',
    datemax: '2024-01-31'
  })
}).then(res => res.json()).then(data => console.log(data));`,
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
        description:
          'Busca duplicatas de contas a pagar na API TOTVS. Paginação paralela + mapeamento para formato frontend.',
        params: {
          body: {
            dt_inicio: {
              type: 'string',
              required: true,
              description: 'Data início (YYYY-MM-DD)',
            },
            dt_fim: {
              type: 'string',
              required: true,
              description: 'Data fim (YYYY-MM-DD)',
            },
            branches: {
              type: 'number[]',
              required: true,
              description: 'Códigos das empresas',
            },
            modo: {
              type: 'string',
              required: false,
              description:
                "'vencimento' | 'emissao' | 'liquidacao' (default: 'vencimento')",
            },
            situacao: {
              type: 'string',
              required: false,
              description:
                "'TODAS' | 'N' | 'C' | 'A' | 'D' | 'L' | 'Q' (default: 'N')",
            },
            previsao: {
              type: 'string',
              required: false,
              description:
                "'TODOS' | 'PREVISAO' | 'REAL' | 'CONSIGNADO' (default: 'TODOS')",
            },
            supplierCodeList: {
              type: 'number[]',
              required: false,
              description: 'Fornecedores',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/accounts-payable/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dt_inicio: '2024-01-01',
    dt_fim: '2024-01-31',
    branches: [1, 2, 5],
    modo: 'vencimento',
    situacao: 'N'
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
    ],
  },
  {
    id: 'token',
    name: 'Autenticação',
    description: 'Gerenciamento de token da API TOTVS',
    icon: '🔑',
    routes: [
      {
        name: 'Obter Token Atual',
        method: 'GET',
        path: '/api/totvs/token',
        description:
          'Retorna o token TOTVS atual (gerado automaticamente a cada 6 horas).',
        params: {},
        example: `fetch('${API_BASE_URL}/api/totvs/token')
  .then(res => res.json())
  .then(data => console.log(data));`,
      },
      {
        name: 'Gerar Token (Autenticação manual)',
        method: 'POST',
        path: '/api/totvs/auth',
        description:
          'Gera um novo token de autenticação da API TOTVS Moda manualmente.',
        params: {
          body: {
            grant_type: {
              type: 'string',
              required: true,
              description:
                "'password' | 'client_credentials' | 'refresh_token'",
            },
            client_id: {
              type: 'string',
              required: true,
              description: 'Client ID da aplicação TOTVS',
            },
            client_secret: {
              type: 'string',
              required: true,
              description: 'Client Secret da aplicação TOTVS',
            },
            username: {
              type: 'string',
              required: false,
              description: 'Usuário (obrigatório se grant_type = password)',
            },
            password: {
              type: 'string',
              required: false,
              description: 'Senha (obrigatório se grant_type = password)',
            },
          },
        },
        example: `fetch('${API_BASE_URL}/api/totvs/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'password',
    client_id: 'SEU_CLIENT_ID',
    client_secret: 'SEU_CLIENT_SECRET',
    username: 'usuario',
    password: 'senha'
  })
}).then(res => res.json()).then(data => console.log(data));`,
      },
    ],
  },
  {
    id: 'estoque',
    name: 'Estoque (Produtos)',
    description:
      'Consultas de saldo de estoque e busca de produtos na API TOTVS (Product v2)',
    icon: '📦',
    routes: [
      {
        name: 'Consultar Saldo de Estoque',
        method: 'POST',
        path: '/api/totvs/product-balances',
        description:
          'Busca saldos de produtos (estoque) na API TOTVS. Permite filtrar por código de produto, referência, nome, grupo, código de barras, classificação e se possui estoque. Requer obrigatoriamente filter e option.balances com branchCode e stockCodeList.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: true,
              description: `Filtros de produto. Campos disponíveis:
  - productCodeList: number[] — Códigos de produto
  - referenceCodeList: string[] — Códigos de referência
  - productName: string — Nome do produto
  - groupCodeList: string[] — Códigos de grupo
  - barCodeList: string[] — Códigos de barra
  - branchInfo: { branchCode: number, isActive?: boolean }
  - classifications: [{ type: number, codeList: string[] }]
  - hasStock: boolean — true = com estoque (requer branchStockCode e stockCode)
  - branchStockCode: number — Código da empresa para filtro de estoque
  - stockCode: number — Código do estoque (ex: 1)`,
            },
            option: {
              type: 'object',
              required: true,
              description: `Opções obrigatórias:
  - balances: [{ branchCode: number, stockCodeList: number[], isSalesOrder?: boolean, isTransaction?: boolean, isPurchaseOrder?: boolean }]`,
            },
            page: {
              type: 'number',
              required: false,
              description: 'Número da página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 100, máx: 1000)',
            },
            order: {
              type: 'string',
              required: false,
              description: 'Ordenação. Ex: "productCode", "-stock"',
            },
            expand: {
              type: 'string',
              required: false,
              description: 'Dados adicionais separados por vírgula',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "data": [
      {
        "productCode": 12345,
        "productName": "CAMISETA POLO M",
        "referenceCode": "REF001",
        "branchCode": 1,
        "stockCode": 1,
        "stock": 150.00,
        "salesOrder": 10.00,
        "purchaseOrder": 0.00,
        "transaction": 5.00,
        "available": 135.00,
        "colorCode": "001",
        "colorDescription": "BRANCO",
        "sizeCode": "M",
        "groupCode": "10",
        "groupDescription": "CAMISETAS"
      }
    ],
    "total": 500,
    "count": 100,
    "totalPages": 5,
    "hasNext": true,
    "page": 1,
    "pageSize": 100
  }
}`,
        example: `// Exemplo: buscar estoque da empresa 1, estoque 1, com saldo > 0
fetch('${API_BASE_URL}/api/totvs/product-balances', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: {
      hasStock: true,
      branchStockCode: 1,
      stockCode: 1,
      classifications: [{ type: 17, codeList: ["10", "20"] }]
    },
    option: {
      balances: [{
        branchCode: 1,
        stockCodeList: [1],
        isSalesOrder: true,
        isTransaction: true,
        isPurchaseOrder: true
      }]
    },
    page: 1,
    pageSize: 100
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
      {
        name: 'Buscar Produtos (com Códigos de Barras)',
        method: 'POST',
        path: '/api/totvs/product-search',
        description:
          'Busca produtos na API TOTVS com suporte a expand. Permite trazer códigos de barras (expand="barCodes"), classificações e outros dados expandidos. Requer filter e option.branchInfoCode.',
        params: {
          body: {
            filter: {
              type: 'object',
              required: true,
              description: `Filtros de produto. Mesmos campos do product-balances:
  - productCodeList, referenceCodeList, productName, groupCodeList, barCodeList, classifications, etc.`,
            },
            option: {
              type: 'object',
              required: true,
              description:
                'Deve conter branchInfoCode: number (código da empresa)',
            },
            expand: {
              type: 'string',
              required: false,
              description:
                'Dados expandidos: "barCodes", "classifications", "additionalFields", etc. Separar por vírgula.',
            },
            page: {
              type: 'number',
              required: false,
              description: 'Número da página (default: 1)',
            },
            pageSize: {
              type: 'number',
              required: false,
              description: 'Itens por página (default: 200, máx: 1000)',
            },
            order: {
              type: 'string',
              required: false,
              description: 'Ordenação. Ex: "productCode"',
            },
          },
        },
        response: `{
  "success": true,
  "data": {
    "data": [
      {
        "code": 12345,
        "name": "CAMISETA POLO M",
        "referenceCode": "REF001",
        "groupCode": "10",
        "groupDescription": "CAMISETAS",
        "barCodes": [
          { "code": "7891234567890", "quantity": 1, "isMainCode": true },
          { "code": "RFID0001ABC", "quantity": 1, "isMainCode": false }
        ]
      }
    ],
    "total": 300,
    "count": 200,
    "totalPages": 2,
    "hasNext": true,
    "page": 1,
    "pageSize": 200
  }
}`,
        example: `// Exemplo: buscar produtos com códigos de barras da empresa 1
fetch('${API_BASE_URL}/api/totvs/product-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filter: {
      classifications: [{ type: 17, codeList: ["10"] }]
    },
    option: {
      branchInfoCode: 1
    },
    expand: "barCodes",
    page: 1,
    pageSize: 200
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      },
    ],
  },
];

// ==========================================
// CAMPOS RETORNADOS PELO MAPEAMENTO pes_pessoa
// (syncPesPessoa.js → mapPersonToRow)
// ==========================================
const PES_PESSOA_FIELDS = [
  {
    campo: 'code',
    tipo: 'number',
    descricao: 'Código da pessoa (chave primária)',
  },
  {
    campo: 'cd_empresacad',
    tipo: 'number',
    descricao: 'Código empresa de cadastro',
  },
  { campo: 'tipo_pessoa', tipo: 'string', descricao: '"PF" ou "PJ"' },
  {
    campo: 'nm_pessoa',
    tipo: 'string',
    descricao: 'Nome completo / Razão social',
  },
  { campo: 'fantasy_name', tipo: 'string', descricao: 'Nome fantasia' },
  { campo: 'uf', tipo: 'string', descricao: 'Estado (UF)' },
  {
    campo: 'insert_date',
    tipo: 'string',
    descricao: 'Data de cadastro no TOTVS',
  },
  {
    campo: 'max_change_filter_date',
    tipo: 'string',
    descricao: 'Data da última alteração',
  },
  { campo: 'cpf', tipo: 'string', descricao: 'CPF (PF) ou CNPJ (PJ)' },
  { campo: 'rg', tipo: 'string', descricao: 'RG ou Inscrição Estadual' },
  {
    campo: 'dt_nascimento',
    tipo: 'string',
    descricao: 'Data nascimento (PF) ou fundação (PJ)',
  },
  { campo: 'gender', tipo: 'string', descricao: 'Gênero (PF)' },
  { campo: 'is_inactive', tipo: 'boolean', descricao: 'Se está inativo' },
  { campo: 'is_customer', tipo: 'boolean', descricao: 'Se é cliente' },
  { campo: 'is_supplier', tipo: 'boolean', descricao: 'Se é fornecedor' },
  {
    campo: 'is_representative',
    tipo: 'boolean',
    descricao: 'Se é representante',
  },
  { campo: 'customer_status', tipo: 'string', descricao: 'Status do cliente' },
  { campo: 'person_status', tipo: 'string', descricao: 'Status da pessoa' },
  {
    campo: 'telefone',
    tipo: 'string',
    descricao: 'Telefone principal extraído',
  },
  { campo: 'email', tipo: 'string', descricao: 'E-mail principal extraído' },
  { campo: 'phones', tipo: 'json[]', descricao: 'Array completo de telefones' },
  { campo: 'emails', tipo: 'json[]', descricao: 'Array completo de e-mails' },
  {
    campo: 'addresses',
    tipo: 'json[]',
    descricao: 'Array completo de endereços',
  },
  {
    campo: 'classifications',
    tipo: 'json[]',
    descricao: 'Classificações do cliente',
  },
  { campo: 'contacts', tipo: 'json[]', descricao: 'Contatos vinculados' },
  {
    campo: 'observations',
    tipo: 'json[]',
    descricao: 'Observações do cadastro',
  },
  {
    campo: 'updated_at',
    tipo: 'string',
    descricao: 'Data/hora da última sincronização',
  },
];

// ==========================================
// GERADOR DE PROMPT PARA CLAUDE CLI
// ==========================================

function generateRoutePrompt(route, category) {
  const parts = [];
  parts.push(`## Rota: ${route.name}`);
  parts.push(`- **Categoria:** ${category.name}`);
  parts.push(`- **Método:** ${route.method}`);
  parts.push(`- **Endpoint:** ${route.path}`);
  parts.push(`- **URL completa:** ${API_BASE_URL}${route.path}`);
  parts.push(`- **Descrição:** ${route.description}`);
  parts.push('');

  // Parâmetros
  if (route.params && Object.keys(route.params).length > 0) {
    parts.push('### Parâmetros');
    for (const [location, fields] of Object.entries(route.params)) {
      for (const [name, info] of Object.entries(fields)) {
        parts.push(
          `- \`${name}\` (${location}) — Tipo: ${info.type || '?'} | Obrigatório: ${info.required ? 'Sim' : 'Não'} | ${info.description || ''}`,
        );
      }
    }
    parts.push('');
  }

  // Resposta
  if (route.response) {
    parts.push('### Exemplo de Resposta');
    parts.push('```json');
    parts.push(route.response);
    parts.push('```');
    parts.push('');
  }

  // Exemplo de uso
  if (route.example) {
    parts.push('### Exemplo de Uso (JavaScript)');
    parts.push('```javascript');
    parts.push(route.example);
    parts.push('```');
    parts.push('');
  }

  return parts.join('\n');
}

function generateCategoryPrompt(category) {
  const parts = [];
  parts.push(`# Documentação API TOTVS — ${category.name}`);
  parts.push(`> ${category.description}`);
  parts.push(`> Base URL: ${API_BASE_URL}`);
  parts.push(`> Prefixo: /api/totvs/`);
  parts.push('');

  if (category.id === 'clientes') {
    parts.push('## Campos da tabela pes_pessoa (Supabase)');
    parts.push('| Campo | Tipo | Descrição |');
    parts.push('|-------|------|-----------|');
    for (const f of PES_PESSOA_FIELDS) {
      parts.push(`| ${f.campo} | ${f.tipo} | ${f.descricao} |`);
    }
    parts.push('');
  }

  for (const route of category.routes) {
    parts.push(generateRoutePrompt(route, category));
    parts.push('---');
    parts.push('');
  }

  return parts.join('\n');
}

// ==========================================
// COMPONENTES
// ==========================================

function CopyPromptButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200'
      }`}
      title="Copiar toda a documentação como prompt para o Claude CLI"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Prompt copiado!' : label || 'Copiar como Prompt'}
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
      title="Copiar código"
    >
      {copied ? (
        <Check size={14} className="text-green-400" />
      ) : (
        <Copy size={14} />
      )}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function CodeBlock({ code, label }) {
  return (
    <div className="mt-3">
      {label && (
        <p className="text-xs text-gray-400 mb-1 font-semibold uppercase">
          {label}
        </p>
      )}
      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <CopyButton text={code} />
        </div>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-green-100 text-green-800 border-green-300',
    POST: 'bg-blue-100 text-blue-800 border-blue-300',
    PUT: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    DELETE: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[method] || 'bg-gray-100 text-gray-800'}`}
    >
      {method}
    </span>
  );
}

function ParamTable({ params }) {
  if (!params || Object.keys(params).length === 0) return null;

  const allParams = [];
  for (const [location, fields] of Object.entries(params)) {
    for (const [name, info] of Object.entries(fields)) {
      allParams.push({ location, name, ...info });
    }
  }

  if (allParams.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 font-semibold mb-1 uppercase">
        Parâmetros
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2 border-b font-semibold">Nome</th>
              <th className="text-left p-2 border-b font-semibold">Local</th>
              <th className="text-left p-2 border-b font-semibold">Tipo</th>
              <th className="text-left p-2 border-b font-semibold">
                Obrigatório
              </th>
              <th className="text-left p-2 border-b font-semibold">
                Descrição
              </th>
            </tr>
          </thead>
          <tbody>
            {allParams.map((p, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 font-mono text-blue-700">{p.name}</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">
                    {p.location}
                  </span>
                </td>
                <td className="p-2 text-gray-600">{p.type}</td>
                <td className="p-2">
                  {p.required ? (
                    <span className="text-red-600 font-bold">Sim</span>
                  ) : (
                    <span className="text-gray-400">Não</span>
                  )}
                </td>
                <td className="p-2 text-gray-600">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RouteModal({ route, onClose }) {
  if (!route) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <MethodBadge method={route.method} />
            <h2 className="text-lg font-bold text-gray-800">{route.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Endpoint */}
          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
            <MethodBadge method={route.method} />
            <code className="text-sm font-mono text-gray-700 break-all">
              {route.path}
            </code>
            <CopyButton text={route.path} />
          </div>

          {/* Descrição */}
          <p className="text-sm text-gray-600">{route.description}</p>

          {/* URL Completa */}
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1 uppercase">
              URL Completa
            </p>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
              <code className="text-xs font-mono text-blue-700 break-all">
                {API_BASE_URL}
                {route.path}
              </code>
              <CopyButton text={`${API_BASE_URL}${route.path}`} />
            </div>
          </div>

          {/* Parâmetros */}
          <ParamTable params={route.params} />

          {/* Response */}
          {route.response && (
            <CodeBlock code={route.response} label="Exemplo de Resposta" />
          )}

          {/* Exemplo de Uso */}
          {route.example && (
            <CodeBlock
              code={route.example}
              label="Exemplo de Uso (JavaScript)"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryModal({ category, onClose }) {
  const [expandedRoute, setExpandedRoute] = useState(null);

  if (!category) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{category.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {category.name}
              </h2>
              <p className="text-sm text-gray-500">{category.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CopyPromptButton
              text={generateCategoryPrompt(category)}
              label="Copiar Tudo como Prompt"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            {category.routes.length} rota(s) disponível(is) — clique para
            expandir
          </p>

          {/* Tabela pes_pessoa se for a categoria de Clientes */}
          {category.id === 'clientes' && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                Campos armazenados na tabela{' '}
                <code className="bg-gray-100 px-1 rounded">pes_pessoa</code>{' '}
                (Supabase)
              </h3>
              <div className="overflow-x-auto max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-100">
                      <th className="text-left p-2 border-b font-semibold">
                        Campo
                      </th>
                      <th className="text-left p-2 border-b font-semibold">
                        Tipo
                      </th>
                      <th className="text-left p-2 border-b font-semibold">
                        Descrição
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PES_PESSOA_FIELDS.map((f, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-blue-50"
                      >
                        <td className="p-2 font-mono text-blue-700">
                          {f.campo}
                        </td>
                        <td className="p-2 text-gray-500">{f.tipo}</td>
                        <td className="p-2 text-gray-600">{f.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {category.routes.map((route, idx) => (
            <div key={idx} className="border rounded-lg overflow-hidden">
              {/* Route Header */}
              <button
                onClick={() =>
                  setExpandedRoute(expandedRoute === idx ? null : idx)
                }
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                {expandedRoute === idx ? (
                  <CaretDown
                    size={16}
                    className="text-gray-400 flex-shrink-0"
                  />
                ) : (
                  <CaretRight
                    size={16}
                    className="text-gray-400 flex-shrink-0"
                  />
                )}
                <MethodBadge method={route.method} />
                <span className="font-medium text-sm text-gray-800">
                  {route.name}
                </span>
                <code className="text-xs text-gray-400 font-mono ml-auto hidden sm:block">
                  {route.path}
                </code>
              </button>

              {/* Route Details */}
              {expandedRoute === idx && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
                  {/* Endpoint */}
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg mt-3 border">
                    <MethodBadge method={route.method} />
                    <code className="text-xs font-mono text-gray-700 break-all">
                      {route.path}
                    </code>
                    <CopyButton text={`${API_BASE_URL}${route.path}`} />
                  </div>

                  <p className="text-sm text-gray-600">{route.description}</p>

                  <ParamTable params={route.params} />

                  {route.response && (
                    <CodeBlock
                      code={route.response}
                      label="Exemplo de Resposta"
                    />
                  )}

                  {route.example && (
                    <CodeBlock code={route.example} label="Exemplo de Uso" />
                  )}

                  {/* Botão Copiar como Prompt */}
                  <div className="pt-3 border-t border-gray-200 mt-3">
                    <CopyPromptButton
                      text={generateRoutePrompt(route, category)}
                      label="Copiar esta rota como Prompt"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function ApiClaude() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      cat.routes.some(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.path.toLowerCase().includes(term),
      )
    );
  });

  const totalRoutes = ROUTE_CATEGORIES.reduce(
    (acc, c) => acc + c.routes.length,
    0,
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Code size={32} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-800">API Claude</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Documentação das rotas de consulta da API TOTVS Moda — {totalRoutes}{' '}
        rotas em {ROUTE_CATEGORIES.length} categorias
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlass
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Buscar rota, categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Info Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-indigo-700">
          <strong>Base URL:</strong>{' '}
          <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs">
            {API_BASE_URL}
          </code>
          <span className="ml-2">
            <CopyButton text={API_BASE_URL} />
          </span>
        </p>
        <p className="text-xs text-indigo-600 mt-1">
          Todas as rotas TOTVS estão sob o prefixo{' '}
          <code className="bg-indigo-100 px-1 rounded">/api/totvs/</code>. O
          token de autenticação é gerenciado automaticamente pelo backend.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat)}
            className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-indigo-300 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{cat.icon}</span>
              <h3 className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                {cat.name}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">
              {cat.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {cat.routes.length} rota(s)
              </span>
              <ArrowSquareOut
                size={16}
                className="text-gray-300 group-hover:text-indigo-400 transition-colors"
              />
            </div>
          </button>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <MagnifyingGlass size={48} className="mx-auto mb-3" />
          <p>Nenhuma rota encontrada para "{searchTerm}"</p>
        </div>
      )}

      {/* Category Modal */}
      {selectedCategory && (
        <CategoryModal
          category={selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
