// Página PÚBLICA: /devolucao — solicitação de devolução de mercadoria pelo
// cliente (link divulgado em Solicitações Crosby). Sem login.
//   1. CPF/CNPJ → validado no cadastro da Crosby
//   2. Vendedor (da empresa do cliente + matrizes)
//   3. Tipo: tradicional | peças com defeito
//   4. Quantidade de peças
//   5. Foto por peça (obrigatória no defeito; comprimida no navegador)
// Envia para POST /api/devolucoes/publico. Devolução por defeito abre chamado
// no Dryland para a Produção; a equipe acompanha em /devolucoes-mercadoria.
import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/constants';

const LOGO = '/logo-crosby.png';
const MAX_PECAS_COM_FOTO = 40;

function useResetBodyForLp() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.cssText, body: body.style.cssText, bodyClass: body.className };
    body.style.cssText +=
      ';display:block !important;align-items:flex-start !important;justify-content:flex-start !important;height:auto !important;min-height:100vh !important;background:#0a1a4f !important;overflow-x:hidden;';
    html.style.height = 'auto';
    return () => {
      body.style.cssText = prev.body;
      html.style.cssText = prev.html;
      body.className = prev.bodyClass;
    };
  }, []);
}

const CSS = `
.dv,.dv *{box-sizing:border-box}
.dv{--navy:#0a1a4f;--red:#d6122a;--ok:#0f9d58;--muted:#c7cee0;font-family:"Segoe UI",Arial,Helvetica,sans-serif;background:var(--navy);color:#fff;min-height:100vh;padding:24px 16px 48px}
.dv h1,.dv h2,.dv p{margin:0}
.dv-wrap{max-width:720px;margin:0 auto}
.dv-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.dv-head img{height:34px}
.dv-head h1{font-size:20px;font-weight:800;letter-spacing:.2px}
.dv-head p{font-size:13px;color:var(--muted)}
.dv-card{background:#fff;color:#1b2340;border-radius:16px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.dv-step{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7390;margin:14px 0 6px}
.dv-step:first-child{margin-top:0}
.dv label{display:block;font-size:12px;font-weight:700;color:#3a4260;margin:8px 0 4px}
.dv input[type=text],.dv input[type=tel],.dv input[type=number],.dv select,.dv textarea{width:100%;height:42px;border:1px solid #d6d6d6;border-radius:10px;padding:0 12px;font-size:15px;color:#1b2340;background:#fff;margin:0}
.dv textarea{height:auto;min-height:80px;padding:10px 12px;resize:vertical}
.dv input:focus,.dv select:focus,.dv textarea:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px rgba(10,26,79,.15)}
.dv .row{display:flex;gap:10px}
.dv .row>*{flex:1}
.dv-btn{height:46px;border:0;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.dv-btn.primary{background:var(--red);color:#fff}
.dv-btn.primary:hover{background:#b50f23}
.dv-btn.ghost{background:#eef1f8;color:var(--navy);height:40px;font-size:13px}
.dv-btn:disabled{opacity:.5;cursor:not-allowed}
.dv-cliente{display:flex;align-items:center;gap:10px;background:#eefbf3;border:1px solid #bfe9cf;border-radius:10px;padding:10px 12px;font-size:14px}
.dv-cliente b{color:#0b6b3a}
.dv-erro{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:8px}
.dv-info{background:#f3f6ff;border:1px solid #d6dcf5;color:#2a3566;border-radius:10px;padding:10px 12px;font-size:12.5px;margin-top:8px;line-height:1.45}
.dv-tipos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dv-tipo{border:2px solid #e2e5ef;border-radius:12px;padding:12px;cursor:pointer;background:#fafbff}
.dv-tipo.on{border-color:var(--navy);background:#eef1fb}
.dv-tipo b{display:block;font-size:14px;color:var(--navy)}
.dv-tipo span{font-size:12px;color:#5b6486}
.dv-fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:8px}
.dv-foto{border:1.5px dashed #c9cfe3;border-radius:12px;padding:8px;text-align:center;background:#fafbff;position:relative;min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.dv-foto.ok{border-style:solid;border-color:#9fd8b6;background:#f2fbf6}
.dv-foto img{width:100%;height:96px;object-fit:cover;border-radius:8px}
.dv-foto small{font-size:11px;color:#6b7390}
.dv-foto input{display:none}
.dv-foto .rm{position:absolute;top:6px;right:6px;background:#fff;border:1px solid #e2e5ef;border-radius:999px;width:22px;height:22px;font-size:12px;cursor:pointer;color:#9f1239}
.dv-ok{text-align:center;padding:10px 0}
.dv-ok .proto{font-size:34px;font-weight:900;color:var(--navy);letter-spacing:1px;margin:8px 0}
.dv-foot{margin-top:18px;text-align:center;font-size:12px;color:var(--muted)}
@media (max-width:560px){.dv .row{flex-direction:column}.dv-tipos{grid-template-columns:1fr}}
`;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const fmtDoc = (v) => {
  const d = soDigitos(v);
  if (d.length <= 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, (m, a, b, c, e) => [a, b, c].filter(Boolean).join('.') + (e ? `-${e}` : ''));
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (m, a, b, c, e, f) => `${a}.${b}.${c}/${e}` + (f ? `-${f}` : ''));
};

