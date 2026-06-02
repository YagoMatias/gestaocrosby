import { useEffect } from "react";
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

export default function CrosbyObrigado() {
  useResetBodyForLp();
  return (
    <div className="crosby-page">
      {/* Header */}
      <header className="cb-header">
        <img src="/logo-crosby.png" alt="CROSBY" className="cb-brand" />
      </header>

      {/* Main */}
      <main className="cb-thanks-container">
        <section className="cb-thanks">
          <h1>Obrigado por participar da nossa ação!</h1>

          <p>
            Seu <strong>cadastro foi realizado com sucesso.</strong> Em breve
            você receberá seu <strong>Cartão Crosby</strong> para viver essa
            experiência com a gente.
          </p>

          <p>
            Fique de olho no seu WhatsApp, pois vamos te enviar todas as
            instruções de como retirar e usar o seu cartão. A Crosby tem{" "}
            <strong>orgulho em reconhecer pessoas como você</strong> que fazem a
            diferença.
          </p>

          <p className="cb-big">
            Nos vemos <strong>em breve</strong> em uma de nossas lojas!
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="cb-footer cb-footer--thanks">
        <div className="cb-footer-inner cb-footer-inner--thanks">
          <h2>Siga Nosso Perfil no Instagram</h2>
          <a
            href="https://www.instagram.com/crosbyoficial/"
            target="_blank"
            rel="noopener noreferrer"
            className="cb-follow"
          >
            Seguir
          </a>
        </div>
      </footer>
    </div>
  );
}
