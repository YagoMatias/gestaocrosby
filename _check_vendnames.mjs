import sb from './config/supabase.js';
const { data } = await sb.from('v_vendedores_integracao')
  .select('totvs_id, nome_vendedor, ativo, modulo')
  .in('totvs_id', [259, 65, 177, 25, 15, 161, 165, 241, 779, 288, 251, 131, 94, 1924, 7044, 21, 26, 69, 40, 20, 35, 50, 121, 30, 250, 121687]);
console.log('Mapping encontrado:');
for (const v of data || []) console.log(`  ${v.totvs_id}: ${v.nome_vendedor} (${v.modulo || '-'} ${v.ativo ? 'ATIVO' : 'INATIVO'})`);

// Pega TODOS pra ver o que tem
const { data: all, count } = await sb.from('v_vendedores_integracao')
  .select('totvs_id, nome_vendedor', { count: 'exact', head: false });
console.log('\nTotal vendedores:', all?.length);
