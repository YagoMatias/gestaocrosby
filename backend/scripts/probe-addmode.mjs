// READ-ONLY: descobre quais grupos-alvo são ADICIONÁVEIS via uazapi.
// Adicionável = existe instância controlável que é membro E (é admin OU
// o grupo permite "all_member_add").
import 'dotenv/config';
import axios from 'axios';

const BASE = process.env.UAZAPI_BASE_URL;
const ADMIN = process.env.UAZAPI_ADMIN_TOKEN;

const BOTS = { '558496900156': 'Jason Reserva', '558491684437': 'BOT Crosby' };

// Só os grupos que FALTAM bots (segundo a última sondagem ao vivo)
const ALVO = [
  ['Varejo Interno', '120363389582583601'], ['Comunidades', '120363426483671933'],
  ['Promoção', '120363408258737226'], ['Reports gerais', '120363427248494841'],
  ['Frete', '120363409827946090'], ['Fat. João Pessoa', '120363420685116079'],
  ['Fat. Nova Cruz', '120363421542603483'], ['Fat. Parnamirim', '120363420441031996'],
  ['Fat. Cidade Jardim', '120363421445191416'], ['Fat. Guararapes', '120363422877008146'],
  ['Fat. Ayrton Senna', '120363403591057763'], ['Fat. Imperatriz', '120363421280092077'],
  ['Fat. Patos', '120363402876602109'], ['Fat. Midway', '120363403491095589'],
  ['Fat. Teresina', '120363421615793772'], ['Fat. Recife', '120363420694826165'],
];

const digits = (s) => String(s || '').replace(/\D/g, '');

const { data: all } = await axios.get(`${BASE}/instance/all`, { headers: { AdminToken: ADMIN }, timeout: 20000 });
const rawList = Array.isArray(all) ? all : all?.instances || [];
const insts = rawList.map((i) => ({ name: i.name, token: i.token, status: i.status, phone: digits(i.owner || i.wid || i.jid) }));
const connected = insts.filter((i) => String(i.status).toLowerCase() === 'connected');
const phoneToInst = new Map(connected.filter((i) => i.phone).map((i) => [i.phone, i]));

async function infoAny(jid) {
  for (const inst of connected) {
    try {
      const { data } = await axios.post(`${BASE}/group/info`, { groupjid: `${jid}@g.us` },
        { headers: { token: inst.token, 'Content-Type': 'application/json' }, timeout: 15000 });
      if (data?.Participants) return data;
    } catch { /* próxima */ }
  }
  return null;
}

console.log('addMode legend: all_member_add = qualquer membro adiciona | admin_add = só admin\n');
const plan = [];
for (const [nome, jid] of ALVO) {
  const info = await infoAny(jid);
  if (!info) { console.log(`⁉️ ${nome}: invisível`); continue; }
  const addMode = info.MemberAddMode || info.memberAddMode || '?';
  const parts = info.Participants || [];
  const present = new Set();
  const memberInstances = [];   // {inst, isAdmin}
  for (const p of parts) {
    const ph = digits(p.PhoneNumber || p.LID);
    if (BOTS[ph]) present.add(ph);
    if (phoneToInst.has(ph)) memberInstances.push({ inst: phoneToInst.get(ph), isAdmin: !!(p.IsAdmin || p.IsSuperAdmin) });
  }
  const missing = Object.keys(BOTS).filter((b) => !present.has(b));
  // atuador: admin preferido; senão qualquer membro se all_member_add
  let actor = memberInstances.find((m) => m.isAdmin)?.inst;
  const openAdd = addMode === 'all_member_add';
  if (!actor && openAdd) actor = memberInstances[0]?.inst;
  const addable = Boolean(actor) && missing.length > 0;
  console.log(`${addable ? '🤖' : '🚫'} ${nome.padEnd(20)} addMode=${addMode.padEnd(15)} falta=[${missing.map((m)=>BOTS[m]).join(',')||'-'}] atuador=${actor?.name || '—'}`);
  if (addable) plan.push({ nome, jid, missing, actor: actor.name });
}

console.log(`\n➡️  ${plan.length} grupo(s) adicionável(is) via uazapi.`);
console.log(JSON.stringify(plan, null, 0));
