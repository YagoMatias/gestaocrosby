/**
 * Script para inserir solicitações de pagamento no Supabase
 * para as duplicatas de TEF e PIX da TOTVS.
 *
 * Uso: node scripts/solicitacoes_totvs_tef_pix.js
 */
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://dorztqiunewggydvkjnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.sk6z1v-MKAjiQK-IfIvPvxI-GdRyH_Biaj5a-8_Ksy8'
);

const STORAGE_BUCKET = 'solicitacoes-crosby';

// Mapeamento da coluna "Filial" da planilha → cd_empresa TOTVS
// O número antes do " - " na planilha já é o cd_empresa
function parseCdEmpresa(filialStr) {
  const match = String(filialStr).match(/^(\d+)\s*-/);
  return match ? parseInt(match[1]) : null;
}

// Mapeamento filial → centro de custo
const FILIAL_CENTRO_CUSTO = {
  95: 19,  // CROSBY SHOPPING MIDWAY
  65: 15,  // CROSBY CANGUARETAMA
  2: 2,    // CROSBY JOAO PESSOA
  5: 5,    // CROSBY NOVA CRUZ
  55: 16,  // CROSBY PARNAMIRIM
  97: 31,  // CROSBY SHOPPING TERESINA
  93: 32,  // CROSBY IMPERATRIZ
  94: 33,  // CROSBY SHOPPING PATOS
  92: 35,  // CROSBY CASCAVEL
};

// Converte "15/06/2026" → "2026-06-15T00:00:00"
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`;
}

// Dado vencimento "15/06/2026", retorna emissão "01/06/2026" → ISO
function emissaoFromVencimento(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;
  const [, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-01T00:00:00`;
}

async function uploadPdf(filePath, prefix) {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '') || 'pdf';
  const fileName = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) throw new Error(`Upload falhou (${prefix}): ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function main() {
  const xlsxPath = path.resolve(__dirname, '..', '..', 'Desktop', 'comprovantes_totvs.xlsx');
  const pdfPath = path.resolve(__dirname, '..', '..', 'Desktop', 'comprovantes totvs.pdf');

  if (!fs.existsSync(xlsxPath)) {
    console.error('Planilha não encontrada:', xlsxPath);
    process.exit(1);
  }
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF não encontrado:', pdfPath);
    process.exit(1);
  }

  // Upload do PDF como comprovante do gestor e de Fábio
  console.log('Fazendo upload do PDF...');
  const comprovanteGestorUrl = await uploadPdf(pdfPath, 'comprovantes-gestor');
  console.log('  Comprovante gestor:', comprovanteGestorUrl);
  const comprovanteFabioUrl = await uploadPdf(pdfPath, 'comprovantes-fabio');
  console.log('  Comprovante Fábio:', comprovanteFabioUrl);

  // Ler planilha
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`\nTotal de linhas na planilha: ${rows.length}\n`);

  let inseridos = 0;
  let erros = 0;

  for (const row of rows) {
    const filialStr = row['Filial'] || '';
    const cdEmpresa = parseCdEmpresa(filialStr);
    const cnpjBeneficiario = row['CNPJ do Beneficiário'] || row['CNPJ do Beneficiário'] || '';
    const valorPago = parseFloat(row['Valor Pago (R$)']) || 0;
    const dataVencimento = row['Data de Vencimento'] || '';
    const cnpjPagador = row['CPF/CNPJ do Pagador'] || '';
    const nomePagador = row['Nome do Pagador'] || '';
    const centroCusto = FILIAL_CENTRO_CUSTO[cdEmpresa] || null;

    if (!cdEmpresa) {
      console.error(`  ERRO: cd_empresa não encontrado para filial "${filialStr}". Pulando.`);
      erros++;
      continue;
    }

    const insertData = {
      cd_empresa: cdEmpresa,
      nm_empresa: filialStr.replace(/^\d+\s*-\s*/, '').trim(),
      solicitante: 'Yago Matias',
      solicitante_email: 'trafegocrosby@gmail.com',
      setor: 'Financeiro',
      tipo_solicitacao: 'pagamento',
      nivel_urgencia: 'normal',
      descricao: 'PAGAMENTO DOS TITULOS DE TEF E PIX TOTVS',
      observacao: `Pagador: ${nomePagador} | CNPJ Pagador: ${cnpjPagador}`,
      status: 'pendente',
      data_solicitacao: new Date().toISOString(),
      branch_cnpj: cnpjPagador.replace(/\D/g, ''),
      supplier_cpf_cnpj: cnpjBeneficiario.replace(/\D/g, ''),
      supplier_name: 'TOTVS S.A.',
      forma_pagamento: 'boleto',
      comprovante_url: null,
      link_exemplo: null,
      imagens_exemplo_urls: [],
      contatos_prestadores: [],
      comprovante_gestor_url: comprovanteGestorUrl,
      comprovante_fabio_url: comprovanteFabioUrl,
      chave_pix: null,
      codigo_barras: '0000000000000000000000000000000000',
      despesa_code: 6042,
      cost_center_code: centroCusto,
      rateio_percentual: 100,
      valor_total: valorPago,
      dt_vencimento: parseDate(dataVencimento),
      dt_emissao: emissaoFromVencimento(dataVencimento),
      marca_modelo: null,
      recomendacao_fornecedores: null,
    };

    const { error } = await supabase
      .from('solicitacoes_crosby')
      .insert([insertData]);

    if (error) {
      console.error(`  ERRO ao inserir linha ${row['Nº'] || row['Nº'] || '?'} (${filialStr}): ${error.message}`);
      erros++;
    } else {
      console.log(`  OK: Linha ${row['Nº'] || row['Nº'] || '?'} | ${filialStr} | R$ ${valorPago.toFixed(2)} | Venc: ${dataVencimento}`);
      inseridos++;
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`  Inseridos: ${inseridos}`);
  console.log(`  Erros: ${erros}`);
  console.log(`  Total: ${rows.length}`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
