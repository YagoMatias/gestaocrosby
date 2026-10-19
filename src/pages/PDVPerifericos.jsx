import React, { useCallback, useEffect, useState } from 'react';
import {
  Printer,
  Barcode,
  Broadcast,
  CreditCard,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  DesktopTower,
} from '@phosphor-icons/react';

// Configurações dos aparelhos do caixa — só funciona dentro do app de desktop
// (PDV Crosby em Electron), que expõe window.pdv (ver pdv-electron/preload.js).
// No site, a página só explica isso. A configuração fica salva na máquina
// (pdv-config.json do app), não no servidor: cada caixa tem a sua.

const CFG_PADRAO = {
  impressora: '',
  rfid: { host: '192.168.99.202', porta: 8888, modelo: 'Chainway UR4', portaSerial: '' },
  tef: { provedor: 'Stone', serie: '' },
};

const Card = ({ icon: Icon, titulo, subtitulo, children }) => (
  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#000638]/5 text-[#000638] grid place-items-center">
        <Icon size={22} weight="duotone" />
      </div>
      <div>
        <h2 className="font-barlow font-bold text-[#000638] text-lg leading-tight">{titulo}</h2>
        {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Status = ({ ok, texto }) =>
  texto ? (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
      }`}
    >
      {ok ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <WarningCircle size={18} className="mt-0.5 shrink-0" />}
      <span className="whitespace-pre-line">{texto}</span>
    </div>
  ) : null;

const Label = ({ children }) => (
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">{children}</label>
);
const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400';
const btnCls =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50';
const btnPrim = `${btnCls} bg-[#000638] text-white hover:bg-[#0a1150]`;
const btnSec = `${btnCls} border border-gray-300 text-gray-700 hover:bg-gray-50`;

export default function PDVPerifericos() {
  const pdv = typeof window !== 'undefined' ? window.pdv : null;
  const [cfg, setCfg] = useState(CFG_PADRAO);
  const [impressoras, setImpressoras] = useState([]);
  const [st, setSt] = useState({}); // status por seção: { imp, bat, portal, tef }
  const [busy, setBusy] = useState({});

  const setStatus = (k, ok, texto) => setSt((s) => ({ ...s, [k]: { ok, texto } }));
  const setBusyK = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const salvar = useCallback(
    async (novo) => {
      setCfg(novo);
      if (pdv) await pdv.salvarConfig(novo);
    },
    [pdv],
  );

  const carregarImpressoras = useCallback(async () => {
    if (!pdv) return;
    setBusyK('imp', true);
    const lista = await pdv.listarImpressoras();
    setImpressoras(lista);
    setBusyK('imp', false);
    setStatus('imp', lista.length > 0, lista.length ? `${lista.length} impressora(s) detectada(s) no Windows` : 'Nenhuma impressora encontrada');
  }, [pdv]);

  useEffect(() => {
    if (!pdv) return;
    (async () => {
      const salvo = await pdv.lerConfig();
      if (salvo)
        setCfg({
          ...CFG_PADRAO,
          ...salvo,
          rfid: { ...CFG_PADRAO.rfid, ...(salvo.rfid || {}) },
          tef: { ...CFG_PADRAO.tef, ...(salvo.tef || {}) },
        });
      carregarImpressoras();
    })();
  }, [pdv, carregarImpressoras]);

  if (!pdv) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white rounded-2xl shadow-md p-8 text-center">
        <DesktopTower size={48} className="mx-auto text-[#000638] mb-3" weight="duotone" />
        <h1 className="font-barlow font-bold text-2xl text-[#000638] mb-2">Configurações dos Aparelhos</h1>
        <p className="text-gray-600">
          Esta página configura a impressora, os leitores RFID e o TEF <b>do computador do caixa</b>, e por
          isso só funciona dentro do aplicativo <b>PDV Crosby</b> instalado na máquina — não pelo navegador.
        </p>
      </div>
    );
  }

  // ---- impressora ----
  const testarImpressao = async () => {
    setBusyK('impTeste', true);
    const html = `<html><body style="font-family:monospace;font-size:12px;white-space:pre">
        CROSBY — TESTE DE IMPRESSÃO
--------------------------------
Impressora: ${cfg.impressora || '(padrão)'}
Data: ${new Date().toLocaleString('pt-BR')}
--------------------------------
Se você leu isto, está tudo certo.
</body></html>`;
    const r = await pdv.imprimirCupom({ impressora: cfg.impressora, html });
    setBusyK('impTeste', false);
    setStatus('imp', r.ok, r.ok ? 'Cupom de teste enviado à impressora' : `Falha ao imprimir: ${r.motivo || 'cancelado'}`);
  };

  // ---- RFID .bat (leitor de mesa, USB-serial) ----
  const detectarLeitor = async () => {
    if (!('serial' in navigator)) {
      setStatus('bat', false, 'Web Serial indisponível neste ambiente');
      return;
    }
    setBusyK('bat', true);
    try {
      // No app, quem escolhe a porta é o processo principal (porta salva →
      // chip CP210x do leitor → primeira porta). Aqui só confirmamos.
      const port = await navigator.serial.requestPort();
      const info = port.getInfo?.() || {};
      await port.open({ baudRate: 57600 });
      await port.close();
      const salvo = await pdv.lerConfig();
      const nome = salvo?.rfid?.portaSerial || '';
      setCfg((c) => ({ ...c, rfid: { ...c.rfid, portaSerial: nome } }));
      const vid = info.usbVendorId ? info.usbVendorId.toString(16).padStart(4, '0').toUpperCase() : '—';
      const pid = info.usbProductId ? info.usbProductId.toString(16).padStart(4, '0').toUpperCase() : '—';
      setStatus('bat', true, `Leitor encontrado${nome ? ` em ${nome}` : ''} (VID ${vid} / PID ${pid}). Porta aberta e fechada com sucesso a 57600 bps.`);
    } catch (e) {
      setStatus('bat', false, `Nenhum leitor respondeu: ${e?.message || 'porta não encontrada'}.\nConfira o cabo USB e o driver CP210x.`);
    } finally {
      setBusyK('bat', false);
    }
  };

  // ---- RFID portal (rede) ----
  const testarPortal = async () => {
    setBusyK('portal', true);
    const r = await pdv.rfidConectar(cfg.rfid);
    setBusyK('portal', false);
    setStatus('portal', r.ok, r.ok ? `${r.mensagem}\nLeituras: ${(r.leituras || []).join(', ') || '—'}` : r.mensagem);
    if (r.ok) salvar(cfg);
  };

  // ---- TEF ----
  const testarTef = async () => {
    setBusyK('tef', true);
    const r = await pdv.tefConectar(cfg.tef);
    setBusyK('tef', false);
    setStatus('tef', r.ok, r.mensagem);
    if (r.ok) salvar(cfg);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="mb-5">
        <h1 className="font-barlow font-bold text-3xl text-[#000638]">Configurações dos Aparelhos</h1>
        <p className="text-gray-500 text-sm">
          Impressora, leitores RFID e TEF deste caixa. Fica salvo nesta máquina — cada computador tem a sua configuração.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card icon={Printer} titulo="Impressora" subtitulo="Cupom NFC-e e comprovantes">
          <Label>Impressora de cupom (detectadas no Windows)</Label>
          <select
            className={inputCls}
            value={cfg.impressora}
            onChange={(e) => salvar({ ...cfg, impressora: e.target.value })}
          >
            <option value="">— impressora padrão do Windows —</option>
            {impressoras.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.nome}
                {p.padrao ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2 flex-wrap">
            <button className={btnSec} onClick={carregarImpressoras} disabled={busy.imp}>
              <ArrowsClockwise size={16} /> Detectar
            </button>
            <button className={btnPrim} onClick={testarImpressao} disabled={busy.impTeste}>
              <Printer size={16} /> Imprimir cupom de teste
            </button>
          </div>
          <Status {...(st.imp || {})} />
        </Card>

        <Card icon={Barcode} titulo="RFID .bat (leitor de mesa)" subtitulo="USB-serial, chip CP210x, 57600 bps">
          <Label>Porta preferida (deixe vazio para detectar sozinho)</Label>
          <input
            className={inputCls}
            placeholder="ex.: COM10"
            value={cfg.rfid.portaSerial || ''}
            onChange={(e) => setCfg({ ...cfg, rfid: { ...cfg.rfid, portaSerial: e.target.value.trim().toUpperCase() } })}
            onBlur={() => salvar(cfg)}
          />
          <p className="text-xs text-gray-500">
            O botão <b>Conectar Leitor RFID</b> do PDV usa esta porta. Sem porta salva, o app escolhe a do chip do leitor automaticamente.
          </p>
          <div>
            <button className={btnPrim} onClick={detectarLeitor} disabled={busy.bat}>
              <Barcode size={16} /> Detectar leitor agora
            </button>
          </div>
          <Status {...(st.bat || {})} />
        </Card>

        <Card icon={Broadcast} titulo="RFID Portal (rede)" subtitulo="Chainway UR4 — leitura em lote na entrada">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <Label>Modelo</Label>
              <input className={inputCls} value={cfg.rfid.modelo} onChange={(e) => setCfg({ ...cfg, rfid: { ...cfg.rfid, modelo: e.target.value } })} />
            </div>
            <div className="col-span-2">
              <Label>Host / IP</Label>
              <input className={inputCls} value={cfg.rfid.host} onChange={(e) => setCfg({ ...cfg, rfid: { ...cfg.rfid, host: e.target.value.trim() } })} />
            </div>
            <div>
              <Label>Porta</Label>
              <input className={inputCls} type="number" value={cfg.rfid.porta} onChange={(e) => setCfg({ ...cfg, rfid: { ...cfg.rfid, porta: Number(e.target.value) } })} />
            </div>
          </div>
          <div>
            <button className={btnPrim} onClick={testarPortal} disabled={busy.portal}>
              <Broadcast size={16} /> Conectar e testar leitura
            </button>
          </div>
          <Status {...(st.portal || {})} />
          <p className="text-[11px] text-amber-600">Conexão com o portal ainda em modo demonstração no app.</p>
        </Card>

        <Card icon={CreditCard} titulo="TEF / Pinpad" subtitulo="Cartão no caixa, sem digitar valor na maquininha">
          <Label>Provedor</Label>
          <select className={inputCls} value={cfg.tef.provedor} onChange={(e) => setCfg({ ...cfg, tef: { ...cfg.tef, provedor: e.target.value } })}>
            <option>Stone</option>
            <option>SiTef (Software Express)</option>
            <option>Cielo</option>
          </select>
          <Label>Série do pinpad (opcional)</Label>
          <input className={inputCls} value={cfg.tef.serie || ''} onChange={(e) => setCfg({ ...cfg, tef: { ...cfg.tef, serie: e.target.value.trim() } })} />
          <div>
            <button className={btnPrim} onClick={testarTef} disabled={busy.tef}>
              <CreditCard size={16} /> Conectar pinpad
            </button>
          </div>
          <Status {...(st.tef || {})} />
          <p className="text-[11px] text-amber-600">Integração TEF ainda em modo demonstração — depende do SDK do provedor.</p>
        </Card>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        App PDV Crosby · Electron {pdv.versaoElectron} · {pdv.plataforma}
      </p>
    </div>
  );
}
