// Modal reusável: captura a card via html2canvas e envia imagem via crosbybot
import React, { useState, useEffect } from 'react';
import { X, WhatsappLogo, CheckCircle, PaperPlaneTilt, Image as ImageIcon } from '@phosphor-icons/react';
import html2canvas from 'html2canvas';
import { API_BASE_URL } from '../../config/constants';

const STORAGE_KEY = 'forecast_whatsapp_phone';

function maskPhone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// targetRef: ref do elemento a capturar como imagem
// tipo: identificador do relatório (caption)
// titulo: nome amigável que aparece no modal + caption
export default function EnviarWhatsappModal({ targetRef, tipo, titulo, params = {}, onClose }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPhone(maskPhone(saved));
    } catch {}
  }, []);

  // Captura a card como PNG base64
  // O modal está em cima da card — usamos `ignoreElements` pra excluí-lo da captura
  useEffect(() => {
    let cancelled = false;
    async function snap() {
      if (!targetRef?.current) return;
      // Pequeno delay pra garantir que o DOM acabou de pintar com o modal visível
      await new Promise((r) => setTimeout(r, 80));
      try {
        const canvas = await html2canvas(targetRef.current, {
          backgroundColor: '#ffffff',
          scale: 1.5,
          useCORS: true,
          logging: false,
          ignoreElements: (el) =>
            el?.getAttribute && el.getAttribute('data-h2c-ignore') === 'true',
        });
        if (cancelled) return;
        const dataUrl = canvas.toDataURL('image/png');
        setPreview(dataUrl);
      } catch (e) {
        if (!cancelled) setErro(`Falha ao capturar imagem: ${e.message}`);
      }
    }
    snap();
    return () => { cancelled = true; };
  }, [targetRef]);

  const submit = async (e) => {
    e?.preventDefault();
    setErro('');
    setOk(false);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setErro('Telefone inválido. Use formato (DDD) número.');
      return;
    }
    if (!preview) {
      setErro('Imagem ainda não capturada — aguarde alguns segundos.');
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/forecast/send-whatsapp-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          image: preview,
          caption: titulo || tipo || 'Relatório Crosby',
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.message || 'Erro');
      try { localStorage.setItem(STORAGE_KEY, digits); } catch {}
      setOk(true);
      setTimeout(() => onClose && onClose(), 1500);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-h2c-ignore="true"
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <WhatsappLogo size={22} className="text-emerald-600" weight="fill" />
            <h3 className="text-lg font-bold text-gray-800">Enviar via WhatsApp</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Envio de <strong>{titulo}</strong> como imagem via <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">crosbybot</code>.
        </p>

        {/* Preview da imagem capturada */}
        <div className="mb-3 bg-gray-50 border border-gray-200 rounded p-2">
          <p className="text-[10px] text-gray-500 uppercase mb-1 flex items-center gap-1">
            <ImageIcon size={10} /> Preview
          </p>
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-60 object-contain border border-gray-200 rounded"
            />
          ) : (
            <p className="text-xs text-gray-400 italic">Capturando imagem...</p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Telefone (com DDD)</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              autoFocus
            />
            <p className="text-[10px] text-gray-500 mt-1">DDI 55 (Brasil) é adicionado automático.</p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{erro}</div>
          )}
          {ok && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-sm inline-flex items-center gap-1">
              <CheckCircle size={14} weight="fill" /> Mensagem enviada!
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending || ok || !preview}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <PaperPlaneTilt size={14} weight="bold" />
              {sending ? 'Enviando...' : ok ? 'Enviado' : 'Enviar imagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
