#!/usr/bin/env node

/**
 * Script de teste rápido para o Query Builder API
 * Execute: node test-querybuilder.js
 */

const API_BASE = 'http://localhost:4000/api/querybuilder';

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function testEndpoint(name, url, options = {}) {
  try {
    log(`🧪 Testando: ${name}`, 'cyan');
    log(`   URL: ${url}`, 'blue');

    const startTime = Date.now();
    const response = await fetch(url, options);
    const data = await response.json();
    const duration = Date.now() - startTime;

    if (response.ok) {
      log(`✅ Sucesso (${duration}ms)`, 'green');
      return { success: true, data, duration };
    } else {
      log(`❌ Erro: ${response.status}`, 'red');
      console.log('   Resposta:', data);
      return { success: false, data, duration };
    }
  } catch (error) {
    log(`❌ Erro de Conexão: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n🚀 Iniciando Testes do Query Builder API\n', 'bright');

  // Teste 1: Listar Tabelas
  logSection('1️⃣  Listar Tabelas Disponíveis');
  const tablesResult = await testEndpoint('GET /tables', `${API_BASE}/tables`);

  if (tablesResult.success && tablesResult.data.data.tables.length > 0) {
    const tables = tablesResult.data.data.tables;
    log(`   📊 Total de tabelas: ${tables.length}`, 'yellow');
    log(`   📋 Primeiras 5 tabelas:`, 'yellow');
    tables.slice(0, 5).forEach((table) => {
      console.log(`      - ${table.fullName}`);
    });

    // Teste 2: Listar Colunas da primeira tabela
    if (tables.length > 0) {
      const firstTable = tables[0].name;

      logSection(`2️⃣  Listar Colunas da Tabela: ${firstTable}`);
      const columnsResult = await testEndpoint(
        `GET /tables/${firstTable}/columns`,
        `${API_BASE}/tables/${firstTable}/columns`,
      );

      if (columnsResult.success) {
        const columns = columnsResult.data.data.columns;
        log(`   📋 Total de colunas: ${columns.length}`, 'yellow');
        log(`   📝 Primeiras 5 colunas:`, 'yellow');
        columns.slice(0, 5).forEach((col) => {
          const pk = col.isPrimaryKey ? ' [PK]' : '';
          console.log(`      - ${col.name} (${col.type})${pk}`);
        });

        // Teste 3: Query Simples
        logSection('3️⃣  Executar Query Simples (SELECT * LIMIT 5)');
        const simpleQueryResult = await testEndpoint(
          'POST /execute - Query Simples',
          `${API_BASE}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: ['*'],
              from: firstTable,
              limit: 5,
            }),
          },
        );

        if (simpleQueryResult.success) {
          const queryData = simpleQueryResult.data.data;
          log(`   📊 Registros retornados: ${queryData.totalRows}`, 'yellow');
          log(`   ⏱️  Tempo de execução: ${queryData.executionTime}`, 'yellow');
          log(
            `   📝 Colunas: ${queryData.columns.map((c) => c.name).join(', ')}`,
            'yellow',
          );

          if (queryData.rows.length > 0) {
            log(`   📄 Primeiro registro:`, 'yellow');
            console.log('      ', JSON.stringify(queryData.rows[0], null, 2));
          }
        }

        // Teste 4: Preview
        logSection('4️⃣  Testar Preview (10 registros)');
        const previewResult = await testEndpoint(
          'POST /preview',
          `${API_BASE}/preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: ['*'],
              from: firstTable,
            }),
          },
        );

        if (previewResult.success) {
          log(
            `   📊 Preview retornou: ${previewResult.data.data.totalRows} registros`,
            'yellow',
          );
        }

        // Teste 5: Query com WHERE (se houver coluna id)
        const hasIdColumn = columns.some(
          (col) => col.name.toLowerCase() === 'id',
        );
        if (hasIdColumn) {
          logSection('5️⃣  Query com WHERE (id >= 1)');
          const whereQueryResult = await testEndpoint(
            'POST /execute - Com WHERE',
            `${API_BASE}/execute`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                select: ['*'],
                from: firstTable,
                where: [
                  {
                    column: 'id',
                    operator: '>=',
                    value: 1,
                  },
                ],
                limit: 5,
              }),
            },
          );

          if (whereQueryResult.success) {
            log(
              `   📊 Registros com WHERE: ${whereQueryResult.data.data.totalRows}`,
              'yellow',
            );
          }
        }

        // Teste 6: Query com ORDER BY
        logSection('6️⃣  Query com ORDER BY');
        const firstColumn = columns[0].name;
        const orderQueryResult = await testEndpoint(
          'POST /execute - Com ORDER BY',
          `${API_BASE}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: ['*'],
              from: firstTable,
              orderBy: [
                {
                  column: firstColumn,
                  direction: 'DESC',
                },
              ],
              limit: 5,
            }),
          },
        );

        if (orderQueryResult.success) {
          log(
            `   📊 Registros ordenados: ${orderQueryResult.data.data.totalRows}`,
            'yellow',
          );
        }

        // Teste 7: Query com Agregação (COUNT)
        logSection('7️⃣  Query com Agregação (COUNT)');
        const countQueryResult = await testEndpoint(
          'POST /execute - COUNT',
          `${API_BASE}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: [
                {
                  column: '*',
                  aggregation: 'COUNT',
                  alias: 'total',
                },
              ],
              from: firstTable,
            }),
          },
        );

        if (
          countQueryResult.success &&
          countQueryResult.data.data.rows.length > 0
        ) {
          const total = countQueryResult.data.data.rows[0].total;
          log(`   📊 Total de registros na tabela: ${total}`, 'yellow');
        }
      }
    }
  }

  // Teste 8: Erro - Tabela Inexistente
  logSection('8️⃣  Teste de Erro - Tabela Inexistente');
  await testEndpoint(
    'POST /execute - Tabela Inexistente',
    `${API_BASE}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        select: ['*'],
        from: 'tabela_que_nao_existe_xyz123',
        limit: 5,
      }),
    },
  );

  // Teste 9: Erro - Parâmetros Inválidos
  logSection('9️⃣  Teste de Erro - Parâmetros Inválidos');
  await testEndpoint('POST /execute - Sem SELECT', `${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'alguma_tabela',
    }),
  });

  // Resumo
  logSection('📊 Resumo dos Testes');
  log('✅ Testes concluídos!', 'green');
  log('📚 Consulte QUERYBUILDER_API.md para documentação completa', 'cyan');
  log('🧪 Consulte QUERYBUILDER_TESTS.md para mais exemplos', 'cyan');
  console.log('');
}

// Executar testes
runTests().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
