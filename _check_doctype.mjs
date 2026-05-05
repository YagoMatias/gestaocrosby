import { createClient } from './backend/node_modules/@supabase/supabase-js/dist/module/index.js';
import { loadDebugEnv } from './backend/debug/_debugEnv.mjs';
loadDebugEnv();
const sb = createClient('https://wnjapaczjcvhumfikwwe.supabase.co', process.env.SUPABASE_FISCAL_KEY);

// Verificar document_type_code de NF conhecida como credev (823962)
const { data: nf, error } = await sb.from('notas_fiscais')
  .select('transaction_code, operation_code, document_type_code, payment_condition_name, invoice_status')
  .eq('transaction_code', 823962);
console.log('NF 823962:', JSON.stringify(nf));

// Verificar valores distintos de document_type_code para operation_code 7236 (vendas normais)
const { data: dist } = await sb.from('notas_fiscais')
  .select('document_type_code')
  .eq('operation_code', 7236)
  .not('document_type_code', 'is', null)
  .limit(200);

const counts = {};
for (const r of dist || []) counts[r.document_type_code] = (counts[r.document_type_code] || 0) + 1;
console.log('document_type_code distribution (op 7236):', JSON.stringify(counts));