// Redimensiona/comprime no navegador: fotos de celular passam de 5 MB;
// 1280 px em JPEG 0,8 fica em ~200 KB sem perder o que a Produção precisa ver.
async function comprimirImagem(file, maxLado = 1280, qualidade = 0.8) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', qualidade);
}

export default function DevolucaoPublica() {
  useResetBodyForLp();
  const [doc, setDoc] = useState('');
  const [cliente, setCliente] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [erroCliente, setErroCliente] = useState('');
  const [vendedores, setVendedores] = useState([]);
  const [vendedor, setVendedor] = useState('');
  const [tipo, setTipo] = useState('tradicional');
  const [qtd, setQtd] = useState(1);
  const [telefone, setTelefone] = useState('');
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState({}); // peca → { base64, nome, tamanho }
  const [processando, setProcessando] = useState(null); // { feitas, total } no lote
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const docRef = useRef('');

  const buscarCliente = async () => {
    const d = soDigitos(doc);
    if (d.length !== 11 && d.length !== 14) {
      setErroCliente('Digite o CPF (11 dígitos) ou o CNPJ (14 dígitos).');
      return;
    }
    if (docRef.current === d && cliente) return;
    setBuscandoCliente(true);
    setErroCliente('');
    setCliente(null);
    setVendedores([]);
    setVendedor('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/devolucoes/publico/cliente?doc=${d}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Cliente não encontrado');
      setCliente(j.data);
      docRef.current = d;
      if (j.data.telefone && !telefone) setTelefone(j.data.telefone);
      const rv = await fetch(`${API_BASE_URL}/api/devolucoes/publico/vendedores?empresa=${j.data.empresa ?? ''}`);
      const jv = await rv.json();
      setVendedores(jv?.data?.items || []);
    } catch (e) {
      setErroCliente(e.message);
    } finally {
      setBuscandoCliente(false);
    }
  };

  const qtdNum = Math.max(1, Math.min(500, parseInt(qtd, 10) || 1));
  const slotsFoto = Math.min(qtdNum, MAX_PECAS_COM_FOTO);
  const fotosPreenchidas = Object.keys(fotos).filter((k) => Number(k) <= slotsFoto).length;

  const escolherFoto = async (peca, file) => {
    if (!file) return;
    try {
      const base64 = await comprimirImagem(file);
      setFotos((f) => ({ ...f, [peca]: { base64, nome: file.name, tamanho: Math.round((base64.length * 3) / 4) } }));
    } catch {
      setErro(`Não consegui ler a foto da peça ${peca}. Tente outra imagem.`);
    }
  };

  // Várias fotos de uma vez (galeria): cada arquivo vai para uma peça, na
  // ordem escolhida, começando pela primeira peça sem foto. Se vierem mais
  // fotos do que peças informadas, a quantidade sobe para caber.
  const escolherVariasFotos = async (lista) => {
    const arquivos = Array.from(lista || []).filter((f) => f && f.type.startsWith('image/'));
    if (!arquivos.length) return;
    setErro('');
    const ocupadas = new Set(Object.keys(fotos).map(Number));
    const necessarias = ocupadas.size + arquivos.length;
    let limite = Math.max(qtdNum, necessarias);
    if (limite > MAX_PECAS_COM_FOTO) {
      limite = MAX_PECAS_COM_FOTO;
      setErro(`Só cabem fotos de ${MAX_PECAS_COM_FOTO} peças; as demais foram ignoradas.`);
    }
    if (limite > qtdNum) setQtd(limite);
    const livres = [];
    for (let p = 1; p <= limite && livres.length < arquivos.length; p++) if (!ocupadas.has(p)) livres.push(p);
    setProcessando({ feitas: 0, total: Math.min(arquivos.length, livres.length) });
    const novas = {};
    for (let i = 0; i < livres.length; i++) {
      try {
        const base64 = await comprimirImagem(arquivos[i]);
        novas[livres[i]] = { base64, nome: arquivos[i].name, tamanho: Math.round((base64.length * 3) / 4) };
      } catch {
        /* pula a foto que não abriu */
      }
      setProcessando({ feitas: i + 1, total: livres.length });
    }
    setFotos((f) => ({ ...f, ...novas }));
    setProcessando(null);
  };

  const removerFoto = (peca) =>
    setFotos((f) => {
      const c = { ...f };
      delete c[peca];
      return c;
    });

  const podeEnviar =
    !!cliente &&
    !!vendedor &&
    qtdNum > 0 &&
    !enviando &&
    (tipo !== 'defeito' || fotosPreenchidas >= 1);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!podeEnviar) return;
    if (tipo === 'defeito' && fotosPreenchidas < slotsFoto) {
      const faltam = slotsFoto - fotosPreenchidas;
      if (!window.confirm(`Faltam fotos de ${faltam} peça(s). Enviar mesmo assim?`)) return;
    }
    setEnviando(true);
    try {
      const lista = Object.entries(fotos)
        .filter(([k]) => Number(k) <= slotsFoto)
        .map(([peca, f]) => ({ peca: Number(peca), base64: f.base64, nome: f.nome }));
      const vend = vendedores.find((v) => String(v.code) === String(vendedor));
      const r = await fetch(`${API_BASE_URL}/api/devolucoes/publico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpfCnpj: soDigitos(doc),
          vendedorCode: vendedor,
          vendedorNome: vend?.name || null,
          tipo,
          qtdPecas: qtdNum,
          telefone: soDigitos(telefone) || null,
          observacao: obs,
          fotos: lista,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Não foi possível registrar a devolução');
      setResultado(j.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setEnviando(false);
    }
  };

  const novo = () => {
    setResultado(null);
    setFotos({});
    setQtd(1);
    setObs('');
    setTipo('tradicional');
    setErro('');
  };

  return (
    <div className="dv">
      <style>{CSS}</style>
      <div className="dv-wrap">
        <div className="dv-head">
          <img src={LOGO} alt="Crosby" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <div>
            <h1>Devolução de mercadoria</h1>
            <p>Preencha os dados abaixo para registrar a devolução com a Crosby.</p>
          </div>
        </div>

        <div className="dv-card">
          {resultado ? (
            <div className="dv-ok">
              <p style={{ fontSize: 14, color: '#3a4260' }}>Solicitação registrada. Seu protocolo é</p>
              <div className="proto">{resultado.protocolo}</div>
              <p style={{ fontSize: 14, color: '#3a4260', lineHeight: 1.5 }}>
                {resultado.tipo === 'defeito'
                  ? 'As fotos foram enviadas para a nossa Produção avaliar. Assim que a avaliação terminar, a equipe Crosby entra em contato para combinar a devolução.'
                  : 'A equipe Crosby vai entrar em contato com você para combinar o envio das peças.'}
              </p>
              {resultado.avisoChamado && (
                <div className="dv-info">Registramos sua solicitação. Um detalhe interno ficou pendente e a equipe já foi avisada.</div>
              )}
              <div style={{ marginTop: 16 }}>
                <button type="button" className="dv-btn ghost" onClick={novo}>
                  Registrar outra devolução
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="dv-step">1 · Seu cadastro</div>
              <label htmlFor="doc">CPF ou CNPJ cadastrado na Crosby</label>
              <div className="row">
                <input
                  id="doc"
                  type="tel"
                  inputMode="numeric"
                  value={fmtDoc(doc)}
                  onChange={(e) => {
                    setDoc(soDigitos(e.target.value));
                    if (cliente) {
                      setCliente(null);
                      setVendedores([]);
                      setVendedor('');
                    }
                  }}
                  onBlur={buscarCliente}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  autoComplete="off"
                />
                <button type="button" className="dv-btn ghost" onClick={buscarCliente} disabled={buscandoCliente} style={{ flex: '0 0 130px' }}>
                  {buscandoCliente ? 'Buscando…' : 'Verificar'}
                </button>
              </div>
              {erroCliente && <div className="dv-erro">{erroCliente}</div>}
              {cliente && (
                <div className="dv-cliente" style={{ marginTop: 8 }}>
                  <span>✅</span>
                  <div>
                    <b>{cliente.fantasia || cliente.nome}</b>
                    <div style={{ fontSize: 12, color: '#3a4260' }}>
                      {cliente.nome} · código {cliente.code}
                      {cliente.empresaNome ? ` · ${cliente.empresaNome}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {cliente && (
                <>
                  <div className="dv-step">2 · Atendimento</div>
                  <div className="row">
                    <div>
                      <label htmlFor="vend">Vendedor</label>
                      <select id="vend" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                        <option value="">Selecione…</option>
                        {vendedores.map((v) => (
                          <option key={v.code} value={v.code}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tel">Telefone / WhatsApp</label>
                      <input id="tel" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="DDD + número" />
                    </div>
                  </div>

                  <div className="dv-step">3 · Devolução</div>
                  <label>Tipo de devolução</label>
                  <div className="dv-tipos">
                    <div className={`dv-tipo ${tipo === 'tradicional' ? 'on' : ''}`} onClick={() => setTipo('tradicional')} role="button" tabIndex={0}>
                      <b>Tradicional</b>
                      <span>Troca, sobra de coleção ou acerto comercial.</span>
                    </div>
                    <div className={`dv-tipo ${tipo === 'defeito' ? 'on' : ''}`} onClick={() => setTipo('defeito')} role="button" tabIndex={0}>
                      <b>Peças com defeito</b>
                      <span>Cada peça precisa de foto. A Produção avalia antes da devolução.</span>
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <div>
                      <label htmlFor="qtd">Quantidade de peças</label>
                      <input id="qtd" type="number" min="1" max="500" value={qtd} onChange={(e) => setQtd(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="obs">Observação (opcional)</label>
                      <input id="obs" type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: referência, motivo, nota fiscal" maxLength={2000} />
                    </div>
                  </div>

                  <div className="dv-step">
                    4 · Fotos das peças {tipo === 'defeito' ? '(uma por peça)' : '(opcional)'}
                  </div>
                  {qtdNum > MAX_PECAS_COM_FOTO && (
                    <div className="dv-info">
                      Você informou {qtdNum} peças. Envie fotos das {MAX_PECAS_COM_FOTO} primeiras; o restante a equipe confere no recebimento.
                    </div>
                  )}
                  <label className="dv-btn ghost" style={{ marginTop: 6, cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        escolherVariasFotos(e.target.files);
                        e.target.value = '';
                      }}
                      disabled={!!processando}
                    />
                    {processando
                      ? `Preparando foto ${processando.feitas} de ${processando.total}…`
                      : '🖼️ Selecionar várias fotos de uma vez'}
                  </label>
                  <p style={{ fontSize: 12, color: '#6b7390', marginTop: 4 }}>
                    Escolha todas as fotos da galeria: cada uma vira uma peça, na ordem. Ou toque em cada peça para fotografar na hora.
                  </p>
                  <div className="dv-fotos">
                    {Array.from({ length: slotsFoto }, (_, i) => i + 1).map((peca) => {
                      const f = fotos[peca];
                      return (
                        <label key={peca} className={`dv-foto ${f ? 'ok' : ''}`} title={f ? f.nome : `Foto da peça ${peca}`}>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => escolherFoto(peca, e.target.files?.[0])} />
                          {f ? (
                            <>
                              <img src={f.base64} alt={`Peça ${peca}`} />
                              <small>Peça {peca} · {Math.round(f.tamanho / 1024)} KB</small>
                              <button type="button" className="rm" onClick={(e) => { e.preventDefault(); removerFoto(peca); }} aria-label="Remover foto">
                                ×
                              </button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 26 }}>📷</span>
                              <b style={{ fontSize: 13, color: '#0a1a4f' }}>Peça {peca}</b>
                              <small>Toque para fotografar</small>
                            </>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {tipo === 'defeito' && (
                    <div className="dv-info">
                      {fotosPreenchidas} de {slotsFoto} foto(s). A foto ajuda a Produção a avaliar o defeito sem precisar da peça em mãos.
                    </div>
                  )}

                  {erro && <div className="dv-erro">{erro}</div>}
                  <div style={{ marginTop: 16 }}>
                    <button type="submit" className="dv-btn primary" disabled={!podeEnviar}>
                      {enviando ? 'Enviando fotos e registrando…' : 'Registrar devolução'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
        <p className="dv-foot">Crosby · dúvidas? fale com o seu vendedor.</p>
      </div>
    </div>
  );
}
