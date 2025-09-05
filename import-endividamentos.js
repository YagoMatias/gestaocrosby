/* scripts/import-endividamentos.js */
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// use suas chaves (pode reaproveitar de src/lib/supabase.js)
// Para import em massa, prefira a service role key (script local, NÃO no frontend)
const supabaseUrl = 'https://dorztqiunewggydvkjnf.supabase.co';
const serviceRoleKey = 'COLOQUE_A_SERVICE_ROLE_KEY_AQUI';
const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'public' } });

// helpers
const cents = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const num = Number(String(v).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'));
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
};
const dec = (v) => (v === null ? null : v / 100);

// mapeia colunas do Excel -> campos do banco
function mapRowToDb(row, userId) {
  return {
    user_id: userId,
    instituicao: row['Instituição'] || null,
    razao_social_tomador: row['Razão Social  - Tomador'] || row['Razão Social - Tomador'] || null,
    cnpj_tomador: row['CNPJ Tomador'] || null,
    ag: row['AG'] || null,
    cc: row['CC'] || null,
    linha_credito: row['Linha de Crédito'] || null,
    numero_contrato: row['Número do contrato'] || null,
    data_contratacao: row['Data da Contratação'] ? excelDate(row['Data da Contratação']) : null,
    vencimento_final: row['Vencimento Final da Operação'] ? excelDate(row['Vencimento Final da Operação']) : null,

    limite_aprovado: dec(cents(row['Limites Aprovados/ Valor do Contrato'])),
    saldo_devedor_sem_juros: dec(cents(row['Saldo devedor nominal s/ juros'])),
    saldo_devedor_com_juros: dec(cents(row['Saldo devedor total c/ juros'])),
    valor_mensal_pmt: dec(cents(row['Valor Mensal PMT'])),

    quantidade_pmt: row['Quantidade PMT'] != null ? Number(String(row['Quantidade PMT']).replace(/\D/g, '') || 0) : null,
    pmt_pagas: row['Quantas já pagamos PMT paga'] != null ? Number(String(row['Quantas já pagamos PMT paga']).replace(/\D/g, '') || 0) : null,
    diferenca_pmt_vencer: dec(cents(row['Diferença PMT a vencer'])),

    data_inicial_pagamento: row['Data inicial de pagamento'] ? excelDate(row['Data inicial de pagamento']) : null,
    taxa_juros_mes: row['Taxa juros % a.m'] != null ? Number(String(row['Taxa juros % a.m']).replace(',', '.')) : null,

    avalista: row['Avalista'] || null,
    garantias: row['Garantias'] || null,

    anexo_path: null
  };
}

// converte datas Excel (número serial ou string) para 'YYYY-MM-DD'
function excelDate(v) {
  if (typeof v === 'number') {
    const epoch = new Date(Math.round((v - 25569) * 86400 * 1000));
    return epoch.toISOString().slice(0, 10);
  }
  // tenta parse de string DD/MM/YYYY, YYYY-MM-DD, etc.
  const parts = String(v).trim().replace(/\\./g, '/').replace(/-/g, '/').split('/');
  if (parts.length === 3) {
    const [p1, p2, p3] = parts.map((x) => x.padStart(2, '0'));
    // heurística DD/MM/YYYY
    const yyyy = p3.length === 4 ? p3 : (p1.length === 4 ? p1 : p3);
    const mm = p2.length === 2 ? p2 : '01';
    const dd = p1.length === 2 ? p1 : '01';
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

async function main() {
  const file = path.resolve(process.cwd(), 'endividamentos.xlsx'); // arquivo na raiz do projeto
  if (!fs.existsSync(file)) {
    console.error('Arquivo endividamentos.xlsx não encontrado na raiz do projeto.');
    process.exit(1);
  }

  const { data: { user } } = await supabase.auth.getUser();
  // Como estamos usando service role, não há usuário autenticado; peça um owner fixo ou adicione uma coluna de owner se necessário.
  // Se a tabela usa RLS por user_id (recomendado), defina um userId alvo:
  const userId = process.env.IMPORT_USER_ID || null;
  if (!userId) {
    console.error('Defina IMPORT_USER_ID com o UUID do usuário dono dos registros (auth.users.id).');
    process.exit(1);
  }

  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(ws, { defval: null });

  const payload = json.map((r) => mapRowToDb(r, userId));

  // insere em lotes para evitar limite de payload
  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from('endividamentos').insert(chunk);
    if (error) {
      console.error('Erro ao inserir chunk:', error.message || error);
      process.exit(1);
    }
    console.log(`Inseridos ${Math.min(i + chunkSize, payload.length)} de ${payload.length}`);
  }

  console.log('Importação concluída com sucesso.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});