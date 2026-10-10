// Configuração da potência de leitura do portal RFID (Chainway UR4).
// Lê a potência atual de cada antena e grava a nova — por antena ou a mesma
// em todas. Potência maior lê mais longe (e pega peça fora do portal);
// potência menor restringe a leitura ao que está passando.
// Usado nas páginas Portal RFID, Orçamento RFID e Devolução RFID.
import React, { useCallback, useEffect, useState } from 'react';
import { X, Spinner, WifiHigh, ArrowsClockwise, CheckCircle, Warning, Lightning } from '@phosphor-icons/react';
import { portalGetPower, portalSetPower } from '../utils/portalApi';

const PRESETS = [
  { label: 'Curto', valor: 12, dica: 'só a peça dentro do portal' },
  { label: 'Médio', valor: 20, dica: 'equilíbrio' },
  { label: 'Longo', valor: 26, dica: 'caixas e volumes' },
  { label: 'Máximo', valor: 30, dica: 'alcance total' },
];

export default function PortalPotenciaModal({ onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [faixa, setFaixa] = useState({ min: 5, max: 30 });
  const [atual, setAtual] = useState([]); // gravado no portal
  const [valores, setValores] = useState({}); // ant → dBm em edição
  const [igual, setIgual] = useState(true); // mesma potência em todas

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    setOk('');
    try {
      const d = await portalGetPower();
      setAtual(d.antenas || []);
      setFaixa({ min: d.min ?? 5, max: d.max ?? 30 });
      setValores(Object.fromEntries((d.antenas || []).map((a) => [a.ant, a.leitura])));
      const distintas = new Set((d.antenas || []).map((a) => a.leitura));
      setIgual(distintas.size <= 1);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const definir = (ant, v) => {
    const n = Math.max(faixa.min, Math.min(faixa.max, Number(v) || faixa.min));
    setValores((prev) => (igual ? Object.fromEntries(Object.keys(prev).map((k) => [k, n])) : { ...prev, [ant]: n }));
  };

  const aplicarPreset = (v) => setValores((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, v])));

  const mudou = atual.some((a) => Number(valores[a.ant]) !== Number(a.leitura));

  const salvar = async () => {
    setSaving(true);
    setErro('');
    setOk('');
    try {
      const d = await portalSetPower({
        antenas: atual.map((a) => ({ ant: a.ant, potencia: Number(valores[a.ant]) })),
      });
      setAtual(d.antenas || []);
      setValores(Object.fromEntries((d.antenas || []).map((a) => [a.ant, a.leitura])));
      setOk('Potência gravada no portal');
      onSaved?.(d);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pct = (v) => ((Number(v) - faixa.min) / (faixa.max - faixa.min)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-[#000638] inline-flex items-center gap-1.5">
            <WifiHigh size={18} weight="bold" /> Potência do portal
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} weight="bold" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          Mais potência lê mais longe e pode pegar peças fora do portal. Menos potência restringe a leitura ao que está
          passando. A leitura pausa por um instante enquanto grava.
        </p>

        {loading ? (
          <div className="py-10 text-center text-gray-400">
            <Spinner size={22} className="animate-spin mx-auto" />
            <p className="text-xs mt-2">Consultando o portal…</p>
          </div>
        ) : atual.length === 0 ? (
          <div className="py-4">
            <p className="text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 ring-1 ring-rose-200 inline-flex gap-1.5">
              <Warning size={14} weight="bold" className="shrink-0 mt-0.5" />
              <span>{erro || 'O portal não informou nenhuma antena.'}</span>
            </p>
            <button
              onClick={carregar}
              className="mt-3 w-full h-9 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
            >
              <ArrowsClockwise size={13} /> Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => aplicarPreset(p.valor)}
                  title={`${p.valor} dBm — ${p.dica}`}
                  className={`rounded-lg py-1.5 text-center ring-1 transition-colors ${
                    atual.every((a) => Number(valores[a.ant]) === p.valor)
                      ? 'bg-[#000638] text-white ring-[#000638]'
                      : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-xs font-bold">{p.label}</span>
                  <span className="block text-[10px] opacity-70">{p.valor} dBm</span>
                </button>
              ))}
            </div>

            <label className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#000638] select-none cursor-pointer">
              <input
                type="checkbox"
                checked={igual}
                onChange={(e) => {
                  setIgual(e.target.checked);
                  if (e.target.checked) aplicarPreset(Number(valores[atual[0].ant]));
                }}
                className="w-4 h-4 p-0 mb-0 accent-[#000638]"
              />
              Mesma potência em todas as antenas
            </label>

            <div className="space-y-2.5">
              {(igual ? atual.slice(0, 1) : atual).map((a) => {
                const v = Number(valores[a.ant]);
                const alterado = igual ? mudou : v !== Number(a.leitura);
                return (
                  <div key={a.ant} className="rounded-xl ring-1 ring-gray-200 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600 inline-flex items-center gap-1">
                        <Lightning size={12} weight="bold" className="text-amber-500" />
                        {igual ? `Todas as antenas (${atual.length})` : `Antena ${a.ant}`}
                      </span>
                      <span className="text-sm font-bold text-[#000638] tabular-nums">
                        {v} dBm
                        {alterado && (
                          <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                            era {igual ? [...new Set(atual.map((x) => x.leitura))].join(' / ') : a.leitura}
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={faixa.min}
                      max={faixa.max}
                      step="1"
                      value={v}
                      onChange={(e) => definir(a.ant, e.target.value)}
                      className="w-full p-0 mb-0 border-0 accent-[#000638]"
                      style={{ background: `linear-gradient(90deg,#000638 ${pct(v)}%,#e5e7eb ${pct(v)}%)`, height: 6, borderRadius: 999, appearance: 'none' }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>{faixa.min} dBm · perto</span>
                      <span>{faixa.max} dBm · longe</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {erro && (
              <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200 inline-flex items-start gap-1">
                <Warning size={13} weight="bold" className="shrink-0 mt-0.5" /> {erro}
              </p>
            )}
            {ok && (
              <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5 ring-1 ring-emerald-200 inline-flex items-center gap-1">
                <CheckCircle size={13} weight="bold" /> {ok}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={salvar}
                disabled={saving || !mudou}
                className="flex-1 h-10 rounded-xl bg-[#000638] text-white text-sm font-bold hover:bg-[#000638]/90 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Spinner size={15} className="animate-spin" /> Gravando…
                  </>
                ) : (
                  'Gravar no portal'
                )}
              </button>
              <button
                onClick={carregar}
                disabled={saving}
                className="h-10 px-3 rounded-xl text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
                title="Ler de novo do portal"
              >
                <ArrowsClockwise size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
