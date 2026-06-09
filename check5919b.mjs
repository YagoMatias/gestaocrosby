import axios from 'axios';
// Sem 5919
const r1 = await axios.post('http://localhost:4100/api/totvs/sale-panel/ranking-faturamento', {
  datemin: '2026-05-01', datemax: '2026-05-31', branchs: [95]
}, { timeout: 60000 });
const midway1 = r1.data.data.dataRow.find(r => r.branch_code === '95' || r.branch_code === 95);
console.log('Com SPECIAL_OPERATIONS atual (com 5919) — Midway:', midway1?.invoice_value, '| qty:', midway1?.invoice_qty);

// Forçando lista SEM 5919
const opsSem5919 = [1, 2, 55, 510, 511, 1511, 521, 1521, 522, 960, 9001, 9009, 9027, 9017, 9400, 9401, 9402, 9403, 9404, 9005, 545, 546, 555, 548, 1210, 9405, 1205, 1101, 9065, 9064, 9063, 9062, 9061, 9420, 9026, 9067];
const r2 = await axios.post('http://localhost:4100/api/totvs/sale-panel/ranking-faturamento', {
  datemin: '2026-05-01', datemax: '2026-05-31', branchs: [95], operations: opsSem5919
}, { timeout: 60000 });
const midway2 = r2.data.data.dataRow.find(r => r.branch_code === '95' || r.branch_code === 95);
console.log('Forçando ops SEM 5919 — Midway:', midway2?.invoice_value, '| qty:', midway2?.invoice_qty);

// Forçando lista COM 5919
const opsCom5919 = [...opsSem5919, 5919];
const r3 = await axios.post('http://localhost:4100/api/totvs/sale-panel/ranking-faturamento', {
  datemin: '2026-05-01', datemax: '2026-05-31', branchs: [95], operations: opsCom5919
}, { timeout: 60000 });
const midway3 = r3.data.data.dataRow.find(r => r.branch_code === '95' || r.branch_code === 95);
console.log('Forçando ops COM 5919 — Midway:', midway3?.invoke_value || midway3?.invoice_value, '| qty:', midway3?.invoice_qty);
