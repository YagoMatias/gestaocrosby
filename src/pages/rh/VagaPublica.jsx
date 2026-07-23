// LP pública de uma vaga — /vagas/:slug
// Mesmo formato imersivo da LP BlueCard (/lp/bluecard): fundo com foto da loja
// + overlay navy, conteúdo à esquerda e formulário à direita.
// Envia multipart para POST /api/vagas/inscricoes.
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config/constants';

// Neutraliza o body global do app (flex/center/font-barlow) enquanto a LP
// estiver montada — mesma técnica das LPs BlueCard.
function useResetBodyForLp() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.cssText, body: body.style.cssText, bodyClass: body.className };
    body.style.cssText +=
      ";display:block !important;align-items:flex-start !important;justify-content:flex-start !important;height:auto !important;min-height:100vh !important;background:#0a1a4f !important;overflow-x:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif !important;";
    html.style.height = 'auto';
    return () => {
      body.style.cssText = prev.body;
      html.style.cssText = prev.html;
      body.className = prev.bodyClass;
    };
  }, []);
}

// Foto de fundo da LP (coloque o arquivo em public/). Se não existir, o navy
// sólido assume — a página continua íntegra.
const BG_IMG = '/loja-crosby.jpeg';

const CSS = `
.vp,.vp *{box-sizing:border-box}
.vp{
  --navy:#0a1a4f;--red:#d6122a;--red-hover:#b50f23;
  --input-border:#d6d6d6;--placeholder:#9aa0ab;--muted:#c7cee0;
  font-family:"Segoe UI",Arial,Helvetica,sans-serif;
  background:var(--navy);
  color:#fff;line-height:1.5;min-height:100vh;display:flex;flex-direction:column;
  position:relative;isolation:isolate;
}
/* Foto da loja como pano de fundo. O leve blur disfarça a ampliação da imagem
   (789px de origem) e dá profundidade; o overlay garante legibilidade. */
.vp::before{content:"";position:fixed;inset:-24px;background:url('${BG_IMG}') center 38% / cover no-repeat;filter:blur(2px);z-index:-2}
.vp::after{content:"";position:fixed;inset:0;background:linear-gradient(rgba(8,12,24,.58),rgba(8,12,24,.78));z-index:-1}
.vp h1,.vp h2,.vp h3,.vp p{margin:0}
.vp-brand{height:34px;width:auto;display:block}
.vp-brand--footer{height:30px}

/* HEADER */
.vp-header{background:var(--navy);padding:26px 0;display:flex;justify-content:center;align-items:center}

/* CONTAINER 2 colunas (igual BlueCard) */
.vp-container{max-width:1280px;margin:0 auto;width:100%;padding:70px 40px 90px;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;flex:1}

/* COLUNA ESQUERDA — vaga */
.vp-eyebrow{display:inline-flex;align-items:center;gap:12px;color:#fff;font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;margin-bottom:20px}
.vp-eyebrow::before{content:"";width:28px;height:3px;background:var(--red);display:inline-block}
.vp-intro h1{font-size:52px;line-height:1.06;font-weight:800;text-transform:uppercase;margin-bottom:24px;color:#fff}
.vp-meta{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:30px}
.vp-meta span{border:1px solid rgba(255,255,255,.32);padding:8px 15px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#fff}
.vp-sec{margin-bottom:22px}
.vp-sec h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#fff;margin-bottom:8px;display:flex;align-items:center;gap:10px}
.vp-sec h2::before{content:"";width:18px;height:3px;background:var(--red);display:inline-block}
.vp-sec p{font-size:17px;color:#eef1f7;white-space:pre-line}

/* COLUNA DIREITA — formulário (card navy) */
.vp-form-card{background:var(--navy)!important;border-radius:16px!important;padding:34px 32px!important;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.vp-form-card form{display:block!important;background:transparent!important;padding:0!important;margin:0!important;border-radius:0!important;box-shadow:none!important;border:none!important}
.vp-form-card h2{font-size:24px;font-weight:800;text-transform:uppercase;color:#fff;margin-bottom:6px}
.vp-form-card .sub{font-size:14px;color:var(--muted);margin-bottom:22px}
.vp-req{color:#ff6b7a}
.vp-field{margin-bottom:18px!important}
.vp-field label{display:block!important;font-size:15px!important;color:#fff!important;margin-bottom:8px!important;font-weight:500!important;font-family:inherit!important;text-transform:none!important;letter-spacing:0!important}
.vp-field input,.vp-field input[type],.vp-field select{
  appearance:none!important;-webkit-appearance:none!important;box-shadow:none!important;background-image:none!important;
  margin:0!important;display:block!important;width:100%!important;background:#fff!important;
  border:1px solid var(--input-border)!important;border-radius:8px!important;padding:14px 16px!important;
  color:#333!important;font-size:16px!important;line-height:normal!important;font-family:inherit!important;
  font-weight:400!important;height:auto!important;min-height:0!important;outline:none;letter-spacing:0!important;
}
.vp-field input::placeholder{color:var(--placeholder)!important;opacity:1!important}
.vp-field input:focus,.vp-field select:focus{outline:2px solid #4f74d6!important;outline-offset:0!important}
.vp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.vp-tel{display:flex}
.vp-tel .ddi{display:flex;align-items:center;padding:0 12px;border:1px solid var(--input-border);border-right:none;border-radius:8px 0 0 8px;background:#eef0f5;font-size:15px;color:#5a6472;white-space:nowrap}
.vp-tel input{border-radius:0 8px 8px 0!important}

/* Upload */
.vp-upload{border:2px dashed rgba(255,255,255,.38);border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:rgba(255,255,255,.06);transition:border-color .15s,background .15s;display:block}
.vp-upload:hover,.vp-upload.drag{border-color:var(--red);background:rgba(214,18,42,.12)}
.vp-upload .ic{font-size:24px}
.vp-upload p{margin-top:6px;font-size:13.5px;color:var(--muted)}
.vp-upload .arq{display:block;margin-top:8px;font-weight:700;font-size:14px;color:#fff}
.vp-upload input{display:none!important}

.vp-consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--muted);line-height:1.45}
.vp-consent input[type=checkbox]{width:18px!important;height:18px!important;margin-top:2px!important;flex-shrink:0;accent-color:var(--red);padding:0!important;border-radius:4px!important}

.vp-submit{appearance:none!important;display:block!important;width:100%!important;background:var(--red)!important;color:#fff!important;border:none!important;border-radius:8px!important;padding:17px!important;font-size:17px!important;font-weight:700!important;font-family:inherit!important;line-height:1.2!important;cursor:pointer;margin-top:10px!important;transition:background .15s ease!important;box-shadow:none!important}
.vp-submit:hover{background:var(--red-hover)!important}
.vp-submit:disabled{opacity:.6!important;cursor:not-allowed!important}
.vp-erro{background:rgba(214,18,42,.15);border:1px solid rgba(214,18,42,.45);color:#ffd0d0;padding:10px 12px;border-radius:8px;font-size:14px;margin-bottom:14px}

/* SUCESSO */
.vp-ok{text-align:center;padding:8px 0}
.vp-ok .check{width:76px;height:76px;border-radius:50%;background:var(--red);color:#fff;font-size:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.vp-ok h2{font-size:26px;font-weight:800;text-transform:uppercase;color:#fff;margin-bottom:12px}
.vp-ok p{color:var(--muted);font-size:16px}
.vp-ok p strong{color:#fff}

/* FOOTER */
.vp-footer{background:var(--navy);padding:40px 40px 28px}
.vp-footer-inner{max-width:1280px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:24px}
.vp-copy{color:#c9d2e8;font-size:14px;margin-top:16px}
.vp-socials{display:flex;gap:22px}
.vp-socials a{color:#fff;opacity:.9}
.vp-socials a:hover{opacity:1}
.vp-socials svg{width:24px;height:24px;fill:currentColor}

/* ESTADOS */
.vp-state{flex:1;max-width:900px;margin:0 auto;text-align:center;padding:110px 40px;display:flex;flex-direction:column;justify-content:center}
.vp-state h1{font-size:clamp(34px,6vw,68px);font-weight:800;text-transform:uppercase;color:#fff;margin-bottom:20px;line-height:1.05}
.vp-state p{color:var(--muted);font-size:18px}
.vp-state .bar{width:52px;height:4px;background:var(--red);margin:0 auto 26px}

@media(max-width:900px){
  .vp-container{grid-template-columns:1fr;gap:44px;padding:44px 22px 60px}
  .vp-intro h1{font-size:34px}
  .vp-sec p{font-size:15.5px}
  .vp-form-card{padding:26px 22px!important}
  .vp-footer{padding:32px 22px 24px}
  .vp-footer-inner{flex-direction:column;align-items:flex-start}
}
@media(max-width:520px){.vp-grid2{grid-template-columns:1fr}}
`;

function maskTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 0) return `(${d}`;
  return '';
}

function Rodape() {
  return (
    <footer className="vp-footer">
      <div className="vp-footer-inner">
        <div>
          <img src="/logo-crosby.png" alt="CROSBY" className="vp-brand vp-brand--footer" />
          <div className="vp-copy">© {new Date().getFullYear()} Crosby. Todos os direitos reservados</div>
        </div>
        <div className="vp-socials">
          <a href="https://www.facebook.com/crosbyoficial/?locale=pt_BR" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5v1.8H16l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z" /></svg>
          </a>
          <a href="https://www.instagram.com/crosbyoficial/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-.9 0-1.4.2-1.7.3-.4.2-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.8-.3 1.7-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c0 .9.2 1.4.3 1.7.2.4.4.7.7 1 .3.3.6.5 1 .7.3.1.8.3 1.7.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.8.3-1.7.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-.9-.2-1.4-.3-1.7-.2-.4-.4-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.8-.3-1.7-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.2-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0z" /></svg>
          </a>
          <a href="https://www.linkedin.com/company/crosbyoficial/?originalSubdomain=br" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm6 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9V9z" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function VagaPublica() {
  useResetBodyForLp();
  const { slug } = useParams();
  const [vaga, setVaga] = useState(null);
  const [estado, setEstado] = useState('loading'); // loading | ok | notfound
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [tel, setTel] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/vagas/publica/${slug}`);
        const j = await r.json();
        if (!vivo) return;
        if (r.ok && j?.success) {
          setVaga(j.data);
          setEstado('ok');
        } else {
          setEstado('notfound');
        }
      } catch {
        if (vivo) setEstado('notfound');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [slug]);

  // Título da aba/compartilhamento — a LP é pública, não pode herdar o
  // "HEADCOACH CROSBY" do painel.
  useEffect(() => {
    const anterior = document.title;
    document.title = vaga?.titulo
      ? `${vaga.titulo} | Trabalhe na Crosby`
      : 'Vagas | Trabalhe na Crosby';
    return () => {
      document.title = anterior;
    };
  }, [vaga]);

  const onDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag');
    const f = e.dataTransfer.files?.[0];
    if (f) setArquivo(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const fd = new FormData(e.currentTarget);
    if (!fd.get('nome')?.toString().trim()) return setErro('Informe o seu nome.');
    if (!fd.get('lgpd')) return setErro('É preciso aceitar o uso dos seus dados (LGPD).');
    if (!arquivo) return setErro('Anexe o seu currículo.');

    const payload = new FormData();
    payload.append('vaga_slug', vaga.slug);
    payload.append('vaga_id', vaga.id);
    payload.append('nome', fd.get('nome'));
    payload.append('email', fd.get('email') || '');
    payload.append('telefone', tel);
    payload.append('cargo', vaga.cargo || vaga.titulo || '');
    payload.append('cidade', vaga.cidade || '');
    payload.append('estado', vaga.estado || '');
    payload.append('indicacao', indicacao || 'Não');
    payload.append('indicado_por', fd.get('indicado_por') || '');
    payload.append('curriculo', arquivo);

    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/vagas/inscricoes`, {
        method: 'POST',
        body: payload,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.message || `Erro ${r.status}`);
      setEnviado(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErro(err.message || 'Falha ao enviar. Tente novamente.');
      setEnviando(false);
    }
  };

  if (estado === 'loading') {
    return (
      <div className="vp">
        <style>{CSS}</style>
        <header className="vp-header"><img src="/logo-crosby.png" alt="CROSBY" className="vp-brand" /></header>
        <div className="vp-state"><div className="bar" /><p>Carregando vaga…</p></div>
      </div>
    );
  }

  if (estado === 'notfound') {
    return (
      <div className="vp">
        <style>{CSS}</style>
        <header className="vp-header"><img src="/logo-crosby.png" alt="CROSBY" className="vp-brand" /></header>
        <div className="vp-state">
          <div className="bar" />
          <h1>Vaga encerrada</h1>
          <p>Esta vaga não existe mais ou as inscrições foram encerradas. Fique de olho nas nossas redes para novas oportunidades na Crosby!</p>
        </div>
        <Rodape />
      </div>
    );
  }

  const local = [vaga.cidade, vaga.estado].filter(Boolean).join(' / ');

  return (
    <div className="vp">
      <style>{CSS}</style>

      <header className="vp-header">
        <img src="/logo-crosby.png" alt="CROSBY" className="vp-brand" />
      </header>

      <main className="vp-container">
        {/* Coluna esquerda — a vaga */}
        <section className="vp-intro">
          <span className="vp-eyebrow">Vaga aberta</span>
          <h1>{vaga.titulo}</h1>
          <div className="vp-meta">
            {vaga.cargo && <span>{vaga.cargo}</span>}
            {local && <span>{local}</span>}
            {vaga.tipo_contratacao && <span>{vaga.tipo_contratacao}</span>}
          </div>
          {vaga.descricao && (
            <div className="vp-sec"><h2>Sobre a vaga</h2><p>{vaga.descricao}</p></div>
          )}
          {vaga.requisitos && (
            <div className="vp-sec"><h2>Requisitos</h2><p>{vaga.requisitos}</p></div>
          )}
          {vaga.beneficios && (
            <div className="vp-sec"><h2>Benefícios</h2><p>{vaga.beneficios}</p></div>
          )}
        </section>

        {/* Coluna direita — formulário */}
        <section className="vp-form-card">
          {enviado ? (
            <div className="vp-ok">
              <div className="check">✓</div>
              <h2>Candidatura enviada!</h2>
              <p>
                Recebemos o seu currículo para a vaga <strong>{vaga.titulo}</strong>. Se o seu
                perfil combinar, o nosso time de RH entra em contato. Obrigado por querer fazer
                parte da Crosby!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2>Quero me candidatar</h2>
              <p className="sub">Preencha os campos abaixo. Itens com <span className="vp-req">*</span> são obrigatórios.</p>

              {erro && <div className="vp-erro">{erro}</div>}

              <div className="vp-field">
                <label>Seu nome <span className="vp-req">*</span></label>
                <input type="text" name="nome" placeholder="Nome completo" required />
              </div>

              <div className="vp-field">
                <label>Seu melhor e-mail <span className="vp-req">*</span></label>
                <input type="email" name="email" placeholder="voce@email.com" required />
              </div>

              <div className="vp-field">
                <label>Telefone / WhatsApp <span className="vp-req">*</span></label>
                <div className="vp-tel">
                  <span className="ddi">🇧🇷 +55</span>
                  <input
                    type="tel"
                    name="telefone"
                    placeholder="(00) 00000-0000"
                    value={tel}
                    onChange={(e) => setTel(maskTelefone(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="vp-field">
                <label>Houve indicação para esta vaga? <span className="vp-req">*</span></label>
                <select value={indicacao} onChange={(e) => setIndicacao(e.target.value)} required>
                  <option value="">Selecionar opção…</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              {indicacao === 'Sim' && (
                <div className="vp-field">
                  <label>Quem indicou você?</label>
                  <input type="text" name="indicado_por" placeholder="Nome de quem te indicou" />
                </div>
              )}

              <div className="vp-field">
                <label>Anexe o seu currículo <span className="vp-req">*</span></label>
                <label
                  className="vp-upload"
                  ref={dropRef}
                  onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drag'); }}
                  onDragLeave={() => dropRef.current?.classList.remove('drag')}
                  onDrop={onDrop}
                >
                  <div className="ic">📎</div>
                  <p><strong>Clique para selecionar</strong> ou arraste aqui</p>
                  <p style={{ fontSize: 12 }}>PDF, DOC ou DOCX — até 10&nbsp;MB</p>
                  {arquivo && <span className="arq">✓ {arquivo.name}</span>}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="vp-field vp-consent">
                <input type="checkbox" name="lgpd" id="lgpd" />
                <label htmlFor="lgpd" style={{ fontWeight: 400, margin: 0, fontSize: 13, color: 'inherit' }}>
                  Autorizo a Crosby a armazenar e utilizar os meus dados para fins de recrutamento
                  e seleção, conforme a LGPD. <span className="vp-req">*</span>
                </label>
              </div>

              <button type="submit" className="vp-submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar candidatura'}
              </button>
            </form>
          )}
        </section>
      </main>

      <Rodape />
    </div>
  );
}
