// LP BlueCard com captura de indicação — variação do CrosbyForm que lê
// ?indicado_por=NOME da URL (ou ?utm_source=NOME) e envia ao backend.
// O nome do indicado aparece como badge na frente do lead na lista admin.
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/constants";
import "./crosby.css";

function useResetBodyForLp() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.cssText, body: body.style.cssText, bodyClass: body.className };
    body.style.cssText += ";display:block !important;align-items:flex-start !important;justify-content:flex-start !important;height:auto !important;min-height:100vh !important;background:transparent !important;overflow-x:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif !important;";
    html.style.height = "auto";
    return () => {
      body.style.cssText = prev.body;
      html.style.cssText = prev.html;
      body.className = prev.bodyClass;
    };
  }, []);
}

const FIELDS = [
  { name: "nome", label: "Nome e Sobrenome*", type: "text", placeholder: "Digite seu nome e sobrenome*", required: true },
  { name: "whatsapp", label: "Whatsapp*", type: "tel", placeholder: "Digite seu whatsapp*", required: true },
  { name: "email", label: "Email*", type: "email", placeholder: "Digite seu melhor email*", required: true },
  { name: "cpf", label: "CPF*", type: "text", placeholder: "CPF (Para gerar a NF do produto)*", required: true },
  { name: "empresa", label: "Nome da empresa, profissão ou négocio*", type: "text", placeholder: "Informe o nome ex: Advogado", required: true },
  { name: "instagram", label: "Instagram*", type: "text", placeholder: "Digite seu instagram @exemplo*", required: true },
  { name: "nascimento", label: "Data de nascimento*", type: "text", placeholder: "Digite sua Data de Nascimento (só dígitos)*", required: true },
  { name: "cep", label: "CEP*", type: "text", placeholder: "Digite seu CEP*", required: true },
  { name: "endereco", label: "Endereço*", type: "text", placeholder: "Digite nome da rua (Rua exemplo)*", required: true },
  { name: "numero", label: "Nº*", type: "text", placeholder: "Digite APENAS números*", required: true },
  { name: "complemento", label: "Complemento*", type: "text", placeholder: "Apto, Bloco, Bairro*", required: true },
];

export default function CrosbyFormIndicacao() {
  useResetBodyForLp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Lê quem indicou da URL. Aceita várias variações:
  //   ?indicado_por=Fulano
  //   ?utm_source=Fulano
  //   ?utm_content=Fulano
  //   ?ref=Fulano
  const indicadoPor = useMemo(() => {
    const raw = (
      searchParams.get("indicado_por") ||
      searchParams.get("utm_source") ||
      searchParams.get("utm_content") ||
      searchParams.get("ref") ||
      ""
    ).trim();
    // Capitaliza primeira letra de cada palavra: "joao silva" → "Joao Silva"
    return raw
      .replace(/[+_]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    const payload = {
      nome: raw.nome,
      whatsapp: raw.whatsapp,
      email: raw.email,
      cpf: raw.cpf,
      empresa: raw.empresa,
      instagram: raw.instagram,
      data_nasc: raw.nascimento,
      cep: raw.cep,
      endereco: raw.endereco,
      numero: raw.numero,
      complemento: raw.complemento,
      // Quem indicou (capturado da URL)
      indicado_por: indicadoPor || undefined,
      // Marca a origem como indicação pra diferenciar de leads orgânicos da LP principal
      origem: indicadoPor ? "lp_bluecard_indicacao" : "lp_bluecard",
    };
    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/bluecard/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Erro ${r.status}`);
      navigate("/lp/bluecard/obrigado");
    } catch (err) {
      setErro(err.message || "Falha ao enviar. Tenta de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="crosby-page">
      <header className="cb-header">
        <img src="/logo-crosby.png" alt="CROSBY" className="cb-brand" />
      </header>

      <main className="cb-container">
        <section className="cb-intro">
          {/* Selo de indicação — estilo editorial, sem pill, integrado ao layout */}
          {indicadoPor && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 24,
                lineHeight: 1.1,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 2.5,
                  textTransform: "uppercase",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 1,
                    background: "linear-gradient(90deg, transparent 0%, #c9a86a 100%)",
                  }}
                />
                <span>Indicação especial</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 24,
                    height: 1,
                    background: "linear-gradient(90deg, #c9a86a 0%, transparent 100%)",
                  }}
                />
              </div>
              <div
                style={{
                  color: "#e6c992",
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: 0.3,
                  fontStyle: "italic",
                  textShadow: "0 1px 14px rgba(201,168,106,0.25)",
                }}
              >
                {indicadoPor}
              </div>
            </div>
          )}

          <h1>
            GRANDES NOMES DO BRASIL:
            <br />
            Um reconhecimento para quem faz a diferença!
          </h1>
          <p>
            A Crosby criou a ação Grandes Nomes do Brasil para reconhecer
            pessoas que inspiram e movimentam nossa região.
          </p>
          <p>
            Este convite é um gesto de reconhecimento pelo seu trabalho e pela
            contribuição que você tem dado ao empreendedorismo. Como forma de
            agradecimento, <strong>QUEREMOS TE PRESENTEAR</strong> com um{" "}
            <strong>CARTÃO EXCLUSIVO</strong> Crosby para viver essa experiência
            com a gente.
          </p>
        </section>

        <section className="cb-form-card">
          <form onSubmit={handleSubmit}>
            {FIELDS.map((f) => (
              <div className="cb-field" key={f.name}>
                <label htmlFor={f.name}>{f.label}</label>
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type}
                  placeholder={f.placeholder}
                  required={f.required}
                />
              </div>
            ))}
            {erro && (
              <div style={{ background: "rgba(214,18,42,0.15)", border: "1px solid rgba(214,18,42,0.4)", color: "#ffd0d0", padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
                {erro}
              </div>
            )}
            <button type="submit" className="cb-submit" disabled={enviando} style={enviando ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </form>
        </section>
      </main>

      <footer className="cb-footer">
        <div className="cb-footer-inner">
          <div className="cb-footer-left">
            <img src="/logo-crosby.png" alt="CROSBY" className="cb-brand cb-brand--footer" />
            <div className="cb-copy">© 2026 Crosby. Todos os direitos reservados</div>
          </div>
          <div className="cb-footer-right">
            <div className="cb-socials">
              <a href="https://www.facebook.com/crosbyoficial/?locale=pt_BR" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5v1.8H16l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z" /></svg>
              </a>
              <a href="https://www.instagram.com/crosbyoficial/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-.9 0-1.4.2-1.7.3-.4.2-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.8-.3 1.7-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c0 .9.2 1.4.3 1.7.2.4.4.7.7 1 .3.3.6.5 1 .7.3.1.8.3 1.7.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.8.3-1.7.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-.9-.2-1.4-.3-1.7-.2-.4-.4-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.8-.3-1.7-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.2-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0z" /></svg>
              </a>
              <a href="https://www.youtube.com/c/crosbyoficial/about" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24"><path d="M23 12s0-3.2-.4-4.7c-.2-.8-.9-1.5-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4c-.8.2-1.5.9-1.7 1.7C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.8.9 1.5 1.7 1.7 1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4c.8-.2 1.5-.9 1.7-1.7.4-1.5.4-4.7.4-4.7zM9.8 15.3V8.7l6 3.3-6 3.3z" /></svg>
              </a>
              <a href="https://www.linkedin.com/company/crosbyoficial/?originalSubdomain=br" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm6 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9V9z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
