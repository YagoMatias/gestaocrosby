// Sondagem READ-ONLY dos grupos do painel "Dryland Módulos" via uazapi.
// v2 — corrige detecção de admin (WhatsApp usa LID; usar PhoneNumber/IsAdmin).
//
// NÃO adiciona ninguém, NÃO envia nada. Só lê /instance/all e /group/info.
import 'dotenv/config';
import axios from 'axios';

const BASE = process.env.UAZAPI_BASE_URL;
const ADMIN = process.env.UAZAPI_ADMIN_TOKEN;
if (!BASE || !ADMIN) { console.error('❌ env uazapi ausente'); process.exit(1); }

const BOTS = {
  '558496900156': 'Jason Reserva',
  '558491684437': 'BOT Crosby',
};

const GRUPOS = [
  ['Varejo Interno', '120363389582583601'], ['Gerente Varejo', '120363426457861965'],
  ['Patrimônio', '120363411300392673'], ['Dryland Suply', '120363408756095092'],
  ['Fiscal', '120363427456375592'], ['Marketing', '120363409027987260'],
  ['Comunidades', '120363426483671933'], ['Loja Virtual', '120363429152868015'],
  ['Promoção', '120363408258737226'], ['Expedição', '120363427459578921'],
  ['DP · RH', '120363428105474370'], ['Atendimento Médico', '120363410449485351'],
  ['Reports gerais', '120363427248494841'], ['Fotos (Consulta)', '120363429733887224'],
  ['Frete', '120363409827946090'], ['Fat. João Pessoa', '120363420685116079'],
  ['Fat. Nova Cruz', '120363421542603483'], ['Fat. Parnamirim', '120363420441031996'],
  ['Fat. Canguaretama', '120363404837531006'], ['Fat. Cidade Jardim', '120363421445191416'],
  ['Fat. Guararapes', '120363422877008146'], ['Fat. Ayrton Senna', '120363403591057763'],
  ['Fat. Imperatriz', '120363421280092077'], ['Fat. Patos', '120363402876602109'],
  ['Fat. Midway', '120363403491095589'], ['Fat. Teresina', '120363421615793772'],
  ['Fat. Recife', '120363420694826165'],
];

const digits = (s) => String(s || '').replace(/\D/g, '');

const { data: all } = await axios.get(`${BASE}/instance/all`, { headers: { AdminToken: ADMIN }, timeout: 20000 });
const rawList = Array.isArray(all) ? all : all?.instances || [];
const insts = rawList.map((i) => ({
  name: i.name, token: i.token, status: i.status,
  phone: digits(i.owner || i.wid || i.jid),
}));
const connected = insts.filter((i) => String(i.status).toLowerCase() === 'connected');
// telefone → instância controlável (conectada)
const phoneToInst = new Map(connected.filter((i) => i.phone).map((i) => [i.phone, i.name]));

console.log(`Instâncias: ${insts.length} total · ${connected.length} conectadas\n`);

async function groupInfo(token, jid) {
  const { data } = await axios.post(`${BASE}/group/info`, { groupjid: `${jid}@g.us` },
    { headers: { token, 'Content-Type': 'application/json' }, timeout: 20000 });
  return data;
}

// tenta obter o info do grupo usando qualquer instância conectada até funcionar
async function infoAny(jid) {
  for (const inst of connected) {
    try {
      const info = await groupInfo(inst.token, jid);
      if (info && info.Participants) return { info, via: inst };
    } catch { /* essa instância não vê o grupo → tenta outra */ }
  }
  return null;
}

const rows = [];
for (const [nome, jid] of GRUPOS) {
  const r = await infoAny(jid);
  if (!r) { rows.push({ nome, jid, err: 'nenhuma instância vê o grupo' }); continue; }
  const parts = r.info.Participants || [];
  const present = new Set();       // bots presentes
  const adminInstances = [];       // instâncias controláveis que são admin
  let humanAdmins = 0;
  for (const p of parts) {
    const ph = digits(p.PhoneNumber || p.LID);
    const isAdmin = p.IsAdmin || p.IsSuperAdmin;
    if (BOTS[ph]) present.add(ph);
    if (isAdmin) {
      if (phoneToInst.has(ph)) adminInstances.push(phoneToInst.get(ph));
      else humanAdmins++;
    }
  }
  rows.push({
    nome, jid,
    missing: Object.keys(BOTS).filter((b) => !present.has(b)).map((b) => BOTS[b]),
    adminInstances, humanAdmins, count: parts.length,
  });
}

console.log('═'.repeat(74));
console.log('📋 SITUAÇÃO POR GRUPO');
console.log('═'.repeat(74));
let auto = 0, manual = 0;
for (const r of rows) {
  if (r.err) { console.log(`\n⁉️ ${r.nome} — ${r.err}`); continue; }
  const faltam = r.missing.length ? `FALTA: ${r.missing.join(' + ')}` : 'completo';
  console.log(`\n${r.missing.length ? '⚠️ ' : '✅'} ${r.nome}  (${r.count} membros) — ${faltam}`);
  if (!r.missing.length) continue;
  if (r.adminInstances.length) {
    auto++;
    console.log(`   🤖 AUTOMATIZÁVEL → instância admin disponível: ${[...new Set(r.adminInstances)].join(', ')}`);
  } else {
    manual++;
    console.log(`   🙋 MANUAL → nenhum bot/instância é admin (só ${r.humanAdmins} admin humano). Precisa de admin humano.`);
  }
}
console.log(`\n${'═'.repeat(74)}`);
console.log(`Resumo: ${auto} grupo(s) automatizável(is) via uazapi · ${manual} exigem admin humano.`);
console.log('✔️ Nada foi alterado.');
