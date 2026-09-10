// Finalizador v2 — usa só atuadores "reach-capable" (contas antigas/bot que
// conseguem adicionar), detecta estado por ground-truth (group list do bot),
// e respeita rate limit.
import 'dotenv/config';
import axios from 'axios';
const BASE = process.env.UAZAPI_BASE_URL, ADMIN = process.env.UAZAPI_ADMIN_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gnum = (j) => String(j || '').replace(/\D/g, '');

const BOT = { jason: { name: 'Jason Reserva', inst: 'jason reserva', phone: '558496900156' },
              crosby: { name: 'BOT Crosby', inst: 'crosbybot', phone: '558491684437' } };
// atuadores que comprovadamente conseguem adicionar (contas antigas) + o próprio Jason
const ALLOW = ['jason reserva', 'rafael', 'david', 'cleiton', 'michel', 'yago', 'renato', 'arthur', 'jhemyson', 'walter'];

const GRUPOS = [
  ['Varejo Interno', '120363389582583601', ['jason', 'crosby']],
  ['Comunidades', '120363426483671933', ['crosby']],
  ['Promoção', '120363408258737226', ['crosby']],
  ['Reports gerais', '120363427248494841', ['crosby']],
  ['Fat. Cidade Jardim', '120363421445191416', ['jason', 'crosby']],
  ['Fat. Guararapes', '120363422877008146', ['jason', 'crosby']],
];

const { data: all } = await axios.get(`${BASE}/instance/all`, { headers: { AdminToken: ADMIN } });
const list = (Array.isArray(all) ? all : all?.instances || []).map((i) => ({ name: String(i.name).toLowerCase(), token: i.token, status: String(i.status).toLowerCase() }));
const inst = (n) => list.find((i) => i.name === n && i.token);

async function groupSet(token) {
  try {
    const { data } = await axios.get(`${BASE}/group/list?force=true`, { headers: { token }, timeout: 40000 });
    const arr = Array.isArray(data) ? data : data?.groups || data?.data || [];
    return new Set(arr.map((g) => gnum(g.JID || g.id || g.jid)).filter(Boolean));
  } catch { return new Set(); }
}
async function addBot(actorTok, jid, botPhone) {
  try {
    const { data } = await axios.post(`${BASE}/group/updateParticipants`,
      { groupjid: `${jid}@g.us`, action: 'add', participants: [`${botPhone}@s.whatsapp.net`] },
      { headers: { token: actorTok, 'Content-Type': 'application/json' }, timeout: 25000 });
    const e = (data?.groupUpdated || [])[0]?.Error;
    return { ok: !e || e === 409, code: e || 200 };
  } catch (err) {
    const m = JSON.stringify(err.response?.data || err.message).match(/status (\d{3})/);
    return { ok: false, code: m ? Number(m[1]) : (err.response?.status || 0) };
  }
}

// membership sets dos bots (ground truth) + dos atuadores allow
const botSet = { jason: await groupSet(inst(BOT.jason.inst).token), crosby: await groupSet(inst(BOT.crosby.inst).token) };
const allowInsts = ALLOW.map(inst).filter((i) => i && i.status === 'connected');
const allowSets = new Map();
for (const a of allowInsts) allowSets.set(a.name, await groupSet(a.token));
console.log(`Atuadores reach-capable conectados: ${allowInsts.map((a) => a.name).join(', ')}\n`);

for (const [nome, jid, needBots] of GRUPOS) {
  const missing = needBots.filter((b) => !botSet[b].has(jid));
  if (!missing.length) { console.log(`✅ ${nome}: já completo`); continue; }
  // atuadores que são membros do grupo (Jason primeiro p/ adicionar Crosby)
  const actorsHere = allowInsts.filter((a) => allowSets.get(a.name)?.has(jid));
  console.log(`▼ ${nome} — falta [${missing.map((b) => BOT[b].name).join(', ')}] · atuadores no grupo: ${actorsHere.map((a) => a.name).join(', ') || 'NENHUM reach-capable'}`);
  if (!actorsHere.length) { console.log(`   🚫 sem atuador capaz neste grupo → precisa de admin humano\n`); continue; }

  for (const b of missing) {
    let done = false;
    for (const actor of actorsHere) {
      if (actor.name === BOT[b].inst) continue; // não usar o próprio bot como atuador dele
      for (let att = 1; att <= 3 && !done; att++) {
        const r = await addBot(actor.token, jid, BOT[b].phone);
        if (r.ok) { console.log(`   ✅ ${BOT[b].name} (via ${actor.name}${r.code === 409 ? ', já estava' : ''})`); done = true; break; }
        if (r.code === 429) { console.log(`   ⏳ 429 (${actor.name}) tent.${att} — aguardando 25s`); await sleep(25000); continue; }
        console.log(`   ↻ ${BOT[b].name} falhou via ${actor.name} (cód ${r.code}) — próximo`);
        break;
      }
      if (done) break;
    }
    if (!done) console.log(`   ❌ ${BOT[b].name}: nenhum atuador conseguiu`);
    await sleep(15000);
  }
  console.log('');
}
console.log('✔️ finish-v2 concluído.');
