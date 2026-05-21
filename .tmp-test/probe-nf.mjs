import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://wnjapaczjcvhumfikwwe.supabase.co',
  process.env.SUPABASE_FISCAL_KEY || ''
);

// Probe: 1 NF de saída pra ver estrutura de items
const { data, error } = await sb
  .from('notas_fiscais')
  .select('person_code, person_name, issue_date, items')
  .eq('operation_type', 'Output')
  .limit(1);
if (error) { console.error(error); process.exit(1); }
console.log(JSON.stringify(data[0], null, 2).slice(0, 2000));
