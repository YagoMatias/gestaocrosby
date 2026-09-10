// GROUND TRUTH: pergunta a CADA bot (via sua própria instância) em quais
// dos grupos-alvo ele está. Sem depender de LID/phone de participante.
import 'dotenv/config';
import axios from 'axios';
const BASE = process.env.UAZAPI_BASE_URL, ADMIN = process.env.UAZAPI_ADMIN_TOKEN;

const BOTS = [
  ['Jason Reserva', 'jason reserva'],
  ['BOT Crosby', 'crosbybot'],
];
const GRUPOS = [
  ['Varejo Interno', '120363389582583601'], ['Comunidades', '120363426483671933'],
  ['Promoção', '120363408258737226'], ['Reports gerais', '120363427248494841'],
  ['Frete', '120363409827946090'], ['Fat. Cidade Jardim', '120363421445191416'],
  ['Fat. Guararapes', '120363422877008146'],
];

const { data: all } = await axios.get(`${BASE}/instance/all`, { headers: { AdminToken: ADMIN } });
const list = Array.isArray(all) ? all : all?.instances || [];
const findInst = (n) => list.find((i) => String(i.name).toLowerCase() === n);

async function groupsOf(token) {
  const { data } = await axios.get(`${BASE}/group/list?force=true`, { headers: { token }, timeout: 40000 });
  const arr = Array.isArray(data) ? data : data?.groups || data?.data || [];
  return new Set(arr.map((g) => String(g.JID || g.id || g.jid || '').replace(/\D/g, '')).filter(Boolean));
}

const memberSets = {};
for (const [label, inst] of BOTS) {
  const ins = findInst(inst);
  memberSets[label] = ins ? await groupsOf(ins.token) : new Set();
  console.log(`${label}: membro de ${memberSets[label].size} grupos`);
}

console.log('\n' + '═'.repeat(60));
let faltas = 0;
for (const [nome, jid] of GRUPOS) {
  const status = BOTS.map(([label]) => `${memberSets[label].has(jid) ? '✅' : '❌'} ${label}`);
  const complete = BOTS.every(([label]) => memberSets[label].has(jid));
  if (!complete) faltas++;
  console.log(`${complete ? '✅' : '⚠️ '} ${nome.padEnd(20)} ${status.join('   ')}`);
}
console.log('═'.repeat(60));
console.log(faltas === 0 ? '🎉 Todos os 7 grupos completos!' : `${faltas} grupo(s) ainda incompleto(s).`);
